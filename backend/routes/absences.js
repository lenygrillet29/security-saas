const express = require('express');
const router = express.Router();
const db = require('../db/database');

const ABSENCES_QUERY = `
  SELECT ab.*, a.first_name, a.last_name, a.color as agent_color
  FROM absences ab
  JOIN agents a ON ab.agent_id = a.id
`;

router.get('/', (req, res) => {
  const { agent_id, start_date, end_date, type, status } = req.query;
  let query = ABSENCES_QUERY + ' WHERE 1=1';
  const params = [];

  if (agent_id) { query += ' AND ab.agent_id = ?'; params.push(agent_id); }
  if (start_date) { query += ' AND ab.end_date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND ab.start_date <= ?'; params.push(end_date); }
  if (type) { query += ' AND ab.type = ?'; params.push(type); }
  if (status) { query += ' AND ab.status = ?'; params.push(status); }
  query += ' ORDER BY ab.start_date DESC';

  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const absence = db.prepare(ABSENCES_QUERY + ' WHERE ab.id = ?').get(req.params.id);
  if (!absence) return res.status(404).json({ error: 'Absence non trouvée' });
  res.json(absence);
});

router.post('/', (req, res) => {
  const { agent_id, start_date, end_date, type, status, notes } = req.body;
  if (!agent_id || !start_date || !end_date || !type)
    return res.status(400).json({ error: 'Champs requis manquants' });
  const result = db.prepare(
    `INSERT INTO absences (agent_id, start_date, end_date, type, status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(agent_id, start_date, end_date, type, status || 'approved', notes || null);
  res.status(201).json(db.prepare(ABSENCES_QUERY + ' WHERE ab.id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { agent_id, start_date, end_date, type, status, notes } = req.body;
  const existing = db.prepare('SELECT id FROM absences WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Absence non trouvée' });
  db.prepare(
    `UPDATE absences SET agent_id=?, start_date=?, end_date=?, type=?, status=?, notes=? WHERE id=?`
  ).run(agent_id, start_date, end_date, type, status || 'approved', notes || null, req.params.id);
  res.json(db.prepare(ABSENCES_QUERY + ' WHERE ab.id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM absences WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Absence non trouvée' });
  db.prepare('DELETE FROM absences WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
