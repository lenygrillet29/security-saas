const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// ─── GET liste ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { agent_id, status } = req.query;
    let q = `
      SELECT e.*,
             a.first_name || ' ' || a.last_name AS agent_name, a.color AS agent_color,
             s.name AS site_name
      FROM expense_reports e
      JOIN agents a ON a.id = e.agent_id
      LEFT JOIN shifts sh ON sh.id = e.shift_id
      LEFT JOIN sites  s  ON s.id  = sh.site_id
      WHERE e.company_id = ?
    `;
    const p = [req.user.companyId];
    if (agent_id) { q += ' AND e.agent_id = ?'; p.push(agent_id); }
    if (status)   { q += ' AND e.status = ?';   p.push(status); }
    q += ' ORDER BY e.date DESC, e.created_at DESC';
    res.json(await db.all(q, p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET stats ────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending_count,
        SUM(amount) FILTER (WHERE status = 'pending')  AS pending_amount,
        SUM(amount) FILTER (WHERE status = 'approved') AS approved_amount,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count
      FROM expense_reports WHERE company_id = ?
    `, [req.user.companyId]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST créer ───────────────────────────────────────────────────────────────
router.post('/', requireWriter, async (req, res) => {
  try {
    const { agent_id, shift_id, date, type, description, amount, notes } = req.body;
    if (!agent_id || !date || !amount) return res.status(400).json({ error: 'agent_id, date et amount sont requis' });

    const { lastInsertRowid } = await db.insert(
      `INSERT INTO expense_reports (company_id, agent_id, shift_id, date, type, description, amount, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.companyId, agent_id, shift_id || null, date, type || 'autre', description || null, parseFloat(amount), notes || null]
    );
    const created = await db.get(`
      SELECT e.*, a.first_name || ' ' || a.last_name AS agent_name
      FROM expense_reports e JOIN agents a ON a.id = e.agent_id WHERE e.id = ?
    `, [lastInsertRowid]);
    logAudit(req, { action: 'CREATE', entityType: 'expense', entityId: created.id, entityName: `${created.agent_name} — ${amount}€` });
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT modifier ─────────────────────────────────────────────────────────────
router.put('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM expense_reports WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Note de frais non trouvée' });
    if (existing.status !== 'pending') return res.status(400).json({ error: 'Impossible de modifier une note déjà traitée' });

    const { shift_id, date, type, description, amount, notes } = req.body;
    await db.run(
      `UPDATE expense_reports SET shift_id=?, date=?, type=?, description=?, amount=?, notes=? WHERE id=? AND company_id=?`,
      [shift_id || null, date, type || 'autre', description || null, parseFloat(amount), notes || null, req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM expense_reports WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST approuver ───────────────────────────────────────────────────────────
router.post('/:id/approve', requireWriter, async (req, res) => {
  try {
    const { changes } = await db.run(
      `UPDATE expense_reports SET status='approved', reject_reason=NULL WHERE id=? AND company_id=? AND status='pending'`,
      [req.params.id, req.user.companyId]
    );
    if (!changes) return res.status(404).json({ error: 'Note non trouvée ou déjà traitée' });
    logAudit(req, { action: 'APPROVE', entityType: 'expense', entityId: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST rejeter ─────────────────────────────────────────────────────────────
router.post('/:id/reject', requireWriter, async (req, res) => {
  try {
    const { reason } = req.body;
    const { changes } = await db.run(
      `UPDATE expense_reports SET status='rejected', reject_reason=? WHERE id=? AND company_id=? AND status='pending'`,
      [reason || null, req.params.id, req.user.companyId]
    );
    if (!changes) return res.status(404).json({ error: 'Note non trouvée ou déjà traitée' });
    logAudit(req, { action: 'REJECT', entityType: 'expense', entityId: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const { changes } = await db.run('DELETE FROM expense_reports WHERE id=? AND company_id=?', [req.params.id, req.user.companyId]);
    if (!changes) return res.status(404).json({ error: 'Note non trouvée' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
