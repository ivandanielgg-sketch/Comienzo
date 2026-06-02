'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const deasync = require('deasync');
const dialect = require('./dialect');
const {
  seedAdmin,
  seedExchangeRates,
  seedAttendanceStatuses,
  seedServiceTypes,
  seedServiceQuoteSettings,
  seedRolePermissions,
} = require('./sqliteDriver');

let pool;

function waitPromise(promise) {
  let done = false;
  let result;
  let error;
  promise
    .then((value) => {
      result = value;
      done = true;
    })
    .catch((err) => {
      error = err;
      done = true;
    });
  deasync.loopWhile(() => !done);
  if (error) throw error;
  return result;
}

function queryExecutor(executor, text, params = []) {
  const sql = dialect.toPositionalParams(text);
  if (executor.query.length >= 2) {
    return waitPromise(executor.query(sql, params));
  }
  return waitPromise(executor.query(sql, params));
}

class PgStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  get(...params) {
    const res = queryExecutor(this.db._executor(), this.sql, params);
    return res.rows[0];
  }

  all(...params) {
    const res = queryExecutor(this.db._executor(), this.sql, params);
    return res.rows;
  }

  run(...params) {
    let sql = this.sql;
    if (dialect.isPostgres()) {
      sql = dialect.appendReturningId(sql);
    }
    const res = queryExecutor(this.db._executor(), sql, params);
    const row = res.rows && res.rows[0];
    return {
      changes: res.rowCount ?? 0,
      lastInsertRowid: row && row.id != null ? row.id : undefined,
    };
  }
}

class PostgresDb {
  constructor(pgPool) {
    this.pool = pgPool;
    this._txClient = null;
  }

  _executor() {
    return this._txClient || this.pool;
  }

  prepare(sql) {
    return new PgStatement(this, sql);
  }

  exec(sql) {
    const parts = sql.split(';').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      queryExecutor(this._executor(), part, []);
    }
  }

  pragma() {
    /* no-op en PostgreSQL */
  }

  transaction(fn) {
    const client = waitPromise(this.pool.connect());
    const prev = this._txClient;
    this._txClient = client;
    try {
      queryExecutor(client, 'BEGIN');
      fn();
      queryExecutor(client, 'COMMIT');
    } catch (error) {
      try {
        queryExecutor(client, 'ROLLBACK');
      } catch (_) {
        /* ignore rollback error */
      }
      throw error;
    } finally {
      this._txClient = prev;
      client.release();
    }
  }
}

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
      if (error.code === '42P07') continue; // already exists
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
      /* column may exist with different definition on re-run */
    }
  }
}

function createPostgresDb(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL es requerida para PostgreSQL.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    waitPromise(pool.query('SELECT 1'));
    const db = new PostgresDb(pool);
    runPostgresSchema(db);
    ensurePostgresColumns(db);
    seedAdmin(db);
    seedExchangeRates(db);
    seedAttendanceStatuses(db);
    seedServiceTypes(db);
    seedServiceQuoteSettings(db);
    seedRolePermissions(db);
    return db;
  }
  return new PostgresDb(pool);
}

module.exports = {
  createPostgresDb,
  PostgresDb,
};
