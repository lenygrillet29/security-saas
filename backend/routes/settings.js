const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', [req.user.companyId]);
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const safe = { ...settings };
    delete safe.smtp_pass;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', requireRole('admin'), async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', [req.user.companyId]);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', requireRole('admin'), async (req, res) => {
  const pgClient = await db.pool.connect();
  try {
    await pgClient.query('BEGIN');
    for (const [key, value] of Object.entries(req.body)) {
      await pgClient.query(
        'INSERT INTO settings (company_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (company_id, key) DO UPDATE SET value = EXCLUDED.value',
        [req.user.companyId, key, value ?? '']
      );
    }
    await pgClient.query('COMMIT');
    pgClient.release();
    res.json({ success: true });
  } catch (e) {
    await pgClient.query('ROLLBACK');
    pgClient.release();
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
