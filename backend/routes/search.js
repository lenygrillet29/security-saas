const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/search?q=... — recherche globale agents/clients/sites/shifts
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ agents: [], clients: [], sites: [], shifts: [] });

    const like = `%${q}%`;
    const cid  = req.user.companyId;

    const [agents, clients, sites, shifts] = await Promise.all([
      db.all(
        `SELECT id, first_name, last_name, color, contract_type, active
         FROM agents
         WHERE company_id = ? AND (first_name ILIKE ? OR last_name ILIKE ? OR CONCAT(first_name, ' ', last_name) ILIKE ?)
         ORDER BY active DESC, last_name LIMIT 6`,
        [cid, like, like, like]
      ),
      db.all(
        `SELECT id, name, email, phone
         FROM clients
         WHERE company_id = ? AND (name ILIKE ? OR email ILIKE ?)
         ORDER BY name LIMIT 6`,
        [cid, like, like]
      ),
      db.all(
        `SELECT s.id, s.name, s.address, c.name AS client_name
         FROM sites s JOIN clients c ON s.client_id = c.id
         WHERE s.company_id = ? AND (s.name ILIKE ? OR s.address ILIKE ?)
         ORDER BY s.name LIMIT 6`,
        [cid, like, like]
      ),
      db.all(
        `SELECT sh.id, sh.date, sh.start_time, sh.end_time,
                a.first_name AS agent_first, a.last_name AS agent_last,
                s.name AS site_name
         FROM shifts sh
         LEFT JOIN agents a ON sh.agent_id = a.id
         JOIN sites s ON sh.site_id = s.id
         WHERE sh.company_id = ?
           AND (a.first_name ILIKE ? OR a.last_name ILIKE ? OR s.name ILIKE ?
                OR CONCAT(a.first_name, ' ', a.last_name) ILIKE ?)
           AND sh.date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY sh.date DESC LIMIT 6`,
        [cid, like, like, like, like]
      ),
    ]);

    res.json({ agents, clients, sites, shifts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
