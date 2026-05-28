const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let query = `SELECT * FROM agents WHERE company_id = ?`;
    const params = [req.user.companyId];
    if (active !== undefined) {
      query += ` AND active = ?`;
      params.push(active === 'true' || active === '1' ? 1 : 0);
    }
    query += ` ORDER BY last_name, first_name`;
    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const agent = await db.get(
      'SELECT * FROM agents WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    res.json(agent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, notes } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'Prénom et nom requis' });
    const result = await db.insert(
      `INSERT INTO agents (company_id, first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, first_name, last_name, email || null, phone || null,
        employee_number || null, contract_type || 'CDI', hourly_rate || 0, color || '#3B82F6', notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM agents WHERE id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, active, notes } = req.body;
    const existing = await db.get('SELECT id FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run(
      `UPDATE agents SET first_name=?, last_name=?, email=?, phone=?, employee_number=?, contract_type=?,
       hourly_rate=?, color=?, active=?, notes=? WHERE id=?`,
      [first_name, last_name, email || null, phone || null, employee_number || null,
        contract_type || 'CDI', hourly_rate || 0, color || '#3B82F6',
        active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id]
    );
    res.json(await db.get('SELECT * FROM agents WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run('DELETE FROM agents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
