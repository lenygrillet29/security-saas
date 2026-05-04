const express = require('express');
const router = express.Router();
const db = require('../db/database');

const QUOTES_QUERY = `
  SELECT q.*, c.name as client_name, s.name as site_name
  FROM quotes q
  JOIN clients c ON q.client_id = c.id
  LEFT JOIN sites s ON q.site_id = s.id
`;

function calcTotal(lines) {
  return lines.reduce((sum, l) => {
    return sum + (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday);
  }, 0);
}

router.get('/', (req, res) => {
  const { client_id, status } = req.query;
  let query = QUOTES_QUERY + ' WHERE 1=1';
  const params = [];
  if (client_id) { query += ' AND q.client_id = ?'; params.push(client_id); }
  if (status) { query += ' AND q.status = ?'; params.push(status); }
  query += ' ORDER BY q.created_at DESC';
  const quotes = db.prepare(query).all(...params);
  res.json(quotes);
});

router.get('/:id', (req, res) => {
  const quote = db.prepare(QUOTES_QUERY + ' WHERE q.id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
  const lines = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id').all(req.params.id);
  res.json({ ...quote, lines });
});

router.post('/', (req, res) => {
  const { client_id, site_id, title, valid_until, hourly_rate_day, hourly_rate_night,
    hourly_rate_sunday, status, notes, tva_rate, lines = [] } = req.body;
  if (!client_id || !title) return res.status(400).json({ error: 'client_id et titre requis' });

  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as c FROM quotes WHERE created_at >= ?').get(`${year}-01-01`).c;
  const quote_number = `DEV-${year}-${String(count + 1).padStart(4, '0')}`;

  const total_ht = calcTotal(lines);
  const result = db.prepare(
    `INSERT INTO quotes (client_id, site_id, quote_number, title, valid_until, hourly_rate_day, hourly_rate_night,
     hourly_rate_sunday, status, notes, total_ht, tva_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(client_id, site_id || null, quote_number, title,
    valid_until || null, hourly_rate_day || 0, hourly_rate_night || 0,
    hourly_rate_sunday || 0, status || 'draft', notes || null, total_ht, tva_rate || 20);

  const quoteId = result.lastInsertRowid;
  const insertLine = db.prepare(
    `INSERT INTO quote_lines (quote_id, description, hours_day, hours_night, hours_sunday, rate_day, rate_night, rate_sunday, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of lines) {
    const lineTotal = (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday);
    insertLine.run(quoteId, l.description, l.hours_day || 0, l.hours_night || 0, l.hours_sunday || 0,
      l.rate_day || 0, l.rate_night || 0, l.rate_sunday || 0, lineTotal);
  }

  const quote = db.prepare(QUOTES_QUERY + ' WHERE q.id = ?').get(quoteId);
  const savedLines = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(quoteId);
  res.status(201).json({ ...quote, lines: savedLines });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });

  const { client_id, site_id, title, valid_until, hourly_rate_day, hourly_rate_night,
    hourly_rate_sunday, status, notes, tva_rate, lines = [] } = req.body;

  const total_ht = calcTotal(lines);
  db.prepare(
    `UPDATE quotes SET client_id=?, site_id=?, title=?, valid_until=?, hourly_rate_day=?, hourly_rate_night=?,
     hourly_rate_sunday=?, status=?, notes=?, total_ht=?, tva_rate=? WHERE id=?`
  ).run(client_id, site_id || null, title, valid_until || null,
    hourly_rate_day || 0, hourly_rate_night || 0, hourly_rate_sunday || 0,
    status || 'draft', notes || null, total_ht, tva_rate || 20, req.params.id);

  db.prepare('DELETE FROM quote_lines WHERE quote_id = ?').run(req.params.id);
  const insertLine = db.prepare(
    `INSERT INTO quote_lines (quote_id, description, hours_day, hours_night, hours_sunday, rate_day, rate_night, rate_sunday, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of lines) {
    const lineTotal = (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday);
    insertLine.run(req.params.id, l.description, l.hours_day || 0, l.hours_night || 0, l.hours_sunday || 0,
      l.rate_day || 0, l.rate_night || 0, l.rate_sunday || 0, lineTotal);
  }

  const quote = db.prepare(QUOTES_QUERY + ' WHERE q.id = ?').get(req.params.id);
  const savedLines = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(req.params.id);
  res.json({ ...quote, lines: savedLines });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });
  db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
