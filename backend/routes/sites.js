const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');

const SITE_QUERY = `
  SELECT s.*, c.name as client_name
  FROM sites s JOIN clients c ON s.client_id = c.id
`;

router.get('/', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = SITE_QUERY + ' WHERE s.company_id = ?';
    const params = [req.user.companyId];
    if (client_id) { query += ' AND s.client_id = ?'; params.push(client_id); }
    query += ' ORDER BY c.name, s.name';
    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const site = await db.get(SITE_QUERY + ' WHERE s.id = ? AND s.company_id = ?', [req.params.id, req.user.companyId]);
    if (!site) return res.status(404).json({ error: 'Site non trouvé' });
    res.json(site);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { client_id, name, address, city, hourly_rate_day, hourly_rate_night, hourly_rate_sunday, notes } = req.body;
    if (!client_id || !name) return res.status(400).json({ error: 'client_id et nom requis' });
    const result = await db.insert(
      `INSERT INTO sites (company_id, client_id, name, address, city, hourly_rate_day, hourly_rate_night, hourly_rate_sunday, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, client_id, name, address || null, city || null,
        hourly_rate_day || 0, hourly_rate_night || 0, hourly_rate_sunday || 0, notes || null]
    );
    res.status(201).json(await db.get(SITE_QUERY + ' WHERE s.id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { client_id, name, address, city, hourly_rate_day, hourly_rate_night, hourly_rate_sunday, active, notes } = req.body;
    const existing = await db.get('SELECT id FROM sites WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Site non trouvé' });
    await db.run(
      `UPDATE sites SET client_id=?, name=?, address=?, city=?, hourly_rate_day=?, hourly_rate_night=?, hourly_rate_sunday=?, active=?, notes=?
       WHERE id=?`,
      [client_id, name, address || null, city || null,
        hourly_rate_day || 0, hourly_rate_night || 0, hourly_rate_sunday || 0,
        active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id]
    );
    res.json(await db.get(SITE_QUERY + ' WHERE s.id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM sites WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Site non trouvé' });
    await db.run('DELETE FROM sites WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
