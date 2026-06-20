const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { db }  = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { sendSystemEmail } = require('../utils/systemEmail');

const APP_URL = process.env.APP_URL || 'https://securoplan.vercel.app';

// ─── GET liste ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT cc.*, cl.name AS client_name, cl.email AS client_email, cl.contact_name
      FROM client_contracts cc
      JOIN clients cl ON cc.client_id = cl.id
      WHERE cc.company_id = ?
      ORDER BY cc.created_at DESC
    `, [req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET un contrat ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT cc.*, cl.name AS client_name, cl.email AS client_email, cl.contact_name
      FROM client_contracts cc
      JOIN clients cl ON cc.client_id = cl.id
      WHERE cc.id = ? AND cc.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!row) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST créer ───────────────────────────────────────────────────────────────
router.post('/', requireWriter, async (req, res) => {
  try {
    const { client_id, title, description, start_date, end_date, amount, billing_type, notes } = req.body;
    if (!client_id || !title || !start_date) return res.status(400).json({ error: 'client_id, title et start_date sont requis' });

    const { lastInsertRowid } = await db.insert(
      `INSERT INTO client_contracts (company_id, client_id, title, description, start_date, end_date, amount, billing_type, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [req.user.companyId, client_id, title, description || null, start_date,
       end_date || null, amount || 0, billing_type || 'monthly', notes || null]
    );
    const created = await db.get('SELECT * FROM client_contracts WHERE id = ?', [lastInsertRowid]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT modifier ─────────────────────────────────────────────────────────────
router.put('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM client_contracts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Contrat non trouvé' });
    if (existing.status === 'signed') return res.status(400).json({ error: 'Impossible de modifier un contrat signé' });

    const { title, description, start_date, end_date, amount, billing_type, notes } = req.body;
    await db.run(
      `UPDATE client_contracts SET title=?, description=?, start_date=?, end_date=?, amount=?, billing_type=?, notes=? WHERE id=? AND company_id=?`,
      [title, description || null, start_date, end_date || null, amount || 0, billing_type || 'monthly', notes || null, req.params.id, req.user.companyId]
    );
    const updated = await db.get('SELECT * FROM client_contracts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const { changes } = await db.run('DELETE FROM client_contracts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!changes) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST envoyer pour signature ──────────────────────────────────────────────
router.post('/:id/send', requireWriter, async (req, res) => {
  try {
    const row = await db.get(`
      SELECT cc.*, cl.name AS client_name, cl.email AS client_email, cl.contact_name,
             co.name AS company_name
      FROM client_contracts cc
      JOIN clients cl    ON cc.client_id  = cl.id
      JOIN companies co  ON cc.company_id = co.id
      WHERE cc.id = ? AND cc.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!row) return res.status(404).json({ error: 'Contrat non trouvé' });
    if (!row.client_email) return res.status(400).json({ error: "Le client n'a pas d'email" });

    const token = crypto.randomBytes(32).toString('hex');
    await db.run('UPDATE client_contracts SET sign_token=?, status=? WHERE id=?', [token, 'sent', row.id]);

    const signUrl = `${APP_URL}/sign-client-contract/${token}`;
    const contactName = row.contact_name || row.client_name;
    await sendSystemEmail({
      to: row.client_email,
      subject: `Contrat de prestation à signer — ${row.company_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0F1117;color:#F1F5F9;padding:32px;border-radius:12px;">
          <h2 style="color:#3B82F6;margin:0 0 8px">Contrat à signer</h2>
          <p style="color:#94A3B8;margin:0 0 24px">Bonjour ${contactName},</p>
          <p style="color:#CBD5E1;margin:0 0 24px">
            <strong>${row.company_name}</strong> vous invite à signer le contrat de prestation suivant :
          </p>
          <div style="background:#1E2535;border-radius:8px;padding:16px;margin:0 0 24px">
            <p style="margin:0 0 4px;color:#F1F5F9;font-weight:600">${row.title}</p>
            <p style="margin:0;color:#94A3B8;font-size:14px">Début : ${new Date(row.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <a href="${signUrl}" style="display:inline-block;background:#3B82F6;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px">
            Consulter et signer le contrat
          </a>
          <p style="color:#475569;font-size:12px;margin:0">
            Ce lien est personnel et sécurisé. En signant, vous acceptez les termes du contrat par signature électronique (eIDAS).
          </p>
        </div>
      `,
    });

    res.json({ success: true, sign_url: signUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET par token (public) ───────────────────────────────────────────────────
router.get('/sign/:token', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT cc.*, cl.name AS client_name, cl.contact_name,
             co.name AS company_name, co.address AS company_address, co.phone AS company_phone
      FROM client_contracts cc
      JOIN clients   cl ON cc.client_id  = cl.id
      JOIN companies co ON cc.company_id = co.id
      WHERE cc.sign_token = ?
    `, [req.params.token]);
    if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST signer (public) ─────────────────────────────────────────────────────
router.post('/sign/:token', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM client_contracts WHERE sign_token = ?', [req.params.token]);
    if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    if (row.status === 'signed') return res.status(400).json({ error: 'Ce contrat a déjà été signé' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'inconnue';
    await db.run('UPDATE client_contracts SET status=?, signed_at=NOW(), signed_ip=? WHERE id=?', ['signed', ip, row.id]);
    res.json({ success: true, signed_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
