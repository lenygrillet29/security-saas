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

    const offers = await db.all(
      `SELECT so.id, so.status, so.sent_at,
              sh.date, sh.start_time, sh.end_time, sh.notes,
              s.name AS site_name, s.address AS site_address
       FROM shift_offers so
       JOIN shifts sh ON sh.id = so.shift_id
       JOIN sites  s  ON s.id  = sh.site_id
       WHERE so.agent_id = ? AND so.status = 'pending'
       ORDER BY so.sent_at DESC`,
      [agent.id]
    );

    res.json({
      agent: {
        id: agent.id,
        first_name: agent.first_name,
        last_name: agent.last_name,
        company_name: agent.company_name,
      },
      shifts,
      offers,
      today,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent-portal/:token/offers/:offerId/accept|decline ─────────────
router.post('/:token/offers/:offerId/:action', async (req, res) => {
  const { action } = req.params;
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Action invalide' });
  try {
    const agent = await resolveAgent(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Lien invalide' });

    const offer = await db.get(
      `SELECT so.*, sh.site_id, sh.date, sh.start_time, sh.end_time, sh.notes
       FROM shift_offers so JOIN shifts sh ON sh.id = so.shift_id
       WHERE so.id = ? AND so.agent_id = ?`,
      [req.params.offerId, agent.id]
    );
    if (!offer) return res.status(404).json({ error: 'Offre non trouvée' });
    if (offer.status !== 'pending') return res.status(409).json({ error: 'Vous avez déjà répondu à cette offre' });

    await db.run(
      'UPDATE shift_offers SET status = ?, responded_at = NOW() WHERE id = ?',
      [action === 'accept' ? 'accepted' : 'declined', offer.id]
    );

    if (action === 'accept') {
      await db.run('UPDATE shifts SET agent_id = ? WHERE id = ?', [agent.id, offer.shift_id]);
      await db.run(
        "UPDATE shift_offers SET status = 'auto_declined', responded_at = NOW() WHERE shift_id = ? AND id != ? AND status = 'pending'",
        [offer.shift_id, offer.id]
      );
    }

    res.json({ success: true, action });
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

// ── Helpers timezone Europe/Paris ─────────────────────────────────────────────
function getParisDateTime(date) {
  // Retourne { date: 'YYYY-MM-DD', h, m } en heure de Paris
  const str = date.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' });
  // sv-SE → "2024-01-15 08:30:00"
  const [datePart, timePart] = str.split(' ');
  const [h, m] = timePart.split(':').map(Number);
  return { date: datePart, h, m };
}

function pad2(n) { return String(n).padStart(2, '0'); }

function shiftTime(h, m, deltaMin) {
  // Ajoute deltaMin minutes à h:m, retourne "HH:MM"
  let total = ((h * 60 + m + deltaMin) % 1440 + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

// ── Envoi notifications — appelé toutes les 15 min par le cron ────────────────
async function sendTimedReminders() {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const WINDOW = 7; // ±7 min (fenêtre 15 min sans doublon)

  const checks = [
    {
      minutesBefore: 24 * 60,
      label: '24h',
      title: (site) => `📅 Vacation demain — ${site}`,
      body:  (s)    => `${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}${s.site_city ? ' · ' + s.site_city : ''}`,
    },
    {
      minutesBefore: 2 * 60,
      label: '2h',
      title: (site) => `⏰ Vacation dans 2h — ${site}`,
      body:  (s)    => `Début à ${s.start_time.slice(0,5)}${s.site_city ? ' · ' + s.site_city : ''}`,
    },
  ];

  try {
    let totalSent = 0;

    for (const check of checks) {
      const target = new Date(Date.now() + check.minutesBefore * 60000);
      const { date, h, m } = getParisDateTime(target);

      const timeMin = shiftTime(h, m, -WINDOW);
      const timeMax = shiftTime(h, m, +WINDOW);

      const shifts = await db.all(
        `SELECT sh.id, sh.start_time, sh.end_time,
                s.name AS site_name, s.city AS site_city,
                a.first_name, subs.endpoint, subs.p256dh, subs.auth
         FROM shifts sh
         JOIN sites s    ON s.id = sh.site_id
         JOIN agents a   ON a.id = sh.agent_id
         JOIN agent_push_subscriptions subs ON subs.agent_id = sh.agent_id
         WHERE sh.date = ? AND sh.start_time >= ? AND sh.start_time <= ?`,
        [date, timeMin, timeMax]
      );

      for (const shift of shifts) {
        try {
          await webpush.sendNotification(
            { endpoint: shift.endpoint, keys: { p256dh: shift.p256dh, auth: shift.auth } },
            JSON.stringify({
              title: check.title(shift.site_name),
              body:  check.body(shift),
              icon:  '/icon-192.png',
              badge: '/icon-192.png',
              tag:   `shift-${shift.id}-${check.label}`,
              data:  { url: '/agent' },
            })
          );
          totalSent++;
        } catch (err) {
          if (err.statusCode === 410) {
            await db.run('DELETE FROM agent_push_subscriptions WHERE endpoint = ?', [shift.endpoint]);
          }
        }
      }
    }

    if (totalSent > 0) console.log(`[Push] ✅ ${totalSent} notification(s) envoyée(s)`);
  } catch (e) {
    console.error('[Push] Erreur cron:', e.message);
  }
}

module.exports = router;
module.exports.sendTimedReminders = sendTimedReminders;
