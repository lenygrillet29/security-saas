const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/tasks?status=&assigned_user_id=&assigned_agent_id=&due=today
router.get('/', async (req, res) => {
  try {
    const { status, assigned_user_id, assigned_agent_id, due } = req.query;
    const today = new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT t.*,
        cu.first_name AS creator_first, cu.last_name AS creator_last,
        au.first_name AS user_first,    au.last_name AS user_last,
        aa.first_name AS agent_first,   aa.last_name AS agent_last, aa.color AS agent_color,
        du.first_name AS done_first,    du.last_name AS done_last
      FROM tasks t
      LEFT JOIN users  cu ON t.created_by       = cu.id
      LEFT JOIN users  au ON t.assigned_user_id  = au.id
      LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
      LEFT JOIN users  du ON t.done_by           = du.id
      WHERE t.company_id = ?
    `;
    const params = [req.user.companyId];
    if (status)            { sql += ' AND t.status = ?';             params.push(status); }
    if (assigned_user_id)  { sql += ' AND t.assigned_user_id = ?';   params.push(assigned_user_id); }
    if (assigned_agent_id) { sql += ' AND t.assigned_agent_id = ?';  params.push(assigned_agent_id); }
    if (due === 'today')   { sql += ' AND t.due_date = ?';           params.push(today); }
    if (due === 'overdue') { sql += ' AND t.due_date < ? AND t.status != \'fait\''; params.push(today); }

    sql += ` ORDER BY
      CASE t.priority WHEN 'urgente' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END,
      t.due_date ASC NULLS LAST, t.created_at DESC`;

    res.json(await db.all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tasks/stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const row = await db.get(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'fait')                       AS total_open,
        COUNT(*) FILTER (WHERE status != 'fait' AND due_date = ?)      AS due_today,
        COUNT(*) FILTER (WHERE status != 'fait' AND due_date < ?)      AS overdue,
        COUNT(*) FILTER (WHERE status = 'fait')                        AS done,
        COUNT(*) FILTER (WHERE priority = 'urgente' AND status != 'fait') AS urgent
      FROM tasks WHERE company_id = ?
    `, [today, today, req.user.companyId]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, priority = 'normale', due_date,
            assigned_user_id, assigned_agent_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title requis' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO tasks (company_id, created_by, title, description, priority,
        due_date, assigned_user_id, assigned_agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, req.user.id, title, description || null, priority,
       due_date || null, assigned_user_id || null, assigned_agent_id || null]
    );
    res.status(201).json(await db.get('SELECT * FROM tasks WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, description, priority, due_date, assigned_user_id, assigned_agent_id } = req.body;
    await db.run(
      `UPDATE tasks SET title=?, description=?, priority=?, due_date=?,
        assigned_user_id=?, assigned_agent_id=?
       WHERE id = ? AND company_id = ?`,
      [title, description || null, priority, due_date || null,
       assigned_user_id || null, assigned_agent_id || null,
       req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tasks/:id/done
router.post('/:id/done', async (req, res) => {
  try {
    await db.run(
      `UPDATE tasks SET status='fait', done_at=CURRENT_TIMESTAMP, done_by=?
       WHERE id = ? AND company_id = ?`,
      [req.user.id, req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tasks/:id/reopen
router.post('/:id/reopen', async (req, res) => {
  try {
    await db.run(
      `UPDATE tasks SET status='a_faire', done_at=NULL, done_by=NULL
       WHERE id = ? AND company_id = ?`,
      [req.params.id, req.user.companyId]
    );
    res.json(await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM tasks WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
