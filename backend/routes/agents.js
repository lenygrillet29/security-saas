const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { active } = req.query;
  let query = `SELECT * FROM agents`;
  const params = [];
  if (active !== undefined) {
    query += ` WHERE active = ?`;
    params.push(active === 'true' || active === '1' ? 1 : 0);
  }
  query += ` ORDER BY last_name, first_name`;
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
  res.json(agent);
});

router.post('/', (req, res) => {
  const { first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, notes } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'Prénom et nom requis' });
  const result = db.prepare(
    `INSERT INTO agents (first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(first_name, last_name, email || null, phone || null, employee_number || null,
    contract_type || 'CDI', hourly_rate || 0, color || '#3B82F6', notes || null);
  res.status(201).json(db.prepare('SELECT * FROM agents WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, active, notes } = req.body;
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Agent non trouvé' });
  db.prepare(
    `UPDATE agents SET first_name=?, last_name=?, email=?, phone=?, employee_number=?, contract_type=?,
     hourly_rate=?, color=?, active=?, notes=? WHERE id=?`
  ).run(first_name, last_name, email || null, phone || null, employee_number || null,
    contract_type || 'CDI', hourly_rate || 0, color || '#3B82F6',
    active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Agent non trouvé' });
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
