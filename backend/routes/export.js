/**
 * Export CSV pour la comptabilité et la paie.
 * GET /api/export/shifts?start_date=&end_date=
 * GET /api/export/invoices?start_date=&end_date=
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { logAudit } = require('../utils/audit');

function toCSV(rows, columns) {
  const header = columns.map(c => c.label).join(';');
  const lines  = rows.map(row =>
    columns.map(c => {
      const v = row[c.key] ?? '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(';')
  );
  return '﻿' + [header, ...lines].join('\n'); // BOM UTF-8 pour Excel
}

// ─── Export shifts (prestations) ──────────────────────────────────────────────
router.get('/shifts', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = await db.all(`
      SELECT
        sh.date,
        a.last_name || ' ' || a.first_name AS agent,
        a.employee_number,
        c.name AS client,
        s.name AS site,
        sh.start_time, sh.end_time,
        sh.hours_day, sh.hours_night, sh.hours_sunday,
        ROUND((sh.hours_day + sh.hours_night + sh.hours_sunday)::numeric, 2) AS total_hours,
        ROUND((
          sh.hours_day    * COALESCE(s.hourly_rate_day,    0) +
          sh.hours_night  * COALESCE(s.hourly_rate_night,  0) +
          sh.hours_sunday * COALESCE(s.hourly_rate_sunday, 0)
        )::numeric, 2) AS montant_ht,
        sh.notes
      FROM shifts sh
      JOIN agents  a ON sh.agent_id = a.id
      JOIN sites   s ON sh.site_id  = s.id
      JOIN clients c ON s.client_id = c.id
      WHERE sh.company_id = ?
        AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, a.last_name
    `, [req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    const csv = toCSV(rows, [
      { key: 'date',           label: 'Date' },
      { key: 'agent',          label: 'Agent' },
      { key: 'employee_number',label: 'N° matricule' },
      { key: 'client',         label: 'Client' },
      { key: 'site',           label: 'Site' },
      { key: 'start_time',     label: 'Début' },
      { key: 'end_time',       label: 'Fin' },
      { key: 'hours_day',      label: 'H. jour' },
      { key: 'hours_night',    label: 'H. nuit' },
      { key: 'hours_sunday',   label: 'H. dimanche' },
      { key: 'total_hours',    label: 'Total heures' },
      { key: 'montant_ht',     label: 'Montant HT (€)' },
      { key: 'notes',          label: 'Notes' },
    ]);

    logAudit(req, { action: 'EXPORT', entityType: 'shifts', details: { start_date, end_date, count: rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prestations_${start_date}_${end_date}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Export factures ──────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = await db.all(`
      SELECT
        i.invoice_number,
        i.issue_date,
        i.due_date,
        c.name AS client,
        i.title,
        i.total_ht,
        i.tva_rate,
        ROUND((i.total_ht * (1 + i.tva_rate / 100))::numeric, 2) AS total_ttc,
        i.status,
        i.payment_date,
        i.notes
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.company_id = ?
        AND i.issue_date >= ? AND i.issue_date <= ?
      ORDER BY i.issue_date DESC
    `, [req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    const STATUS_FR = { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' };
    const mapped = rows.map(r => ({ ...r, status: STATUS_FR[r.status] || r.status }));

    const csv = toCSV(mapped, [
      { key: 'invoice_number', label: 'N° facture' },
      { key: 'issue_date',     label: "Date d'émission" },
      { key: 'due_date',       label: "Date d'échéance" },
      { key: 'client',         label: 'Client' },
      { key: 'title',          label: 'Objet' },
      { key: 'total_ht',       label: 'Total HT (€)' },
      { key: 'tva_rate',       label: 'TVA (%)' },
      { key: 'total_ttc',      label: 'Total TTC (€)' },
      { key: 'status',         label: 'Statut' },
      { key: 'payment_date',   label: 'Date paiement' },
      { key: 'notes',          label: 'Notes' },
    ]);

    logAudit(req, { action: 'EXPORT', entityType: 'invoices', details: { start_date, end_date, count: rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="factures_${start_date}_${end_date}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
