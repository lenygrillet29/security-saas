const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('[DB] ⚠️  DATABASE_URL non définie. Connectez une base PostgreSQL Railway.');
}

const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

// Convertit les ? en $1, $2, ... pour pg
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

  // INSERT avec RETURNING id pour récupérer lastInsertRowid
  async insert(sql, params = []) {
    const sqlR = toPositional(sql) + ' RETURNING id';
    const { rows } = await pool.query(sqlR, params);
    return { lastInsertRowid: rows[0]?.id };
  },
};

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const defaults = [
    ['company_name', 'Ma Société de Sécurité'],
    ['company_address', ''],
    ['company_email', ''],
    ['company_phone', ''],
    ['smtp_host', ''],
    ['smtp_port', '587'],
    ['smtp_user', ''],
    ['smtp_pass', ''],
    ['smtp_from', ''],
    ['tva_rate', '20'],
    ['hourly_rate_day', '18'],
    ['hourly_rate_night', '22'],
    ['hourly_rate_sunday', '25'],
  ];

  for (const [key, value] of defaults) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }

  console.log('[DB] PostgreSQL connecté et schéma initialisé');
}

module.exports = { db, init };
