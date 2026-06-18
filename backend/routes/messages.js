const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// ── Threads liste ─────────────────────────────────────────────────────────────
// GET /api/messages/threads
router.get('/threads', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId    = req.user.id;

    // Fils agents
    const agentThreads = await db.all(`
      SELECT 'agent' AS thread_type,
        m.recipient_agent_id AS target_id,
        a.first_name, a.last_name, a.color, a.employee_number,
        NULL AS target_email,
        COUNT(m.id) AS total,
        SUM(CASE WHEN m.read_at IS NULL AND m.sender_type != 'user' THEN 1 ELSE 0 END) AS unread,
        MAX(m.created_at) AS last_at,
        (SELECT body FROM messages m2
         WHERE m2.company_id = m.company_id AND m2.thread_key = m.thread_key
         ORDER BY m2.created_at DESC LIMIT 1) AS last_body
      FROM messages m
      JOIN agents a ON m.recipient_agent_id = a.id
      WHERE m.company_id = ? AND m.thread_type = 'agent'
      GROUP BY m.recipient_agent_id, a.first_name, a.last_name, a.color, a.employee_number, m.thread_key
      ORDER BY last_at DESC
    `, [companyId]);

    // Fils équipe
    const teamThread = await db.get(`
      SELECT 'team' AS thread_type,
        0 AS target_id, 'Équipe' AS first_name, '' AS last_name,
        '#6366F1' AS color, NULL AS employee_number, NULL AS target_email,
        COUNT(*) AS total,
        SUM(CASE WHEN read_at IS NULL AND sender_id != ? THEN 1 ELSE 0 END) AS unread,
        MAX(created_at) AS last_at,
        (SELECT body FROM messages m2
         WHERE m2.company_id = ? AND m2.thread_type = 'team'
         ORDER BY m2.created_at DESC LIMIT 1) AS last_body
      FROM messages WHERE company_id = ? AND thread_type = 'team'
    `, [userId, companyId, companyId]);

    // Fils utilisateur-à-utilisateur
    const userThreads = await db.all(`
      SELECT 'user' AS thread_type,
        CASE WHEN m.sender_id = ? THEN m.recipient_user_id ELSE m.sender_id END AS target_id,
        u.first_name, u.last_name, '#64748B' AS color, NULL AS employee_number, u.email AS target_email,
        COUNT(*) AS total,
        SUM(CASE WHEN m.read_at IS NULL AND m.sender_id != ? THEN 1 ELSE 0 END) AS unread,
        MAX(m.created_at) AS last_at,
        (SELECT body FROM messages m2
         WHERE m2.company_id = ? AND m2.thread_type = 'user'
           AND (( m2.sender_id = ? AND m2.recipient_user_id = CASE WHEN m.sender_id = ? THEN m.recipient_user_id ELSE m.sender_id END)
             OR (m2.sender_id = CASE WHEN m.sender_id = ? THEN m.recipient_user_id ELSE m.sender_id END AND m2.recipient_user_id = ?))
         ORDER BY m2.created_at DESC LIMIT 1) AS last_body
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_user_id ELSE m.sender_id END
      WHERE m.company_id = ? AND m.thread_type = 'user'
        AND (m.sender_id = ? OR m.recipient_user_id = ?)
      GROUP BY target_id, u.first_name, u.last_name, u.email
      ORDER BY last_at DESC
    `, [userId, userId, companyId, userId, userId, userId, userId, userId, companyId, userId, userId]);

    const result = [];
    if (teamThread?.total > 0) result.push(teamThread);
    result.push(...agentThreads);
    result.push(...userThreads);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/messages/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const row = await db.get(
      `SELECT COUNT(*) AS count FROM messages
       WHERE company_id = ? AND read_at IS NULL
         AND (sender_type != 'user' OR (thread_type = 'user' AND sender_id != ?)
              OR (thread_type = 'team' AND sender_id != ?))`,
      [req.user.companyId, req.user.id, req.user.id]
    );
    res.json({ count: parseInt(row.count) || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/messages/users — collaborateurs disponibles pour DM
router.get('/users', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, first_name, last_name, email, role FROM users
       WHERE company_id = ? AND active = 1 AND id != ?
       ORDER BY first_name`,
      [req.user.companyId, req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fil agent ─────────────────────────────────────────────────────────────────
router.get('/agent/:agentId', async (req, res) => {
  try {
    await db.run(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP
       WHERE company_id = ? AND recipient_agent_id = ? AND read_at IS NULL AND sender_type != 'user'`,
      [req.user.companyId, req.params.agentId]
    );
    const rows = await db.all(`
      SELECT m.*, u.first_name AS user_first, u.last_name AS user_last
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.company_id = ? AND m.recipient_agent_id = ? AND m.thread_type = 'agent'
      ORDER BY m.created_at ASC
    `, [req.user.companyId, req.params.agentId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/agent/:agentId', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body requis' });
    const threadKey = `agent_${req.params.agentId}`;
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO messages (company_id, thread_key, thread_type, sender_id, sender_type, recipient_agent_id, body, read_at)
       VALUES (?, ?, 'agent', ?, 'user', ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.companyId, threadKey, req.user.id, req.params.agentId, body.trim()]
    );
    res.status(201).json(await db.get('SELECT * FROM messages WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fil équipe (canal partagé) ────────────────────────────────────────────────
router.get('/team', async (req, res) => {
  try {
    await db.run(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP
       WHERE company_id = ? AND thread_type = 'team' AND read_at IS NULL AND sender_id != ?`,
      [req.user.companyId, req.user.id]
    );
    const rows = await db.all(`
      SELECT m.*, u.first_name AS user_first, u.last_name AS user_last
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.company_id = ? AND m.thread_type = 'team'
      ORDER BY m.created_at ASC
    `, [req.user.companyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/team', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body requis' });
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO messages (company_id, thread_key, thread_type, sender_id, sender_type, body, read_at)
       VALUES (?, 'team', 'team', ?, 'user', ?, CURRENT_TIMESTAMP)`,
      [req.user.companyId, req.user.id, body.trim()]
    );
    res.status(201).json(await db.get('SELECT * FROM messages WHERE id = ?', [lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fil utilisateur-à-utilisateur ────────────────────────────────────────────
router.get('/user/:userId', async (req, res) => {
  try {
    const me    = req.user.id;
    const other = parseInt(req.params.userId);
    await db.run(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP
       WHERE company_id = ? AND thread_type = 'user'
         AND sender_id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [req.user.companyId, other, me]
    );
    const rows = await db.all(`
      SELECT m.*, u.first_name AS user_first, u.last_name AS user_last
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.company_id = ? AND m.thread_type = 'user'
        AND ((m.sender_id = ? AND m.recipient_user_id = ?)
          OR (m.sender_id = ? AND m.recipient_user_id = ?))
      ORDER BY m.created_at ASC
    `, [req.user.companyId, me, other, other, me]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/user/:userId', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body requis' });
    const me    = req.user.id;
    const other = parseInt(req.params.userId);
    const threadKey = `user_${Math.min(me, other)}_${Math.max(me, other)}`;
    const { lastInsertRowid } = await db.insert(
      `INSERT INTO messages (company_id, thread_key, thread_type, sender_id, sender_type, recipient_user_id, body, read_at)
       VALUES (?, ?, 'user', ?, 'user', ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.companyId, threadKey, me, other, body.trim()]
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
