const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/vacation-reports
router.get('/', async (req, res) => {
  try {
    const { agent_id, site_id, start_date, end_date, status } = req.query;
    let q = `
      SELECT vr.*,
        a.first_name AS agent_first, a.last_name AS agent_last, a.color AS agent_color,
        s.name AS site_name,
        u.first_name AS creator_first, u.last_name AS creator_last
      FROM vacation_reports vr
      JOIN agents a ON a.id = vr.agent_id
      LEFT JOIN sites s ON s.id = vr.site_id
      LEFT JOIN users u ON u.id = vr.created_by
      WHERE vr.company_id = ?
    `;
    const params = [req.user.companyId];
    if (agent_id)   { q += ' AND vr.agent_id = ?';   params.push(agent_id); }
    if (site_id)    { q += ' AND vr.site_id = ?';    params.push(site_id); }
    if (start_date) { q += ' AND vr.report_date >= ?'; params.push(start_date); }
    if (end_date)   { q += ' AND vr.report_date <= ?'; params.push(end_date); }
    if (status)     { q += ' AND vr.status = ?';     params.push(status); }
    q += ' ORDER BY vr.report_date DESC, vr.created_at DESC';
    res.json(await db.all(q, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/vacation-reports/stats
router.get('/stats', async (req, res) => {
  try {
    const cid = req.user.companyId;
    const [total, signed, draft, today] = await Promise.all([
      db.get('SELECT COUNT(*) AS n FROM vacation_reports WHERE company_id = ?', [cid]),
      db.get("SELECT COUNT(*) AS n FROM vacation_reports WHERE company_id = ? AND status = 'signe'", [cid]),
      db.get("SELECT COUNT(*) AS n FROM vacation_reports WHERE company_id = ? AND status = 'brouillon'", [cid]),
      db.get("SELECT COUNT(*) AS n FROM vacation_reports WHERE company_id = ? AND report_date = date('now')", [cid]),
    ]);
    res.json({ total: total.n, signed: signed.n, draft: draft.n, today: today.n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/vacation-reports/:id
router.get('/:id', async (req, res) => {
  try {
    const report = await db.get(`
      SELECT vr.*,
        a.first_name AS agent_first, a.last_name AS agent_last, a.color AS agent_color,
        s.name AS site_name, s.address AS site_address
      FROM vacation_reports vr
      JOIN agents a ON a.id = vr.agent_id
      LEFT JOIN sites s ON s.id = vr.site_id
      WHERE vr.id = ? AND vr.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!report) return res.status(404).json({ error: 'Rapport introuvable' });
    const events = await db.all(
      'SELECT * FROM vacation_report_events WHERE report_id = ? ORDER BY time ASC',
      [req.params.id]
    );
    res.json({ ...report, events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/vacation-reports
router.post('/', async (req, res) => {
  try {
    const {
      agent_id, site_id, shift_id, report_date, start_time, end_time,
      nothing_to_report = false, observations, incidents, visitors,
      equipment_check = true, equipment_notes, events = [],
    } = req.body;
    if (!agent_id || !report_date) return res.status(400).json({ error: 'agent_id et report_date requis' });
    const { lastInsertRowid: rid } = await db.insert(`
      INSERT INTO vacation_reports
        (company_id, agent_id, site_id, shift_id, report_date, start_time, end_time,
         nothing_to_report, observations, incidents, visitors,
         equipment_check, equipment_notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [req.user.companyId, agent_id, site_id||null, shift_id||null,
        report_date, start_time||null, end_time||null,
        nothing_to_report ? 1 : 0, observations||null, incidents||null, visitors||null,
        equipment_check ? 1 : 0, equipment_notes||null, req.user.id]);
    for (const ev of events) {
      await db.run(
        'INSERT INTO vacation_report_events (report_id, time, type, description) VALUES (?,?,?,?)',
        [rid, ev.time, ev.type || 'observation', ev.description]
      );
    }
    res.status(201).json(await db.get('SELECT * FROM vacation_reports WHERE id = ?', [rid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/vacation-reports/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      agent_id, site_id, shift_id, report_date, start_time, end_time,
      nothing_to_report, observations, incidents, visitors,
      equipment_check, equipment_notes, events,
    } = req.body;
    await db.run(`
      UPDATE vacation_reports SET
        agent_id=?, site_id=?, shift_id=?, report_date=?, start_time=?, end_time=?,
        nothing_to_report=?, observations=?, incidents=?, visitors=?,
        equipment_check=?, equipment_notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND company_id=?
    `, [agent_id, site_id||null, shift_id||null, report_date, start_time||null, end_time||null,
        nothing_to_report ? 1 : 0, observations||null, incidents||null, visitors||null,
        equipment_check ? 1 : 0, equipment_notes||null,
        req.params.id, req.user.companyId]);
    if (events !== undefined) {
      await db.run('DELETE FROM vacation_report_events WHERE report_id = ?', [req.params.id]);
      for (const ev of events) {
        await db.run(
          'INSERT INTO vacation_report_events (report_id, time, type, description) VALUES (?,?,?,?)',
          [req.params.id, ev.time, ev.type || 'observation', ev.description]
        );
      }
    }
    res.json(await db.get('SELECT * FROM vacation_reports WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/vacation-reports/:id/sign
router.post('/:id/sign', async (req, res) => {
  try {
    const { signature } = req.body;
    await db.run(
      `UPDATE vacation_reports SET status='signe', signature=?, signed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`,
      [signature||null, req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM vacation_reports WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/vacation-reports/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM vacation_reports WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
