const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/notifications — toutes les alertes actives
router.get('/', async (req, res) => {
  const cid = req.user.companyId;
  const today = new Date().toISOString().split('T')[0];
  const in30  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const in60  = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  try {
    const items = [];

    // ── Tâches en retard ────────────────────────────────────────────────────
    const overdueTasks = await db.all(`
      SELECT t.id, t.title, t.due_date, t.priority,
             u.first_name AS user_first, u.last_name AS user_last,
             a.first_name AS agent_first, a.last_name AS agent_last
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_user_id
      LEFT JOIN agents a ON a.id = t.assigned_agent_id
      WHERE t.company_id = ? AND t.status != 'terminee'
        AND t.due_date IS NOT NULL AND t.due_date < ?
      ORDER BY t.due_date ASC
      LIMIT 20
    `, [cid, today]);
    overdueTasks.forEach(t => items.push({
      id:       `task_overdue_${t.id}`,
      category: 'taches',
      level:    t.priority === 'urgente' ? 'critique' : 'warning',
      title:    `Tâche en retard : ${t.title}`,
      detail:   t.due_date,
      assignee: t.user_first ? `${t.user_first} ${t.user_last}` : t.agent_first ? `${t.agent_first} ${t.agent_last}` : null,
      link:     '/taches',
      date:     t.due_date,
    }));

    // ── Absences en attente ────────────────────────────────────────────────
    const pendingAbs = await db.all(`
      SELECT ab.id, ab.type, ab.start_date, ab.end_date,
             a.first_name, a.last_name
      FROM absences ab
      JOIN agents a ON a.id = ab.agent_id
      WHERE ab.company_id = ? AND ab.status = 'pending'
      ORDER BY ab.created_at DESC
      LIMIT 10
    `, [cid]);
    pendingAbs.forEach(a => items.push({
      id:       `absence_pending_${a.id}`,
      category: 'absences',
      level:    'info',
      title:    `Absence en attente : ${a.first_name} ${a.last_name}`,
      detail:   `${a.type} · ${a.start_date} → ${a.end_date}`,
      link:     '/absences',
      date:     a.start_date,
    }));

    // ── Documents agents expirant dans 30j ────────────────────────────────
    const expiringDocs = await db.all(`
      SELECT d.id, d.doc_type, d.expiry_date,
             a.first_name, a.last_name
      FROM agent_documents d
      JOIN agents a ON a.id = d.agent_id
      WHERE d.company_id = ? AND d.expiry_date IS NOT NULL
        AND d.expiry_date <= ? AND d.expiry_date >= ?
      ORDER BY d.expiry_date ASC
      LIMIT 20
    `, [cid, in30, today]);
    expiringDocs.forEach(d => {
      const daysLeft = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000);
      items.push({
        id:       `doc_expiry_${d.id}`,
        category: 'documents',
        level:    daysLeft <= 7 ? 'critique' : 'warning',
        title:    `Document expirant : ${d.doc_type.toUpperCase()} de ${d.first_name} ${d.last_name}`,
        detail:   `Expire le ${d.expiry_date} (${daysLeft}j)`,
        link:     '/documents',
        date:     d.expiry_date,
      });
    });

    // ── Documents expirés ─────────────────────────────────────────────────
    const expiredDocs = await db.all(`
      SELECT d.id, d.doc_type, d.expiry_date,
             a.first_name, a.last_name
      FROM agent_documents d
      JOIN agents a ON a.id = d.agent_id
      WHERE d.company_id = ? AND d.expiry_date IS NOT NULL
        AND d.expiry_date < ?
      ORDER BY d.expiry_date DESC
      LIMIT 10
    `, [cid, today]);
    expiredDocs.forEach(d => items.push({
      id:       `doc_expired_${d.id}`,
      category: 'documents',
      level:    'critique',
      title:    `Document expiré : ${d.doc_type.toUpperCase()} de ${d.first_name} ${d.last_name}`,
      detail:   `Expiré le ${d.expiry_date}`,
      link:     '/documents',
      date:     d.expiry_date,
    }));

    // ── Formations / habilitations expirant dans 60j ──────────────────────
    const expiringTrainings = await db.all(`
      SELECT t.id, t.training_type, t.name, t.expiry_date,
             a.first_name, a.last_name
      FROM agent_trainings t
      JOIN agents a ON a.id = t.agent_id
      WHERE t.company_id = ? AND t.expiry_date IS NOT NULL
        AND t.expiry_date <= ? AND t.expiry_date >= ?
      ORDER BY t.expiry_date ASC
      LIMIT 20
    `, [cid, in60, today]);
    expiringTrainings.forEach(t => {
      const daysLeft = Math.ceil((new Date(t.expiry_date) - new Date()) / 86400000);
      items.push({
        id:       `training_expiry_${t.id}`,
        category: 'formations',
        level:    daysLeft <= 14 ? 'warning' : 'info',
        title:    `${t.training_type === 'habilitation' ? 'Habilitation' : 'Formation'} à renouveler : ${t.name}`,
        detail:   `${t.first_name} ${t.last_name} · expire le ${t.expiry_date} (${daysLeft}j)`,
        link:     '/formations',
        date:     t.expiry_date,
      });
    });

    // ── Incidents ouverts depuis plus de 7j ───────────────────────────────
    const oldIncidents = await db.all(`
      SELECT i.id, i.title, i.severity, i.incident_date,
             s.name AS site_name
      FROM incidents i
      LEFT JOIN sites s ON s.id = i.site_id
      WHERE i.company_id = ? AND i.status = 'ouvert'
        AND i.incident_date < date('now', '-7 days')
      ORDER BY i.incident_date ASC
      LIMIT 10
    `, [cid]);
    oldIncidents.forEach(i => items.push({
      id:       `incident_open_${i.id}`,
      category: 'incidents',
      level:    i.severity === 'critique' || i.severity === 'majeur' ? 'critique' : 'warning',
      title:    `Incident non clôturé : ${i.title}`,
      detail:   `${i.site_name || ''} · depuis le ${i.incident_date}`,
      link:     '/incidents',
      date:     i.incident_date,
    }));

    // ── Équipements non rendus depuis plus de 30j après fin prévue ────────
    const overdueEquip = await db.all(`
      SELECT e.id, e.name, e.category, e.return_date,
             a.first_name, a.last_name
      FROM equipments e
      JOIN agents a ON a.id = e.assigned_agent_id
      WHERE e.company_id = ? AND e.status = 'attribue'
        AND e.return_date IS NOT NULL AND e.return_date < ?
      ORDER BY e.return_date ASC
      LIMIT 10
    `, [cid, today]);
    overdueEquip.forEach(e => items.push({
      id:       `equip_overdue_${e.id}`,
      category: 'equipements',
      level:    'warning',
      title:    `Équipement non rendu : ${e.name}`,
      detail:   `${e.first_name} ${e.last_name} · retour prévu le ${e.return_date}`,
      link:     '/equipements',
      date:     e.return_date,
    }));

    // Trier : critique d'abord, puis warning, puis info ; puis par date
    const levelOrder = { critique: 0, warning: 1, info: 2 };
    items.sort((a, b) => {
      const lvl = levelOrder[a.level] - levelOrder[b.level];
      if (lvl !== 0) return lvl;
      return (a.date || '').localeCompare(b.date || '');
    });

    res.json({ count: items.length, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
