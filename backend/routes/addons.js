/**
 * Routes add-ons payants — outil de chiffrage + packs agents/collaborateurs
 *
 * Limites incluses dans l'abonnement de base 79 €/mois :
 *   • 100 agents actifs
 *   • 3 collaborateurs bureau
 *
 * Packs Agents supplémentaires (mutuellement exclusifs, 1 seul à la fois) :
 *   S (+50 = 150 total)  9 €/mois   STRIPE_PACK_AGENTS_S_PRICE_ID
 *   M (+100 = 200 total) 15 €/mois  STRIPE_PACK_AGENTS_M_PRICE_ID
 *   L (+200 = 300 total) 25 €/mois  STRIPE_PACK_AGENTS_L_PRICE_ID
 *   Illimité             39 €/mois  STRIPE_PACK_AGENTS_ILLIMITE_PRICE_ID
 *
 * Packs Collaborateurs supplémentaires :
 *   S (+5 = 8 total)     5 €/mois   STRIPE_PACK_COLLAB_S_PRICE_ID
 *   M (+10 = 13 total)   9 €/mois   STRIPE_PACK_COLLAB_M_PRICE_ID
 *   L (+20 = 23 total)   15 €/mois  STRIPE_PACK_COLLAB_L_PRICE_ID
 *   Illimité             25 €/mois  STRIPE_PACK_COLLAB_ILLIMITE_PRICE_ID
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Limites de base (abonnement 79 €) ───────────────────────────────────────
const BASE_LIMITS = { agents: 100, collab: 3 };

// ─── Définitions packs ───────────────────────────────────────────────────────
const PACK_DEFS = {
  agents: {
    col: 'pack_agents', subCol: 'pack_agents_sub_id',
    baseLimit: BASE_LIMITS.agents,
    tiers: [
      { id: 's',        label: 'Pack S',        extra: 50,       price: 9,  envKey: 'STRIPE_PACK_AGENTS_S_PRICE_ID'        },
      { id: 'm',        label: 'Pack M',         extra: 100,      price: 15, envKey: 'STRIPE_PACK_AGENTS_M_PRICE_ID'        },
      { id: 'l',        label: 'Pack L',         extra: 200,      price: 25, envKey: 'STRIPE_PACK_AGENTS_L_PRICE_ID'        },
      { id: 'illimite', label: 'Pack Illimité',  extra: Infinity, price: 39, envKey: 'STRIPE_PACK_AGENTS_ILLIMITE_PRICE_ID' },
    ],
  },
  collab: {
    col: 'pack_collab', subCol: 'pack_collab_sub_id',
    baseLimit: BASE_LIMITS.collab,
    tiers: [
      { id: 's',        label: 'Pack S',        extra: 5,        price: 5,  envKey: 'STRIPE_PACK_COLLAB_S_PRICE_ID'        },
      { id: 'm',        label: 'Pack M',         extra: 10,       price: 9,  envKey: 'STRIPE_PACK_COLLAB_M_PRICE_ID'        },
      { id: 'l',        label: 'Pack L',         extra: 20,       price: 15, envKey: 'STRIPE_PACK_COLLAB_L_PRICE_ID'        },
      { id: 'illimite', label: 'Pack Illimité',  extra: Infinity, price: 25, envKey: 'STRIPE_PACK_COLLAB_ILLIMITE_PRICE_ID' },
    ],
  },
};

// ─── Add-ons standalone ───────────────────────────────────────────────────────
const ADDONS = {
  chiffrage: {
    id:          'chiffrage',
    name:        'Outil de chiffrage',
    description: "Calcul automatique des coûts, marges et devis complexes pour vos appels d'offres.",
    price:       49,
    priceEnvKey: 'STRIPE_ADDON_CHIFFRAGE_PRICE_ID',
    successUrl:  '/chiffrage?addon_success=1',
    cancelUrl:   '/chiffrage',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY non configurée');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

function parseAddons(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function getTotalLimit(packType, packTierId, isLifetime) {
  if (isLifetime) return Infinity;
  const def = PACK_DEFS[packType];
  if (!def) return 0;
  if (!packTierId) return def.baseLimit;
  const tier = def.tiers.find(t => t.id === packTierId);
  if (!tier) return def.baseLimit;
  if (tier.extra === Infinity) return Infinity;
  return def.baseLimit + tier.extra;
}

// Format "pack_agents_s" → { packType: 'agents', tierId: 's' }
function parsePackAddonId(addonId) {
  const m = addonId.match(/^pack_(agents|collab)_(.+)$/);
  return m ? { packType: m[1], tierId: m[2] } : null;
}

// ─── GET /api/addons ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const company = await db.get(
      'SELECT plan, addons, pack_agents, pack_collab FROM companies WHERE id = ?',
      [req.user.companyId]
    );
    const isLifetime = company?.plan === 'lifetime';
    const activeAddons = isLifetime ? Object.keys(ADDONS) : parseAddons(company?.addons);

    const packs = {};
    for (const [type, def] of Object.entries(PACK_DEFS)) {
      const currentTier = isLifetime ? 'illimite' : (company?.[def.col] || null);
      packs[type] = {
        baseLimit:  def.baseLimit,
        current:    currentTier,
        totalLimit: getTotalLimit(type, currentTier, isLifetime),
        tiers:      def.tiers.map(t => ({
          ...t,
          totalLimit:  t.extra === Infinity ? Infinity : def.baseLimit + t.extra,
          configured:  !!process.env[t.envKey],
          isCurrent:   currentTier === t.id,
        })),
      };
    }

    res.json({
      active: activeAddons,
      available: Object.values(ADDONS).map(a => ({
        ...a,
        isActive:   activeAddons.includes(a.id),
        configured: !!process.env[a.priceEnvKey],
      })),
      packs,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/addons/limits — compteurs actuels ───────────────────────────────
router.get('/limits', requireAuth, async (req, res) => {
  try {
    const company = await db.get(
      'SELECT plan, pack_agents, pack_collab FROM companies WHERE id = ?',
      [req.user.companyId]
    );
    const isLifetime = company?.plan === 'lifetime';

    const [[agR], [coR]] = await Promise.all([
      db.all('SELECT COUNT(*) AS cnt FROM agents WHERE company_id = ? AND active = 1', [req.user.companyId]),
      db.all('SELECT COUNT(*) AS cnt FROM users  WHERE company_id = ? AND active = 1', [req.user.companyId]),
    ]);

    const agentLimit  = getTotalLimit('agents', company?.pack_agents,  isLifetime);
    const collabLimit = getTotalLimit('collab', company?.pack_collab,  isLifetime);
    const agentCount  = parseInt(agR.cnt);
    const collabCount = parseInt(coR.cnt);

    res.json({
      agents: {
        count:    agentCount,
        limit:    agentLimit === Infinity ? null : agentLimit,
        pack:     company?.pack_agents || null,
        pct:      agentLimit === Infinity ? 0 : Math.round(agentCount / agentLimit * 100),
        exceeded: agentLimit !== Infinity && agentCount >= agentLimit,
      },
      collab: {
        count:    collabCount,
        limit:    collabLimit === Infinity ? null : collabLimit,
        pack:     company?.pack_collab || null,
        pct:      collabLimit === Infinity ? 0 : Math.round(collabCount / collabLimit * 100),
        exceeded: collabLimit !== Infinity && collabCount >= collabLimit,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/addons/checkout/:addonId ──────────────────────────────────────
// addonId examples : "chiffrage" | "pack_agents_s" | "pack_collab_illimite"
router.post('/checkout/:addonId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { addonId } = req.params;
    const company  = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    const appUrl   = process.env.APP_URL || 'https://securoplan.vercel.app';
    const stripe   = getStripe();

    // Résolution du priceId + URL de redirection
    let priceId, successUrl, cancelUrl;
    const packInfo = parsePackAddonId(addonId);

    if (packInfo) {
      const def  = PACK_DEFS[packInfo.packType];
      const tier = def?.tiers.find(t => t.id === packInfo.tierId);
      if (!tier) return res.status(404).json({ error: 'Pack inconnu' });
      priceId    = process.env[tier.envKey];
      successUrl = `${appUrl}/billing?pack_success=${packInfo.packType}`;
      cancelUrl  = `${appUrl}/billing`;
    } else {
      const addon = ADDONS[addonId];
      if (!addon) return res.status(404).json({ error: 'Add-on inconnu' });
      priceId    = process.env[addon.priceEnvKey];
      successUrl = `${appUrl}${addon.successUrl}`;
      cancelUrl  = `${appUrl}${addon.cancelUrl}`;
    }

    if (!priceId) return res.status(503).json({ error: "Ce pack n'est pas encore disponible (price ID manquant)." });

    // Stripe customer
    let customerId = company.stripe_customer_id;
    if (!customerId) {
      const user = await db.get('SELECT email FROM users WHERE id = ?', [req.user.userId]);
      const cust = await stripe.customers.create({
        email: user.email, name: company.name,
        metadata: { company_id: String(company.id) },
      });
      customerId = cust.id;
      await db.run('UPDATE companies SET stripe_customer_id = ? WHERE id = ?', [customerId, company.id]);
    }

    // Si l'entreprise a déjà un pack actif du même type, on résilie avant de créer le nouveau
    if (packInfo) {
      const def    = PACK_DEFS[packInfo.packType];
      const oldSub = company[def.subCol];
      if (oldSub) {
        await stripe.subscriptions.cancel(oldSub).catch(() => {});
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer:    customerId,
      mode:        'subscription',
      line_items:  [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      subscription_data: { metadata: { company_id: String(company.id), addon_id: addonId } },
      metadata:          { company_id: String(company.id), addon_id: addonId },
    });

    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/addons/cancel/:addonId ────────────────────────────────────────
router.post('/cancel/:addonId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { addonId } = req.params;
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.companyId]);
    const packInfo = parsePackAddonId(addonId);

    if (packInfo) {
      const def = PACK_DEFS[packInfo.packType];
      const sub = company[def.subCol];
      if (sub && process.env.STRIPE_SECRET_KEY) {
        await getStripe().subscriptions.cancel(sub).catch(() => {});
      }
      await db.run(`UPDATE companies SET ${def.col} = NULL, ${def.subCol} = NULL WHERE id = ?`, [company.id]);
    } else {
      const addon = ADDONS[addonId];
      if (!addon) return res.status(404).json({ error: 'Add-on inconnu' });
      const sub = company.addon_chiffrage_subscription_id;
      if (sub && process.env.STRIPE_SECRET_KEY) {
        await getStripe().subscriptions.cancel(sub).catch(() => {});
      }
      const active = parseAddons(company.addons).filter(a => a !== addonId);
      await db.run(
        'UPDATE companies SET addons = ?, addon_chiffrage_subscription_id = NULL WHERE id = ?',
        [JSON.stringify(active), company.id]
      );
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Utilitaires webhook (appelés depuis billing.js) ─────────────────────────
async function activateAddon(companyId, addonId, subscriptionId) {
  const packInfo = parsePackAddonId(addonId);
  if (packInfo) {
    const def = PACK_DEFS[packInfo.packType];
    if (!def) return;
    await db.run(
      `UPDATE companies SET ${def.col} = ?, ${def.subCol} = ? WHERE id = ?`,
      [packInfo.tierId, subscriptionId, companyId]
    );
    console.log(`[Pack] ✅ pack_${packInfo.packType}_${packInfo.tierId} activé (company ${companyId})`);
  } else {
    const company = await db.get('SELECT addons FROM companies WHERE id = ?', [companyId]);
    if (!company) return;
    const active = parseAddons(company.addons);
    if (!active.includes(addonId)) active.push(addonId);
    await db.run(
      'UPDATE companies SET addons = ?, addon_chiffrage_subscription_id = ? WHERE id = ?',
      [JSON.stringify(active), subscriptionId, companyId]
    );
    console.log(`[Addon] ✅ ${addonId} activé (company ${companyId})`);
  }
}

async function deactivateAddon(companyId, addonId) {
  const packInfo = parsePackAddonId(addonId);
  if (packInfo) {
    const def = PACK_DEFS[packInfo.packType];
    if (!def) return;
    await db.run(
      `UPDATE companies SET ${def.col} = NULL, ${def.subCol} = NULL WHERE id = ?`,
      [companyId]
    );
    console.log(`[Pack] ⛔ pack_${packInfo.packType} désactivé (company ${companyId})`);
  } else {
    const company = await db.get('SELECT addons FROM companies WHERE id = ?', [companyId]);
    if (!company) return;
    const active = parseAddons(company.addons).filter(a => a !== addonId);
    await db.run(
      'UPDATE companies SET addons = ?, addon_chiffrage_subscription_id = NULL WHERE id = ?',
      [JSON.stringify(active), companyId]
    );
    console.log(`[Addon] ⛔ ${addonId} désactivé (company ${companyId})`);
  }
}

// Vérification limite agents (appelé depuis agents.js)
async function checkAgentLimit(companyId) {
  const company = await db.get('SELECT plan, pack_agents FROM companies WHERE id = ?', [companyId]);
  if (!company || company.plan === 'lifetime') return { ok: true };
  const limit = getTotalLimit('agents', company.pack_agents, false);
  const [row] = await db.all('SELECT COUNT(*) AS cnt FROM agents WHERE company_id = ? AND active = 1', [companyId]);
  const count = parseInt(row.cnt);
  if (limit !== Infinity && count >= limit) {
    return { ok: false, count, limit, pack: company.pack_agents };
  }
  return { ok: true, count, limit: limit === Infinity ? null : limit };
}

// Vérification limite collaborateurs (appelé depuis auth.js)
async function checkCollabLimit(companyId) {
  const company = await db.get('SELECT plan, pack_collab FROM companies WHERE id = ?', [companyId]);
  if (!company || company.plan === 'lifetime') return { ok: true };
  const limit = getTotalLimit('collab', company.pack_collab, false);
  const [row] = await db.all('SELECT COUNT(*) AS cnt FROM users WHERE company_id = ? AND active = 1', [companyId]);
  const count = parseInt(row.cnt);
  if (limit !== Infinity && count >= limit) {
    return { ok: false, count, limit, pack: company.pack_collab };
  }
  return { ok: true, count, limit: limit === Infinity ? null : limit };
}

module.exports = router;
module.exports.activateAddon    = activateAddon;
module.exports.deactivateAddon  = deactivateAddon;
module.exports.checkAgentLimit  = checkAgentLimit;
module.exports.checkCollabLimit = checkCollabLimit;
