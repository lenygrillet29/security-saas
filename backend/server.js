const express  = require('express');
const cors     = require('cors');
const cron     = require('node-cron');
const { init } = require('./db/database');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins) return callback(null, true);
    const allowed =
      allowedOrigins.includes(origin) ||
      /^https:\/\/[a-z0-9-]+(\.vercel\.app)$/.test(origin);
    if (allowed) return callback(null, true);
    console.warn(`[CORS] Origin bloquée : ${origin}`);
    return callback(new Error(`Origin non autorisée : ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ── Webhook Stripe : body brut AVANT express.json() ──────────────────────────
// Doit être déclaré ici pour intercepter le raw body avant le parser JSON global
const { webhookHandler } = require('./routes/billing');
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  webhookHandler
);

app.use(express.json());

// ─── Routes publiques (pas d'auth) ───────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ─── Signature de contrat (public — token dans l'URL) ────────────────────────
app.use('/api/contracts/sign', require('./routes/contracts'));

// ─── Portail client public (token dans l'URL, pas de JWT) ────────────────────
app.use('/api/portal', require('./routes/portal'));

// ─── Portail agent mobile (token dans l'URL, pas de JWT) ─────────────────────
app.use('/api/agent-portal', require('./routes/agent-portal'));

// ─── Admin superadmin (protégé par ADMIN_MASTER_KEY, pas JWT) ────────────────
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', async (req, res) => {
  const health = { status: 'ok', node: process.version, db: 'postgresql', stripe: null };

  if (process.env.STRIPE_SECRET_KEY) {
    const keyMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test';
    const priceId = process.env.STRIPE_PRICE_ID || null;
    const pricePreview = priceId
      ? `${priceId.slice(0, 12)}…${priceId.slice(-4)}`
      : null;

    let priceValid = null;
    if (priceId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.prices.retrieve(priceId);
        priceValid = true;
      } catch (e) {
        priceValid = false;
        health.stripe_error = e.message;
      }
    }

    health.stripe = {
      configured: true,
      key_mode:   keyMode,
      price_id:   pricePreview,
      price_valid: priceValid,
      webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
    };
  } else {
    health.stripe = { configured: false };
  }

  res.json(health);
});

// ─── Routes protégées (JWT requis) ────────────────────────────────────────────
app.use('/api', requireAuth);
app.use('/api/agents',   require('./routes/agents'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/sites',    require('./routes/sites'));
app.use('/api/shifts',   require('./routes/shifts'));
app.use('/api/absences', require('./routes/absences'));
app.use('/api/quotes',   require('./routes/quotes'));
app.use('/api/pdf',      require('./routes/pdf'));
app.use('/api/email',    require('./routes/email'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/billing',   require('./routes/billing'));   // /subscription, /cancel, /reactivate
app.use('/api/contracts', require('./routes/contracts')); // CRUD + envoi + signature
app.use('/api/invoices',  require('./routes/invoices'));  // Facturation
app.use('/api/audit',    require('./routes/audit'));     // Journal d'audit
app.use('/api/export',   require('./routes/export'));    // Export CSV comptable
app.use('/api/addons',       require('./routes/addons'));        // Add-ons payants
app.use('/api/shift-offers', require('./routes/shift-offers')); // Offres de vacation

// ─── Gestionnaire d'erreurs ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
init()
  .then(async () => {
    app.listen(PORT, () => {
      console.log(`SecuroPlan API running on port ${PORT} (PostgreSQL, multi-tenant)`);
    });

    // ── Scheduler (cron jobs) ─────────────────────────────────────────────────
    const { startScheduler } = require('./jobs/scheduler');
    startScheduler();

    // ── Validation Stripe au démarrage ────────────────────────────────────────
    if (process.env.STRIPE_SECRET_KEY) {
      const keyMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
      console.log(`[Stripe] Mode : ${keyMode}`);

      if (process.env.STRIPE_PRICE_ID) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
          console.log(`[Stripe] ✅ STRIPE_PRICE_ID valide : ${price.id} (${price.unit_amount / 100} ${price.currency.toUpperCase()}/${price.recurring?.interval || 'once'})`);
        } catch (e) {
          console.error(`[Stripe] ❌ STRIPE_PRICE_ID invalide (${process.env.STRIPE_PRICE_ID.slice(0, 12)}…) : ${e.message}`);
          console.error('[Stripe] → Vérifiez que le price_id correspond au mode', keyMode, '(test vs live)');
        }
      } else {
        console.warn('[Stripe] ⚠️  STRIPE_PRICE_ID non défini — abonnement désactivé');
      }
    } else {
      console.warn('[Stripe] Non configuré (STRIPE_SECRET_KEY absent)');
    }
  })
  .then(() => {
    // Cron notifications push — toutes les 15 min
    // Envoie 2 rappels par vacation : 24h avant + 2h avant
    cron.schedule('*/15 * * * *', () => {
      const { sendTimedReminders } = require('./routes/agent-portal');
      sendTimedReminders();
    }, { timezone: 'Europe/Paris' });
    console.log('[Cron] ✅ Rappels push planifiés — toutes les 15 min (24h et 2h avant chaque vacation)');
  })
  .catch(err => {
    console.error('[DB] Impossible de se connecter à PostgreSQL :', err.message);
    process.exit(1);
  });
