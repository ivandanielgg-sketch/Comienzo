const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    seedAdmin(db);
  }

  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);

    CREATE TABLE IF NOT EXISTS exchange_rates (
      currency TEXT PRIMARY KEY,
      rate_to_mxn REAL NOT NULL CHECK (rate_to_mxn > 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      purchase_order_number TEXT,
      purchase_order_not_applicable INTEGER NOT NULL DEFAULT 0,
      seller TEXT NOT NULL,
      client_name TEXT NOT NULL,
      project_description TEXT NOT NULL DEFAULT '',
      expected_margin REAL NOT NULL DEFAULT 0,
      total_invoiced REAL NOT NULL DEFAULT 0,
      total_invoiced_currency TEXT NOT NULL DEFAULT 'MXN',
      progress_percent REAL NOT NULL DEFAULT 0,
      technician_name TEXT NOT NULL,
      promised_delivery_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pendiente', 'En Proceso', 'Terminado')),
      risk TEXT NOT NULL CHECK (risk IN ('Alto', 'Medio', 'Bajo')),
      observations TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'Compra',
          'Gasolina',
          'Casetas',
          'Viaticos',
          'Sueldo',
          'Materiales',
          'Hospedaje',
          'Otros'
        )
      ),
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      department TEXT,
      position TEXT,
      immediate_boss TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vacation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      requested_days INTEGER NOT NULL CHECK (requested_days > 0),
      vacation_exercise_year INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('programada', 'tomada', 'cancelada')),
      is_first_vacation_of_exercise INTEGER NOT NULL DEFAULT 0,
      include_vacation_bonus INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      authorized_by TEXT DEFAULT 'Ivan Garcia',
      hr_responsible TEXT DEFAULT 'Alejandra Gonzalez',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
  `);
  ensureColumn(database, 'projects', 'project_description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'projects', 'total_invoiced_currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'projects', 'closed_at', 'TEXT');
  ensureColumn(database, 'project_payments', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'project_costs', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'users', 'role', "TEXT NOT NULL DEFAULT 'user'");
  ensureColumn(database, 'vacation_requests', 'creates_negative_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'vacation_requests', 'negative_days_generated', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'vacation_requests', 'admin_override_reason', 'TEXT');
  ensureColumn(database, 'vacation_requests', 'balance_after_request', 'INTEGER');
  migrateCostCategories(database);
  seedExchangeRates(database);
}

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateCostCategories(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_costs'")
    .get();

  if (!table || table.sql.includes("'Gasolina'")) {
    return;
  }

  database.exec(`
    PRAGMA foreign_keys = OFF;

    ALTER TABLE project_costs RENAME TO project_costs_old;

    CREATE TABLE project_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'Compra',
          'Gasolina',
          'Casetas',
          'Viaticos',
          'Sueldo',
          'Materiales',
          'Hospedaje',
          'Otros'
        )
      ),
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    INSERT INTO project_costs (
      id,
      project_id,
      category,
      description,
      amount,
      currency,
      cost_date,
      created_at
    )
    SELECT
      id,
      project_id,
      CASE category
        WHEN 'Gasto' THEN 'Otros'
        WHEN 'Salario' THEN 'Sueldo'
        ELSE category
      END,
      description,
      amount,
      currency,
      cost_date,
      created_at
    FROM project_costs_old;

    DROP TABLE project_costs_old;

    PRAGMA foreign_keys = ON;
  `);
}

function seedExchangeRates(database) {
  const seedRate = database.prepare(
    `INSERT INTO exchange_rates (currency, rate_to_mxn)
     VALUES (?, ?)
     ON CONFLICT(currency) DO NOTHING`,
  );

  seedRate.run('MXN', 1);
  seedRate.run('USD', Number(process.env.USD_TO_MXN || 17));
  seedRate.run('EUR', Number(process.env.EUR_TO_MXN || 19));
}

function seedAdmin(database) {
  const adminUsername = process.env.ADMIN_USER || 'admin';
  const existingUser = database
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(adminUsername);

  if (existingUser) {
    if (existingUser.role !== 'admin') {
      database.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existingUser.id);
    }
    return;
  }

  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 12);
  database
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')")
    .run(adminUsername, passwordHash);
}

module.exports = {
  getDb,
};
