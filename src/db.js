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

    CREATE TABLE IF NOT EXISTS project_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      report_folio TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_address TEXT,
      service_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      assigned_technicians TEXT,
      burner_model TEXT,
      equipment_model_serial TEXT,
      pumps_motors_model TEXT,
      fuel TEXT,
      voltage TEXT,
      gas_pressure_inh2o TEXT,
      liquid_fuel_pressure_psi TEXT,
      working_pressure TEXT,
      pump_amperage TEXT,
      fan_amperage TEXT,
      condensate_tank_temp_c TEXT,
      operating_output_temp_c TEXT,
      flue_gas_temp_c TEXT,
      safety_tests TEXT,
      comments TEXT,
      emissions_low_fire TEXT,
      emissions_high_fire TEXT,
      technician_name TEXT,
      plant_manager_name TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS ecovis_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      quote_number TEXT,
      purchase_order_number TEXT,
      invoice_number TEXT,
      project_date TEXT NOT NULL,
      description TEXT,
      total_amount REAL NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagado', 'pagado', 'cancelado')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecovis_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_method TEXT,
      bank_reference TEXT,
      source_description TEXT,
      notes TEXT,
      unallocated_amount REAL NOT NULL DEFAULT 0,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecovis_payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'saldo_a_favor', 'prestamo', 'ajuste')),
      amount REAL NOT NULL CHECK (amount > 0),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES ecovis_payments(id),
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id)
    );

    CREATE TABLE IF NOT EXISTS ecovis_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_date TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('proyecto', 'pago_recibido', 'prestamo_ecovis_a_revram', 'aplicacion_a_proyecto', 'saldo_a_favor', 'devolucion', 'ajuste', 'cancelacion')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MXN',
      direction TEXT NOT NULL CHECK (direction IN ('ecovis_debe_a_revram', 'revram_debe_a_ecovis', 'neutral')),
      reference TEXT,
      related_project_id INTEGER,
      related_payment_id INTEGER,
      payment_method TEXT,
      bank_reference TEXT,
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (related_payment_id) REFERENCES ecovis_payments(id)
    );
  `);
  ensureColumn(database, 'projects', 'project_description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'projects', 'total_invoiced_currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'projects', 'closed_at', 'TEXT');
  ensureColumn(database, 'project_payments', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'project_costs', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'users', 'role', "TEXT NOT NULL DEFAULT 'user'");
  ensureColumn(database, 'employees', 'termination_date', 'TEXT');
  ensureColumn(database, 'employees', 'inactive_reason', 'TEXT');
  ensureColumn(database, 'vacation_requests', 'creates_negative_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'vacation_requests', 'negative_days_generated', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'vacation_requests', 'admin_override_reason', 'TEXT');
  ensureColumn(database, 'vacation_requests', 'balance_after_request', 'INTEGER');
  ensureColumn(database, 'project_reports', 'report_type', "TEXT NOT NULL DEFAULT 'boiler_startup'");
  ensureColumn(database, 'project_reports', 'report_data', 'TEXT');
  ensureColumn(database, 'project_reports', 'deleted_at', 'TEXT');
  ensureColumn(database, 'project_reports', 'deleted_by', 'TEXT');
  ensureColumn(database, 'project_reports', 'delete_reason', 'TEXT');
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
