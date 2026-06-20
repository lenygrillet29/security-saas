const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { db }  = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

const APP_URL = process.env.APP_URL || 'https://securoplan.vercel.app';

// ─── GET liste ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT c.*, a.first_name || ' ' || a.last_name AS agent_name, a.email AS agent_email
      FROM contracts c
      JOIN agents a ON c.agent_id = a.id
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET un contrat ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const contract = await db.get(
      'SELECT c.*, a.first_name || \' \' || a.last_name AS agent_name, a.email AS agent_email FROM contracts c JOIN agents a ON c.agent_id = a.id WHERE c.id = ? AND c.company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!contract) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json(contract);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST créer ───────────────────────────────────────────────────────────────
router.post('/', requireWriter, async (req, res) => {
  try {
    const { agent_id, type, title, start_date, end_date, gross_salary, hours_per_week, position, trial_period_months, notes } = req.body;
    if (!agent_id || !title || !start_date) return res.status(400).json({ error: 'agent_id, title et start_date sont requis' });

    const { lastInsertRowid } = await db.insert(
      `INSERT INTO contracts (company_id, agent_id, type, title, start_date, end_date, gross_salary, hours_per_week, position, trial_period_months, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [req.user.companyId, agent_id, type || 'CDI', title, start_date, end_date || null,
       gross_salary || 0, hours_per_week || 35, position || null, trial_period_months || 0, notes || null]
    );
    const contract = await db.get('SELECT * FROM contracts WHERE id = ?', [lastInsertRowid]);
    res.status(201).json(contract);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT modifier ─────────────────────────────────────────────────────────────
router.put('/:id', requireWriter, async (req, res) => {
  try {
    const contract = await db.get('SELECT * FROM contracts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!contract) return res.status(404).json({ error: 'Contrat non trouvé' });
    if (contract.status === 'signed') return res.status(400).json({ error: 'Impossible de modifier un contrat signé' });

    const { type, title, start_date, end_date, gross_salary, hours_per_week, position, trial_period_months, notes } = req.body;
    await db.run(
      `UPDATE contracts SET type=?, title=?, start_date=?, end_date=?, gross_salary=?, hours_per_week=?, position=?, trial_period_months=?, notes=?
       WHERE id=? AND company_id=?`,
      [type, title, start_date, end_date || null, gross_salary, hours_per_week, position || null, trial_period_months || 0, notes || null,
       req.params.id, req.user.companyId]
    );
    const updated = await db.get('SELECT * FROM contracts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const { changes } = await db.run('DELETE FROM contracts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!changes) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST envoyer pour signature ──────────────────────────────────────────────
router.post('/:id/send', requireWriter, async (req, res) => {
  try {
    const contract = await db.get(`
      SELECT c.*, a.first_name, a.last_name, a.email AS agent_email,
             co.name AS company_name
      FROM contracts c
      JOIN agents  a  ON c.agent_id  = a.id
      JOIN companies co ON c.company_id = co.id
      WHERE c.id = ? AND c.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!contract) return res.status(404).json({ error: 'Contrat non trouvé' });
    if (!contract.agent_email) return res.status(400).json({ error: "L'agent n'a pas d'email" });

    // Générer un token unique
    const token = crypto.randomBytes(32).toString('hex');
    await db.run('UPDATE contracts SET sign_token = ?, status = ? WHERE id = ?', [token, 'sent', contract.id]);

    const signUrl = `${APP_URL}/sign-contract/${token}`;
    await sendSystemEmail({
      to: contract.agent_email,
      subject: `Votre contrat ${contract.type} à signer — ${contract.company_name}`,
      html: templates.contractSignRequest({
        agentName:    `${contract.first_name} ${contract.last_name}`,
        companyName:  contract.company_name,
        contractType: contract.type,
        signUrl,
      }),
    });

    res.json({ success: true, sign_url: signUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET contrat par token (public — pour la page de signature) ───────────────
router.get('/sign/:token', async (req, res) => {
  try {
    const contract = await db.get(`
      SELECT c.*, a.first_name, a.last_name,
             co.name AS company_name, co.address AS company_address
      FROM contracts c
      JOIN agents    a  ON c.agent_id   = a.id
      JOIN companies co ON c.company_id = co.id
      WHERE c.sign_token = ?
    `, [req.params.token]);
    if (!contract) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    res.json(contract);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST signer (public — appelé par la page de signature) ───────────────────
router.post('/sign/:token', async (req, res) => {
  try {
    const contract = await db.get('SELECT * FROM contracts WHERE sign_token = ?', [req.params.token]);
    if (!contract) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    if (contract.status === 'signed') return res.status(400).json({ error: 'Ce contrat a déjà été signé' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'inconnue';
    await db.run(
      'UPDATE contracts SET status = ?, signed_at = NOW(), signed_ip = ? WHERE id = ?',
      ['signed', ip, contract.id]
    );

    res.json({ success: true, signed_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
