const express = require('express');
const router = express.Router();
const db = require('../db/database');
const {
  generateAgentPlanning,
  generateSitePlanning,
  generateClientPlanning,
  generateQuote,
} = require('../utils/pdfGenerator');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function streamPdf(res, doc, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
}

// Planning agent
router.get('/planning/agent/:id', (req, res) => {
  const { start_date, end_date } = req.query;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

  const shifts = db.prepare(`
    SELECT sh.*, s.name as site_name
    FROM shifts sh JOIN sites s ON sh.site_id = s.id
    WHERE sh.agent_id = ? AND sh.date >= ? AND sh.date <= ?
    ORDER BY sh.date, sh.start_time
  `).all(req.params.id, start_date || '2000-01-01', end_date || '2099-12-31');

  const doc = generateAgentPlanning(getSettings(), agent, shifts, start_date, end_date);
  streamPdf(res, doc, `planning_${agent.last_name}_${start_date}.pdf`);
});

// Planning site
router.get('/planning/site/:id', (req, res) => {
  const { start_date, end_date } = req.query;
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site non trouvé' });
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(site.client_id);

  const shifts = db.prepare(`
    SELECT sh.*, a.first_name as agent_first_name, a.last_name as agent_last_name
    FROM shifts sh JOIN agents a ON sh.agent_id = a.id
    WHERE sh.site_id = ? AND sh.date >= ? AND sh.date <= ?
    ORDER BY sh.date, sh.start_time
  `).all(req.params.id, start_date || '2000-01-01', end_date || '2099-12-31');

  const doc = generateSitePlanning(getSettings(), site, client, shifts, start_date, end_date);
  streamPdf(res, doc, `planning_site_${site.name}_${start_date}.pdf`);
});

// Planning client
router.get('/planning/client/:id', (req, res) => {
  const { start_date, end_date } = req.query;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client non trouvé' });

  const shifts = db.prepare(`
    SELECT sh.*, s.name as site_name,
           a.first_name as agent_first_name, a.last_name as agent_last_name
    FROM shifts sh
    JOIN sites s ON sh.site_id = s.id
    JOIN agents a ON sh.agent_id = a.id
    WHERE s.client_id = ? AND sh.date >= ? AND sh.date <= ?
    ORDER BY sh.date, sh.start_time
  `).all(req.params.id, start_date || '2000-01-01', end_date || '2099-12-31');

  const doc = generateClientPlanning(getSettings(), client, [], shifts, start_date, end_date);
  streamPdf(res, doc, `planning_client_${client.name}_${start_date}.pdf`);
});

// Devis
router.get('/quote/:id', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(quote.client_id);
  const site = quote.site_id ? db.prepare('SELECT * FROM sites WHERE id = ?').get(quote.site_id) : null;
  const lines = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id').all(quote.id);

  const doc = generateQuote(getSettings(), quote, client, site, lines);
  streamPdf(res, doc, `devis_${quote.quote_number || quote.id}.pdf`);
});

module.exports = router;
