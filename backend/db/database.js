const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'security.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    hourly_rate_day REAL DEFAULT 0,
    hourly_rate_night REAL DEFAULT 0,
    hourly_rate_sunday REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    site_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    hours_day REAL DEFAULT 0,
    hours_night REAL DEFAULT 0,
    hours_sunday REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'conge',
    status TEXT DEFAULT 'approved',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    site_id INTEGER,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS quote_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    hours_day REAL DEFAULT 0,
    hours_night REAL DEFAULT 0,
    hours_sunday REAL DEFAULT 0,
    rate_day REAL DEFAULT 0,
    rate_night REAL DEFAULT 0,
    rate_sunday REAL DEFAULT 0,
    total REAL DEFAULT 0,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Default settings
const defaultSettings = [
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

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

// Wrap node:sqlite to match better-sqlite3 API shape used in routes
// node:sqlite returns lastInsertRowid as BigInt — normalize to Number
const originalPrepare = db.prepare.bind(db);
db.prepare = (sql) => {
  const stmt = originalPrepare(sql);
  const originalRun = stmt.run.bind(stmt);
  stmt.run = (...args) => {
    const result = originalRun(...args);
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  };
  return stmt;
};

module.exports = db;
