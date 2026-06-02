'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createBetterSqlite3Adapter, waitPromise } = require('./betterSqlite3Adapter');
const {
  seedAdmin,
  seedExchangeRates,
  seedAttendanceStatuses,
  seedServiceTypes,
  seedServiceQuoteSettings,
  seedRolePermissions,
} = require('./sqliteDriver');

let pool;
let adapterInstance;

function runPostgresSchema(database) {
  const schemaPath = path.join(__dirname, 'postgresSchema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    try {
      database.exec(`${statement};`);
    } catch (error) {
      if (error.code === '42P07') continue;
      throw error;
    }
  }
}

function ensurePostgresColumns(database) {
  const alters = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'",
    'ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS include_manual_payroll INTEGER NOT NULL DEFAULT 1',
  ];
  for (const sql of alters) {
    try {
      database.exec(sql);
    } catch (_) {
      /* re-run safe */
    }
  }
}


function shouldBootstrapSchema(database) {
  if (process.env.PG_SKIP_SCHEMA === 'true') {
    return false;
  }
  const row = database.prepare(
    `SELECT COUNT(*)::int AS table_count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  ).get();
  return Number(row.table_count) === 0;
}

function createPostgresDb(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL es requerida para PostgreSQL.');
  }
  if (!adapterInstance) {
    pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_MS || 10000),
    });
    waitPromise(pool.query('SELECT 1'));
    adapterInstance = createBetterSqlite3Adapter(pool);
    if (shouldBootstrapSchema(adapterInstance)) {
      runPostgresSchema(adapterInstance);
    }
    ensurePostgresColumns(adapterInstance);
    seedAdmin(adapterInstance);
    seedExchangeRates(adapterInstance);
    seedAttendanceStatuses(adapterInstance);
    seedServiceTypes(adapterInstance);
    seedServiceQuoteSettings(adapterInstance);
    seedRolePermissions(adapterInstance);
  }
  return adapterInstance;
}

module.exports = {
  createPostgresDb,
};
