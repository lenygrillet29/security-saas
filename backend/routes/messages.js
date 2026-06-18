const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/messages/threads — liste des fils (un par agent ayant des messages)
router.get('/threads', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        m.recipient_agent_id AS agent_id,
        a.first_name, a.last_name, a.color, a.employee_number,
        COUNT(m.id)                                                     AS total,
        SUM(CASE WHEN m.read_at IS NULL AND m.sender_type = 'user' THEN 0
                 WHEN m.read_at IS NULL THEN 1 ELSE 0 END)              AS unread,
        MAX(m.created_at)                                               AS last_at,
        (SELECT body FROM messages m2
         WHERE m2.company_id = m.company_id
           AND m2.recipient_agent_id = m.recipient_agent_id
         ORDER BY m2.created_at DESC LIMIT 1)                           AS last_body
      FROM messages m
      JOIN agents a ON m.recipient_agent_id = a.id
      WHERE m.company_id = ?
      GROUP BY m.recipient_agent_id, a.first_name, a.last_name, a.color, a.employee_number
      ORDER BY last_at DESC
    `, [req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/messages/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const row = await db.get(
      `SELECT COUNT(*) AS count FROM messages
       WHERE company_id = ? AND read_at IS NULL AND sender_type != 'user'`,
      [req.user.companyId]
    );
    res.json({ count: parseInt(row.count) || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/messages/agent/:agentId — messages d'un fil
router.get('/agent/:agentId', async (req, res) => {
  try {
    // Marquer comme lus les messages entrants non lus
    await db.run(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP
       WHERE company_id = ? AND recipient_agent_id = ? AND read_at IS NULL AND sender_type != 'user'`,
      [req.user.companyId, req.params.agentId]
    );
    const rows = await db.all(`
      SELECT m.*,
        u.first_name AS user_first, u.last_name AS user_last
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.company_id = ? AND m.recipient_agent_id = ?
      ORDER BY m.created_at ASC
    `, [req.user.companyId, req.params.agentId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/messages/agent/:agentId — envoyer un message (manager → agent)
router.post('/agent/:agentId', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body requis' });
    const threadKey = `agent_${req.params.agentId}`;
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO messages (company_id, thread_key, sender_id, sender_type, recipient_agent_id, body, read_at)
       VALUES (?, ?, ?, 'user', ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.companyId, threadKey, req.user.id, req.params.agentId, body.trim()]
    );
    res.status(201).json(await db.get('SELECT * FROM messages WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/messages/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM messages WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
