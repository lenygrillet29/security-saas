const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const SALT_ROUNDS = 10;

// ─── Inscription entreprise ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { company_name, email, password, first_name, last_name, phone, siret } = req.body;

    if (!company_name || !email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Tous les champs obligatoires sont requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà' });

    await client.query('BEGIN');

    // Créer l'entreprise (essai 14 jours)
    const companyRes = await client.query(
      `INSERT INTO companies (name, email, phone, siret, plan, plan_status, trial_ends_at)
       VALUES ($1, $2, $3, $4, 'trial', 'active', NOW() + INTERVAL '14 days')
       RETURNING id`,
      [company_name, email.toLowerCase(), phone || null, siret || null]
    );
    const companyId = companyRes.rows[0].id;

    // Créer l'utilisateur admin
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRes = await client.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin') RETURNING id, email, first_name, last_name, role`,
      [companyId, email.toLowerCase(), passwordHash, first_name, last_name]
    );
    const user = userRes.rows[0];

    // Paramètres par défaut pour cette entreprise
    const defaults = [
      ['company_name', company_name],
      ['company_email', email],
      ['company_phone', phone || ''],
      ['company_address', ''],
      ['smtp_host', ''],
      ['smtp_port', '587'],
      ['smtp_user', ''],
      ['smtp_pass', ''],
      ['smtp_from', ''],
      ['tva_rate', '20'],
      ['hourly_rate_day', '18'],
      ['hourly_rate_night', '22'],
      ['hourly_rate_sunday', '25'],
    ];
    for (const [key, value] of defaults) {
      await client.query(
        'INSERT INTO settings (company_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (company_id, key) DO NOTHING',
        [companyId, key, value]
      );
    }

    await client.query('COMMIT');
    client.release();

    const token = jwt.sign(
      { userId: user.id, companyId, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        companyId,
        company_name,
      },
    });
  } catch (e) {
    await client.query('ROLLBACK');
    client.release();
    res.status(500).json({ error: e.message });
  }
});

// ─── Connexion ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const user = await db.get(
      `SELECT u.*, c.name as company_name, c.plan, c.plan_status
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.email = ? AND u.active = 1`,
      [email.toLowerCase()]
    );

    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    await db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { userId: user.id, companyId: user.company_id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        companyId: user.company_id,
        company_name: user.company_name,
        plan: user.plan,
        plan_status: user.plan_status,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Profil courant ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.company_id,
              c.name as company_name, c.plan, c.plan_status, c.trial_ends_at
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.id = ? AND u.active = 1`,
      [req.user.userId]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Changer son mot de passe ────────────────────────────────────────────────
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Champs requis' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Minimum 8 caractères' });

    const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.userId]);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Gestion des utilisateurs (admin uniquement) ─────────────────────────────
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.all(
      'SELECT id, email, first_name, last_name, role, active, last_login, created_at FROM users WHERE company_id = ? ORDER BY last_name',
      [req.user.companyId]
    );
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.insert(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, email.toLowerCase(), passwordHash, first_name, last_name, role || 'gestionnaire']
    );
    const user = await db.get(
      'SELECT id, email, first_name, last_name, role, active, created_at FROM users WHERE id = ?',
      [result.lastInsertRowid]
    );
    res.status(201).json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { first_name, last_name, role, active } = req.body;
    const existing = await db.get(
      'SELECT id FROM users WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    await db.run(
      'UPDATE users SET first_name=?, last_name=?, role=?, active=? WHERE id=?',
      [first_name, last_name, role, active !== undefined ? (active ? 1 : 0) : 1, req.params.id]
    );
    const user = await db.get(
      'SELECT id, email, first_name, last_name, role, active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    const existing = await db.get(
      'SELECT id FROM users WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
