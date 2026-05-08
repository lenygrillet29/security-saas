const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    res.json(await db.all('SELECT * FROM clients ORDER BY name'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });
    res.json(client);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, city, postal_code, siret, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const result = await db.insert(
      `INSERT INTO clients (name, contact_name, email, phone, address, city, postal_code, siret, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, contact_name || null, email || null, phone || null,
        address || null, city || null, postal_code || null, siret || null, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM clients WHERE id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, city, postal_code, siret, active, notes } = req.body;
    const existing = await db.get('SELECT id FROM clients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client non trouvé' });
    await db.run(
      `UPDATE clients SET name=?, contact_name=?, email=?, phone=?, address=?, city=?, postal_code=?, siret=?, active=?, notes=?
       WHERE id=?`,
      [name, contact_name || null, email || null, phone || null,
        address || null, city || null, postal_code || null, siret || null,
        active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id]
    );
    res.json(await db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM clients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client non trouvé' });
    await db.run('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
