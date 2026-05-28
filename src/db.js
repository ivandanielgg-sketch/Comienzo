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

    CREATE TABLE IF NOT EXISTS ecovis_purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_number TEXT NOT NULL,
      project_name TEXT,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      order_date TEXT NOT NULL,
      total_amount REAL NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagada', 'pagada', 'cancelada')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      updated_by TEXT,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecovis_payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      ecovis_purchase_order_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste')),
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
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (ecovis_purchase_order_id) REFERENCES ecovis_purchase_orders(id)
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

  // Audit columns for projects
  ensureColumn(database, 'projects', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'created_by_name', 'TEXT');
  ensureColumn(database, 'projects', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'updated_by_name', 'TEXT');
  ensureColumn(database, 'projects', 'deleted_at', 'TEXT');
  ensureColumn(database, 'projects', 'deleted_by_user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'deleted_by_name', 'TEXT');
  ensureColumn(database, 'projects', 'delete_reason', 'TEXT');

  // Audit columns for project_payments
  ensureColumn(database, 'project_payments', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_payments', 'created_by_name', 'TEXT');

  // Audit columns for project_costs
  ensureColumn(database, 'project_costs', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_costs', 'created_by_name', 'TEXT');

  // Audit columns for project_reports (created_by/updated_by already exist as TEXT username)
  ensureColumn(database, 'project_reports', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_reports', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_reports', 'deleted_by_user_id', 'INTEGER');

  // Audit columns for employees
  ensureColumn(database, 'employees', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'employees', 'created_by_name', 'TEXT');
  ensureColumn(database, 'employees', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'employees', 'updated_by_name', 'TEXT');

  // Audit columns for vacation_requests (created_by already exists as TEXT username)
  ensureColumn(database, 'vacation_requests', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'vacation_requests', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'vacation_requests', 'updated_by_name', 'TEXT');

  // Audit columns for ecovis_projects (created_by/updated_by already exist)
  ensureColumn(database, 'ecovis_projects', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_projects', 'updated_by_user_id', 'INTEGER');

  // Audit columns for ecovis_payments (created_by/updated_by already exist)
  ensureColumn(database, 'ecovis_payments', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_payments', 'updated_by_user_id', 'INTEGER');

  // Audit columns for ecovis_payment_allocations (created_by already exists)
  ensureColumn(database, 'ecovis_payment_allocations', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_payment_allocations', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_payment_allocations', 'updated_by', 'TEXT');
  ensureColumn(database, 'ecovis_payment_allocations', 'ecovis_purchase_order_id', 'INTEGER');

  // Link ecovis_projects to purchase orders
  ensureColumn(database, 'ecovis_projects', 'ecovis_purchase_order_id', 'INTEGER');

  // ECOVIS currency snapshot columns
  ensureColumn(database, 'ecovis_projects', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_projects', 'amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_projects', 'paid_amount_mxn', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'ecovis_projects', 'pending_amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_projects', 'fully_paid_at', 'TEXT');

  ensureColumn(database, 'ecovis_payments', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_payments', 'amount_mxn', 'REAL');

  ensureColumn(database, 'ecovis_payment_allocations', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'ecovis_payment_allocations', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_payment_allocations', 'amount_mxn', 'REAL');

  ensureColumn(database, 'ecovis_purchase_orders', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_purchase_orders', 'amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_purchase_orders', 'paid_amount_mxn', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'ecovis_purchase_orders', 'pending_amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_purchase_orders', 'fully_paid_at', 'TEXT');

  ensureColumn(database, 'ecovis_movements', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_movements', 'amount_mxn', 'REAL');

  // Audit columns for ecovis_movements (created_by/updated_by already exist)
  ensureColumn(database, 'ecovis_movements', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_movements', 'updated_by_user_id', 'INTEGER');

  // Audit columns for users
  ensureColumn(database, 'users', 'updated_at', 'TEXT');
  ensureColumn(database, 'users', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'users', 'created_by_name', 'TEXT');
  ensureColumn(database, 'users', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'users', 'updated_by_name', 'TEXT');

  // Security columns for users
  ensureColumn(database, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(database, 'users', 'locked_until', 'TEXT');
  ensureColumn(database, 'users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'users', 'last_failed_login_at', 'TEXT');
  ensureColumn(database, 'users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'users', 'mfa_secret', 'TEXT');
  ensureColumn(database, 'users', 'mfa_verified_at', 'TEXT');

  // Project credit/invoice fields for accounts receivable
  ensureColumn(database, 'projects', 'credit_days', 'INTEGER');
  ensureColumn(database, 'projects', 'credit_days_na', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'invoice_date', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_date_na', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'due_date', 'TEXT');

  // Create audit_logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      entity_label TEXT,
      timestamp_utc TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp_utc);

    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at TEXT NOT NULL,
      imported_by TEXT NOT NULL,
      schema_version TEXT,
      backup_exported_at TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      summary_json TEXT,
      conflicts_json TEXT,
      errors_json TEXT,
      validation_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_identifier TEXT NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      attempted_at TEXT NOT NULL,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts (user_identifier);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts (attempted_at);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS attendance_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      counts_as_absence INTEGER NOT NULL DEFAULT 0,
      requires_project_location INTEGER NOT NULL DEFAULT 0,
      requires_extra_payment INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payroll_attendance_weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      week_start_date TEXT NOT NULL,
      week_end_date TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrada', 'cancelada')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_week_unique
      ON payroll_attendance_weeks (year, week_number)
      WHERE deleted_at IS NULL AND status != 'cancelada';

    CREATE TABLE IF NOT EXISTS payroll_attendance_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_attendance_week_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_number_snapshot TEXT NOT NULL,
      full_name_snapshot TEXT NOT NULL,
      position_snapshot TEXT,
      department_snapshot TEXT,
      monday_status TEXT NOT NULL DEFAULT 'A',
      tuesday_status TEXT NOT NULL DEFAULT 'A',
      wednesday_status TEXT NOT NULL DEFAULT 'A',
      thursday_status TEXT NOT NULL DEFAULT 'A',
      friday_status TEXT NOT NULL DEFAULT 'A',
      saturday_status TEXT NOT NULL DEFAULT 'D',
      sunday_status TEXT NOT NULL DEFAULT 'D',
      project_location_text TEXT,
      extra_payment_amount REAL,
      extra_payment_currency TEXT DEFAULT 'MXN',
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_attendance_week_id) REFERENCES payroll_attendance_weeks(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE INDEX IF NOT EXISTS idx_payroll_emp_week ON payroll_attendance_employees (payroll_attendance_week_id);
  `);

  seedAttendanceStatuses(database);
  migrateCostCategories(database);
  migrateAllocationTypes(database);
  seedExchangeRates(database);

  // Service Quoter module tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS service_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      margin REAL NOT NULL CHECK (margin >= 0 AND margin < 1),
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_quote_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Financial Statements module tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS financial_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      estimated_isr_rate REAL NOT NULL DEFAULT 0.10,
      ivan_commission_rate REAL NOT NULL DEFAULT 0.10,
      project_income_recognition TEXT NOT NULL DEFAULT 'project_created_date',
      accounts_payable_recognition TEXT NOT NULL DEFAULT 'invoice_date',
      base_currency TEXT NOT NULL DEFAULT 'MXN',
      include_vat_in_sales INTEGER NOT NULL DEFAULT 0,
      include_pending_accounts_payable INTEGER NOT NULL DEFAULT 1,
      include_classified_bank_movements INTEGER NOT NULL DEFAULT 1,
      include_manual_payroll INTEGER NOT NULL DEFAULT 1,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO financial_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS financial_statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrado', 'cancelado')),
      revenue_net_mxn REAL NOT NULL DEFAULT 0,
      cost_of_sales_mxn REAL NOT NULL DEFAULT 0,
      gross_profit_mxn REAL NOT NULL DEFAULT 0,
      operating_expenses_mxn REAL NOT NULL DEFAULT 0,
      net_administrative_profit_mxn REAL NOT NULL DEFAULT 0,
      estimated_isr_mxn REAL NOT NULL DEFAULT 0,
      profit_after_isr_mxn REAL NOT NULL DEFAULT 0,
      ivan_commission_mxn REAL NOT NULL DEFAULT 0,
      real_administrative_profit_mxn REAL NOT NULL DEFAULT 0,
      accounts_receivable_mxn REAL NOT NULL DEFAULT 0,
      accounts_payable_mxn REAL NOT NULL DEFAULT 0,
      bank_initial_balance_mxn REAL NOT NULL DEFAULT 0,
      bank_deposits_mxn REAL NOT NULL DEFAULT 0,
      bank_withdrawals_mxn REAL NOT NULL DEFAULT 0,
      bank_final_balance_mxn REAL NOT NULL DEFAULT 0,
      unclassified_movements_count INTEGER NOT NULL DEFAULT 0,
      configuration_snapshot_json TEXT,
      data_snapshot_json TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_statements_unique
      ON financial_statements (year, month)
      WHERE status != 'cancelado' AND deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS accounts_payable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Otros',
      related_project_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagada', 'cancelada')),
      paid_at TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS bank_statement_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_name TEXT NOT NULL,
      account_number_masked TEXT,
      currency TEXT NOT NULL DEFAULT 'MXN',
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      initial_balance_original REAL NOT NULL DEFAULT 0,
      deposits_original REAL NOT NULL DEFAULT 0,
      withdrawals_original REAL NOT NULL DEFAULT 0,
      commissions_original REAL NOT NULL DEFAULT 0,
      commissions_vat_original REAL NOT NULL DEFAULT 0,
      final_balance_original REAL NOT NULL DEFAULT 0,
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      initial_balance_mxn REAL NOT NULL DEFAULT 0,
      deposits_mxn REAL NOT NULL DEFAULT 0,
      withdrawals_mxn REAL NOT NULL DEFAULT 0,
      commissions_mxn REAL NOT NULL DEFAULT 0,
      commissions_vat_mxn REAL NOT NULL DEFAULT 0,
      final_balance_mxn REAL NOT NULL DEFAULT 0,
      source_file_name TEXT,
      source_file_type TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_statement_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_statement_summary_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT,
      reference TEXT,
      deposit_original REAL NOT NULL DEFAULT 0,
      withdrawal_original REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      deposit_mxn REAL NOT NULL DEFAULT 0,
      withdrawal_mxn REAL NOT NULL DEFAULT 0,
      balance_original REAL,
      balance_mxn REAL,
      classification_status TEXT NOT NULL DEFAULT 'sin_clasificar' CHECK (classification_status IN ('sin_clasificar', 'clasificado', 'ignorado')),
      classification_type TEXT,
      related_project_id INTEGER,
      related_account_payable_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bank_statement_summary_id) REFERENCES bank_statement_summaries(id)
    );

    CREATE TABLE IF NOT EXISTS manual_payroll_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      concept TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ingreso', 'costo_de_venta', 'gasto_operativo', 'impuesto', 'comision_ivan', 'banco', 'otro')),
      concept TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cancelado')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts_payable_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accounts_payable_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      payment_method TEXT,
      bank_movement_id INTEGER,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id),
      FOREIGN KEY (bank_movement_id) REFERENCES bank_statement_movements(id)
    );

    CREATE TABLE IF NOT EXISTS financial_project_omissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      project_id INTEGER NOT NULL,
      omit INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_project_omission_unique
      ON financial_project_omissions (year, month, project_id);
  `);

  seedServiceTypes(database);
  seedServiceQuoteSettings(database);

  // Bank movement week of month (after financial tables created)
  ensureColumn(database, 'bank_statement_movements', 'financial_week_of_month', 'INTEGER');

  migrateEcovisCurrencyFields(database);
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

function migrateAllocationTypes(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ecovis_payment_allocations'")
    .get();

  if (!table || table.sql.includes("'orden_compra'")) {
    return;
  }

  database.exec(`
    PRAGMA foreign_keys = OFF;

    ALTER TABLE ecovis_payment_allocations RENAME TO ecovis_payment_allocations_old;

    CREATE TABLE ecovis_payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      ecovis_purchase_order_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste')),
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
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (ecovis_purchase_order_id) REFERENCES ecovis_purchase_orders(id)
    );

    INSERT INTO ecovis_payment_allocations (
      id, payment_id, ecovis_project_id, allocation_type, amount, notes,
      is_cancelled, cancelled_at, cancelled_by, cancellation_reason,
      created_by, created_at, updated_at
    )
    SELECT
      id, payment_id, ecovis_project_id, allocation_type, amount, notes,
      is_cancelled, cancelled_at, cancelled_by, cancellation_reason,
      created_by, created_at, updated_at
    FROM ecovis_payment_allocations_old;

    DROP TABLE ecovis_payment_allocations_old;

    PRAGMA foreign_keys = ON;
  `);
}

function seedAttendanceStatuses(database) {
  const { ATTENDANCE_STATUSES } = require('./attendance');
  const stmt = database.prepare(
    `INSERT INTO attendance_statuses (code, label, color, counts_as_absence, requires_project_location, requires_extra_payment)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO NOTHING`,
  );
  for (const s of ATTENDANCE_STATUSES) {
    stmt.run(s.code, s.label, s.color, s.counts_as_absence, s.requires_project_location, s.requires_extra_payment);
  }
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

function seedServiceTypes(database) {
  const defaults = [
    { name: 'Emergencia', margin: 0.60, sort_order: 1 },
    { name: 'Automatización', margin: 0.60, sort_order: 2 },
    { name: 'Instalaciones', margin: 0.45, sort_order: 3 },
    { name: 'Mantenimiento Mayor', margin: 0.35, sort_order: 4 },
    { name: 'Mantenimiento Preventivo', margin: 0.30, sort_order: 5 },
    { name: 'Calentadores', margin: 0.30, sort_order: 6 },
  ];

  const stmt = database.prepare(
    `INSERT INTO service_types (name, margin, sort_order, created_by_name, created_at)
     VALUES (?, ?, ?, 'system', CURRENT_TIMESTAMP)
     ON CONFLICT(name) DO NOTHING`,
  );
  for (const st of defaults) {
    stmt.run(st.name, st.margin, st.sort_order);
  }
}

function seedServiceQuoteSettings(database) {
  const defaults = [
    { key: 'tarifa_programador_hora', value: '300', label: 'Tarifa programador ($/h)', category: 'mano_de_obra' },
    { key: 'tarifa_tecnico_hora', value: '250', label: 'Tarifa técnico ($/h)', category: 'mano_de_obra' },
    { key: 'tarifa_ayudante_hora', value: '175', label: 'Tarifa ayudante ($/h)', category: 'mano_de_obra' },
    { key: 'horas_por_dia_servicio', value: '9', label: 'Horas por día de servicio', category: 'mano_de_obra' },
    { key: 'costo_por_kilometro', value: '7.50', label: 'Costo por kilómetro ($)', category: 'transporte' },
    { key: 'hotel_default', value: '2500', label: 'Hotel por noche default ($)', category: 'viaticos' },
    { key: 'hotel_opcion_baja', value: '2000', label: 'Hotel opción baja ($)', category: 'viaticos' },
    { key: 'costo_por_comida', value: '150', label: 'Costo por comida ($)', category: 'viaticos' },
    { key: 'comidas_por_dia', value: '3', label: 'Comidas por día', category: 'viaticos' },
    { key: 'iva_final', value: '16', label: 'IVA final (%)', category: 'cotizacion' },
  ];

  const stmt = database.prepare(
    `INSERT INTO service_quote_settings (key, value, label, category, updated_by_name, updated_at)
     VALUES (?, ?, ?, ?, 'system', CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO NOTHING`,
  );
  for (const s of defaults) {
    stmt.run(s.key, s.value, s.label, s.category);
  }
}

function migrateEcovisCurrencyFields(database) {
  const rates = {};
  const rateRows = database.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all();
  for (const r of rateRows) {
    rates[r.currency] = r.rate_to_mxn;
  }
  rates.MXN = 1;

  const needsMigration = database.prepare(
    'SELECT COUNT(*) as cnt FROM ecovis_projects WHERE amount_mxn IS NULL',
  ).get().cnt;
  if (needsMigration === 0) return;

  const migrateAll = database.transaction(() => {
    const projects = database.prepare('SELECT id, total_amount, currency, exchange_rate_to_mxn FROM ecovis_projects WHERE amount_mxn IS NULL').all();
    for (const p of projects) {
      const cur = p.currency || 'MXN';
      const rate = p.exchange_rate_to_mxn && p.exchange_rate_to_mxn !== 1 ? p.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(p.total_amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_projects SET exchange_rate_to_mxn = ?, amount_mxn = ?, pending_amount_mxn = amount_mxn - paid_amount_mxn WHERE id = ?').run(rate, amountMxn, p.id);
    }

    const payments = database.prepare('SELECT id, amount, currency, exchange_rate_to_mxn FROM ecovis_payments WHERE amount_mxn IS NULL').all();
    for (const p of payments) {
      const cur = p.currency || 'MXN';
      const rate = p.exchange_rate_to_mxn && p.exchange_rate_to_mxn !== 1 ? p.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(p.amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_payments SET exchange_rate_to_mxn = ?, amount_mxn = ? WHERE id = ?').run(rate, amountMxn, p.id);
    }

    const allocations = database.prepare('SELECT a.id, a.amount, a.exchange_rate_to_mxn, p.currency FROM ecovis_payment_allocations a JOIN ecovis_payments p ON p.id = a.payment_id WHERE a.amount_mxn IS NULL').all();
    for (const a of allocations) {
      const cur = a.currency || 'MXN';
      const rate = a.exchange_rate_to_mxn && a.exchange_rate_to_mxn !== 1 ? a.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(a.amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_payment_allocations SET currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ? WHERE id = ?').run(cur, rate, amountMxn, a.id);
    }

    const pos = database.prepare('SELECT id, total_amount, currency, exchange_rate_to_mxn FROM ecovis_purchase_orders WHERE amount_mxn IS NULL').all();
    for (const po of pos) {
      const cur = po.currency || 'MXN';
      const rate = po.exchange_rate_to_mxn && po.exchange_rate_to_mxn !== 1 ? po.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(po.total_amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_purchase_orders SET exchange_rate_to_mxn = ?, amount_mxn = ?, pending_amount_mxn = amount_mxn - paid_amount_mxn WHERE id = ?').run(rate, amountMxn, po.id);
    }

    const movements = database.prepare('SELECT id, amount, currency, exchange_rate_to_mxn FROM ecovis_movements WHERE amount_mxn IS NULL').all();
    for (const m of movements) {
      const cur = m.currency || 'MXN';
      const rate = m.exchange_rate_to_mxn && m.exchange_rate_to_mxn !== 1 ? m.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(m.amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_movements SET exchange_rate_to_mxn = ?, amount_mxn = ? WHERE id = ?').run(rate, amountMxn, m.id);
    }

    // Recalculate paid/pending amounts for projects using MXN values
    const allProjects = database.prepare('SELECT id, amount_mxn FROM ecovis_projects WHERE is_cancelled = 0').all();
    for (const p of allProjects) {
      const paidMxn = database.prepare(
        'SELECT COALESCE(SUM(amount_mxn), 0) as total FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = \'proyecto\' AND is_cancelled = 0',
      ).get(p.id).total;
      const pendingMxn = Math.round(((p.amount_mxn || 0) - paidMxn + Number.EPSILON) * 100) / 100;
      const fullyPaid = pendingMxn <= 0.01 && paidMxn > 0 ? database.prepare(
        'SELECT MAX(created_at) as last_alloc FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = \'proyecto\' AND is_cancelled = 0',
      ).get(p.id).last_alloc : null;
      database.prepare('UPDATE ecovis_projects SET paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ? WHERE id = ?').run(
        Math.round((paidMxn + Number.EPSILON) * 100) / 100, Math.max(0, pendingMxn), fullyPaid, p.id,
      );
    }

    // Recalculate paid/pending amounts for purchase orders
    const allPOs = database.prepare('SELECT id, amount_mxn FROM ecovis_purchase_orders WHERE is_cancelled = 0').all();
    for (const po of allPOs) {
      const paidMxn = database.prepare(
        'SELECT COALESCE(SUM(amount_mxn), 0) as total FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = \'orden_compra\' AND is_cancelled = 0',
      ).get(po.id).total;
      const pendingMxn = Math.round(((po.amount_mxn || 0) - paidMxn + Number.EPSILON) * 100) / 100;
      const fullyPaid = pendingMxn <= 0.01 && paidMxn > 0 ? database.prepare(
        'SELECT MAX(created_at) as last_alloc FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = \'orden_compra\' AND is_cancelled = 0',
      ).get(po.id).last_alloc : null;
      database.prepare('UPDATE ecovis_purchase_orders SET paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ? WHERE id = ?').run(
        Math.round((paidMxn + Number.EPSILON) * 100) / 100, Math.max(0, pendingMxn), fullyPaid, po.id,
      );
    }
  });

  migrateAll();
}

module.exports = {
  getDb,
};
