/**
 * Export CSV / Excel pour la comptabilité et la paie.
 * GET /api/export/shifts?start_date=&end_date=&format=csv|xlsx
 * GET /api/export/invoices?start_date=&end_date=&format=csv|xlsx
 */
const express  = require('express');
const router   = express.Router();
const { db }   = require('../db/database');
const { logAudit } = require('../utils/audit');

// ── CSV ──────────────────────────────────────────────────────────────────────
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

// ── Excel XML (SpreadsheetML — aucune dépendance) ────────────────────────────
function toXLS(res, rows, columns, sheetName, filename) {
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const headerCells = columns.map(c =>
    `<Cell ss:StyleID="header"><Data ss:Type="String">${esc(c.label)}</Data></Cell>`
  ).join('');

  const dataRows = rows.map((row, i) => {
    const style = i % 2 === 0 ? 'even' : 'odd';
    const cells = columns.map(c => {
      const v = row[c.key] ?? '';
      const isNum = v !== '' && !isNaN(v) && typeof v !== 'boolean';
      return isNum
        ? `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${v}</Data></Cell>`
        : `<Cell ss:StyleID="${style}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="even">
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="odd">
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${esc(sheetName)}">
    <Table>
      <Row ss:Height="20">${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
}

// ── Export shifts (prestations) ───────────────────────────────────────────────
router.get('/shifts', async (req, res) => {
  try {
    const { start_date, end_date, format = 'csv' } = req.query;
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

    const columns = [
      { key: 'date',            label: 'Date' },
      { key: 'agent',           label: 'Agent' },
      { key: 'employee_number', label: 'N° matricule' },
      { key: 'client',          label: 'Client' },
      { key: 'site',            label: 'Site' },
      { key: 'start_time',      label: 'Début' },
      { key: 'end_time',        label: 'Fin' },
      { key: 'hours_day',       label: 'H. jour' },
      { key: 'hours_night',     label: 'H. nuit' },
      { key: 'hours_sunday',    label: 'H. dimanche' },
      { key: 'total_hours',     label: 'Total heures' },
      { key: 'montant_ht',      label: 'Montant HT (€)' },
      { key: 'notes',           label: 'Notes' },
    ];

    logAudit(req, { action: 'EXPORT', entityType: 'shifts', details: { start_date, end_date, format, count: rows.length } });

    if (format === 'xlsx') {
      return toXLS(res, rows, columns, 'Prestations', `prestations_${start_date}_${end_date}.xls`);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prestations_${start_date}_${end_date}.csv"`);
    res.send(toCSV(rows, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Export factures ───────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const { start_date, end_date, format = 'csv' } = req.query;
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

    const columns = [
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
    ];

    logAudit(req, { action: 'EXPORT', entityType: 'invoices', details: { start_date, end_date, format, count: rows.length } });

    if (format === 'xlsx') {
      return toXLS(res, mapped, columns, 'Factures', `factures_${start_date}_${end_date}.xls`);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="factures_${start_date}_${end_date}.csv"`);
    res.send(toCSV(mapped, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Export paie consolidé (heures + frais + CP) ───────────────────────────────
// GET /api/export/paie?month=YYYY-MM&format=csv|xlsx
router.get('/paie', async (req, res) => {
  try {
    const { format = 'xlsx' } = req.query;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const startDate = `${month}-01`;
    const endDate   = new Date(parseInt(year), parseInt(mon), 0).toISOString().slice(0, 10);

    const agents = await db.all(
      `SELECT id, first_name, last_name, employee_number, contract_type, hourly_rate
       FROM agents WHERE company_id = ? AND active = 1
       ORDER BY last_name, first_name`,
      [req.user.companyId]
    );

    const rows = await Promise.all(agents.map(async (a) => {
      const h = await db.get(`
        SELECT
          COALESCE(SUM(hours_day),0)                  AS h_jour,
          COALESCE(SUM(hours_night),0)                AS h_nuit,
          COALESCE(SUM(hours_sunday),0)               AS h_dim,
          COALESCE(SUM(hours_sunday_night),0)         AS h_dim_nuit,
          COALESCE(SUM(hours_holiday),0)              AS h_ferie,
          COALESCE(SUM(hours_holiday_night),0)        AS h_ferie_nuit,
          COALESCE(SUM(hours_holiday_sunday_day),0)   AS h_ferie_dim,
          COALESCE(SUM(hours_holiday_sunday_night),0) AS h_ferie_dim_nuit,
          COUNT(*)                                     AS nb_vacations
        FROM shifts
        WHERE agent_id = ? AND company_id = ? AND date >= ? AND date <= ?
      `, [a.id, req.user.companyId, startDate, endDate]);

      const totalH = ['h_jour','h_nuit','h_dim','h_dim_nuit',
        'h_ferie','h_ferie_nuit','h_ferie_dim','h_ferie_dim_nuit']
        .reduce((s, k) => s + (parseFloat(h[k]) || 0), 0);

      const frais = await db.get(`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS nb
        FROM expense_reports
        WHERE agent_id = ? AND company_id = ? AND date >= ? AND date <= ? AND status = 'approved'
      `, [a.id, req.user.companyId, startDate, endDate]);

      const cp = await db.get(
        `SELECT COALESCE(SUM(days), 0) AS balance FROM cp_transactions
         WHERE agent_id = ? AND company_id = ?`,
        [a.id, req.user.companyId]
      );

      const absences = await db.all(`
        SELECT type, start_date, end_date FROM absences
        WHERE agent_id = ? AND company_id = ? AND status = 'approved'
          AND start_date <= ? AND end_date >= ?
      `, [a.id, req.user.companyId, endDate, startDate]);

      const absJours = absences.reduce((s, ab) => {
        const s1 = new Date(Math.max(new Date(ab.start_date), new Date(startDate)));
        const e1 = new Date(Math.min(new Date(ab.end_date), new Date(endDate)));
        return s + Math.max(0, Math.round((e1 - s1) / 86400000) + 1);
      }, 0);

      const brutEstime = totalH * (a.hourly_rate || 0);

      return {
        matricule:    a.employee_number || '',
        nom:          a.last_name,
        prenom:       a.first_name,
        contrat:      a.contract_type || '',
        nb_vacations: parseInt(h.nb_vacations) || 0,
        h_jour:       Math.round((parseFloat(h.h_jour) || 0) * 100) / 100,
        h_nuit:       Math.round((parseFloat(h.h_nuit) || 0) * 100) / 100,
        h_dim:        Math.round(((parseFloat(h.h_dim) || 0) + (parseFloat(h.h_dim_nuit) || 0)) * 100) / 100,
        h_ferie:      Math.round(((parseFloat(h.h_ferie) || 0) + (parseFloat(h.h_ferie_nuit) || 0) + (parseFloat(h.h_ferie_dim) || 0) + (parseFloat(h.h_ferie_dim_nuit) || 0)) * 100) / 100,
        total_heures: Math.round(totalH * 100) / 100,
        abs_jours:    absJours,
        frais_nb:     parseInt(frais.nb) || 0,
        frais_total:  Math.round((parseFloat(frais.total) || 0) * 100) / 100,
        cp_solde:     Math.round((parseFloat(cp.balance) || 0) * 10) / 10,
        brut_estime:  brutEstime > 0 ? Math.round(brutEstime * 100) / 100 : '',
      };
    }));

    const columns = [
      { key: 'matricule',    label: 'Matricule' },
      { key: 'nom',          label: 'Nom' },
      { key: 'prenom',       label: 'Prénom' },
      { key: 'contrat',      label: 'Contrat' },
      { key: 'nb_vacations', label: 'Nb vacations' },
      { key: 'h_jour',       label: 'H. jour' },
      { key: 'h_nuit',       label: 'H. nuit' },
      { key: 'h_dim',        label: 'H. dimanche' },
      { key: 'h_ferie',      label: 'H. fériés' },
      { key: 'total_heures', label: 'Total heures' },
      { key: 'abs_jours',    label: 'Jours absents' },
      { key: 'frais_nb',     label: 'Nb frais' },
      { key: 'frais_total',  label: 'Frais approuvés (€)' },
      { key: 'cp_solde',     label: 'Solde CP (j)' },
      { key: 'brut_estime',  label: 'Brut estimé (€)' },
    ];

    logAudit(req, { action: 'EXPORT', entityType: 'paie', details: { month, format, count: rows.length } });

    const filename = `paie_${month}`;
    if (format === 'xlsx' || format === 'xls') {
      return toXLS(res, rows, columns, `Paie ${month}`, `${filename}.xls`);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(toCSV(rows, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
