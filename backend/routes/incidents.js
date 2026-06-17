const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/incidents?site_id=&agent_id=&severity=&status=&month=
router.get('/', async (req, res) => {
  try {
    const { site_id, agent_id, severity, status, month } = req.query;
    let sql = `
      SELECT i.*,
        s.name AS site_name, c.name AS client_name,
        a.first_name AS agent_first, a.last_name AS agent_last, a.color AS agent_color
      FROM incidents i
      LEFT JOIN sites   s ON i.site_id   = s.id
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN agents  a ON i.agent_id  = a.id
      WHERE i.company_id = ?
    `;
    const params = [req.user.companyId];
    if (site_id)  { sql += ' AND i.site_id = ?';   params.push(site_id); }
    if (agent_id) { sql += ' AND i.agent_id = ?';  params.push(agent_id); }
    if (severity) { sql += ' AND i.severity = ?';  params.push(severity); }
    if (status)   { sql += ' AND i.status = ?';    params.push(status); }
    if (month)    { sql += ' AND i.date LIKE ?';   params.push(`${month}%`); }
    sql += ' ORDER BY i.date DESC, i.time DESC';
    res.json(await db.all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incidents/stats
router.get('/stats', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'ouvert' THEN 1 ELSE 0 END)   AS ouverts,
        SUM(CASE WHEN status = 'clos'   THEN 1 ELSE 0 END)   AS clos,
        SUM(CASE WHEN severity = 'critique' THEN 1 ELSE 0 END) AS critiques,
        SUM(CASE WHEN severity = 'majeur'   THEN 1 ELSE 0 END) AS majeurs,
        SUM(CASE WHEN severity = 'mineur'   THEN 1 ELSE 0 END) AS mineurs
      FROM incidents WHERE company_id = ?
    `, [req.user.companyId]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incidents/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT i.*,
        s.name AS site_name, c.name AS client_name,
        a.first_name AS agent_first, a.last_name AS agent_last
      FROM incidents i
      LEFT JOIN sites   s ON i.site_id   = s.id
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN agents  a ON i.agent_id  = a.id
      WHERE i.id = ? AND i.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incidents
router.post('/', async (req, res) => {
  try {
    const { site_id, agent_id, shift_id, date, time, type = 'autre',
            severity = 'mineur', title, description, actions_taken, notes } = req.body;
    if (!date || !title) return res.status(400).json({ error: 'date et title requis' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO incidents (company_id, site_id, agent_id, shift_id, date, time,
        type, severity, title, description, actions_taken, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, site_id || null, agent_id || null, shift_id || null,
       date, time || null, type, severity, title,
       description || null, actions_taken || null, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM incidents WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/incidents/:id
router.put('/:id', async (req, res) => {
  try {
    const { site_id, agent_id, date, time, type, severity, title,
            description, actions_taken, notes } = req.body;
    await db.run(
      `UPDATE incidents SET site_id=?, agent_id=?, date=?, time=?, type=?, severity=?,
        title=?, description=?, actions_taken=?, notes=?
       WHERE id = ? AND company_id = ?`,
      [site_id || null, agent_id || null, date, time || null, type, severity,
       title, description || null, actions_taken || null, notes || null,
       req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incidents/:id/close
router.post('/:id/close', async (req, res) => {
  try {
    await db.run(
      `UPDATE incidents SET status='clos', closed_at=CURRENT_TIMESTAMP, closed_by=?
       WHERE id = ? AND company_id = ?`,
      [req.user.id, req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incidents/:id/reopen
router.post('/:id/reopen', async (req, res) => {
  try {
    await db.run(
      `UPDATE incidents SET status='ouvert', closed_at=NULL, closed_by=NULL
       WHERE id = ? AND company_id = ?`,
      [req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/incidents/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM incidents WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
