const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');
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

// /stats/summary AVANT /:id
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
      WHERE sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      GROUP BY agent_id, a.first_name, a.last_name
      ORDER BY a.last_name
    `, [req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { agent_id, site_id, client_id, start_date, end_date } = req.query;
    let query = SHIFTS_QUERY + ' WHERE sh.company_id = ?';
    const params = [req.user.companyId];

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
    const shift = await db.get(SHIFTS_QUERY + ' WHERE sh.id = ? AND sh.company_id = ?', [req.params.id, req.user.companyId]);
    if (!shift) return res.status(404).json({ error: 'Shift non trouvé' });
    res.json(shift);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { agent_id, site_id, date, start_time, end_time, notes } = req.body;
    if (!agent_id || !site_id || !date || !start_time || !end_time)
      return res.status(400).json({ error: 'Champs requis manquants' });

    const hours = calculateHours(date, start_time, end_time);
    const result = await db.insert(
      `INSERT INTO shifts (company_id, agent_id, site_id, date, start_time, end_time, hours_day, hours_night, hours_sunday, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, site_id, date, start_time, end_time,
        hours.hours_day, hours.hours_night, hours.hours_sunday, notes || null]
    );
    res.status(201).json(await db.get(SHIFTS_QUERY + ' WHERE sh.id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { agent_id, site_id, date, start_time, end_time, notes } = req.body;
    const existing = await db.get('SELECT id FROM shifts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
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

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM shifts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Shift non trouvé' });
    await db.run('DELETE FROM shifts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Prise de service géolocalisée ───────────────────────────────────────────
// Distance haversine en mètres entre deux coordonnées GPS
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const CHECKIN_RADIUS_METERS = parseInt(process.env.CHECKIN_RADIUS_METERS) || 200;

// POST /api/shifts/:id/checkin
router.post('/:id/checkin', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude et longitude requis' });
    }

    const shift = await db.get(`
      SELECT sh.*, s.latitude AS site_lat, s.longitude AS site_lng, s.name AS site_name
      FROM shifts sh JOIN sites s ON sh.site_id = s.id
      WHERE sh.id = ? AND sh.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!shift) return res.status(404).json({ error: 'Shift non trouvé' });
    if (shift.checkin_at) return res.status(400).json({ error: 'Prise de service déjà effectuée' });

    // Vérification de la distance si le site a des coordonnées GPS
    let distance = null;
    if (shift.site_lat != null && shift.site_lng != null) {
      distance = Math.round(haversineMeters(latitude, longitude, shift.site_lat, shift.site_lng));
      if (distance > CHECKIN_RADIUS_METERS) {
        return res.status(400).json({
          error: `Vous êtes trop loin du site (${distance} m). Rayon autorisé : ${CHECKIN_RADIUS_METERS} m.`,
          distance,
          max_distance: CHECKIN_RADIUS_METERS,
        });
      }
    }

    await db.run(
      'UPDATE shifts SET checkin_at = NOW(), checkin_lat = ?, checkin_lng = ?, checkin_distance = ? WHERE id = ?',
      [latitude, longitude, distance, req.params.id]
    );
    res.json({ success: true, distance, checked_in_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shifts/:id/checkout
router.post('/:id/checkout', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude et longitude requis' });
    }

    const shift = await db.get(`
      SELECT sh.*, s.latitude AS site_lat, s.longitude AS site_lng
      FROM shifts sh JOIN sites s ON sh.site_id = s.id
      WHERE sh.id = ? AND sh.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!shift) return res.status(404).json({ error: 'Shift non trouvé' });
    if (!shift.checkin_at) return res.status(400).json({ error: 'Prise de service non effectuée' });
    if (shift.checkout_at) return res.status(400).json({ error: 'Fin de service déjà enregistrée' });

    let distance = null;
    if (shift.site_lat != null && shift.site_lng != null) {
      distance = Math.round(haversineMeters(latitude, longitude, shift.site_lat, shift.site_lng));
    }

    await db.run(
      'UPDATE shifts SET checkout_at = NOW(), checkout_lat = ?, checkout_lng = ? WHERE id = ?',
      [latitude, longitude, req.params.id]
    );
    res.json({ success: true, distance, checked_out_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
