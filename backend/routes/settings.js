const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM settings');
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const safe = { ...settings };
    delete safe.smtp_pass;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM settings');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(req.body)) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, value ?? '']
      );
    }
    await client.query('COMMIT');
    client.release();
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    client.release();
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
