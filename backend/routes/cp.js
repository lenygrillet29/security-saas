const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// Solde CP d'un agent = somme de toutes ses transactions
async function getBalance(agentId, companyId) {
  const row = await db.get(
    `SELECT COALESCE(SUM(days), 0) AS balance FROM cp_transactions WHERE agent_id = ? AND company_id = ?`,
    [agentId, companyId]
  );
  return parseFloat(row.balance) || 0;
}

// ─── GET soldes de tous les agents ───────────────────────────────────────────
router.get('/balances', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT a.id AS agent_id, a.first_name, a.last_name, a.color, a.active,
             COALESCE(SUM(t.days), 0) AS balance
      FROM agents a
      LEFT JOIN cp_transactions t ON t.agent_id = a.id AND t.company_id = a.company_id
      WHERE a.company_id = ? AND a.active = 1
      GROUP BY a.id, a.first_name, a.last_name, a.color, a.active
      ORDER BY a.last_name, a.first_name
    `, [req.user.companyId]);
    res.json(rows.map(r => ({ ...r, balance: parseFloat(r.balance) || 0 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET transactions d'un agent ─────────────────────────────────────────────
router.get('/agent/:agentId', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT t.*, ab.type AS absence_type, ab.start_date AS absence_start, ab.end_date AS absence_end
      FROM cp_transactions t
      LEFT JOIN absences ab ON ab.id = t.absence_id
      WHERE t.agent_id = ? AND t.company_id = ?
      ORDER BY t.date DESC, t.created_at DESC
    `, [req.params.agentId, req.user.companyId]);
    const balance = rows.reduce((s, r) => s + (parseFloat(r.days) || 0), 0);
    res.json({ transactions: rows, balance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST ajouter une transaction manuelle ────────────────────────────────────
// type: 'acquisition' | 'ajustement' | 'solde_initial'
router.post('/', requireWriter, async (req, res) => {
  try {
    const { agent_id, date, type, days, notes } = req.body;
    if (!agent_id || !date || days === undefined) return res.status(400).json({ error: 'agent_id, date et days requis' });

    const agent = await db.get('SELECT * FROM agents WHERE id = ? AND company_id = ?', [agent_id, req.user.companyId]);
    if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

    const { lastInsertRowid } = await db.insert(
      `INSERT INTO cp_transactions (company_id, agent_id, date, type, days, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, agent_id, date, type || 'acquisition', parseFloat(days), notes || null]
    );
    const balance = await getBalance(agent_id, req.user.companyId);
    logAudit(req, { action: 'CP_TRANSACTION', entityType: 'agent', entityId: agent_id, entityName: `${agent.first_name} ${agent.last_name}`, details: `${days > 0 ? '+' : ''}${days}j (${type})` });
    res.status(201).json({ id: lastInsertRowid, balance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST acquisition mensuelle en masse ─────────────────────────────────────
// Ajoute 2.5j à tous les agents actifs pour un mois donné
router.post('/acquisition-mensuelle', requireWriter, async (req, res) => {
  try {
    const { month, days_per_agent } = req.body; // month = 'YYYY-MM'
    if (!month) return res.status(400).json({ error: 'month requis (YYYY-MM)' });
    const days = parseFloat(days_per_agent) || 2.5;
    const date = `${month}-01`;

    // Vérifie qu'on n'a pas déjà fait cette acquisition ce mois
    const existing = await db.get(
      `SELECT id FROM cp_transactions WHERE company_id = ? AND type = 'acquisition' AND date = ? LIMIT 1`,
      [req.user.companyId, date]
    );
    if (existing) return res.status(400).json({ error: `Acquisition déjà effectuée pour ${month}` });

    const agents = await db.all('SELECT id FROM agents WHERE company_id = ? AND active = 1', [req.user.companyId]);
    for (const a of agents) {
      await db.insert(
        `INSERT INTO cp_transactions (company_id, agent_id, date, type, days, notes) VALUES (?, ?, ?, 'acquisition', ?, ?)`,
        [req.user.companyId, a.id, date, days, `Acquisition mensuelle ${month}`]
      );
    }
    logAudit(req, { action: 'CP_ACQUISITION', entityType: 'company', details: `${agents.length} agents · ${days}j · ${month}` });
    res.json({ success: true, agents_count: agents.length, days_each: days });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE transaction ───────────────────────────────────────────────────────
router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const t = await db.get('SELECT * FROM cp_transactions WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!t) return res.status(404).json({ error: 'Transaction non trouvée' });
    if (t.absence_id) return res.status(400).json({ error: 'Impossible de supprimer une transaction liée à une absence' });
    await db.run('DELETE FROM cp_transactions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.getBalance = getBalance;
