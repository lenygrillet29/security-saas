#!/usr/bin/env node
/**
 * create-lifetime-account.js
 * Crée un compte "lifetime" directement en base Railway.
 *
 * Usage :
 *   DATABASE_URL=postgresql://... node create-lifetime-account.js
 *
 * Le DATABASE_URL est dans Railway → Variables de ton service.
 */

const { Pool } = require('pg');
const bcrypt   = require('bcrypt');

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL manquant.');
  console.error('   Usage : DATABASE_URL=postgresql://... node create-lifetime-account.js');
  process.exit(1);
}

// ── Données du compte à créer ─────────────────────────────────────────────────
const ACCOUNT = {
  company_name: 'MG2D',
  email:        'dgrillet@mg2d.fr',
  password:     'Events2026!',
  first_name:   'Denis',
  last_name:    'Grillet',
  phone:        '',
};
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n🚀 Création du compte lifetime pour ${ACCOUNT.email}\n`);

    // Vérifier si l'email existe déjà
    const existing = await client.query('SELECT id, company_id FROM users WHERE email = $1', [ACCOUNT.email.toLowerCase()]);

    if (existing.rows.length > 0) {
      // Le compte existe → passer la company en lifetime
      const companyId = existing.rows[0].company_id;
      await client.query(
        `UPDATE companies SET plan = 'lifetime', plan_status = 'active', trial_ends_at = NULL WHERE id = $1`,
        [companyId]
      );
      // Mettre à jour le mot de passe
      const hash = await bcrypt.hash(ACCOUNT.password, 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, ACCOUNT.email.toLowerCase()]);
      console.log(`✅ Compte existant mis à jour en LIFETIME (company_id=${companyId})`);
      console.log(`   Email    : ${ACCOUNT.email}`);
      console.log(`   Password : ${ACCOUNT.password}`);
    } else {
      // Créer le compte
      await client.query('BEGIN');

      const companyRes = await client.query(
        `INSERT INTO companies (name, email, phone, plan, plan_status, trial_ends_at)
         VALUES ($1, $2, $3, 'lifetime', 'active', NULL) RETURNING id`,
        [ACCOUNT.company_name, ACCOUNT.email.toLowerCase(), ACCOUNT.phone || null]
      );
      const companyId = companyRes.rows[0].id;

      const hash = await bcrypt.hash(ACCOUNT.password, 10);
      await client.query(
        `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, 'admin')`,
        [companyId, ACCOUNT.email.toLowerCase(), hash, ACCOUNT.first_name, ACCOUNT.last_name]
      );

      const defaults = [
        ['company_name', ACCOUNT.company_name], ['company_email', ACCOUNT.email],
        ['company_phone', ACCOUNT.phone || ''], ['company_address', ''],
        ['smtp_host', ''], ['smtp_port', '587'], ['smtp_user', ''], ['smtp_pass', ''], ['smtp_from', ''],
        ['tva_rate', '20'], ['hourly_rate_day', '18'], ['hourly_rate_night', '22'], ['hourly_rate_sunday', '25'],
      ];
      for (const [key, value] of defaults) {
        await client.query(
          'INSERT INTO settings (company_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [companyId, key, value]
        );
      }

      await client.query('COMMIT');
      console.log(`✅ Nouveau compte LIFETIME créé (company_id=${companyId})`);
      console.log(`   Email    : ${ACCOUNT.email}`);
      console.log(`   Password : ${ACCOUNT.password}`);
      console.log(`   Société  : ${ACCOUNT.company_name}`);
    }

    console.log('\n✅ Terminé — il peut se connecter sur securoplan.vercel.app\n');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Erreur :', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
