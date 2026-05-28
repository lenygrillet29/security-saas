const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');

const QUOTES_QUERY = `
  SELECT q.*, c.name as client_name, s.name as site_name
  FROM quotes q
  JOIN clients c ON q.client_id = c.id
  LEFT JOIN sites s ON q.site_id = s.id
`;

function calcTotal(lines) {
  return lines.reduce((sum, l) =>
    sum + (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday), 0);
}

router.get('/', async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let query = QUOTES_QUERY + ' WHERE q.company_id = ?';
    const params = [req.user.companyId];
    if (client_id) { query += ' AND q.client_id = ?'; params.push(client_id); }
    if (status) { query += ' AND q.status = ?'; params.push(status); }
    query += ' ORDER BY q.created_at DESC';
    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await db.get(QUOTES_QUERY + ' WHERE q.id = ? AND q.company_id = ?', [req.params.id, req.user.companyId]);
    if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
    const lines = await db.all('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id', [req.params.id]);
    res.json({ ...quote, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  const pgClient = await db.pool.connect();
  try {
    const { client_id, site_id, title, valid_until, hourly_rate_day, hourly_rate_night,
      hourly_rate_sunday, status, notes, tva_rate, lines = [] } = req.body;
    if (!client_id || !title) return res.status(400).json({ error: 'client_id et titre requis' });

    await pgClient.query('BEGIN');

    const year = new Date().getFullYear();
    const countRow = await pgClient.query(
      `SELECT COUNT(*) as c FROM quotes WHERE company_id = $1 AND created_at >= $2`,
      [req.user.companyId, `${year}-01-01`]
    );
    const count = parseInt(countRow.rows[0].c, 10);
    const quote_number = `DEV-${year}-${String(count + 1).padStart(4, '0')}`;

    const total_ht = calcTotal(lines);
    const qRes = await pgClient.query(
      `INSERT INTO quotes (company_id, client_id, site_id, quote_number, title, valid_until, hourly_rate_day,
       hourly_rate_night, hourly_rate_sunday, status, notes, total_ht, tva_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [req.user.companyId, client_id, site_id || null, quote_number, title,
        valid_until || null, hourly_rate_day || 0, hourly_rate_night || 0,
        hourly_rate_sunday || 0, status || 'draft', notes || null, total_ht, tva_rate || 20]
    );
    const quoteId = qRes.rows[0].id;

    for (const l of lines) {
      const lineTotal = (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday);
      await pgClient.query(
        `INSERT INTO quote_lines (quote_id, description, hours_day, hours_night, hours_sunday, rate_day, rate_night, rate_sunday, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [quoteId, l.description, l.hours_day || 0, l.hours_night || 0, l.hours_sunday || 0,
          l.rate_day || 0, l.rate_night || 0, l.rate_sunday || 0, lineTotal]
      );
    }

    await pgClient.query('COMMIT');
    pgClient.release();

    const quote = await db.get(QUOTES_QUERY + ' WHERE q.id = ?', [quoteId]);
    const savedLines = await db.all('SELECT * FROM quote_lines WHERE quote_id = ?', [quoteId]);
    res.status(201).json({ ...quote, lines: savedLines });
  } catch (e) {
    await pgClient.query('ROLLBACK');
    pgClient.release();
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireWriter, async (req, res) => {
  const pgClient = await db.pool.connect();
  try {
    const existing = await db.get('SELECT id FROM quotes WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });

    const { client_id, site_id, title, valid_until, hourly_rate_day, hourly_rate_night,
      hourly_rate_sunday, status, notes, tva_rate, lines = [] } = req.body;

    await pgClient.query('BEGIN');
    const total_ht = calcTotal(lines);
    await pgClient.query(
      `UPDATE quotes SET client_id=$1, site_id=$2, title=$3, valid_until=$4, hourly_rate_day=$5,
       hourly_rate_night=$6, hourly_rate_sunday=$7, status=$8, notes=$9, total_ht=$10, tva_rate=$11 WHERE id=$12`,
      [client_id, site_id || null, title, valid_until || null,
        hourly_rate_day || 0, hourly_rate_night || 0, hourly_rate_sunday || 0,
        status || 'draft', notes || null, total_ht, tva_rate || 20, req.params.id]
    );

    await pgClient.query('DELETE FROM quote_lines WHERE quote_id = $1', [req.params.id]);
    for (const l of lines) {
      const lineTotal = (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday);
      await pgClient.query(
        `INSERT INTO quote_lines (quote_id, description, hours_day, hours_night, hours_sunday, rate_day, rate_night, rate_sunday, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [req.params.id, l.description, l.hours_day || 0, l.hours_night || 0, l.hours_sunday || 0,
          l.rate_day || 0, l.rate_night || 0, l.rate_sunday || 0, lineTotal]
      );
    }

    await pgClient.query('COMMIT');
    pgClient.release();

    const quote = await db.get(QUOTES_QUERY + ' WHERE q.id = ?', [req.params.id]);
    const savedLines = await db.all('SELECT * FROM quote_lines WHERE quote_id = ?', [req.params.id]);
    res.json({ ...quote, lines: savedLines });
  } catch (e) {
    await pgClient.query('ROLLBACK');
    pgClient.release();
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM quotes WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });
    await db.run('DELETE FROM quotes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
