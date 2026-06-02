'use strict';

const deasync = require('deasync');
const { toPositionalParams, appendReturningId } = require('./dialect');

/**
 * Adaptador que imita la API publica de better-sqlite3 (prepare/get/all/run,
 * exec, pragma, transaction) sobre un ejecutor PostgreSQL (pg Pool/Client).
 *
 * Objetivo: el resto de la app (server.js, modulos) no cambia de forma.
 */

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

function querySync(executor, text, params = []) {
  const sql = toPositionalParams(text);
  return waitPromise(executor.query(sql, params));
}

/**
 * Convierte argumentos estilo better-sqlite3:
 * - run(a, b, c) posicional con ?
 * - run({ col: v }) con @col en SQL
 */
function normalizeStatementArgs(sql, args) {
  if (args.length === 0) return { sql, params: [] };
  if (args.length === 1 && args[0] != null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0];
    const params = [];
    const converted = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      if (!(name in obj)) {
        throw new Error(`Parametro faltante: @${name}`);
      }
      params.push(obj[name]);
      return '?';
    });
    return { sql: converted, params };
  }
  return { sql, params: args };
}

class BetterSqlite3CompatibleStatement {
  constructor(database, sql) {
    this.database = database;
    this.originalSql = sql;
    this.sql = sql;
  }

  get(...args) {
    const { sql, params } = normalizeStatementArgs(this.originalSql, args);
    const res = querySync(this.database._executor(), sql, params);
    return res.rows[0];
  }

  all(...args) {
    const { sql, params } = normalizeStatementArgs(this.originalSql, args);
    const res = querySync(this.database._executor(), sql, params);
    return res.rows;
  }

  run(...args) {
    const { sql, params } = normalizeStatementArgs(this.originalSql, args);
    let execSql = appendReturningId(sql);
    const res = querySync(this.database._executor(), execSql, params);
    const row = res.rows && res.rows[0];
    return {
      changes: res.rowCount ?? 0,
      lastInsertRowid: row && row.id != null ? row.id : undefined,
    };
  }
}

class BetterSqlite3CompatibleDatabase {
  constructor(pool) {
    this.pool = pool;
    this._txClient = null;
    this.driver = 'postgres-adapter';
  }

  _executor() {
    return this._txClient || this.pool;
  }

  prepare(sql) {
    return new BetterSqlite3CompatibleStatement(this, sql);
  }

  exec(sql) {
    const parts = sql.split(';').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      querySync(this._executor(), part, []);
    }
  }

  pragma(_nameOrSql, _value) {
    /* SQLite PRAGMA: no-op en PostgreSQL */
  }

  /**
   * Igual que better-sqlite3: fn usa el mismo objeto db; durante fn las
   * consultas van por la conexion transaccional.
   */
  transaction(fn) {
    return () => {
      const client = waitPromise(this.pool.connect());
      const prev = this._txClient;
      this._txClient = client;
      try {
        querySync(client, 'BEGIN');
        fn();
        querySync(client, 'COMMIT');
      } catch (error) {
        try {
          querySync(client, 'ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        throw error;
      } finally {
        this._txClient = prev;
        client.release();
      }
    };
  }
}

/**
 * Crea instancia compatible con better-sqlite3 sobre un pg Pool.
 */
function createBetterSqlite3Adapter(pool) {
  return new BetterSqlite3CompatibleDatabase(pool);
}

module.exports = {
  createBetterSqlite3Adapter,
  BetterSqlite3CompatibleDatabase,
  BetterSqlite3CompatibleStatement,
  normalizeStatementArgs,
  waitPromise,
  querySync,
};
