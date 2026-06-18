const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { getBalance } = require('./cp');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

const TYPE_LABELS = {
  conge: 'Congé payé', rtt: 'RTT', maladie: 'Arrêt maladie',
  sans_solde: 'Sans solde', formation: 'Formation', autre: 'Autre',
};

async function getCompanyManagers(companyId) {
  return db.all(
    `SELECT email, first_name, last_name FROM users
     WHERE company_id = ? AND active = 1 AND role IN ('admin','gestionnaire') AND email IS NOT NULL`,
    [companyId]
  );
}

async function getAgentEmail(agentId, companyId) {
  const a = await db.get(
    'SELECT email, first_name, last_name FROM agents WHERE id = ? AND company_id = ?',
    [agentId, companyId]
  );
  return a;
}

const ABSENCES_QUERY = `
  SELECT ab.*, a.first_name, a.last_name, a.color as agent_color
  FROM absences ab JOIN agents a ON ab.agent_id = a.id
`;

router.get('/', async (req, res) => {
  try {
    const { agent_id, start_date, end_date, type, status } = req.query;
    let query = ABSENCES_QUERY + ' WHERE ab.company_id = ?';
    const params = [req.user.companyId];

    if (agent_id) { query += ' AND ab.agent_id = ?'; params.push(agent_id); }
    if (start_date) { query += ' AND ab.end_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND ab.start_date <= ?'; params.push(end_date); }
    if (type) { query += ' AND ab.type = ?'; params.push(type); }
    if (status) { query += ' AND ab.status = ?'; params.push(status); }
    query += ' ORDER BY ab.start_date DESC';

    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const absence = await db.get(ABSENCES_QUERY + ' WHERE ab.id = ? AND ab.company_id = ?', [req.params.id, req.user.companyId]);
    if (!absence) return res.status(404).json({ error: 'Absence non trouvée' });
    res.json(absence);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { agent_id, start_date, end_date, type, status, notes } = req.body;
    if (!agent_id || !start_date || !end_date || !type)
      return res.status(400).json({ error: 'Champs requis manquants' });
    const result = await db.insert(
      `INSERT INTO absences (company_id, agent_id, start_date, end_date, type, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, start_date, end_date, type, status || 'approved', notes || null]
    );
    const absence = await db.get(ABSENCES_QUERY + ' WHERE ab.id = ?', [result.lastInsertRowid]);

    // Email aux gestionnaires si statut = en attente
    if ((status || 'approved') === 'pending') {
      try {
        const managers = await getCompanyManagers(req.user.companyId);
        const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
        for (const mgr of managers) {
          sendSystemEmail({
            to: mgr.email,
            subject: `📋 Demande d'absence — ${absence.first_name} ${absence.last_name}`,
            html: templates.absenceRequest({
              managerName: mgr.first_name,
              agentName: `${absence.first_name} ${absence.last_name}`,
              type: TYPE_LABELS[type] || type,
              startDate: start_date,
              endDate: end_date,
              notes: notes || '',
              appUrl,
            }),
          }).catch(() => {});
        }
      } catch {}
    }

    res.status(201).json(absence);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { agent_id, start_date, end_date, type, status, notes } = req.body;
    const existing = await db.get('SELECT id FROM absences WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Absence non trouvée' });
    await db.run(
      `UPDATE absences SET agent_id=?, start_date=?, end_date=?, type=?, status=?, notes=? WHERE id=?`,
      [agent_id, start_date, end_date, type, status || 'approved', notes || null, req.params.id]
    );
    res.json(await db.get(ABSENCES_QUERY + ' WHERE ab.id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT approuver ────────────────────────────────────────────────────────────
router.put('/:id/approve', requireWriter, async (req, res) => {
  try {
    const absence = await db.get(
      ABSENCES_QUERY + ' WHERE ab.id = ? AND ab.company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!absence) return res.status(404).json({ error: 'Absence non trouvée' });

    await db.run('UPDATE absences SET status = ? WHERE id = ?', ['approved', req.params.id]);

    // Déduire les jours CP si c'est un congé payé
    if (absence.type === 'conge') {
      try {
        const start = new Date(absence.start_date);
        const end   = new Date(absence.end_date);
        const days  = Math.round((end - start) / 86400000) + 1;
        await db.insert(
          `INSERT INTO cp_transactions (company_id, agent_id, absence_id, date, type, days, notes)
           VALUES (?, ?, ?, ?, 'utilisation', ?, ?)`,
          [req.user.companyId, absence.agent_id, absence.id, absence.start_date, -days, `Congé ${absence.start_date} → ${absence.end_date}`]
        );
      } catch {}
    }

    // Push notification à l'agent
    try {
      const subs = await db.all(
        'SELECT endpoint, p256dh, auth FROM agent_push_subscriptions WHERE agent_id = ?',
        [absence.agent_id]
      );
      if (subs.length && process.env.VAPID_PUBLIC_KEY) {
        const webpush = require('web-push');
        for (const s of subs) {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({
              title: '✅ Demande de congé approuvée',
              body:  `Du ${absence.start_date} au ${absence.end_date}`,
              icon:  '/icon-192.png',
              tag:   `absence-${absence.id}`,
            })
          ).catch(() => {});
        }
      }
    } catch {}

    const updated = await db.get(ABSENCES_QUERY + ' WHERE ab.id = ?', [req.params.id]);

    // Email à l'agent
    try {
      const agent = await getAgentEmail(absence.agent_id, req.user.companyId);
      if (agent?.email) {
        const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
        sendSystemEmail({
          to: agent.email,
          subject: '✅ Votre demande d\'absence a été approuvée',
          html: templates.absenceDecision({
            agentName: agent.first_name,
            approved: true,
            type: TYPE_LABELS[absence.type] || absence.type,
            startDate: absence.start_date,
            endDate: absence.end_date,
            reason: '',
            appUrl,
          }),
        }).catch(() => {});
      }
    } catch {}

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT refuser ──────────────────────────────────────────────────────────────
router.put('/:id/reject', requireWriter, async (req, res) => {
  try {
    const absence = await db.get(
      ABSENCES_QUERY + ' WHERE ab.id = ? AND ab.company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!absence) return res.status(404).json({ error: 'Absence non trouvée' });

    const { reason } = req.body;
    await db.run(
      'UPDATE absences SET status = ?, notes = COALESCE(?, notes) WHERE id = ?',
      ['rejected', reason || null, req.params.id]
    );

    // Push notification à l'agent
    try {
      const subs = await db.all(
        'SELECT endpoint, p256dh, auth FROM agent_push_subscriptions WHERE agent_id = ?',
        [absence.agent_id]
      );
      if (subs.length && process.env.VAPID_PUBLIC_KEY) {
        const webpush = require('web-push');
        for (const s of subs) {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({
              title: '❌ Demande de congé refusée',
              body:  `Du ${absence.start_date} au ${absence.end_date}${reason ? ' — ' + reason : ''}`,
              icon:  '/icon-192.png',
              tag:   `absence-${absence.id}`,
            })
          ).catch(() => {});
        }
      }
    } catch {}

    const updated = await db.get(ABSENCES_QUERY + ' WHERE ab.id = ?', [req.params.id]);

    // Email à l'agent
    try {
      const agent = await getAgentEmail(absence.agent_id, req.user.companyId);
      if (agent?.email) {
        const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
        sendSystemEmail({
          to: agent.email,
          subject: '❌ Votre demande d\'absence a été refusée',
          html: templates.absenceDecision({
            agentName: agent.first_name,
            approved: false,
            type: TYPE_LABELS[absence.type] || absence.type,
            startDate: absence.start_date,
            endDate: absence.end_date,
            reason: reason || '',
            appUrl,
          }),
        }).catch(() => {});
      }
    } catch {}

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM absences WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Absence non trouvée' });
    await db.run('DELETE FROM absences WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
