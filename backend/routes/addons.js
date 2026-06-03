/**
 * Routes add-ons payants (outil de chiffrage, etc.)
 * GET  /api/addons               — liste les add-ons actifs de la société
 * POST /api/addons/checkout/:id  — crée une Stripe Checkout Session pour souscrire
 * POST /api/addons/cancel/:id    — résilie l'add-on
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const ADDONS = {
  chiffrage: {
    id:          'chiffrage',
    name:        'Outil de chiffrage',
    description: "Calcul automatique des coûts, marges et devis complexes pour vos appels d'offres.",
    price:       49,          // €/mois affiché
    priceEnvKey: 'STRIPE_ADDON_CHIFFRAGE_PRICE_ID',
    features:    [
      'Simulation multi-postes (jour / nuit / dimanche)',
      'Calcul de marge en temps réel',
      'Génération de devis en 1 clic depuis le chiffrage',
      'Export PDF chiffrage détaillé',
      'Scénarios comparatifs (économique / standard / premium)',
    ],
  },
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY non configurée');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

function parseAddons(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ─── GET /api/addons ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const company = await db.get(
      'SELECT plan, addons FROM companies WHERE id = ?',
      [req.user.companyId]
    );
    const active = company?.plan === 'lifetime'
      ? Object.keys(ADDONS)      // lifetime = tout débloqué
      : parseAddons(company?.addons);

    res.json({
      active,
      available: Object.values(ADDONS).map(a => ({
        ...a,
        isActive:   active.includes(a.id),
        configured: !!process.env[a.priceEnvKey],
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/addons/checkout/:addonId ──────────────────────────────────────
router.post('/checkout/:addonId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const addon = ADDONS[req.params.addonId];
    if (!addon) return res.status(404).json({ error: 'Add-on inconnu' });

    const priceId = process.env[addon.priceEnvKey];
    if (!priceId) return res.status(503).json({ error: 'Cet add-on n\'est pas encore disponible à la vente.' });

    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    const stripe  = getStripe();
    const appUrl  = process.env.APP_URL || 'https://securoplan.vercel.app';

    // Réutilise le customer Stripe existant si possible
    let customerId = company.stripe_customer_id;
    if (!customerId) {
      const user = await db.get('SELECT email, first_name, last_name FROM users WHERE id = ?', [req.user.userId]);
      const customer = await stripe.customers.create({
        email: user.email,
        name:  company.name,
        metadata: { company_id: String(company.id) },
      });
      customerId = customer.id;
      await db.run('UPDATE companies SET stripe_customer_id = ? WHERE id = ?', [customerId, company.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/chiffrage?addon_success=1`,
      cancel_url:  `${appUrl}/chiffrage?addon_canceled=1`,
      subscription_data: {
        metadata: {
          company_id: String(company.id),
          addon_id:   addon.id,
        },
      },
      metadata: {
        company_id: String(company.id),
        addon_id:   addon.id,
      },
    });

    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/addons/cancel/:addonId ────────────────────────────────────────
router.post('/cancel/:addonId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const addon = ADDONS[req.params.addonId];
    if (!addon) return res.status(404).json({ error: 'Add-on inconnu' });

    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    const subId = company[`addon_${addon.id}_subscription_id`];

    if (subId && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(subId);
    }

    // Retire l'addon localement
    const active = parseAddons(company.addons).filter(a => a !== addon.id);
    await db.run(
      `UPDATE companies SET addons = ?, addon_chiffrage_subscription_id = NULL WHERE id = ?`,
      [JSON.stringify(active), company.id]
    );

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Utilitaire appelé depuis le webhook billing ──────────────────────────────
async function activateAddon(companyId, addonId, subscriptionId) {
  const company = await db.get('SELECT addons FROM companies WHERE id = ?', [companyId]);
  if (!company) return;
  const active = parseAddons(company.addons);
  if (!active.includes(addonId)) active.push(addonId);
  await db.run(
    `UPDATE companies SET addons = ?, addon_chiffrage_subscription_id = ? WHERE id = ?`,
    [JSON.stringify(active), subscriptionId, companyId]
  );
  console.log(`[Addon] ✅ ${addonId} activé pour company_id=${companyId}`);
}

async function deactivateAddon(companyId, addonId) {
  const company = await db.get('SELECT addons FROM companies WHERE id = ?', [companyId]);
  if (!company) return;
  const active = parseAddons(company.addons).filter(a => a !== addonId);
  await db.run(
    `UPDATE companies SET addons = ?, addon_chiffrage_subscription_id = NULL WHERE id = ?`,
    [JSON.stringify(active), companyId]
  );
  console.log(`[Addon] ⛔ ${addonId} désactivé pour company_id=${companyId}`);
}

module.exports = router;
module.exports.activateAddon   = activateAddon;
module.exports.deactivateAddon = deactivateAddon;
