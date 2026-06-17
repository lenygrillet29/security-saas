const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/contract-templates
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM contract_templates WHERE company_id = ?';
    const params = [req.user.companyId];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY name';
    res.json(await db.all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contract-templates/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get(
      'SELECT * FROM contract_templates WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/contract-templates
router.post('/', async (req, res) => {
  try {
    const { name, category = 'client', body = '', notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name requis' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO contract_templates (company_id, name, category, body, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.companyId, name, category, body, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM contract_templates WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/contract-templates/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, body, notes } = req.body;
    await db.run(
      `UPDATE contract_templates SET name=?, category=?, body=?, notes=?, updated_at=CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [name, category, body, notes || null, req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM contract_templates WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/contract-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM contract_templates WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
