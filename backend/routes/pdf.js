const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  generateAgentPlanning,
  generateSitePlanning,
  generateClientPlanning,
  generateQuote,
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

module.exports = router;
