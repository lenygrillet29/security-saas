const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');

const ABSENCES_QUERY = `
  SELECT ab.*, a.first_name, a.last_name, a.color as agent_color
  FROM absences ab JOIN agents a ON ab.agent_id = a.id
`;

router.get('/', async (req, res) => {
  try {
    const { agent_id, start_date, end_date, type, status } = req.query;
    let query = ABSENCES_QUERY + ' WHERE ab.company_id = ?';
    const params = [req.user.companyId];

    if (agent_id) { query += ' AND ab.agent_id = ?'; params.push(agent_id); }
    if (start_date) { query += ' AND ab.end_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND ab.start_date <= ?'; params.push(end_date); }
    if (type) { query += ' AND ab.type = ?'; params.push(type); }
    if (status) { query += ' AND ab.status = ?'; params.push(status); }
    query += ' ORDER BY ab.start_date DESC';

    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const absence = await db.get(ABSENCES_QUERY + ' WHERE ab.id = ? AND ab.company_id = ?', [req.params.id, req.user.companyId]);
    if (!absence) return res.status(404).json({ error: 'Absence non trouvée' });
    res.json(absence);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { agent_id, start_date, end_date, type, status, notes } = req.body;
    if (!agent_id || !start_date || !end_date || !type)
      return res.status(400).json({ error: 'Champs requis manquants' });
    const result = await db.insert(
      `INSERT INTO absences (company_id, agent_id, start_date, end_date, type, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, start_date, end_date, type, status || 'approved', notes || null]
    );
    res.status(201).json(await db.get(ABSENCES_QUERY + ' WHERE ab.id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { agent_id, start_date, end_date, type, status, notes } = req.body;
    const existing = await db.get('SELECT id FROM absences WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Absence non trouvée' });
    await db.run(
      `UPDATE absences SET agent_id=?, start_date=?, end_date=?, type=?, status=?, notes=? WHERE id=?`,
      [agent_id, start_date, end_date, type, status || 'approved', notes || null, req.params.id]
    );
    res.json(await db.get(ABSENCES_QUERY + ' WHERE ab.id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM absences WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Absence non trouvée' });
    await db.run('DELETE FROM absences WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
