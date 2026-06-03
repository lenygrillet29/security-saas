const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { requireWriter } = require('../middleware/auth');

async function nextInvoiceNumber(companyId) {
  const row = await db.get(
    `SELECT COUNT(*) AS cnt FROM invoices WHERE company_id = ?`,
    [companyId]
  );
  const n = (parseInt(row.cnt) || 0) + 1;
  return `FA-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

const INV_QUERY = `
  SELECT i.*, c.name AS client_name
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
`;

// ─── GET liste ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let q = INV_QUERY + ' WHERE i.company_id = ?';
    const p = [req.user.companyId];
    if (client_id) { q += ' AND i.client_id = ?'; p.push(client_id); }
    if (status)    { q += ' AND i.status = ?';    p.push(status); }
    q += ' ORDER BY i.created_at DESC';
    res.json(await db.all(q, p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET une facture + ses lignes ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const inv = await db.get(INV_QUERY + ' WHERE i.id = ? AND i.company_id = ?', [req.params.id, req.user.companyId]);
    if (!inv) return res.status(404).json({ error: 'Facture non trouvée' });
    inv.lines = await db.all('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id', [inv.id]);
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST créer manuellement ──────────────────────────────────────────────────
router.post('/', requireWriter, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { client_id, title, issue_date, due_date, tva_rate, notes, lines = [] } = req.body;
    if (!client_id || !title || !issue_date) return res.status(400).json({ error: 'client_id, title et issue_date requis' });

    const invoice_number = await nextInvoiceNumber(req.user.companyId);
    const total_ht = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);

    await client.query('BEGIN');
    const invRes = await client.query(
      `INSERT INTO invoices (company_id, client_id, invoice_number, title, issue_date, due_date, tva_rate, notes, total_ht)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.companyId, client_id, invoice_number, title, issue_date, due_date || null, tva_rate || 20, notes || null, total_ht]
    );
    const invoiceId = invRes.rows[0].id;
    for (const l of lines) {
      await client.query(
        'INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)',
        [invoiceId, l.description, l.quantity || 1, l.unit_price || 0, l.total || 0]
      );
    }
    await client.query('COMMIT');
    client.release();

    const inv = await db.get(INV_QUERY + ' WHERE i.id = ?', [invoiceId]);
    inv.lines = await db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', [invoiceId]);
    res.status(201).json(inv);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    res.status(500).json({ error: e.message });
  }
});

// ─── POST convertir un devis en facture ───────────────────────────────────────
router.post('/from-quote/:quoteId', requireWriter, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const quote = await db.get('SELECT * FROM quotes WHERE id = ? AND company_id = ?', [req.params.quoteId, req.user.companyId]);
    if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });

    const lines = await db.all('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id', [quote.id]);
    const invoice_number = await nextInvoiceNumber(req.user.companyId);
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    await client.query('BEGIN');
    const invRes = await client.query(
      `INSERT INTO invoices (company_id, client_id, quote_id, invoice_number, title, issue_date, due_date, tva_rate, notes, total_ht)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [req.user.companyId, quote.client_id, quote.id, invoice_number,
       quote.title, today, dueDate, quote.tva_rate || 20, quote.notes || null, quote.total_ht || 0]
    );
    const invoiceId = invRes.rows[0].id;

    for (const l of lines) {
      const desc = l.description;
      const qty  = l.hours_day + l.hours_night + l.hours_sunday;
      const rate = qty > 0
        ? ((l.hours_day * l.rate_day + l.hours_night * l.rate_night + l.hours_sunday * l.rate_sunday) / qty)
        : 0;
      await client.query(
        'INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)',
        [invoiceId, desc, Math.round(qty * 100) / 100, Math.round(rate * 100) / 100, Math.round(l.total * 100) / 100]
      );
    }

    // Passer le devis à "accepted"
    await client.query('UPDATE quotes SET status = $1 WHERE id = $2', ['accepted', quote.id]);
    await client.query('COMMIT');
    client.release();

    const inv = await db.get(INV_QUERY + ' WHERE i.id = ?', [invoiceId]);
    inv.lines = await db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', [invoiceId]);
    res.status(201).json(inv);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT modifier statut / infos ──────────────────────────────────────────────
router.put('/:id', requireWriter, async (req, res) => {
  try {
    const inv = await db.get('SELECT * FROM invoices WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!inv) return res.status(404).json({ error: 'Facture non trouvée' });

    const { status, payment_date, due_date, notes } = req.body;
    await db.run(
      'UPDATE invoices SET status=COALESCE(?,status), payment_date=COALESCE(?,payment_date), due_date=COALESCE(?,due_date), notes=COALESCE(?,notes) WHERE id=?',
      [status || null, payment_date || null, due_date || null, notes || null, req.params.id]
    );
    const updated = await db.get(INV_QUERY + ' WHERE i.id = ?', [req.params.id]);
    updated.lines = await db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const { changes } = await db.run('DELETE FROM invoices WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!changes) return res.status(404).json({ error: 'Facture non trouvée' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
