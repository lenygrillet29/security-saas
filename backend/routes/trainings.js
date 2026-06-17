const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/trainings?agent_id=&category=&expiring_days=
router.get('/', async (req, res) => {
  try {
    const { agent_id, category, expiring_days } = req.query;
    let sql = `
      SELECT t.*, a.first_name, a.last_name, a.color, a.employee_number
      FROM agent_trainings t
      JOIN agents a ON t.agent_id = a.id
      WHERE t.company_id = ?
    `;
    const params = [req.user.companyId];
    if (agent_id) { sql += ' AND t.agent_id = ?'; params.push(agent_id); }
    if (category)  { sql += ' AND t.category = ?'; params.push(category); }
    if (expiring_days) {
      const limit = new Date();
      limit.setDate(limit.getDate() + parseInt(expiring_days));
      sql += ` AND t.expiry_date IS NOT NULL AND t.expiry_date <= ?`;
      params.push(limit.toISOString().slice(0, 10));
    }
    sql += ' ORDER BY a.last_name, a.first_name, t.expiry_date ASC NULLS LAST';
    res.json(await db.all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/trainings/alerts — expirations dans les 60 prochains jours
router.get('/alerts', async (req, res) => {
  try {
    const today  = new Date().toISOString().slice(0, 10);
    const in60   = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const rows = await db.all(`
      SELECT t.*, a.first_name, a.last_name, a.color, a.employee_number
      FROM agent_trainings t
      JOIN agents a ON t.agent_id = a.id
      WHERE t.company_id = ? AND a.active = 1
        AND t.expiry_date IS NOT NULL AND t.expiry_date <= ?
      ORDER BY t.expiry_date ASC
    `, [req.user.companyId, in60]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/trainings/stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const in60  = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const rows = await db.all(`
      SELECT category, COUNT(*) AS total,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date < ? THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date >= ? AND expiry_date <= ? THEN 1 ELSE 0 END) AS expiring_30,
        SUM(CASE WHEN expiry_date IS NULL OR expiry_date > ? THEN 1 ELSE 0 END) AS valid
      FROM agent_trainings
      WHERE company_id = ?
      GROUP BY category
    `, [today, today, in30, in60, req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/trainings/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get(
      'SELECT * FROM agent_trainings WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/trainings
router.post('/', async (req, res) => {
  try {
    const { agent_id, name, category = 'formation', obtained_date,
            expiry_date, issuer, reference, notes } = req.body;
    if (!agent_id || !name) return res.status(400).json({ error: 'agent_id et name requis' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO agent_trainings (company_id, agent_id, name, category,
        obtained_date, expiry_date, issuer, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, name, category,
       obtained_date || null, expiry_date || null,
       issuer || null, reference || null, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM agent_trainings WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/trainings/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, obtained_date, expiry_date, issuer, reference, notes } = req.body;
    await db.run(
      `UPDATE agent_trainings SET name=?, category=?, obtained_date=?, expiry_date=?,
        issuer=?, reference=?, notes=?
       WHERE id = ? AND company_id = ?`,
      [name, category, obtained_date || null, expiry_date || null,
       issuer || null, reference || null, notes || null,
       req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM agent_trainings WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/trainings/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM agent_trainings WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
