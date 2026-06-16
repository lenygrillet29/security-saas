const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { randomUUID } = require('crypto');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');
const { format } = require('date-fns');
const { fr } = require('date-fns/locale');

const APP_URL = process.env.APP_URL || 'https://securoplan.vercel.app';

function fmtDate(d) {
  try { return format(new Date(d), 'EEEE d MMMM yyyy', { locale: fr }); }
  catch { return d; }
}

// ── Envoyer une offre à un ou plusieurs agents ─────────────────────────────────
// POST /api/shift-offers  { shift_id, agent_ids: [] }
router.post('/', requireWriter, async (req, res) => {
  try {
    const { shift_id, agent_ids } = req.body;
    if (!shift_id || !agent_ids?.length) return res.status(400).json({ error: 'shift_id et agent_ids requis' });

    const shift = await db.get(`
      SELECT sh.*, s.name as site_name
      FROM shifts sh JOIN sites s ON sh.site_id = s.id
      WHERE sh.id = ? AND sh.company_id = ?
    `, [shift_id, req.user.companyId]);
    if (!shift) return res.status(404).json({ error: 'Shift non trouvé' });

    const company = await db.get('SELECT name FROM companies WHERE id = ?', [req.user.companyId]);

    const results = [];
    for (const agent_id of agent_ids) {
      const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [agent_id, req.user.companyId]);
      if (!agent?.email) { results.push({ agent_id, status: 'no_email' }); continue; }

      // Supprimer ancienne offre si existe
      await db.run('DELETE FROM shift_offers WHERE shift_id = ? AND agent_id = ?', [shift_id, agent_id]);

      const token = randomUUID();
      await db.insert(
        'INSERT INTO shift_offers (company_id, shift_id, agent_id, token, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.companyId, shift_id, agent_id, token, 'pending']
      );

      await sendSystemEmail({
        to: agent.email,
        subject: `Proposition de vacation — ${company?.name || 'SecuroPlan'}`,
        html: templates.shiftOffer({
          agentFirstName: agent.first_name,
          companyName:    company?.name || 'SecuroPlan',
          date:           fmtDate(shift.date),
          startTime:      shift.start_time?.slice(0, 5),
          endTime:        shift.end_time?.slice(0, 5),
          siteName:       shift.site_name,
          portalUrl:      `${APP_URL}/agent/${agent.agent_token}`,
        }),
      }).catch(() => {});

      results.push({ agent_id, status: 'sent', email: agent.email });
    }

    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Liste des offres pour un shift ─────────────────────────────────────────────
// GET /api/shift-offers?shift_id=X
router.get('/', requireWriter, async (req, res) => {
  try {
    const { shift_id } = req.query;
    let query = `
      SELECT so.*, a.first_name, a.last_name, a.email, a.color
      FROM shift_offers so
      JOIN agents a ON so.agent_id = a.id
      WHERE so.company_id = ?
    `;
    const params = [req.user.companyId];
    if (shift_id) { query += ' AND so.shift_id = ?'; params.push(shift_id); }
    query += ' ORDER BY so.sent_at DESC';
    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Annuler une offre ──────────────────────────────────────────────────────────
// DELETE /api/shift-offers/:id
router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const offer = await db.get('SELECT id FROM shift_offers WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!offer) return res.status(404).json({ error: 'Offre non trouvée' });
    await db.run('DELETE FROM shift_offers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
