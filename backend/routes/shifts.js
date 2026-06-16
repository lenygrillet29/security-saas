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

// /stats/revenue — CA mensuel sur les 6 derniers mois
router.get('/stats/revenue', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', sh.date::date), 'YYYY-MM') AS month,
        ROUND(SUM(
          sh.hours_day    * COALESCE(s.hourly_rate_day,    0) +
          sh.hours_night  * COALESCE(s.hourly_rate_night,  0) +
          sh.hours_sunday * COALESCE(s.hourly_rate_sunday, 0)
        )::numeric, 2) AS revenue,
        ROUND(SUM(sh.hours_day + sh.hours_night + sh.hours_sunday)::numeric, 1) AS hours
      FROM shifts sh
      JOIN sites s ON sh.site_id = s.id
      WHERE sh.company_id = ?
        AND sh.date >= TO_CHAR(NOW() - INTERVAL '5 months', 'YYYY-MM-01')
      GROUP BY month
      ORDER BY month
    `, [req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /stats/clients — top clients par CA ce mois
router.get('/stats/clients', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = await db.all(`
      SELECT
        c.id, c.name,
        ROUND(SUM(
          sh.hours_day    * COALESCE(s.hourly_rate_day,    0) +
          sh.hours_night  * COALESCE(s.hourly_rate_night,  0) +
          sh.hours_sunday * COALESCE(s.hourly_rate_sunday, 0)
        )::numeric, 2) AS revenue,
        ROUND(SUM(sh.hours_day + sh.hours_night + sh.hours_sunday)::numeric, 1) AS hours,
        COUNT(DISTINCT sh.id) AS shift_count
      FROM shifts sh
      JOIN sites  s ON sh.site_id  = s.id
      JOIN clients c ON s.client_id = c.id
      WHERE sh.company_id = ?
        AND sh.date >= ? AND sh.date <= ?
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
      LIMIT 10
    `, [req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /stats/summary AVANT /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = await db.all(`
      SELECT
        agent_id,
        a.first_name, a.last_name,
        SUM(hours_day)                                  as total_day,
        SUM(hours_night)                                as total_night,
        SUM(hours_sunday)                               as total_sunday,
        COALESCE(SUM(hours_sunday_night), 0)            as total_sunday_night,
        COALESCE(SUM(hours_holiday), 0)                 as total_holiday,
        COALESCE(SUM(hours_holiday_night), 0)           as total_holiday_night,
        COALESCE(SUM(hours_holiday_sunday_day), 0)      as total_holiday_sunday_day,
        COALESCE(SUM(hours_holiday_sunday_night), 0)    as total_holiday_sunday_night,
        COUNT(*)                                        as shift_count
      FROM shifts sh
      JOIN agents a ON sh.agent_id = a.id
      WHERE sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      GROUP BY agent_id, a.first_name, a.last_name
      ORDER BY a.last_name
    `, [req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /recap — Récapitulatif détaillé heures par agent sur une période
router.get('/recap', async (req, res) => {
  try {
    const { start_date, end_date, agent_id } = req.query;
    const from = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to   = end_date   || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

    let query = `
      SELECT
        a.id as agent_id,
        a.first_name, a.last_name, a.employee_number, a.hourly_rate,
        COUNT(sh.id) as shift_count,
        ROUND(SUM(sh.hours_day)::numeric, 2)                                      as total_day,
        ROUND(SUM(sh.hours_night)::numeric, 2)                                    as total_night,
        ROUND(SUM(sh.hours_sunday)::numeric, 2)                                   as total_sunday,
        ROUND(COALESCE(SUM(sh.hours_sunday_night), 0)::numeric, 2)               as total_sunday_night,
        ROUND(SUM(COALESCE(sh.hours_holiday, 0))::numeric, 2)                    as total_holiday,
        ROUND(COALESCE(SUM(sh.hours_holiday_night), 0)::numeric, 2)              as total_holiday_night,
        ROUND(COALESCE(SUM(sh.hours_holiday_sunday_day), 0)::numeric, 2)         as total_holiday_sunday_day,
        ROUND(COALESCE(SUM(sh.hours_holiday_sunday_night), 0)::numeric, 2)       as total_holiday_sunday_night,
        ROUND(SUM(
          sh.hours_day + sh.hours_night + sh.hours_sunday +
          COALESCE(sh.hours_sunday_night, 0) + COALESCE(sh.hours_holiday, 0) +
          COALESCE(sh.hours_holiday_night, 0) + COALESCE(sh.hours_holiday_sunday_day, 0) +
          COALESCE(sh.hours_holiday_sunday_night, 0)
        )::numeric, 2) as total_hours
      FROM shifts sh
      JOIN agents a ON a.id = sh.agent_id
      WHERE sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
    `;
    const params = [req.user.companyId, from, to];
    if (agent_id) { query += ' AND sh.agent_id = ?'; params.push(agent_id); }
    query += ' GROUP BY a.id, a.first_name, a.last_name, a.employee_number, a.hourly_rate ORDER BY a.last_name, a.first_name';

    const rows = await db.all(query, params);
    res.json({ from, to, agents: rows });
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
      `INSERT INTO shifts (company_id, agent_id, site_id, date, start_time, end_time,
        hours_day, hours_night, hours_sunday, hours_sunday_night,
        hours_holiday, hours_holiday_night, hours_holiday_sunday_day, hours_holiday_sunday_night, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, site_id, date, start_time, end_time,
        hours.hours_day, hours.hours_night, hours.hours_sunday, hours.hours_sunday_night,
        hours.hours_holiday, hours.hours_holiday_night,
        hours.hours_holiday_sunday_day, hours.hours_holiday_sunday_night, notes || null]
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
       hours_day=?, hours_night=?, hours_sunday=?, hours_sunday_night=?,
       hours_holiday=?, hours_holiday_night=?, hours_holiday_sunday_day=?, hours_holiday_sunday_night=?,
       notes=? WHERE id=?`,
      [agent_id, site_id, date, start_time, end_time,
        hours.hours_day, hours.hours_night, hours.hours_sunday, hours.hours_sunday_night,
        hours.hours_holiday, hours.hours_holiday_night,
        hours.hours_holiday_sunday_day, hours.hours_holiday_sunday_night,
        notes || null, req.params.id]
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

// ─── Simulation planning & marge ─────────────────────────────────────────────
// GET /api/shifts/stats/margin?start_date=&end_date=
router.get('/stats/margin', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = await db.all(`
      SELECT
        sh.date,
        sh.start_time, sh.end_time,
        sh.hours_day, sh.hours_night, sh.hours_sunday,
        a.first_name, a.last_name,
        COALESCE(a.hourly_rate, 0) AS agent_rate,
        s.name AS site_name,
        COALESCE(s.hourly_rate_day,    set_day.value::numeric,    0) AS rate_day,
        COALESCE(s.hourly_rate_night,  set_night.value::numeric,  0) AS rate_night,
        COALESCE(s.hourly_rate_sunday, set_sun.value::numeric,    0) AS rate_sunday,
        c.name AS client_name
      FROM shifts sh
      JOIN agents  a ON sh.agent_id  = a.id
      JOIN sites   s ON sh.site_id   = s.id
      JOIN clients c ON s.client_id  = c.id
      LEFT JOIN settings set_day   ON set_day.company_id   = sh.company_id AND set_day.key   = 'hourly_rate_day'
      LEFT JOIN settings set_night ON set_night.company_id = sh.company_id AND set_night.key = 'hourly_rate_night'
      LEFT JOIN settings set_sun   ON set_sun.company_id   = sh.company_id AND set_sun.key   = 'hourly_rate_sunday'
      WHERE sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, sh.start_time
    `, [req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    // Calcul des totaux
    let totalRevenue = 0, totalCost = 0;
    const byAgent = {};

    const result = rows.map(r => {
      const revenue = r.hours_day * r.rate_day + r.hours_night * r.rate_night + r.hours_sunday * r.rate_sunday;
      const totalH = r.hours_day + r.hours_night + r.hours_sunday;
      const cost = totalH * r.agent_rate;
      const margin = revenue - cost;
      totalRevenue += revenue;
      totalCost += cost;

      const key = `${r.first_name} ${r.last_name}`;
      if (!byAgent[key]) byAgent[key] = { name: key, revenue: 0, cost: 0, hours: 0 };
      byAgent[key].revenue += revenue;
      byAgent[key].cost += cost;
      byAgent[key].hours += totalH;

      return { ...r, revenue: Math.round(revenue * 100) / 100, cost: Math.round(cost * 100) / 100, margin: Math.round(margin * 100) / 100, total_hours: Math.round(totalH * 100) / 100 };
    });

    res.json({
      shifts: result,
      summary: {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        total_margin: Math.round((totalRevenue - totalCost) * 100) / 100,
        margin_pct: totalRevenue > 0 ? Math.round((totalRevenue - totalCost) / totalRevenue * 10000) / 100 : 0,
        by_agent: Object.values(byAgent).map(a => ({
          ...a,
          revenue: Math.round(a.revenue * 100) / 100,
          cost: Math.round(a.cost * 100) / 100,
          margin: Math.round((a.revenue - a.cost) * 100) / 100,
          hours: Math.round(a.hours * 100) / 100,
        })),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
