const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

const ACTION_LABELS = {
  CREATE:    { label: 'Création',     color: 'emerald' },
  UPDATE:    { label: 'Modification', color: 'blue' },
  DELETE:    { label: 'Suppression',  color: 'red' },
  ARCHIVE:   { label: 'Archivage',    color: 'amber' },
  UNARCHIVE: { label: 'Désarchivage', color: 'blue' },
  LOGIN:     { label: 'Connexion',    color: 'slate' },
  SIGN:      { label: 'Signature',    color: 'violet' },
  SEND:      { label: 'Envoi',        color: 'blue' },
  EXPORT:    { label: 'Export',       color: 'slate' },
};

// GET /api/audit
router.get('/', async (req, res) => {
  try {
    const { entity_type, action, limit = 100, offset = 0 } = req.query;
    let q = 'SELECT * FROM audit_logs WHERE company_id = ?';
    const p = [req.user.companyId];
    if (entity_type) { q += ' AND entity_type = ?'; p.push(entity_type); }
    if (action)      { q += ' AND action = ?';      p.push(action); }
    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    p.push(parseInt(limit), parseInt(offset));
    const rows = await db.all(q, p);
    res.json(rows.map(r => ({
      ...r,
      action_label: ACTION_LABELS[r.action]?.label || r.action,
      action_color: ACTION_LABELS[r.action]?.color || 'slate',
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
