/**
 * Portail agent mobile — accessible sans compte via token unique.
 *
 * GET  /api/agent-portal/:token              → planning agent (30 jours)
 * POST /api/agent-portal/:token/checkin/:shiftId  → pointer arrivée (géoloc)
 * POST /api/agent-portal/:token/checkout/:shiftId → pointer départ (géoloc)
 */
const express  = require('express');
const router   = express.Router();
const { db }   = require('../db/database');
const webpush  = require('web-push');

// Config VAPID (si clés présentes)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contact@securoplan.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── Résoudre l'agent depuis le token ─────────────────────────────────────────
async function resolveAgent(token) {
  if (!/^[0-9a-f-]{32,36}$/i.test(token)) return null;
  return db.get(
    `SELECT a.*, c.name AS company_name
     FROM agents a
     JOIN companies c ON c.id = a.company_id
     WHERE a.agent_token = ? AND a.active = 1`,
    [token]
  );
}

// ── GET /api/agent-portal/:token ─────────────────────────────────────────────
router.get('/:token', async (req, res) => {
  try {
    const agent = await resolveAgent(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Lien invalide ou agent inactif' });

    const today = new Date().toISOString().slice(0, 10);
    const end   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const shifts = await db.all(
      `SELECT sh.id, sh.date, sh.start_time, sh.end_time, sh.notes,
              sh.checkin_at, sh.checkout_at, sh.checkin_distance,
              s.name AS site_name, s.address AS site_address, s.city AS site_city,
              s.latitude, s.longitude, s.instructions AS site_instructions,
              cl.name AS client_name
       FROM shifts sh
       JOIN sites s   ON s.id  = sh.site_id
       JOIN clients cl ON cl.id = s.client_id
       WHERE sh.agent_id = ? AND sh.date >= ? AND sh.date <= ?
       ORDER BY sh.date, sh.start_time`,
      [agent.id, today, end]
    );

    res.json({
      agent: {
        id: agent.id,
        first_name: agent.first_name,
        last_name: agent.last_name,
        company_name: agent.company_name,
      },
      shifts,
      today,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent-portal/:token/checkin/:shiftId ───────────────────────────
router.post('/:token/checkin/:shiftId', async (req, res) => {
  try {
    const agent = await resolveAgent(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Lien invalide' });

    const shift = await db.get(
      'SELECT * FROM shifts WHERE id = ? AND agent_id = ?',
      [req.params.shiftId, agent.id]
    );
    if (!shift) return res.status(404).json({ error: 'Vacation non trouvée' });
    if (shift.checkin_at) return res.status(409).json({ error: 'Déjà pointé' });

    const { lat, lng } = req.body;

    // Calcul distance si le site a des coordonnées
    let distance = null;
    if (lat && lng && shift.latitude && shift.longitude) {
      const R = 6371000;
      const dLat = (shift.latitude - lat) * Math.PI / 180;
      const dLng = (shift.longitude - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(shift.latitude*Math.PI/180) * Math.sin(dLng/2)**2;
      distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    await db.run(
      `UPDATE shifts SET checkin_at = NOW(), checkin_lat = ?, checkin_lng = ?, checkin_distance = ? WHERE id = ?`,
      [lat || null, lng || null, distance, shift.id]
    );

    res.json({ success: true, checkin_at: new Date().toISOString(), distance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent-portal/:token/checkout/:shiftId ──────────────────────────
router.post('/:token/checkout/:shiftId', async (req, res) => {
  try {
    const agent = await resolveAgent(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Lien invalide' });

    const shift = await db.get(
      'SELECT * FROM shifts WHERE id = ? AND agent_id = ?',
      [req.params.shiftId, agent.id]
    );
    if (!shift) return res.status(404).json({ error: 'Vacation non trouvée' });
    if (!shift.checkin_at) return res.status(409).json({ error: 'Check-in requis avant le check-out' });
    if (shift.checkout_at) return res.status(409).json({ error: 'Déjà pointé en sortie' });

    const { lat, lng } = req.body;
    await db.run(
      `UPDATE shifts SET checkout_at = NOW(), checkout_lat = ?, checkout_lng = ? WHERE id = ?`,
      [lat || null, lng || null, shift.id]
    );

    res.json({ success: true, checkout_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent-portal/:token/subscribe ───────────────────────────────────
router.post('/:token/subscribe', async (req, res) => {
  try {
    const agent = await resolveAgent(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Lien invalide' });

    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Subscription invalide' });
    }

    await db.run(
      `INSERT INTO agent_push_subscriptions (agent_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (agent_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [agent.id, endpoint, keys.p256dh, keys.auth]
    );

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent-portal/:token/unsubscribe ─────────────────────────────────
router.post('/:token/unsubscribe', async (req, res) => {
  try {
    const agent = await resolveAgent(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Lien invalide' });
    await db.run('DELETE FROM agent_push_subscriptions WHERE agent_id = ?', [agent.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Clé publique VAPID (pour le frontend) ────────────────────────────────────
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// ── Envoi notifications (appelé par le cron) ──────────────────────────────────
async function sendShiftReminders() {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Shifts demain avec abonnements push
    const shifts = await db.all(
      `SELECT sh.id, sh.start_time, sh.end_time,
              s.name AS site_name, s.city AS site_city,
              a.first_name, subs.endpoint, subs.p256dh, subs.auth
       FROM shifts sh
       JOIN sites s ON s.id = sh.site_id
       JOIN agents a ON a.id = sh.agent_id
       JOIN agent_push_subscriptions subs ON subs.agent_id = sh.agent_id
       WHERE sh.date = ?`,
      [tomorrowStr]
    );

    let sent = 0;
    for (const shift of shifts) {
      try {
        await webpush.sendNotification(
          { endpoint: shift.endpoint, keys: { p256dh: shift.p256dh, auth: shift.auth } },
          JSON.stringify({
            title: `Vacation demain — ${shift.site_name}`,
            body:  `${shift.start_time.slice(0,5)} – ${shift.end_time.slice(0,5)}${shift.site_city ? ' · ' + shift.site_city : ''}`,
            icon:  '/icon-192.png',
            badge: '/icon-192.png',
            tag:   `shift-${shift.id}`,
            data:  { url: '/agent' },
          })
        );
        sent++;
      } catch (err) {
        // Subscription expirée → supprimer
        if (err.statusCode === 410) {
          await db.run('DELETE FROM agent_push_subscriptions WHERE endpoint = ?', [shift.endpoint]);
        }
      }
    }
    if (sent > 0) console.log(`[Push] ✅ ${sent} notification(s) envoyée(s) pour demain (${tomorrowStr})`);
  } catch (e) {
    console.error('[Push] Erreur cron:', e.message);
  }
}

module.exports = router;
module.exports.sendShiftReminders = sendShiftReminders;
