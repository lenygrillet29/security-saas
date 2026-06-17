const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/agent-documents?agent_id=&type=&expiring_days=
router.get('/', async (req, res) => {
  try {
    const { agent_id, type, expiring_days } = req.query;
    let sql = `
      SELECT d.*, a.first_name, a.last_name, a.color, a.employee_number
      FROM agent_documents d
      JOIN agents a ON d.agent_id = a.id
      WHERE d.company_id = ?
    `;
    const params = [req.user.companyId];
    if (agent_id)     { sql += ' AND d.agent_id = ?'; params.push(agent_id); }
    if (type)         { sql += ' AND d.type = ?';     params.push(type); }
    if (expiring_days) {
      const limit = new Date();
      limit.setDate(limit.getDate() + parseInt(expiring_days));
      sql += ' AND d.expiry_date IS NOT NULL AND d.expiry_date <= ?';
      params.push(limit.toISOString().slice(0, 10));
    }
    sql += ' ORDER BY a.last_name, a.first_name, d.expiry_date ASC NULLS LAST';
    res.json(await db.all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agent-documents/alerts — docs expirés ou expirant dans 60j
router.get('/alerts', async (req, res) => {
  try {
    const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const rows = await db.all(`
      SELECT d.*, a.first_name, a.last_name, a.color
      FROM agent_documents d
      JOIN agents a ON d.agent_id = a.id
      WHERE d.company_id = ? AND a.active = 1
        AND d.expiry_date IS NOT NULL AND d.expiry_date <= ?
      ORDER BY d.expiry_date ASC
    `, [req.user.companyId, in60]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agent-documents/stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const rows = await db.all(`
      SELECT type,
        COUNT(*) AS total,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date < ? THEN 1 ELSE 0 END)  AS expired,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date >= ? AND expiry_date <= ? THEN 1 ELSE 0 END) AS expiring_30
      FROM agent_documents
      WHERE company_id = ?
      GROUP BY type
    `, [today, today, in30, req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agent-documents
router.post('/', async (req, res) => {
  try {
    const { agent_id, type = 'autre', label, reference,
            issued_date, expiry_date, issuer, file_url, notes } = req.body;
    if (!agent_id || !label) return res.status(400).json({ error: 'agent_id et label requis' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO agent_documents (company_id, agent_id, type, label, reference,
        issued_date, expiry_date, issuer, file_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, type, label, reference || null,
       issued_date || null, expiry_date || null, issuer || null,
       file_url || null, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM agent_documents WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/agent-documents/:id
router.put('/:id', async (req, res) => {
  try {
    const { type, label, reference, issued_date, expiry_date, issuer, file_url, notes } = req.body;
    await db.run(
      `UPDATE agent_documents SET type=?, label=?, reference=?, issued_date=?,
        expiry_date=?, issuer=?, file_url=?, notes=?
       WHERE id = ? AND company_id = ?`,
      [type, label, reference || null, issued_date || null,
       expiry_date || null, issuer || null, file_url || null, notes || null,
       req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM agent_documents WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/agent-documents/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM agent_documents WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
