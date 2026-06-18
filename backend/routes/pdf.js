const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  generateAgentPlanning,
  generateSitePlanning,
  generateClientPlanning,
  generateQuote,
  generateInvoice,
  generateAgentBadge,
  generateRHReport,
} = require('../utils/pdfGenerator');

async function getSettings(companyId) {
  const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', [companyId]);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function streamPdf(res, doc, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
}

router.get('/planning/agent/:id', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

    const shifts = await db.all(`
      SELECT sh.*, s.name as site_name
      FROM shifts sh JOIN sites s ON sh.site_id = s.id
      WHERE sh.agent_id = ? AND sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, sh.start_time
    `, [req.params.id, req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    const settings = await getSettings(req.user.companyId);
    const doc = generateAgentPlanning(settings, agent, shifts, start_date, end_date);
    streamPdf(res, doc, `planning_${agent.last_name}_${start_date}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/planning/site/:id', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const site = await db.get('SELECT * FROM sites WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!site) return res.status(404).json({ error: 'Site non trouvé' });
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [site.client_id]);

    const shifts = await db.all(`
      SELECT sh.*, a.first_name as agent_first_name, a.last_name as agent_last_name
      FROM shifts sh JOIN agents a ON sh.agent_id = a.id
      WHERE sh.site_id = ? AND sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, sh.start_time
    `, [req.params.id, req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    const settings = await getSettings(req.user.companyId);
    const doc = generateSitePlanning(settings, site, client, shifts, start_date, end_date);
    streamPdf(res, doc, `planning_site_${site.name}_${start_date}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/planning/client/:id', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const client = await db.get('SELECT * FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });

    const shifts = await db.all(`
      SELECT sh.*, s.name as site_name,
             a.first_name as agent_first_name, a.last_name as agent_last_name
      FROM shifts sh
      JOIN sites s ON sh.site_id = s.id
      JOIN agents a ON sh.agent_id = a.id
      WHERE s.client_id = ? AND sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, sh.start_time
    `, [req.params.id, req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    const settings = await getSettings(req.user.companyId);
    const doc = generateClientPlanning(settings, client, [], shifts, start_date, end_date);
    streamPdf(res, doc, `planning_client_${client.name}_${start_date}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/quote/:id', async (req, res) => {
  try {
    const quote = await db.get('SELECT * FROM quotes WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [quote.client_id]);
    const site = quote.site_id ? await db.get('SELECT * FROM sites WHERE id = ?', [quote.site_id]) : null;
    const lines = await db.all('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id', [quote.id]);

    const settings = await getSettings(req.user.companyId);
    const doc = generateQuote(settings, quote, client, site, lines);
    streamPdf(res, doc, `devis_${quote.quote_number || quote.id}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Badge agent ──────────────────────────────────────────────────────────────
router.get('/badge/:id', async (req, res) => {
  try {
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    const settings = await getSettings(req.user.companyId);
    const doc = generateAgentBadge(settings, agent);
    streamPdf(res, doc, `badge_${agent.last_name}_${agent.first_name}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Facture PDF ──────────────────────────────────────────────────────────────
router.get('/invoice/:id', async (req, res) => {
  try {
    const invoice = await db.get(
      `SELECT i.*, c.name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.id = ? AND i.company_id = ?`,
      [req.params.id, req.user.companyId]
    );
    if (!invoice) return res.status(404).json({ error: 'Facture non trouvée' });
    const client  = await db.get('SELECT * FROM clients WHERE id = ?', [invoice.client_id]);
    const lines   = await db.all('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id', [invoice.id]);
    const settings = await getSettings(req.user.companyId);
    const doc = generateInvoice(settings, invoice, client, lines);
    streamPdf(res, doc, `facture_${invoice.invoice_number || invoice.id}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Rapport mensuel client ────────────────────────────────────────────────────
// GET /api/pdf/report/monthly/:clientId?month=2026-06
router.get('/report/monthly/:clientId', async (req, res) => {
  try {
    const { month } = req.query; // format YYYY-MM
    const yearMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = yearMonth.split('-');
    const startDate = `${yearMonth}-01`;
    const endDate   = new Date(year, mon, 0).toISOString().split('T')[0]; // dernier jour du mois

    const client = await db.get('SELECT * FROM clients WHERE id = ? AND company_id = ?', [req.params.clientId, req.user.companyId]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });

    const shifts = await db.all(`
      SELECT sh.*,
             s.name AS site_name, s.address AS site_address,
             a.first_name AS agent_first, a.last_name AS agent_last
      FROM shifts sh
      JOIN sites  s ON sh.site_id  = s.id
      JOIN agents a ON sh.agent_id = a.id
      WHERE s.client_id = ? AND sh.company_id = ?
        AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, s.name, sh.start_time
    `, [req.params.clientId, req.user.companyId, startDate, endDate]);

    const settings = await getSettings(req.user.companyId);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true, info: { Creator: 'SecuroPlan' } });

    // En-tête
    doc.rect(0, 0, doc.page.width, 70).fill('#1A1D2E');
    doc.fillColor('#3B82F6').fontSize(18).font('Helvetica-Bold')
       .text(settings.company_name || 'SecuroPlan', 40, 18);
    doc.fillColor('#F1F5F9').fontSize(13).font('Helvetica-Bold')
       .text('RAPPORT MENSUEL', 0, 18, { align: 'right', width: doc.page.width - 40 });
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica')
       .text(`${new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, 0, 38, { align: 'right', width: doc.page.width - 40 });

    let y = 90;
    // Infos client
    doc.fillColor('#94A3B8').fontSize(8).text('CLIENT', 40, y);
    doc.fillColor('#F1F5F9').fontSize(12).font('Helvetica-Bold').text(client.name, 40, y + 12);
    if (client.address) doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text(client.address, 40, y + 26);
    y += 55;

    // Résumé
    const totalDay    = shifts.reduce((s, sh) => s + (parseFloat(sh.hours_day)    || 0), 0);
    const totalNight  = shifts.reduce((s, sh) => s + (parseFloat(sh.hours_night)  || 0), 0);
    const totalSunday = shifts.reduce((s, sh) => s + (parseFloat(sh.hours_sunday) || 0), 0);
    const totalHours  = totalDay + totalNight + totalSunday;

    doc.rect(40, y, doc.page.width - 80, 44).fill('#2D3555');
    doc.fillColor('#94A3B8').fontSize(8).text('TOTAL HEURES', 60, y + 8);
    doc.fillColor('#F1F5F9').fontSize(14).font('Helvetica-Bold').text(`${totalHours.toFixed(1)}h`, 60, y + 18);
    doc.fillColor('#94A3B8').fontSize(8).text(`Jour: ${totalDay.toFixed(1)}h  Nuit: ${totalNight.toFixed(1)}h  Dimanche: ${totalSunday.toFixed(1)}h`, 60, y + 32);
    doc.fillColor('#94A3B8').fontSize(8).text('PRESTATIONS', doc.page.width / 2, y + 8);
    doc.fillColor('#F1F5F9').fontSize(14).font('Helvetica-Bold').text(`${shifts.length}`, doc.page.width / 2, y + 18);
    y += 60;

    // Tableau des prestations
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('DATE', 40, y);
    doc.text('AGENT', 110, y);
    doc.text('SITE', 230, y);
    doc.text('HORAIRES', 360, y);
    doc.text('HEURES', 460, y, { width: 80, align: 'right' });
    y += 14;
    doc.rect(40, y, doc.page.width - 80, 1).fill('#2D3555');
    y += 6;

    for (const sh of shifts) {
      if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
      const total = (parseFloat(sh.hours_day)||0) + (parseFloat(sh.hours_night)||0) + (parseFloat(sh.hours_sunday)||0);
      doc.fillColor('#F1F5F9').fontSize(9).font('Helvetica')
         .text(new Date(sh.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), 40, y)
         .text(`${sh.agent_first} ${sh.agent_last}`, 110, y)
         .text(sh.site_name, 230, y, { width: 120, ellipsis: true })
         .text(`${sh.start_time}–${sh.end_time}`, 360, y)
         .text(`${total.toFixed(1)}h`, 460, y, { width: 80, align: 'right' });
      y += 16;
      doc.rect(40, y, doc.page.width - 80, 0.5).fill('#1e2535');
      y += 4;
    }

    // Pied de page légal sur toutes les pages
    const range = doc.bufferedPageRange();
    const legalParts = [];
    if (settings.company_name)       legalParts.push(settings.company_name);
    if (settings.company_siret)      legalParts.push(`SIRET : ${settings.company_siret}`);
    if (settings.company_tva_number) legalParts.push(`TVA : ${settings.company_tva_number}`);
    if (settings.company_cnaps)      legalParts.push(`CNAPS : ${settings.company_cnaps}`);
    const footerText = legalParts.join('  ·  ') || `SecuroPlan — Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const pw = doc.page.width;
      const ph = doc.page.height;
      doc.rect(0, ph - 30, pw, 30).fill('#1A1D2E');
      doc.fillColor('#475569').fontSize(7).font('Helvetica')
         .text(footerText, 20, ph - 19, { width: pw - 40, align: 'center', lineBreak: false });
    }

    const monthLabel = new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(' ', '_');
    streamPdf(res, doc, `rapport_${client.name}_${monthLabel}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Récap mensuel paie agent ─────────────────────────────────────────────────
// GET /api/pdf/recap/agent/:agentId?month=2026-06
router.get('/recap/agent/:agentId', async (req, res) => {
  try {
    const { month } = req.query;
    const yearMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = yearMonth.split('-');
    const startDate = `${yearMonth}-01`;
    const endDate   = new Date(year, mon, 0).toISOString().split('T')[0];

    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.agentId, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

    const shifts = await db.all(`
      SELECT sh.*,
             s.name AS site_name, s.city AS site_city,
             cl.name AS client_name
      FROM shifts sh
      JOIN sites   s  ON sh.site_id  = s.id
      JOIN clients cl ON cl.id = s.client_id
      WHERE sh.agent_id = ? AND sh.company_id = ?
        AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date, sh.start_time
    `, [agent.id, req.user.companyId, startDate, endDate]);

    const settings = await getSettings(req.user.companyId);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true, info: { Creator: 'SecuroPlan' } });

    const monthLabel = new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const W = doc.page.width;

    // ── En-tête ──
    doc.rect(0, 0, W, 70).fill('#1A1D2E');
    doc.fillColor('#3B82F6').fontSize(18).font('Helvetica-Bold')
       .text(settings.company_name || 'SecuroPlan', 40, 18);
    doc.fillColor('#F1F5F9').fontSize(13).font('Helvetica-Bold')
       .text('RÉCAP MENSUEL PAIE', 0, 18, { align: 'right', width: W - 40 });
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica')
       .text(monthLabel.toUpperCase(), 0, 38, { align: 'right', width: W - 40 });

    let y = 90;

    // ── Infos agent ──
    doc.rect(40, y, W - 80, 54).fill('#1E2535');
    doc.fillColor('#94A3B8').fontSize(8).text('AGENT', 56, y + 8);
    doc.fillColor('#F1F5F9').fontSize(13).font('Helvetica-Bold')
       .text(`${agent.first_name} ${agent.last_name}`, 56, y + 18);
    const agentInfoParts = [];
    if (agent.employee_number) agentInfoParts.push(`Matricule : ${agent.employee_number}`);
    if (agent.contract_type)   agentInfoParts.push(agent.contract_type);
    if (agent.carte_pro)       agentInfoParts.push(`Carte pro : ${agent.carte_pro}`);
    if (agentInfoParts.length) {
      doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
         .text(agentInfoParts.join('  ·  '), 56, y + 36);
    }
    y += 68;

    // ── Totaux ──
    const tot = {
      day:          shifts.reduce((s, sh) => s + (parseFloat(sh.hours_day)                  || 0), 0),
      night:        shifts.reduce((s, sh) => s + (parseFloat(sh.hours_night)                || 0), 0),
      sunday:       shifts.reduce((s, sh) => s + (parseFloat(sh.hours_sunday)               || 0), 0),
      sundayNight:  shifts.reduce((s, sh) => s + (parseFloat(sh.hours_sunday_night)         || 0), 0),
      holiday:      shifts.reduce((s, sh) => s + (parseFloat(sh.hours_holiday)              || 0), 0),
      holidayNight: shifts.reduce((s, sh) => s + (parseFloat(sh.hours_holiday_night)        || 0), 0),
      hsdDay:       shifts.reduce((s, sh) => s + (parseFloat(sh.hours_holiday_sunday_day)   || 0), 0),
      hsdNight:     shifts.reduce((s, sh) => s + (parseFloat(sh.hours_holiday_sunday_night) || 0), 0),
    };
    tot.total = Object.values(tot).reduce((a, b) => a + b, 0);

    const hStr = h => h > 0 ? `${Math.floor(h)}h${Math.round((h%1)*60).toString().padStart(2,'0')}` : '—';

    const boxes = [
      { label: 'Total heures', value: hStr(tot.total), color: '#3B82F6' },
      { label: 'Heures jour', value: hStr(tot.day), color: '#F59E0B' },
      { label: 'Heures nuit', value: hStr(tot.night), color: '#8B5CF6' },
      { label: 'Dimanche', value: hStr(tot.sunday + tot.sundayNight), color: '#06B6D4' },
      { label: 'Jours fériés', value: hStr(tot.holiday + tot.holidayNight + tot.hsdDay + tot.hsdNight), color: '#EF4444' },
      { label: 'Vacations', value: `${shifts.length}`, color: '#10B981' },
    ];
    const bw = (W - 80) / 3;
    boxes.forEach((b, i) => {
      const bx = 40 + (i % 3) * bw;
      const by = y + Math.floor(i / 3) * 48;
      doc.rect(bx + 2, by, bw - 4, 44).fill('#1E2535');
      doc.fillColor(b.color).fontSize(15).font('Helvetica-Bold')
         .text(b.value, bx + 8, by + 6, { width: bw - 16 });
      doc.fillColor('#64748B').fontSize(7).font('Helvetica')
         .text(b.label.toUpperCase(), bx + 8, by + 28, { width: bw - 16 });
    });
    y += 100;

    // ── Tableau des vacations ──
    const COL = { date: 40, client: 95, site: 200, hours: 310, type: 390, total: 490 };
    doc.rect(40, y, W - 80, 16).fill('#2D3555');
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
       .text('DATE',    COL.date,   y + 5)
       .text('CLIENT',  COL.client, y + 5)
       .text('SITE',    COL.site,   y + 5)
       .text('HORAIRES',COL.hours,  y + 5)
       .text('TYPE',    COL.type,   y + 5)
       .text('TOTAL',   COL.total,  y + 5, { width: 60, align: 'right' });
    y += 20;

    for (const sh of shifts) {
      if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
      const totalH = (parseFloat(sh.hours_day)||0) + (parseFloat(sh.hours_night)||0) +
                     (parseFloat(sh.hours_sunday)||0) + (parseFloat(sh.hours_sunday_night)||0) +
                     (parseFloat(sh.hours_holiday)||0) + (parseFloat(sh.hours_holiday_night)||0) +
                     (parseFloat(sh.hours_holiday_sunday_day)||0) + (parseFloat(sh.hours_holiday_sunday_night)||0);

      let typeLabel = 'Jour';
      if (sh.hours_night > 0)               typeLabel = 'Nuit';
      if (sh.hours_sunday > 0)              typeLabel = 'Dim.';
      if (sh.hours_holiday > 0)             typeLabel = 'Férié';

      doc.fillColor('#F1F5F9').fontSize(8.5).font('Helvetica')
         .text(new Date(sh.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), COL.date, y)
         .text(sh.client_name, COL.client, y, { width: 100, ellipsis: true })
         .text(sh.site_name,   COL.site,   y, { width: 105, ellipsis: true })
         .text(`${sh.start_time.slice(0,5)}–${sh.end_time.slice(0,5)}`, COL.hours, y)
         .text(typeLabel,      COL.type,   y)
         .text(hStr(totalH),   COL.total,  y, { width: 60, align: 'right' });
      y += 14;
      doc.rect(40, y, W - 80, 0.5).fill('#1E2535');
      y += 3;
    }

    // ── Zone signature ──
    y += 20;
    if (y > doc.page.height - 120) { doc.addPage(); y = 40; }
    doc.rect(40, y, W - 80, 80).fill('#1E2535');
    doc.fillColor('#64748B').fontSize(8).font('Helvetica')
       .text('Je soussigné(e) certifie exact le récapitulatif des heures ci-dessus.', 56, y + 10);
    doc.fillColor('#94A3B8').fontSize(8)
       .text('Date et signature de l\'agent :', 56, y + 28)
       .text('Signature de l\'employeur :', W / 2 + 10, y + 28);
    doc.rect(56, y + 40, (W - 80) / 2 - 20, 28).stroke('#2D3555');
    doc.rect(W / 2 + 10, y + 40, (W - 80) / 2 - 20, 28).stroke('#2D3555');

    // ── Pied de page ──
    const range = doc.bufferedPageRange();
    const legalParts = [];
    if (settings.company_name)  legalParts.push(settings.company_name);
    if (settings.company_siret) legalParts.push(`SIRET : ${settings.company_siret}`);
    const footerText = legalParts.join('  ·  ') || `SecuroPlan — Généré le ${new Date().toLocaleDateString('fr-FR')}`;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const ph = doc.page.height;
      doc.rect(0, ph - 28, W, 28).fill('#1A1D2E');
      doc.fillColor('#475569').fontSize(7).font('Helvetica')
         .text(footerText, 20, ph - 17, { width: W - 40, align: 'center', lineBreak: false });
    }

    const mSlug = monthLabel.replace(' ', '_');
    streamPdf(res, doc, `recap_paie_${agent.last_name}_${mSlug}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PDF rapport de vacation ───────────────────────────────────────────────────
router.get('/vacation-report/:id', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const report = await db.get(`
      SELECT vr.*,
        a.first_name AS agent_first, a.last_name AS agent_last,
        s.name AS site_name, s.address AS site_address,
        c.name AS company_name
      FROM vacation_reports vr
      JOIN agents a ON a.id = vr.agent_id
      LEFT JOIN sites s ON s.id = vr.site_id
      JOIN companies c ON c.id = vr.company_id
      WHERE vr.id = ? AND vr.company_id = ?
    `, [req.params.id, req.user.companyId]);
    if (!report) return res.status(404).json({ error: 'Rapport introuvable' });

    const events = await db.all(
      'SELECT * FROM vacation_report_events WHERE report_id = ? ORDER BY time ASC',
      [req.params.id]
    );
    const settings = await getSettings(req.user.companyId);

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const W = doc.page.width;
    const BLUE = '#3B82F6'; const DARK = '#1E2535'; const LIGHT = '#CBD5E1'; const MID = '#64748B';

    // ── En-tête ──
    doc.rect(0, 0, W, 70).fill(DARK);
    doc.fillColor(BLUE).fontSize(18).font('Helvetica-Bold').text('RAPPORT DE VACATION', 40, 18);
    doc.fillColor(LIGHT).fontSize(9).font('Helvetica').text(settings.company_name || report.company_name, 40, 42);
    const dateStr = new Date(report.report_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    doc.fillColor(MID).text(dateStr, W - 260, 42, { width: 220, align: 'right' });

    // ── Statut badge ──
    const signed = report.status === 'signe';
    doc.rect(W - 120, 10, 80, 22).fill(signed ? '#10B981' : '#F59E0B');
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text(signed ? 'SIGNÉ' : 'BROUILLON', W - 120, 17, { width: 80, align: 'center' });

    let y = 90;

    // ── Infos principales ──
    const col = (W - 80) / 2;
    const infoBox = (label, value, x, yy) => {
      doc.fillColor(MID).fontSize(7).font('Helvetica').text(label.toUpperCase(), x, yy);
      doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(value || '—', x, yy + 12, { width: col - 10 });
    };
    infoBox('Agent', `${report.agent_last} ${report.agent_first}`, 40, y);
    infoBox('Site', report.site_name || 'Non précisé', 40 + col, y);
    y += 38;
    infoBox('Heure de prise de poste', report.start_time ? report.start_time.slice(0,5) : '—', 40, y);
    infoBox('Heure de fin de service', report.end_time ? report.end_time.slice(0,5) : '—', 40 + col, y);
    y += 38;

    // Séparateur
    doc.rect(40, y, W - 80, 1).fill('#2D3555'); y += 16;

    // ── RAS ──
    if (report.nothing_to_report) {
      doc.rect(40, y, W - 80, 40).fill('#0F2E1A');
      doc.rect(40, y, 4, 40).fill('#10B981');
      doc.fillColor('#10B981').fontSize(11).font('Helvetica-Bold').text('✓ RIEN À SIGNALER (RAS)', 56, y + 14);
      y += 56;
    } else {
      // ── Événements ──
      if (events.length > 0) {
        doc.fillColor(BLUE).fontSize(9).font('Helvetica-Bold').text('CHRONOLOGIE DES ÉVÉNEMENTS', 40, y); y += 14;
        const TYPE_COLORS = { incident: '#EF4444', visiteur: '#F59E0B', ronde: '#10B981', intervention: '#F97316', observation: '#3B82F6', autre: '#94A3B8' };
        events.forEach(ev => {
          if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
          const c = TYPE_COLORS[ev.type] || '#94A3B8';
          doc.rect(40, y, 3, 18).fill(c);
          doc.fillColor(MID).fontSize(8).font('Helvetica').text(ev.time, 50, y + 4);
          doc.fillColor(c).fontSize(7).font('Helvetica-Bold').text(ev.type.toUpperCase(), 90, y + 5);
          doc.fillColor(LIGHT).fontSize(8).font('Helvetica').text(ev.description, 155, y + 4, { width: W - 195 });
          y += 22;
        });
        y += 8;
      }

      // ── Observations ──
      if (report.observations) {
        if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
        doc.fillColor(BLUE).fontSize(9).font('Helvetica-Bold').text('OBSERVATIONS GÉNÉRALES', 40, y); y += 14;
        doc.rect(40, y, W - 80, 1).fill('#2D3555'); y += 8;
        doc.fillColor(LIGHT).fontSize(9).font('Helvetica').text(report.observations, 40, y, { width: W - 80 });
        y += doc.heightOfString(report.observations, { width: W - 80 }) + 16;
      }

      // ── Incidents ──
      if (report.incidents) {
        if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
        doc.rect(40, y, W - 80, 14).fill('#2A0A0A');
        doc.fillColor('#EF4444').fontSize(9).font('Helvetica-Bold').text('⚠ INCIDENTS / SIGNALEMENTS', 44, y + 3); y += 22;
        doc.fillColor(LIGHT).fontSize(9).font('Helvetica').text(report.incidents, 40, y, { width: W - 80 });
        y += doc.heightOfString(report.incidents, { width: W - 80 }) + 16;
      }

      // ── Visiteurs ──
      if (report.visitors) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        doc.fillColor(BLUE).fontSize(9).font('Helvetica-Bold').text('ENTRÉES / VISITEURS', 40, y); y += 14;
        doc.fillColor(LIGHT).fontSize(9).font('Helvetica').text(report.visitors, 40, y, { width: W - 80 });
        y += doc.heightOfString(report.visitors, { width: W - 80 }) + 16;
      }
    }

    // ── Équipements ──
    if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
    doc.rect(40, y, W - 80, 28).fill(report.equipment_check ? '#0A2818' : '#2A1A0A');
    doc.fillColor(report.equipment_check ? '#10B981' : '#F59E0B').fontSize(9).font('Helvetica-Bold')
       .text(report.equipment_check ? '✓ Équipements vérifiés — tout en ordre' : `⚠ Anomalie équipements : ${report.equipment_notes || 'voir notes'}`, 50, y + 9);
    y += 44;

    // ── Zone signature ──
    if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
    doc.rect(40, y, W - 80, 80).fill(DARK);
    doc.fillColor(MID).fontSize(8).font('Helvetica').text('Je soussigné(e) certifie exacts les renseignements portés sur ce rapport de vacation.', 50, y + 10, { width: W - 100 });
    doc.fillColor(LIGHT).fontSize(8).text('Nom et signature de l\'agent :', 50, y + 28).text('Visa responsable :', (W / 2) + 10, y + 28);
    doc.rect(50, y + 42, (W - 80) / 2 - 20, 26).stroke('#2D3555');
    doc.rect((W / 2) + 10, y + 42, (W - 80) / 2 - 20, 26).stroke('#2D3555');
    if (signed && report.signed_at) {
      const signDate = new Date(report.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.fillColor('#10B981').fontSize(7).text(`Signé électroniquement le ${signDate}`, 50, y + 50, { width: (W - 80) / 2 - 20, align: 'center' });
    }

    // ── Pied de page ──
    const range = doc.bufferedPageRange();
    const footer = [settings.company_name, settings.company_siret ? `SIRET ${settings.company_siret}` : null].filter(Boolean).join(' · ') || 'SecuroPlan';
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const ph = doc.page.height;
      doc.rect(0, ph - 24, W, 24).fill('#1A1D2E');
      doc.fillColor('#475569').fontSize(7).font('Helvetica')
         .text(`${footer} · Rapport du ${report.report_date} — ${i + 1}/${range.count}`, 20, ph - 14, { width: W - 40, align: 'center', lineBreak: false });
    }

    streamPdf(res, doc, `rapport_vacation_${report.agent_last}_${report.report_date}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /pdf/rh-report?month=2026-06
router.get('/rh-report', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const startDate = `${month}-01`;
    const endDate   = new Date(Number(year), Number(mon), 0).toISOString().slice(0, 10);

    const agents = await db.all(
      `SELECT id, first_name, last_name, color, contract_type, employee_number, carte_pro_expiry
       FROM agents WHERE company_id = ? AND active = 1 ORDER BY last_name, first_name`,
      [req.user.companyId]
    );

    const today = new Date().toISOString().slice(0, 10);
    const results = await Promise.all(agents.map(async (a) => {
      const hoursRow = await db.get(`
        SELECT
          COALESCE(SUM(hours_day),0)                  AS hours_day,
          COALESCE(SUM(hours_night),0)                AS hours_night,
          COALESCE(SUM(hours_sunday),0)               AS hours_sunday,
          COALESCE(SUM(hours_sunday_night),0)         AS hours_sunday_night,
          COALESCE(SUM(hours_holiday),0)              AS hours_holiday,
          COALESCE(SUM(hours_holiday_night),0)        AS hours_holiday_night,
          COALESCE(SUM(hours_holiday_sunday_day),0)   AS hours_holiday_sunday_day,
          COALESCE(SUM(hours_holiday_sunday_night),0) AS hours_holiday_sunday_night,
          COUNT(*) AS shift_count
        FROM shifts WHERE agent_id = ? AND company_id = ? AND date >= ? AND date <= ?
      `, [a.id, req.user.companyId, startDate, endDate]);

      const totalHours = ['hours_day','hours_night','hours_sunday','hours_sunday_night',
        'hours_holiday','hours_holiday_night','hours_holiday_sunday_day','hours_holiday_sunday_night']
        .reduce((s, k) => s + (parseFloat(hoursRow[k]) || 0), 0);

      const absences = await db.all(
        `SELECT type, status, start_date, end_date FROM absences
         WHERE agent_id = ? AND company_id = ? AND start_date <= ? AND end_date >= ?`,
        [a.id, req.user.companyId, endDate, startDate]
      );
      const absenceDays = absences.filter(ab => ab.status === 'approved').reduce((s, ab) => {
        const s1 = new Date(Math.max(new Date(ab.start_date), new Date(startDate)));
        const e1 = new Date(Math.min(new Date(ab.end_date), new Date(endDate)));
        return s + Math.max(0, Math.round((e1 - s1) / 86400000) + 1);
      }, 0);

      const cpRow = await db.get(
        `SELECT COALESCE(SUM(days), 0) AS balance FROM cp_transactions WHERE agent_id = ? AND company_id = ?`,
        [a.id, req.user.companyId]
      );

      const expRow = await db.get(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE agent_id = ? AND company_id = ? AND date >= ? AND date <= ? AND status = 'approved'`,
        [a.id, req.user.companyId, startDate, endDate]
      );

      const carteProExpired = a.carte_pro_expiry && a.carte_pro_expiry < today;
      const carteProDaysLeft = a.carte_pro_expiry
        ? Math.round((new Date(a.carte_pro_expiry) - new Date(today)) / 86400000)
        : null;

      return {
        ...a,
        total_hours: totalHours,
        hours_breakdown: {
          day: parseFloat(hoursRow.hours_day) || 0,
          night: parseFloat(hoursRow.hours_night) || 0,
          sunday: parseFloat(hoursRow.hours_sunday) || 0,
          sunday_night: parseFloat(hoursRow.hours_sunday_night) || 0,
          holiday: parseFloat(hoursRow.hours_holiday) || 0,
          holiday_night: parseFloat(hoursRow.hours_holiday_night) || 0,
        },
        absence_days: absenceDays,
        cp_balance: parseFloat(cpRow.balance) || 0,
        expenses_total: parseFloat(expRow.total) || 0,
        carte_pro_expired: carteProExpired,
        carte_pro_days_left: carteProDaysLeft,
      };
    }));

    const settings = await getSettings(req.user.companyId);
    const doc = generateRHReport(settings, month, results);
    streamPdf(res, doc, `bilan_rh_${month}.pdf`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
