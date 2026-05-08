const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { calculateHours } = require('../utils/hoursCalculator');

const SHIFTS_QUERY = `
  SELECT sh.*,
    a.first_name as agent_first_name, a.last_name as agent_last_name, a.color as agent_color,
    s.name as site_name, s.client_id,
    c.name as client_name
  FROM shifts sh
  JOIN agents a ON sh.agent_id = a.id
  JOIN sites s ON sh.site_id = s.id
  JOIN clients c ON s.client_id = c.id
`;

// Stats doit être avant /:id pour ne pas être capturée par la route paramétrée
router.get('/stats/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = await db.all(`
      SELECT
        agent_id,
        a.first_name, a.last_name,
        SUM(hours_day) as total_day,
        SUM(hours_night) as total_night,
        SUM(hours_sunday) as total_sunday,
        COUNT(*) as shift_count
      FROM shifts sh
      JOIN agents a ON sh.agent_id = a.id
      WHERE sh.date >= ? AND sh.date <= ?
      GROUP BY agent_id, a.first_name, a.last_name
      ORDER BY a.last_name
    `, [start_date || '2000-01-01', end_date || '2099-12-31']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { agent_id, site_id, client_id, start_date, end_date } = req.query;
    let query = SHIFTS_QUERY + ' WHERE 1=1';
    const params = [];

    if (agent_id) { query += ' AND sh.agent_id = ?'; params.push(agent_id); }
    if (site_id) { query += ' AND sh.site_id = ?'; params.push(site_id); }
    if (client_id) { query += ' AND s.client_id = ?'; params.push(client_id); }
    if (start_date) { query += ' AND sh.date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND sh.date <= ?'; params.push(end_date); }
    query += ' ORDER BY sh.date, sh.start_time';

    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const shift = await db.get(SHIFTS_QUERY + ' WHERE sh.id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift non trouvé' });
    res.json(shift);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { agent_id, site_id, date, start_time, end_time, notes } = req.body;
    if (!agent_id || !site_id || !date || !start_time || !end_time)
      return res.status(400).json({ error: 'Champs requis manquants' });

    const hours = calculateHours(date, start_time, end_time);
    const result = await db.insert(
      `INSERT INTO shifts (agent_id, site_id, date, start_time, end_time, hours_day, hours_night, hours_sunday, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agent_id, site_id, date, start_time, end_time,
        hours.hours_day, hours.hours_night, hours.hours_sunday, notes || null]
    );
    res.status(201).json(await db.get(SHIFTS_QUERY + ' WHERE sh.id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { agent_id, site_id, date, start_time, end_time, notes } = req.body;
    const existing = await db.get('SELECT id FROM shifts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Shift non trouvé' });

    const hours = calculateHours(date, start_time, end_time);
    await db.run(
      `UPDATE shifts SET agent_id=?, site_id=?, date=?, start_time=?, end_time=?,
       hours_day=?, hours_night=?, hours_sunday=?, notes=? WHERE id=?`,
      [agent_id, site_id, date, start_time, end_time,
        hours.hours_day, hours.hours_night, hours.hours_sunday, notes || null, req.params.id]
    );
    res.json(await db.get(SHIFTS_QUERY + ' WHERE sh.id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM shifts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Shift non trouvé' });
    await db.run('DELETE FROM shifts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
