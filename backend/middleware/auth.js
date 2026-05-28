const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function requireAuth(req, res, next) {
  // Supporte Bearer header ET ?token= query string (pour window.open PDF/images)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const rawToken = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : queryToken;

  if (!rawToken) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const token = rawToken;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// Middleware de vérification de rôle (à utiliser après requireAuth)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }
    next();
  };
}

// Raccourci : seuls admin et gestionnaire peuvent écrire
const requireWriter = requireRole('admin', 'gestionnaire');

module.exports = { requireAuth, requireRole, requireWriter };
