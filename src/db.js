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

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      purchase_order_number TEXT,
      purchase_order_not_applicable INTEGER NOT NULL DEFAULT 0,
      seller TEXT NOT NULL,
      client_name TEXT NOT NULL,
      expected_margin REAL NOT NULL DEFAULT 0,
      total_invoiced REAL NOT NULL DEFAULT 0,
      progress_percent REAL NOT NULL DEFAULT 0,
      technician_name TEXT NOT NULL,
      promised_delivery_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pendiente', 'En Proceso', 'Terminado')),
      risk TEXT NOT NULL CHECK (risk IN ('Alto', 'Medio', 'Bajo')),
      observations TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Compra', 'Gasto', 'Salario')),
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedAdmin(database) {
  const existingUser = database
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(process.env.ADMIN_USER || 'admin');

  if (existingUser) {
    return;
  }

  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 12);
  database
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(process.env.ADMIN_USER || 'admin', passwordHash);
}

module.exports = {
  getDb,
};
