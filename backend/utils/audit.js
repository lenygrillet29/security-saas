const { db } = require('../db/database');

/**
 * Enregistre une action dans le journal d'audit.
 * Ne plante jamais l'app en cas d'erreur.
 */
async function logAudit(req, { action, entityType, entityId, entityName, details }) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    const userName = req.user ? `${req.user.email}` : 'system';
    await db.run(
      `INSERT INTO audit_logs (company_id, user_id, user_name, action, entity_type, entity_id, entity_name, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user?.companyId || null, req.user?.userId || null, userName,
       action, entityType || null, entityId || null, entityName || null,
       details ? JSON.stringify(details) : null, ip]
    );
  } catch (e) {
    console.warn('[Audit] Erreur log:', e.message);
  }
}

module.exports = { logAudit };
