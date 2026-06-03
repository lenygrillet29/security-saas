const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('[DB] ⚠️  DATABASE_URL non définie.');
}

const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  pool,

  async all(sql, params = []) {
    const { rows } = await pool.query(toPositional(sql), params);
    return rows;
  },

  async get(sql, params = []) {
    const { rows } = await pool.query(toPositional(sql), params);
    return rows[0] || null;
  },

  async run(sql, params = []) {
    const result = await pool.query(toPositional(sql), params);
    return { changes: result.rowCount };
  },

  async insert(sql, params = []) {
    const sqlR = toPositional(sql) + ' RETURNING id';
    const { rows } = await pool.query(sqlR, params);
    return { lastInsertRowid: rows[0]?.id };
  },
};

async function init() {
  // Tables socle multi-tenant
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      siret TEXT,
      address TEXT,
      plan TEXT DEFAULT 'trial',
      plan_status TEXT DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      trial_ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'gestionnaire',
      active INTEGER DEFAULT 1,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      employee_number TEXT,
      contract_type TEXT DEFAULT 'CDI',
      hourly_rate REAL DEFAULT 0,
      color TEXT DEFAULT '#3B82F6',
      active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      siret TEXT,
      active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      hourly_rate_day REAL DEFAULT 0,
      hourly_rate_night REAL DEFAULT 0,
      hourly_rate_sunday REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      hours_day REAL DEFAULT 0,
      hours_night REAL DEFAULT 0,
      hours_sunday REAL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS absences (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'conge',
      status TEXT DEFAULT 'approved',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      quote_number TEXT,
      title TEXT NOT NULL,
      valid_until TEXT,
      hourly_rate_day REAL DEFAULT 0,
      hourly_rate_night REAL DEFAULT 0,
      hourly_rate_sunday REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      total_ht REAL DEFAULT 0,
      tva_rate REAL DEFAULT 20,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quote_lines (
      id SERIAL PRIMARY KEY,
      quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      hours_day REAL DEFAULT 0,
      hours_night REAL DEFAULT 0,
      hours_sunday REAL DEFAULT 0,
      rate_day REAL DEFAULT 0,
      rate_night REAL DEFAULT 0,
      rate_sunday REAL DEFAULT 0,
      total REAL DEFAULT 0
    );
  `);

  // Migration settings : recrée avec company_id si besoin
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'settings' AND column_name = 'company_id'
      ) THEN
        DROP TABLE IF EXISTS settings CASCADE;
        CREATE TABLE settings (
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          value TEXT,
          PRIMARY KEY (company_id, key)
        );
      END IF;
    END $$;
  `);

  // ALTER TABLE pour les colonnes manquantes sur DB existantes
  await pool.query(`
    ALTER TABLE agents   ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE clients  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE sites    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE shifts   ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE quotes   ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP;
  `);

  // ── Géolocalisation : coordonnées + consignes sur les sites ──────────────────
  await pool.query(`
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS latitude  REAL;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS longitude REAL;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS instructions TEXT;
  `);

  // ── Prise de service géolocalisée sur les shifts ──────────────────────────────
  await pool.query(`
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_at       TIMESTAMP;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkout_at      TIMESTAMP;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_lat      REAL;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_lng      REAL;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkout_lat     REAL;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkout_lng     REAL;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_distance INTEGER;
  `);

  // ── Facturation ───────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id             SERIAL PRIMARY KEY,
      company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      quote_id       INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
      invoice_number TEXT,
      title          TEXT NOT NULL,
      issue_date     TEXT NOT NULL,
      due_date       TEXT,
      status         TEXT DEFAULT 'draft',
      payment_date   TEXT,
      notes          TEXT,
      total_ht       REAL DEFAULT 0,
      tva_rate       REAL DEFAULT 20,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id          SERIAL PRIMARY KEY,
      invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity    REAL DEFAULT 1,
      unit_price  REAL DEFAULT 0,
      total       REAL DEFAULT 0
    );
  `);

  // ── Contrats de travail ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id                   SERIAL PRIMARY KEY,
      company_id           INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id             INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type                 TEXT NOT NULL DEFAULT 'CDI',
      title                TEXT NOT NULL,
      start_date           TEXT NOT NULL,
      end_date             TEXT,
      gross_salary         REAL DEFAULT 0,
      hours_per_week       REAL DEFAULT 35,
      position             TEXT,
      trial_period_months  INTEGER DEFAULT 0,
      notes                TEXT,
      status               TEXT DEFAULT 'draft',
      sign_token           TEXT UNIQUE,
      signed_at            TIMESTAMP,
      signed_ip            TEXT,
      created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[DB] PostgreSQL connecté — schéma multi-tenant initialisé');
}

module.exports = { db, init };
