const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  generateAgentPlanning,
  generateSitePlanning,
  generateClientPlanning,
  generateQuote,
  generateInvoice,
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

module.exports = router;
