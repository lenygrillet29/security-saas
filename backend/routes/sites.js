const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { client_id } = req.query;
  let query = `
    SELECT s.*, c.name as client_name
    FROM sites s
    JOIN clients c ON s.client_id = c.id
  `;
  const params = [];
  if (client_id) {
    query += ' WHERE s.client_id = ?';
    params.push(client_id);
  }
  query += ' ORDER BY c.name, s.name';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const site = db.prepare(`
    SELECT s.*, c.name as client_name
    FROM sites s JOIN clients c ON s.client_id = c.id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site non trouvé' });
  res.json(site);
});

router.post('/', (req, res) => {
  const { client_id, name, address, city, hourly_rate_day, hourly_rate_night, hourly_rate_sunday, notes } = req.body;
  if (!client_id || !name) return res.status(400).json({ error: 'client_id et nom requis' });
  const result = db.prepare(
    `INSERT INTO sites (client_id, name, address, city, hourly_rate_day, hourly_rate_night, hourly_rate_sunday, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(client_id, name, address || null, city || null,
    hourly_rate_day || 0, hourly_rate_night || 0, hourly_rate_sunday || 0, notes || null);
  res.status(201).json(db.prepare(`
    SELECT s.*, c.name as client_name FROM sites s JOIN clients c ON s.client_id = c.id WHERE s.id = ?
  `).get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { client_id, name, address, city, hourly_rate_day, hourly_rate_night, hourly_rate_sunday, active, notes } = req.body;
  const existing = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Site non trouvé' });
  db.prepare(
    `UPDATE sites SET client_id=?, name=?, address=?, city=?, hourly_rate_day=?, hourly_rate_night=?, hourly_rate_sunday=?, active=?, notes=?
     WHERE id=?`
  ).run(client_id, name, address || null, city || null,
    hourly_rate_day || 0, hourly_rate_night || 0, hourly_rate_sunday || 0,
    active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id);
  res.json(db.prepare(`
    SELECT s.*, c.name as client_name FROM sites s JOIN clients c ON s.client_id = c.id WHERE s.id = ?
  `).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Site non trouvé' });
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
