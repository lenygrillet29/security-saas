const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// POST /api/push/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth)
      return res.status(400).json({ error: 'Subscription invalide' });

    await db.run(
      `INSERT INTO user_push_subscriptions (user_id, company_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.user.id, req.user.companyId, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    await db.run('DELETE FROM user_push_subscriptions WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
