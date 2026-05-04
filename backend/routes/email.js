const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendEmail } = require('../utils/emailSender');
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

function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

router.post('/planning/agent/:id', async (req, res) => {
  const { start_date, end_date, to, subject, message } = req.body;
  const settings = getSettings();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

  const shifts = db.prepare(`
    SELECT sh.*, s.name as site_name FROM shifts sh JOIN sites s ON sh.site_id = s.id
    WHERE sh.agent_id = ? AND sh.date >= ? AND sh.date <= ?
    ORDER BY sh.date
  `).all(req.params.id, start_date || '2000-01-01', end_date || '2099-12-31');

  const doc = generateAgentPlanning(settings, agent, shifts, start_date, end_date);
  const pdfBuffer = await pdfToBuffer(doc);

  await sendEmail(settings, {
    to: to || agent.email,
    subject: subject || `Planning ${agent.first_name} ${agent.last_name}`,
    html: `<p>${message || 'Veuillez trouver ci-joint votre planning.'}</p>`,
    attachments: [{ filename: `planning_${agent.last_name}.pdf`, content: pdfBuffer }],
  });
  res.json({ success: true });
});

router.post('/quote/:id', async (req, res) => {
  const { to, subject, message } = req.body;
  const settings = getSettings();
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(quote.client_id);
  const site = quote.site_id ? db.prepare('SELECT * FROM sites WHERE id = ?').get(quote.site_id) : null;
  const lines = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id').all(quote.id);

  const doc = generateQuote(settings, quote, client, site, lines);
  const pdfBuffer = await pdfToBuffer(doc);

  await sendEmail(settings, {
    to: to || client.email,
    subject: subject || `Devis ${quote.quote_number} - ${quote.title}`,
    html: `<p>${message || 'Veuillez trouver ci-joint votre devis.'}</p>`,
    attachments: [{ filename: `devis_${quote.quote_number}.pdf`, content: pdfBuffer }],
  });

  db.prepare('UPDATE quotes SET status = ? WHERE id = ? AND status = ?').run('sent', quote.id, 'draft');
  res.json({ success: true });
});

module.exports = router;
