const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

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

// ─── GET aperçu planning → lignes de facture ─────────────────────────────────
// GET /api/invoices/preview-planning?client_id=X&date_from=Y&date_to=Z
router.get('/preview-planning', async (req, res) => {
  try {
    const { client_id, date_from, date_to } = req.query;
    if (!client_id || !date_from || !date_to) return res.status(400).json({ error: 'client_id, date_from, date_to requis' });

    const shifts = await db.all(
      `SELECT sh.id, sh.date, sh.start_time, sh.end_time,
              s.id AS site_id, s.name AS site_name, s.hourly_rate_day,
              a.first_name || ' ' || a.last_name AS agent_name
       FROM shifts sh
       JOIN sites s   ON s.id = sh.site_id
       JOIN clients c ON c.id = s.client_id
       LEFT JOIN agents a ON a.id = sh.agent_id
       WHERE sh.company_id = ? AND c.id = ? AND sh.date >= ? AND sh.date <= ?
       ORDER BY sh.date, sh.start_time`,
      [req.user.companyId, client_id, date_from, date_to]
    );

    if (!shifts.length) return res.json({ shifts: [], lines: [] });

    // Calcul durée en heures
    function hrs(start, end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let m = (eh * 60 + em) - (sh * 60 + sm);
      if (m < 0) m += 1440;
      return Math.round(m / 60 * 100) / 100;
    }

    // Grouper par site
    const bySite = {};
    for (const s of shifts) {
      if (!bySite[s.site_id]) bySite[s.site_id] = { site_name: s.site_name, rate: s.hourly_rate_day || 0, hours: 0, count: 0 };
      bySite[s.site_id].hours += hrs(s.start_time, s.end_time);
      bySite[s.site_id].count++;
    }

    const lines = Object.values(bySite).map(b => ({
      description: `${b.site_name} — ${b.count} vacation${b.count > 1 ? 's' : ''}`,
      quantity:    Math.round(b.hours * 100) / 100,
      unit_price:  Math.round(b.rate * 100) / 100,
      total:       Math.round(b.hours * b.rate * 100) / 100,
    }));

    res.json({ shifts, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST générer facture depuis le planning ───────────────────────────────────
// POST /api/invoices/from-planning { client_id, date_from, date_to, tva_rate, title }
router.post('/from-planning', requireWriter, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { client_id, date_from, date_to, tva_rate = 20, title, lines } = req.body;
    if (!client_id || !date_from || !date_to || !lines?.length) {
      return res.status(400).json({ error: 'client_id, date_from, date_to et lines requis' });
    }

    const invoice_number = await nextInvoiceNumber(req.user.companyId);
    const today    = new Date().toISOString().split('T')[0];
    const dueDate  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const total_ht = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);

    await client.query('BEGIN');
    const invRes = await client.query(
      `INSERT INTO invoices (company_id, client_id, invoice_number, title, issue_date, due_date, tva_rate, total_ht)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [req.user.companyId, client_id, invoice_number, title, today, dueDate, tva_rate, Math.round(total_ht * 100) / 100]
    );
    const invoiceId = invRes.rows[0].id;

    for (const l of lines) {
      await client.query(
        'INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)',
        [invoiceId, l.description, l.quantity, l.unit_price, l.total]
      );
    }

    await client.query('COMMIT');
    client.release();

    const inv = await db.get(INV_QUERY + ' WHERE i.id = ?', [invoiceId]);
    inv.lines  = await db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', [invoiceId]);
    res.status(201).json(inv);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    res.status(500).json({ error: e.message });
  }
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

// POST /api/invoices/:id/remind — relance manuelle
router.post('/:id/remind', requireWriter, async (req, res) => {
  try {
    const inv = await db.get(`
      SELECT i.*, cl.name AS client_name, cl.email AS client_email,
             co.name AS company_name
      FROM invoices i
      JOIN clients cl  ON cl.id = i.client_id
      JOIN companies co ON co.id = i.company_id
      WHERE i.id = ? AND i.company_id = ?
    `, [req.params.id, req.user.companyId]);

    if (!inv) return res.status(404).json({ error: 'Facture non trouvée' });
    if (!inv.client_email) return res.status(400).json({ error: 'Le client n\'a pas d\'adresse email' });

    const today = new Date().toISOString().slice(0, 10);
    const daysLate = inv.due_date
      ? Math.max(0, Math.floor((new Date(today) - new Date(inv.due_date)) / 86400000))
      : 0;
    const totalTtc = ((inv.total_ht || 0) * (1 + (inv.tva_rate || 20) / 100)).toFixed(2);
    const frDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    await sendSystemEmail({
      to: inv.client_email,
      subject: `Rappel facture ${inv.invoice_number} — ${inv.company_name}`,
      html: templates.invoiceOverdue({
        clientName:    inv.client_name,
        companyName:   inv.company_name,
        invoiceNumber: inv.invoice_number,
        totalTtc,
        dueDate: inv.due_date ? frDate(inv.due_date) : '—',
        daysLate,
        appUrl: null,
      }),
    });

    if (inv.status === 'sent' && daysLate > 0) {
      await db.run("UPDATE invoices SET status = 'overdue' WHERE id = ?", [inv.id]);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET stats CA sur 12 mois ─────────────────────────────────────────────────
// GET /api/invoices/stats/ca
router.get('/stats/ca', async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // CA facturé par mois (toutes factures non-draft)
    const invoiced = await db.all(`
      SELECT TO_CHAR(issue_date::date, 'YYYY-MM') AS month,
             SUM(total_ht) AS total
      FROM invoices
      WHERE company_id = ? AND status != 'draft'
        AND issue_date >= ?
      GROUP BY 1
    `, [req.user.companyId, months[0] + '-01']);

    // CA encaissé par mois (factures payées)
    const paid = await db.all(`
      SELECT TO_CHAR(payment_date::date, 'YYYY-MM') AS month,
             SUM(total_ht) AS total
      FROM invoices
      WHERE company_id = ? AND status = 'paid' AND payment_date IS NOT NULL
        AND payment_date >= ?
      GROUP BY 1
    `, [req.user.companyId, months[0] + '-01']);

    const invoicedMap = Object.fromEntries(invoiced.map(r => [r.month, parseFloat(r.total) || 0]));
    const paidMap     = Object.fromEntries(paid.map(r => [r.month, parseFloat(r.total) || 0]));

    const data = months.map(m => ({
      month:    m,
      invoiced: invoicedMap[m] || 0,
      paid:     paidMap[m]     || 0,
    }));

    // Totaux globaux
    const totals = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN status != 'draft' THEN total_ht END), 0) AS total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'paid'   THEN total_ht END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN status IN ('sent','overdue') THEN total_ht END), 0) AS total_pending
      FROM invoices WHERE company_id = ?
    `, [req.user.companyId]);

    res.json({ months: data, totals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
