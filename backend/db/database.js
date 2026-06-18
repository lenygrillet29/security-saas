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

  // ── Heures fériées + ventilation complète 8 catégories ───────────────────────
  await pool.query(`
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours_holiday              REAL DEFAULT 0;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours_sunday_night         REAL DEFAULT 0;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours_holiday_night        REAL DEFAULT 0;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours_holiday_sunday_day   REAL DEFAULT 0;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours_holiday_sunday_night REAL DEFAULT 0;
  `);

  // ── Taux horaires sites : 8 catégories ────────────────────────────────────────
  await pool.query(`
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS hourly_rate_sunday_night         REAL DEFAULT 0;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS hourly_rate_holiday_day          REAL DEFAULT 0;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS hourly_rate_holiday_night        REAL DEFAULT 0;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS hourly_rate_holiday_sunday_day   REAL DEFAULT 0;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS hourly_rate_holiday_sunday_night REAL DEFAULT 0;
  `);

  // ── Journal d'audit ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      user_id     INTEGER,
      user_name   TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      entity_name TEXT,
      details     TEXT,
      ip          TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
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

  // ── Add-ons payants ──────────────────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS addons TEXT DEFAULT '[]';
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS addon_chiffrage_subscription_id TEXT;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS pack_agents TEXT DEFAULT NULL;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS pack_collab TEXT DEFAULT NULL;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS pack_agents_sub_id TEXT DEFAULT NULL;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS pack_collab_sub_id TEXT DEFAULT NULL;
  `);

  // ── Portail client (lien public par token) ───────────────────────────────────
  await pool.query(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;
  `);

  // ── Portail agent mobile (lien unique envoyé par email à la création) ─────────
  await pool.query(`
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_token TEXT UNIQUE;
  `);

  // ── Données RH complémentaires agents ────────────────────────────────────────
  await pool.query(`
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS address       TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS birth_date    TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS birth_place   TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS nationality   TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS carte_vitale  TEXT;
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS recurrence_id TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS carte_pro        TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS carte_pro_expiry TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS entry_date    TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS exit_date     TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS photo         TEXT;
  `);

  // ── Contrats de prestation clients ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_contracts (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      title        TEXT NOT NULL,
      description  TEXT,
      start_date   TEXT NOT NULL,
      end_date     TEXT,
      amount       REAL DEFAULT 0,
      billing_type TEXT DEFAULT 'monthly',
      status       TEXT DEFAULT 'draft',
      sign_token   TEXT UNIQUE,
      signed_at    TIMESTAMP,
      signed_ip    TEXT,
      notes        TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Abonnements notifications push agents ────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_push_subscriptions (
      id         SERIAL PRIMARY KEY,
      agent_id   INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agent_id, endpoint)
    );
  `);

  // ── Réinitialisation mot de passe ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used       INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Congés payés — transactions par agent ────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cp_transactions (
      id          SERIAL PRIMARY KEY,
      company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id    INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      absence_id  INTEGER REFERENCES absences(id) ON DELETE SET NULL,
      date        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'acquisition',
      days        REAL NOT NULL,
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Notes de frais agents ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_reports (
      id          SERIAL PRIMARY KEY,
      company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id    INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      shift_id    INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
      date        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'autre',
      description TEXT,
      amount      REAL NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'pending',
      reject_reason TEXT,
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Offres de vacation (demandes envoyées aux agents) ────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_offers (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      shift_id     INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      agent_id     INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      token        TEXT NOT NULL UNIQUE,
      status       TEXT NOT NULL DEFAULT 'pending',
      sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      responded_at TIMESTAMP,
      UNIQUE(shift_id, agent_id)
    );
  `);

  // ── Tâches / To-do ────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              SERIAL PRIMARY KEY,
      company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_user_id  INTEGER REFERENCES users(id)  ON DELETE SET NULL,
      assigned_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      priority        TEXT NOT NULL DEFAULT 'normale',
      due_date        TEXT,
      status          TEXT NOT NULL DEFAULT 'a_faire',
      done_at         TIMESTAMP,
      done_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Groupes de messagerie ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_groups (
      id          SERIAL PRIMARY KEY,
      company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      agents_can_reply BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS message_group_members (
      id       SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
      user_id  INTEGER REFERENCES users(id)  ON DELETE CASCADE,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE
    );
  `);
  await pool.query(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES message_groups(id) ON DELETE CASCADE;
  `);
  await pool.query(`
    ALTER TABLE message_groups ADD COLUMN IF NOT EXISTS agents_can_reply BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  // ── Messagerie interne ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      thread_key   TEXT NOT NULL,
      thread_type  TEXT NOT NULL DEFAULT 'agent',
      sender_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sender_type  TEXT NOT NULL DEFAULT 'user',
      recipient_agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      recipient_user_id  INTEGER REFERENCES users(id)  ON DELETE CASCADE,
      body         TEXT NOT NULL,
      read_at      TIMESTAMP,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(company_id, thread_key);
  `);
  await pool.query(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_type TEXT NOT NULL DEFAULT 'agent';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  `);

  // ── Documents agents ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_documents (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id     INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type         TEXT NOT NULL DEFAULT 'autre',
      label        TEXT NOT NULL,
      reference    TEXT,
      issued_date  TEXT,
      expiry_date  TEXT,
      issuer       TEXT,
      file_url     TEXT,
      notes        TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Incidents sur sites ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      site_id      INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      agent_id     INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      shift_id     INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
      date         TEXT NOT NULL,
      time         TEXT,
      type         TEXT NOT NULL DEFAULT 'autre',
      severity     TEXT NOT NULL DEFAULT 'mineur',
      title        TEXT NOT NULL,
      description  TEXT,
      actions_taken TEXT,
      status       TEXT NOT NULL DEFAULT 'ouvert',
      closed_at    TIMESTAMP,
      closed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes        TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Formations et habilitations agents ────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_trainings (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id     INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'formation',
      obtained_date TEXT,
      expiry_date  TEXT,
      issuer       TEXT,
      reference    TEXT,
      notes        TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Modèles de contrats ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contract_templates (
      id         SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'client',
      body       TEXT NOT NULL DEFAULT '',
      notes      TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Equipements / dotations agents ────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipments (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id     INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      category     TEXT NOT NULL DEFAULT 'tenue',
      label        TEXT NOT NULL,
      size         TEXT,
      quantity     INTEGER NOT NULL DEFAULT 1,
      condition    TEXT NOT NULL DEFAULT 'neuf',
      issued_date  TEXT NOT NULL,
      return_date  TEXT,
      returned_at  TEXT,
      serial_number TEXT,
      notes        TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Demandes d'absence depuis le portail agent ───────────────────────────────
  await pool.query(`
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS requested_by_agent INTEGER DEFAULT 0;
  `);

  // ── Rapports de vacation ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vacation_reports (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      shift_id     INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
      agent_id     INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      site_id      INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      report_date  TEXT NOT NULL,
      start_time   TEXT,
      end_time     TEXT,
      status       TEXT NOT NULL DEFAULT 'brouillon',
      nothing_to_report BOOLEAN NOT NULL DEFAULT FALSE,
      observations TEXT,
      incidents    TEXT,
      visitors     TEXT,
      equipment_check BOOLEAN DEFAULT TRUE,
      equipment_notes TEXT,
      signature    TEXT,
      signed_at    TIMESTAMP,
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS vacation_report_events (
      id         SERIAL PRIMARY KEY,
      report_id  INTEGER NOT NULL REFERENCES vacation_reports(id) ON DELETE CASCADE,
      time       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'observation',
      description TEXT NOT NULL
    );
  `);

  console.log('[DB] PostgreSQL connecté — schéma multi-tenant initialisé');
}

module.exports = { db, init };
