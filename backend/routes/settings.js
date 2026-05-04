const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Don't expose SMTP password
  const safe = { ...settings };
  delete safe.smtp_pass;
  res.json(safe);
});

router.get('/all', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.put('/', (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateMany = db.transaction((obj) => {
    for (const [key, value] of Object.entries(obj)) {
      update.run(key, value ?? '');
    }
  });
  updateMany(req.body);
  res.json({ success: true });
});

module.exports = router;
