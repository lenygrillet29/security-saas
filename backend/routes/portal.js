/**
 * Portail client public — accessible sans authentification via un token unique.
 * GET /api/portal/:token?start=YYYY-MM-DD&end=YYYY-MM-DD
 *   → renvoie le planning du client pour la période demandée (défaut : 30 prochains jours).
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// ── GET /api/portal/:token ────────────────────────────────────────────────────
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Validation simple du format UUID
    if (!/^[0-9a-f-]{32,36}$/i.test(token)) {
      return res.status(404).json({ error: 'Lien invalide' });
    }

    // Récupérer le client + sa société
    const client = await db.get(
      `SELECT c.id, c.name, c.contact_name, c.email, c.phone, c.city, c.address,
              co.name AS company_name
       FROM clients c
       JOIN companies co ON co.id = c.company_id
       WHERE c.portal_token = ? AND c.active = 1`,
      [token]
    );
    if (!client) return res.status(404).json({ error: 'Lien introuvable ou expiré' });

    // Période (défaut : aujourd'hui → +30 jours)
    const today = new Date().toISOString().slice(0, 10);
    const defaultEnd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const start = req.query.start || today;
    const end   = req.query.end   || defaultEnd;

    // Shifts du client sur la période, avec agent + site
    const shifts = await db.all(
      `SELECT sh.id, sh.date, sh.start_time, sh.end_time, sh.notes,
              s.id   AS site_id,   s.name AS site_name,
              s.address AS site_address, s.city AS site_city,
              a.first_name AS agent_first_name, a.last_name AS agent_last_name
       FROM shifts sh
       JOIN sites  s ON s.id  = sh.site_id
       JOIN agents a ON a.id  = sh.agent_id
       WHERE s.client_id = ?
         AND sh.date >= ? AND sh.date <= ?
       ORDER BY sh.date, sh.start_time`,
      [client.id, start, end]
    );

    // Sites distincts du client
    const sites = await db.all(
      'SELECT id, name, address, city FROM sites WHERE client_id = ? AND active = 1 ORDER BY name',
      [client.id]
    );

    res.json({ client, sites, shifts, period: { start, end } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
