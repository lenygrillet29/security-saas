const express = require('express');
const cors = require('cors');
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

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', node: process.version, db: 'postgresql' })
);

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
app.use('/api/billing',  require('./routes/billing'));  // /subscription, /cancel, /reactivate

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
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SecuritySaaS API running on port ${PORT} (PostgreSQL, multi-tenant)`);
    });
  })
  .catch(err => {
    console.error('[DB] Impossible de se connecter à PostgreSQL :', err.message);
    process.exit(1);
  });
