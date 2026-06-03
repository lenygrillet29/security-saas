/**
 * Routes superadmin — protégées par ADMIN_MASTER_KEY (env var).
 * Utilisées pour créer des comptes "lifetime" (accès illimité gratuit à vie).
 */
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const { db }   = require('../db/database');

const SALT_ROUNDS = 10;

function masterKeyAuth(req, res, next) {
  const key = req.headers['x-master-key'] || req.query.master_key;
  if (!process.env.ADMIN_MASTER_KEY) {
    return res.status(503).json({ error: 'ADMIN_MASTER_KEY non configurée sur ce serveur' });
  }
  if (key !== process.env.ADMIN_MASTER_KEY) {
    return res.status(401).json({ error: 'Clé master invalide' });
  }
  next();
}

// ─── POST /api/admin/lifetime — Créer un compte lifetime ─────────────────────
router.post('/lifetime', masterKeyAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { company_name, email, password, first_name, last_name, phone } = req.body;
    if (!company_name || !email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    await client.query('BEGIN');

    const companyRes = await client.query(
      `INSERT INTO companies (name, email, phone, plan, plan_status, trial_ends_at)
       VALUES ($1, $2, $3, 'lifetime', 'active', NULL)
       RETURNING id`,
      [company_name, email.toLowerCase(), phone || null]
    );
    const companyId = companyRes.rows[0].id;

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRes = await client.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin') RETURNING id, email, first_name, last_name, role`,
      [companyId, email.toLowerCase(), hash, first_name, last_name]
    );

    const defaults = [
      ['company_name', company_name], ['company_email', email],
      ['company_phone', phone || ''], ['company_address', ''],
      ['smtp_host', ''], ['smtp_port', '587'], ['smtp_user', ''], ['smtp_pass', ''], ['smtp_from', ''],
      ['tva_rate', '20'], ['hourly_rate_day', '18'], ['hourly_rate_night', '22'], ['hourly_rate_sunday', '25'],
    ];
    for (const [key, value] of defaults) {
      await client.query(
        'INSERT INTO settings (company_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [companyId, key, value]
      );
    }

    await client.query('COMMIT');
    client.release();

    console.log(`[Admin] ✅ Compte lifetime créé : ${email} (${company_name}) — id=${companyId}`);
    res.status(201).json({
      success: true,
      company: { id: companyId, name: company_name, plan: 'lifetime' },
      user: userRes.rows[0],
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/admin/companies — Lister toutes les entreprises ─────────────────
router.get('/companies', masterKeyAuth, async (req, res) => {
  try {
    const companies = await db.all(`
      SELECT c.id, c.name, c.email, c.plan, c.plan_status, c.created_at,
             COUNT(u.id) AS user_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC
    `);
    res.json(companies);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/admin/newsletter — Envoyer une newsletter feature ──────────────
router.post('/newsletter', masterKeyAuth, async (req, res) => {
  try {
    const { features, ctaUrl } = req.body;
    if (!features || !features.length) return res.status(400).json({ error: 'features[] requis' });

    const { sendSystemEmail } = require('../utils/systemEmail');
    const templates = require('../utils/emailTemplates');

    // Récupérer tous les admins actifs
    const admins = await db.all(`
      SELECT u.email, u.first_name, c.name AS company_name
      FROM users u JOIN companies c ON u.company_id = c.id
      WHERE u.role = 'admin' AND u.active = 1 AND c.plan_status NOT IN ('canceled')
    `);

    let sent = 0;
    for (const admin of admins) {
      await sendSystemEmail({
        to: admin.email,
        subject: '🚀 Nouveautés SecuroPlan',
        html: templates.newFeature({ features, ctaUrl }),
      });
      sent++;
    }

    res.json({ success: true, sent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
