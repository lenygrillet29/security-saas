const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

const CATEGORIES = ['tenue', 'badge', 'materiel', 'vehicule', 'autre'];
const CONDITIONS  = ['neuf', 'bon', 'use', 'endommage'];

// GET /api/equipments?agent_id=&category=&returned=
router.get('/', async (req, res) => {
  try {
    const { agent_id, category, returned } = req.query;
    let sql = `
      SELECT e.*, a.first_name, a.last_name, a.color, a.employee_number
      FROM equipments e
      JOIN agents a ON e.agent_id = a.id
      WHERE e.company_id = ?
    `;
    const params = [req.user.companyId];
    if (agent_id) { sql += ' AND e.agent_id = ?'; params.push(agent_id); }
    if (category)  { sql += ' AND e.category = ?'; params.push(category); }
    if (returned === 'false') { sql += ' AND e.returned_at IS NULL'; }
    if (returned === 'true')  { sql += ' AND e.returned_at IS NOT NULL'; }
    sql += ' ORDER BY a.last_name, a.first_name, e.issued_date DESC';
    res.json(await db.all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/equipments/stats
router.get('/stats', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT category, COUNT(*) AS total,
             SUM(CASE WHEN returned_at IS NULL THEN 1 ELSE 0 END) AS en_cours,
             SUM(CASE WHEN returned_at IS NOT NULL THEN 1 ELSE 0 END) AS rendus
      FROM equipments WHERE company_id = ?
      GROUP BY category
    `, [req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/equipments/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get(
      'SELECT * FROM equipments WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/equipments
router.post('/', async (req, res) => {
  try {
    const { agent_id, category = 'tenue', label, size, quantity = 1,
            condition = 'neuf', issued_date, return_date, serial_number, notes } = req.body;
    if (!agent_id || !label || !issued_date) return res.status(400).json({ error: 'agent_id, label et issued_date requis' });
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Catégorie invalide' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO equipments (company_id, agent_id, category, label, size, quantity,
        condition, issued_date, return_date, serial_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, category, label, size || null, quantity,
       condition, issued_date, return_date || null, serial_number || null, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM equipments WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/equipments/:id
router.put('/:id', async (req, res) => {
  try {
    const { category, label, size, quantity, condition, issued_date,
            return_date, serial_number, notes } = req.body;
    await db.run(
      `UPDATE equipments SET category=?, label=?, size=?, quantity=?, condition=?,
        issued_date=?, return_date=?, serial_number=?, notes=?
       WHERE id = ? AND company_id = ?`,
      [category, label, size || null, quantity, condition, issued_date,
       return_date || null, serial_number || null, notes || null,
       req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM equipments WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/equipments/:id/return  — marque comme rendu
router.post('/:id/return', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { returned_at = today, notes } = req.body;
    await db.run(
      `UPDATE equipments SET returned_at = ?, notes = COALESCE(?, notes)
       WHERE id = ? AND company_id = ?`,
      [returned_at, notes || null, req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM equipments WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/equipments/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM equipments WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
