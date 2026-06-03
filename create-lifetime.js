/**
 * Crée le compte lifetime pour ton père.
 * Usage : node create-lifetime.js
 */

const https = require('https');

const RAILWAY_URL = 'https://security-saas-production.up.railway.app';
const MASTER_KEY  = 'SecuroPlan-Admin-2026!'; // doit correspondre à ADMIN_MASTER_KEY sur Railway

const data = JSON.stringify({
  company_name: 'MG2D Sécurité',
  email:        'dgrillet@mg2d.fr',
  password:     'Events2026!',   // ← change ce mot de passe si tu veux
  first_name:   'Denis',
  last_name:    'Grillet',
  phone:        '',
});

const url = new URL('/api/admin/lifetime', RAILWAY_URL);

const options = {
  hostname: url.hostname,
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':  'application/json',
    'x-master-key':  MASTER_KEY,
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const result = JSON.parse(body);
    if (res.statusCode === 201) {
      console.log('✅ Compte lifetime créé avec succès !');
      console.log('   Email    :', data && JSON.parse(data).email);
      console.log('   Password :', JSON.parse(data).password);
      console.log('   Plan     : lifetime (accès illimité, aucun paiement)');
      console.log('   Rôle     : admin');
    } else {
      console.error('❌ Erreur :', result.error || body);
    }
  });
});

req.on('error', (e) => console.error('❌ Connexion échouée :', e.message));
req.write(data);
req.end();
