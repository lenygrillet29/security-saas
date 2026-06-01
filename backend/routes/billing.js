const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY non configurée');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ─── Calcul des périodes ──────────────────────────────────────────────────────
// Mois 1 (j0-j29)   : essai gratuit
// Mois 2-3 (j30-j89): engagement obligatoire 79 €/mois
// Mois 4+ (j90+)    : résiliable avec 30 j de préavis
function getPeriodInfo(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt)) / 86400000);
  return {
    daysSinceSignup:    days,
    isTrialing:         days < 30,
    isMandatory:        days >= 30 && days < 90,
    canCancel:          days >= 90,
    daysUntilCanCancel: Math.max(0, 90 - days),
    trialEndsIn:        Math.max(0, 30 - days),
    trialEndDate:       new Date(new Date(createdAt).getTime() + 30 * 86400000).toISOString(),
  };
}

// ─── GET statut abonnement ────────────────────────────────────────────────────
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    if (!company) return res.status(404).json({ error: 'Entreprise non trouvée' });

    const period = getPeriodInfo(company.created_at);

    // Sync depuis Stripe si disponible
    let stripeData = null;
    if (company.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        stripeData = {
          status:             sub.status,
          trial_end:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at:          sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        };
        // Sync trial_ends_at si Stripe fait autorité
        if (sub.trial_end && !company.trial_ends_at) {
          await db.run('UPDATE companies SET trial_ends_at = ? WHERE id = ?',
            [new Date(sub.trial_end * 1000).toISOString(), company.id]);
        }
      } catch { /* subscription non trouvée dans Stripe */ }
    }

    const phase = period.isTrialing ? 'trial' : period.isMandatory ? 'mandatory' : 'flexible';

    res.json({
      plan:          company.plan,
      plan_status:   company.plan_status,
      trial_ends_at: company.trial_ends_at,
      cancel_at:     company.cancel_at || (stripeData?.cancel_at ?? null),
      created_at:    company.created_at,
      stripe:        stripeData,
      period,
      phase,
      price_monthly: 79,
      currency:      'EUR',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST résilier avec préavis 30 jours (admin) ──────────────────────────────
router.post('/cancel', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    if (!company) return res.status(404).json({ error: 'Entreprise non trouvée' });

    const { canCancel, daysUntilCanCancel } = getPeriodInfo(company.created_at);
    if (!canCancel) {
      return res.status(400).json({
        error: `Résiliation impossible : période d'engagement obligatoire en cours. Disponible dans ${daysUntilCanCancel} jour(s).`,
        days_until_can_cancel: daysUntilCanCancel,
      });
    }

    const existingCancelAt = company.cancel_at || null;
    if (existingCancelAt) {
      return res.status(400).json({ error: 'Une résiliation est déjà planifiée.' });
    }

    // Préavis fixe de 30 jours
    const cancelAtMs  = Date.now() + 30 * 86400000;
    const cancelAtIso = new Date(cancelAtMs).toISOString();

    if (company.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      await stripe.subscriptions.update(company.stripe_subscription_id, {
        cancel_at: Math.floor(cancelAtMs / 1000),
      });
    }

    await db.run('UPDATE companies SET cancel_at = ? WHERE id = ?', [cancelAtIso, req.user.companyId]);

    // Email de confirmation de résiliation
    const admin = await db.get(
      'SELECT u.email, u.first_name, c.name FROM users u JOIN companies c ON u.company_id = c.id WHERE u.company_id = ? AND u.role = ?',
      [req.user.companyId, 'admin']
    );
    if (admin) {
      sendSystemEmail({
        to: admin.email,
        subject: 'Résiliation confirmée — SecuritySaaS',
        html: templates.cancellationConfirmed({
          firstName:   admin.first_name,
          companyName: admin.name,
          cancelAt:    new Date(cancelAtIso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        }),
      }).catch(() => {});
    }

    res.json({ success: true, cancel_at: cancelAtIso });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST annuler la résiliation ─────────────────────────────────────────────
router.post('/reactivate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    if (!company?.cancel_at) return res.status(400).json({ error: 'Aucune résiliation planifiée' });

    if (company.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      // '' (empty string) = supprimer le cancel_at dans Stripe REST
      await stripe.subscriptions.update(company.stripe_subscription_id, { cancel_at: '' });
    }

    await db.run('UPDATE companies SET cancel_at = NULL WHERE id = ?', [req.user.companyId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Webhook Stripe ───────────────────────────────────────────────────────────
// Monté séparément dans server.js avec express.raw() AVANT express.json()
// URL : POST /api/billing/webhook
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('[Webhook] Stripe non configuré — événement ignoré');
    return res.json({ received: true });
  }

  let event;
  try {
    const stripe = getStripe();
    // req.body est un Buffer brut grâce à express.raw() dans server.js
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('[Webhook] Signature invalide :', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  const obj = event.data.object;
  console.log(`[Webhook] ${event.type} — customer: ${obj.customer || '–'}`);

  try {
    switch (event.type) {

      // ── Abonnement créé ou mis à jour ──────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const updates = {
          plan_status:          obj.status,              // trialing / active / past_due / canceled
          stripe_subscription_id: obj.id,
        };
        // Sync date de fin d'essai depuis Stripe (source de vérité)
        if (obj.trial_end) {
          updates.trial_ends_at = new Date(obj.trial_end * 1000).toISOString();
        }
        // Si Stripe a supprimé le cancel_at, on nettoie notre DB
        if (!obj.cancel_at) {
          updates.cancel_at = null;
        } else {
          updates.cancel_at = new Date(obj.cancel_at * 1000).toISOString();
        }

        await db.pool.query(
          `UPDATE companies
           SET plan_status = $1, stripe_subscription_id = $2,
               trial_ends_at = COALESCE($3, trial_ends_at),
               cancel_at = $4
           WHERE stripe_customer_id = $5`,
          [updates.plan_status, updates.stripe_subscription_id,
           updates.trial_ends_at || null, updates.cancel_at || null,
           obj.customer]
        );
        break;
      }

      // ── Abonnement supprimé ────────────────────────────────────────────────
      case 'customer.subscription.deleted':
        await db.pool.query(
          `UPDATE companies SET plan_status = 'canceled', plan = 'canceled'
           WHERE stripe_customer_id = $1`,
          [obj.customer]
        );
        break;

      // ── Paiement réussi ────────────────────────────────────────────────────
      // IMPORTANT : ne pas passer à 'active' si c'est la facture à 0 € du trial
      case 'invoice.payment_succeeded':
        if (obj.amount_due > 0) {
          // Premier vrai paiement → passage trial → pro
          await db.pool.query(
            `UPDATE companies
             SET plan_status = 'active', plan = 'pro',
                 subscription_started_at = COALESCE(subscription_started_at, NOW())
             WHERE stripe_customer_id = $1`,
            [obj.customer]
          );
          console.log(`[Billing] Premier paiement reçu (${obj.amount_due / 100} €) pour`, obj.customer);

          // Email de confirmation de paiement
          try {
            const { rows } = await db.pool.query(
              `SELECT u.email, u.first_name, c.name FROM users u JOIN companies c ON u.company_id = c.id
               WHERE c.stripe_customer_id = $1 AND u.role = 'admin' LIMIT 1`,
              [obj.customer]
            );
            if (rows[0]) {
              const amount = (obj.amount_due / 100).toFixed(2);
              const date   = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
              sendSystemEmail({
                to: rows[0].email,
                subject: `Confirmation de paiement — ${amount} €`,
                html: templates.paymentSucceeded({
                  firstName:   rows[0].first_name,
                  companyName: rows[0].name,
                  amount,
                  date,
                  invoiceUrl:  obj.hosted_invoice_url || null,
                }),
              }).catch(() => {});
            }
          } catch {}
        } else {
          // Facture à 0 € = début du trial → on reste en 'trialing'
          console.log('[Billing] Facture trial à 0 € — statut trialing conservé');
        }
        break;

      // ── Échec de paiement ─────────────────────────────────────────────────
      case 'invoice.payment_failed':
        await db.pool.query(
          `UPDATE companies SET plan_status = 'past_due' WHERE stripe_customer_id = $1`,
          [obj.customer]
        );
        console.log('[Billing] Paiement échoué pour', obj.customer);

        // Email d'alerte paiement échoué
        try {
          const { rows } = await db.pool.query(
            `SELECT u.email, u.first_name, c.name FROM users u JOIN companies c ON u.company_id = c.id
             WHERE c.stripe_customer_id = $1 AND u.role = 'admin' LIMIT 1`,
            [obj.customer]
          );
          if (rows[0]) {
            sendSystemEmail({
              to: rows[0].email,
              subject: '⚠️ Échec de paiement — SecuritySaaS',
              html: templates.paymentFailed({
                firstName:   rows[0].first_name,
                companyName: rows[0].name,
                amount:      ((obj.amount_due || 7900) / 100).toFixed(2),
              }),
            }).catch(() => {});
          }
        } catch {}
        break;

      // ── Essai se terminant dans 3 jours ──────────────────────────────────
      case 'customer.subscription.trial_will_end':
        // TODO: envoyer un email de rappel (à implémenter)
        console.log('[Billing] Essai se terminant bientôt pour', obj.customer);
        break;

      default:
        console.log(`[Webhook] Événement non traité : ${event.type}`);
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[Webhook] Erreur traitement :', event.type, e.message);
    // Retourner 200 quand même pour éviter que Stripe ne renvoie l'événement en boucle
    res.json({ received: true, error: e.message });
  }
}

module.exports = router;
module.exports.webhookHandler = webhookHandler;
