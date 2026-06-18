const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { checkAgentLimit } = require('./addons');
const { randomUUID } = require('crypto');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let query = `SELECT * FROM agents WHERE company_id = ?`;
    const params = [req.user.companyId];
    if (active !== undefined) {
      query += ` AND active = ?`;
      params.push(active === 'true' || active === '1' ? 1 : 0);
    }
    query += ` ORDER BY last_name, first_name`;
    res.json(await db.all(query, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Agents disponibles sur une période (sans shift ni absence) ───────────────
router.get('/available', async (req, res) => {
  try {
    const { start_date, end_date, exclude_agent_id } = req.query;
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date et end_date requis' });

    // Agents actifs de la société
    const agents = await db.all(
      'SELECT * FROM agents WHERE company_id = ? AND active = 1 ORDER BY last_name, first_name',
      [req.user.companyId]
    );

    // Agents ayant un shift sur la période
    const busyShifts = await db.all(
      `SELECT DISTINCT agent_id FROM shifts
       WHERE company_id = ? AND date >= ? AND date <= ?`,
      [req.user.companyId, start_date, end_date]
    );
    const busyAbsences = await db.all(
      `SELECT DISTINCT agent_id FROM absences
       WHERE company_id = ? AND status != 'rejected' AND start_date <= ? AND end_date >= ?`,
      [req.user.companyId, end_date, start_date]
    );
    const busyIds = new Set([
      ...busyShifts.map(r => r.agent_id),
      ...busyAbsences.map(r => r.agent_id),
    ]);
    if (exclude_agent_id) busyIds.add(parseInt(exclude_agent_id));

    res.json(agents.filter(a => !busyIds.has(a.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    res.json(agent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, notes,
            address, birth_date, birth_place, nationality, carte_vitale, carte_pro, carte_pro_expiry, entry_date, exit_date } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'Prénom et nom requis' });
    if (!email) return res.status(400).json({ error: 'Email requis' });

    // Vérification limite pack agents
    const limitCheck = await checkAgentLimit(req.user.companyId);
    if (!limitCheck.ok) {
      return res.status(403).json({
        error: `Limite atteinte : ${limitCheck.count}/${limitCheck.limit} agents actifs. Passez au pack supérieur pour en ajouter davantage.`,
        limit_reached: true,
        count: limitCheck.count,
        limit: limitCheck.limit,
        pack:  limitCheck.pack,
      });
    }
    const agentToken = randomUUID();
    const result = await db.insert(
      `INSERT INTO agents (company_id, first_name, last_name, email, phone, employee_number, contract_type,
        hourly_rate, color, notes, agent_token, address, birth_date, birth_place, nationality,
        carte_vitale, carte_pro, carte_pro_expiry, entry_date, exit_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, first_name, last_name, email || null, phone || null,
        employee_number || null, contract_type || 'CDI', hourly_rate || 0, color || '#3B82F6',
        notes || null, agentToken,
        address || null, birth_date || null, birth_place || null, nationality || null,
        carte_vitale || null, carte_pro || null, carte_pro_expiry || null, entry_date || null, exit_date || null]
    );
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [result.lastInsertRowid]);
    logAudit(req, { action: 'CREATE', entityType: 'agent', entityId: agent.id, entityName: `${first_name} ${last_name}` });

    // Envoi email avec lien portail agent
    if (email) {
      const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
      const company = await db.get('SELECT name FROM companies WHERE id = ?', [req.user.companyId]);
      sendSystemEmail({
        to: email,
        subject: `Votre espace agent — ${company?.name || 'SecuroPlan'}`,
        html: templates.agentPortalLink({
          agentFirstName: first_name,
          companyName:    company?.name || 'SecuroPlan',
          portalUrl:      `${appUrl}/agent/${agentToken}`,
        }),
      }).catch(() => {});
    }

    res.status(201).json(agent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, color, active, notes,
            address, birth_date, birth_place, nationality, carte_vitale, carte_pro, carte_pro_expiry, entry_date, exit_date, photo } = req.body;
    const existing = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run(
      `UPDATE agents SET first_name=?, last_name=?, email=?, phone=?, employee_number=?, contract_type=?,
       hourly_rate=?, color=?, active=?, notes=?,
       address=?, birth_date=?, birth_place=?, nationality=?,
       carte_vitale=?, carte_pro=?, carte_pro_expiry=?, entry_date=?, exit_date=?,
       photo=COALESCE(?, photo)
       WHERE id=?`,
      [first_name, last_name, email || null, phone || null, employee_number || null,
        contract_type || 'CDI', hourly_rate || 0, color || '#3B82F6',
        active !== undefined ? (active ? 1 : 0) : 1, notes || null,
        address || null, birth_date || null, birth_place || null, nationality || null,
        carte_vitale || null, carte_pro || null, carte_pro_expiry || null, entry_date || null, exit_date || null,
        photo || null,
        req.params.id]
    );
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [req.params.id]);
    logAudit(req, { action: 'UPDATE', entityType: 'agent', entityId: agent.id, entityName: `${agent.first_name} ${agent.last_name}` });
    res.json(agent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Photo agent ─────────────────────────────────────────────────────────────
router.post('/:id/photo', requireWriter, async (req, res) => {
  try {
    const { photo } = req.body; // data URL base64
    if (!photo) return res.status(400).json({ error: 'Photo manquante' });
    // Limite ~4 Mo en base64
    if (photo.length > 5_500_000) return res.status(400).json({ error: 'Image trop volumineuse (max 4 Mo)' });
    const agent = await db.get('SELECT id FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run('UPDATE agents SET photo = ? WHERE id = ?', [photo, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/photo', requireWriter, async (req, res) => {
  try {
    const agent = await db.get('SELECT id FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run('UPDATE agents SET photo = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Renvoyer le lien portail agent ──────────────────────────────────────────
router.post('/:id/send-portal', requireWriter, async (req, res) => {
  try {
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    if (!agent.email) return res.status(400).json({ error: 'Cet agent n\'a pas d\'email' });

    // Générer un token si pas encore fait
    let token = agent.agent_token;
    if (!token) {
      token = randomUUID();
      await db.run('UPDATE agents SET agent_token = ? WHERE id = ?', [token, agent.id]);
    }

    const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
    const company = await db.get('SELECT name FROM companies WHERE id = ?', [req.user.companyId]);
    await sendSystemEmail({
      to: agent.email,
      subject: `Votre espace agent — ${company?.name || 'SecuroPlan'}`,
      html: templates.agentPortalLink({
        agentFirstName: agent.first_name,
        companyName:    company?.name || 'SecuroPlan',
        portalUrl:      `${appUrl}/agent/${token}`,
      }),
    });

    res.json({ success: true, sent_to: agent.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Lien portail (copier sans envoyer email) ─────────────────────────────────
router.get('/:id/portal-link', requireWriter, async (req, res) => {
  try {
    const agent = await db.get('SELECT id, agent_token FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

    let token = agent.agent_token;
    if (!token) {
      token = randomUUID();
      await db.run('UPDATE agents SET agent_token = ? WHERE id = ?', [token, agent.id]);
    }

    const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
    res.json({ url: `${appUrl}/agent/${token}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Archive / Désarchive ─────────────────────────────────────────────────────
router.post('/:id/archive', requireWriter, async (req, res) => {
  try {
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run('UPDATE agents SET active = 0 WHERE id = ?', [req.params.id]);
    logAudit(req, { action: 'ARCHIVE', entityType: 'agent', entityId: agent.id, entityName: `${agent.first_name} ${agent.last_name}` });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/unarchive', requireWriter, async (req, res) => {
  try {
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run('UPDATE agents SET active = 1 WHERE id = ?', [req.params.id]);
    logAudit(req, { action: 'UNARCHIVE', entityType: 'agent', entityId: agent.id, entityName: `${agent.first_name} ${agent.last_name}` });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
    await db.run('DELETE FROM agents WHERE id = ?', [req.params.id]);
    logAudit(req, { action: 'DELETE', entityType: 'agent', entityId: agent.id, entityName: `${agent.first_name} ${agent.last_name}` });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agents/carte-pro-alerts — agents avec carte pro expirée ou expirant dans 30 jours
router.get('/carte-pro-alerts', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const agents = await db.all(
      `SELECT id, first_name, last_name, color, carte_pro, carte_pro_expiry
       FROM agents
       WHERE company_id = ? AND active = 1
         AND carte_pro_expiry IS NOT NULL AND carte_pro_expiry != ''
         AND carte_pro_expiry <= ?
       ORDER BY carte_pro_expiry ASC`,
      [req.user.companyId, in30]
    );
    // Enrichir avec le statut
    const result = agents.map(a => ({
      ...a,
      expired: a.carte_pro_expiry < today,
      days_left: Math.ceil((new Date(a.carte_pro_expiry) - new Date(today)) / 86400000),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/agents/import — import CSV ─────────────────────────────────────
// Colonnes attendues (ordre libre, noms insensibles à la casse) :
// first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, carte_pro, carte_pro_expiry
router.post('/import', requireWriter, async (req, res) => {
  try {
    const { rows } = req.body; // tableau d'objets parsé côté frontend
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Aucune ligne à importer' });
    if (rows.length > 200) return res.status(400).json({ error: 'Maximum 200 agents par import' });

    const norm = k => k.trim().toLowerCase().replace(/\s+/g, '_');

    let created = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [norm(k), String(v ?? '').trim()]));

      const first = r.first_name || r.prenom || r['prénom'] || '';
      const last  = r.last_name  || r.nom    || '';
      if (!first || !last) { skipped++; errors.push(`Ligne ${i + 2} : prénom ou nom manquant`); continue; }

      // Doublon par nom + prénom
      const exists = await db.get(
        'SELECT id FROM agents WHERE company_id = ? AND lower(first_name) = lower(?) AND lower(last_name) = lower(?)',
        [req.user.companyId, first, last]
      );
      if (exists) { skipped++; errors.push(`Ligne ${i + 2} : ${first} ${last} existe déjà`); continue; }

      await db.insert(
        `INSERT INTO agents (company_id, first_name, last_name, email, phone, employee_number, contract_type, hourly_rate, carte_pro, carte_pro_expiry, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          req.user.companyId,
          first, last,
          r.email            || null,
          r.phone || r.tel   || null,
          r.employee_number  || r.matricule || null,
          r.contract_type    || r.contrat   || 'CDI',
          parseFloat(r.hourly_rate || r.taux_horaire) || 0,
          r.carte_pro        || null,
          r.carte_pro_expiry || null,
        ]
      );
      created++;
    }

    logAudit(req, { action: 'IMPORT', entityType: 'agent', details: `${created} agent(s) importé(s)` });
    res.json({ created, skipped, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
