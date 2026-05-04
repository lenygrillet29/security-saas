const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY name').all();
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client non trouvé' });
  res.json(client);
});

router.post('/', (req, res) => {
  const { name, contact_name, email, phone, address, city, postal_code, siret, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const result = db.prepare(
    `INSERT INTO clients (name, contact_name, email, phone, address, city, postal_code, siret, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, contact_name || null, email || null, phone || null,
    address || null, city || null, postal_code || null, siret || null, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, contact_name, email, phone, address, city, postal_code, siret, active, notes } = req.body;
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client non trouvé' });
  db.prepare(
    `UPDATE clients SET name=?, contact_name=?, email=?, phone=?, address=?, city=?, postal_code=?, siret=?, active=?, notes=?
     WHERE id=?`
  ).run(name, contact_name || null, email || null, phone || null,
    address || null, city || null, postal_code || null, siret || null,
    active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client non trouvé' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
