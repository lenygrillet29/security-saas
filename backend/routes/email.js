const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { sendEmail } = require('../utils/emailSender');
const { generateAgentPlanning, generateQuote } = require('../utils/pdfGenerator');

async function getSettings(companyId) {
  const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', [companyId]);
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
  try {
    const { start_date, end_date, to, subject, message } = req.body;
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

    const shifts = await db.all(`
      SELECT sh.*, s.name as site_name FROM shifts sh JOIN sites s ON sh.site_id = s.id
      WHERE sh.agent_id = ? AND sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
      ORDER BY sh.date
    `, [req.params.id, req.user.companyId, start_date || '2000-01-01', end_date || '2099-12-31']);

    const settings = await getSettings(req.user.companyId);
    const doc = generateAgentPlanning(settings, agent, shifts, start_date, end_date);
    const pdfBuffer = await pdfToBuffer(doc);

    await sendEmail(settings, {
      to: to || agent.email,
      subject: subject || `Planning ${agent.first_name} ${agent.last_name}`,
      html: `<p>${message || 'Veuillez trouver ci-joint votre planning.'}</p>`,
      attachments: [{ filename: `planning_${agent.last_name}.pdf`, content: pdfBuffer }],
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/quote/:id', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    const quote = await db.get('SELECT * FROM quotes WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [quote.client_id]);
    const site = quote.site_id ? await db.get('SELECT * FROM sites WHERE id = ?', [quote.site_id]) : null;
    const lines = await db.all('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY id', [quote.id]);

    const settings = await getSettings(req.user.companyId);
    const doc = generateQuote(settings, quote, client, site, lines);
    const pdfBuffer = await pdfToBuffer(doc);

    await sendEmail(settings, {
      to: to || client.email,
      subject: subject || `Devis ${quote.quote_number} - ${quote.title}`,
      html: `<p>${message || 'Veuillez trouver ci-joint votre devis.'}</p>`,
      attachments: [{ filename: `devis_${quote.quote_number}.pdf`, content: pdfBuffer }],
    });

    await db.run('UPDATE quotes SET status = ? WHERE id = ? AND status = ?', ['sent', quote.id, 'draft']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Envoi planning en masse (tous les agents actifs avec email) ──────────────
router.post('/planning/bulk', async (req, res) => {
  try {
    const { start_date, end_date, subject, message } = req.body;
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date et end_date requis' });

    const agents = await db.all(
      'SELECT * FROM agents WHERE company_id = ? AND active = 1 AND email IS NOT NULL AND email != ""',
      [req.user.companyId]
    );

    const settings = await getSettings(req.user.companyId);
    const results = { sent: 0, failed: 0, errors: [] };

    for (const agent of agents) {
      try {
        const shifts = await db.all(`
          SELECT sh.*, s.name as site_name FROM shifts sh JOIN sites s ON sh.site_id = s.id
          WHERE sh.agent_id = ? AND sh.company_id = ? AND sh.date >= ? AND sh.date <= ?
          ORDER BY sh.date
        `, [agent.id, req.user.companyId, start_date, end_date]);

        const doc = generateAgentPlanning(settings, agent, shifts, start_date, end_date);
        const pdfBuffer = await pdfToBuffer(doc);

        await sendEmail(settings, {
          to: agent.email,
          subject: subject || `Planning ${agent.first_name} ${agent.last_name}`,
          html: `<p>${message || 'Veuillez trouver ci-joint votre planning.'}</p>`,
          attachments: [{ filename: `planning_${agent.last_name}.pdf`, content: pdfBuffer }],
        });
        results.sent++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${agent.first_name} ${agent.last_name}: ${err.message}`);
      }
    }

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
