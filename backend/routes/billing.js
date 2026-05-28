const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY non configurée');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Calcul de la période (basé sur created_at de l'entreprise)
function getPeriodInfo(createdAt) {
  const daysSinceSignup = Math.floor((Date.now() - new Date(createdAt)) / 86400000);
  return {
    daysSinceSignup,
    isTrialing: daysSinceSignup < 30,           // mois 1 : gratuit
    isMandatory: daysSinceSignup >= 30 && daysSinceSignup < 90, // mois 2-3 : obligatoires
    canCancel: daysSinceSignup >= 90,            // mois 4+ : résiliable
    daysUntilCanCancel: Math.max(0, 90 - daysSinceSignup),
    trialEndsIn: Math.max(0, 30 - daysSinceSignup),
  };
}

// ─── GET statut abonnement ────────────────────────────────────────────────────
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    if (!company) return res.status(404).json({ error: 'Entreprise non trouvée' });

    const period = getPeriodInfo(company.created_at);

    let stripeData = null;
    if (company.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        stripeData = {
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        };
      } catch { /* subscription non trouvée dans Stripe */ }
    }

    res.json({
      plan: company.plan,
      plan_status: company.plan_status,
      trial_ends_at: company.trial_ends_at,
      cancel_at: company.cancel_at,
      created_at: company.created_at,
      stripe: stripeData,
      period,
      price_monthly: 79,
      currency: 'EUR',
      // Résumé lisible
      phase:
        period.isTrialing ? 'trial' :
        period.isMandatory ? 'mandatory' :
        'flexible',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST résilier (admin seulement) ─────────────────────────────────────────
router.post('/cancel', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    if (!company) return res.status(404).json({ error: 'Entreprise non trouvée' });

    const { canCancel, daysUntilCanCancel } = getPeriodInfo(company.created_at);
    if (!canCancel) {
      return res.status(400).json({
        error: `Résiliation impossible pendant la période d'engagement obligatoire. Disponible dans ${daysUntilCanCancel} jour(s).`,
        days_until_can_cancel: daysUntilCanCancel,
      });
    }

    if (company.cancel_at) {
      return res.status(400).json({ error: 'Une résiliation est déjà planifiée.' });
    }

    // Préavis 30 jours
    const cancelAtTs = Date.now() + 30 * 86400000;
    const cancelAt = new Date(cancelAtTs).toISOString();

    if (company.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      await stripe.subscriptions.update(company.stripe_subscription_id, {
        cancel_at: Math.floor(cancelAtTs / 1000),
      });
    }

    await db.run('UPDATE companies SET cancel_at = ? WHERE id = ?', [cancelAt, req.user.companyId]);
    res.json({ success: true, cancel_at: cancelAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST annuler la résiliation ─────────────────────────────────────────────
router.post('/reactivate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    if (!company?.cancel_at) return res.status(400).json({ error: 'Aucune résiliation planifiée' });

    if (company.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      await stripe.subscriptions.update(company.stripe_subscription_id, { cancel_at: null });
    }

    await db.run('UPDATE companies SET cancel_at = NULL WHERE id = ?', [req.user.companyId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST Stripe webhook ──────────────────────────────────────────────────────
// Nota : ce handler reçoit req.body en Buffer brut (voir server.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Stripe non configuré' });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('[Webhook] Signature invalide :', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'customer.subscription.trial_will_end':
        // Notif 3 jours avant fin de l'essai — rien à faire côté DB
        console.log('[Billing] Essai se termine bientôt pour', obj.customer);
        break;

      case 'customer.subscription.updated':
        await db.run(
          'UPDATE companies SET plan_status = ?, stripe_subscription_id = ? WHERE stripe_customer_id = ?',
          [obj.status, obj.id, obj.customer]
        );
        // Si cancel_at mis à 0 depuis Stripe (réactivation) : nettoyer notre DB
        if (!obj.cancel_at) {
          await db.run('UPDATE companies SET cancel_at = NULL WHERE stripe_customer_id = ?', [obj.customer]);
        }
        break;

      case 'customer.subscription.deleted':
        await db.run(
          'UPDATE companies SET plan_status = ?, plan = ? WHERE stripe_customer_id = ?',
          ['canceled', 'canceled', obj.customer]
        );
        break;

      case 'invoice.payment_succeeded':
        // Passage trial → actif
        await db.run(
          `UPDATE companies SET plan_status = 'active', plan = 'pro',
           subscription_started_at = COALESCE(subscription_started_at, NOW())
           WHERE stripe_customer_id = ?`,
          [obj.customer]
        );
        break;

      case 'invoice.payment_failed':
        await db.run(
          "UPDATE companies SET plan_status = 'past_due' WHERE stripe_customer_id = ?",
          [obj.customer]
        );
        break;
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[Webhook] Erreur traitement :', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
