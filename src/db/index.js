'use strict';

const { resolveDbMode, isPostgres } = require('./mode');
const { createSqliteDb } = require('./sqliteDriver');
const { createPostgresDb } = require('./postgresDriver');

let db;
let resolvedMode;

function getDriverLabel() {
  const mode = resolvedMode || resolveDbMode();
  return mode === 'postgres' ? 'postgresql (better-sqlite3 adapter)' : 'sqlite (better-sqlite3)';
}

/**
 * Conexion principal — API compatible con better-sqlite3.
 */
function getDb() {
  if (!db) {
    resolvedMode = resolveDbMode();
    if (resolvedMode === 'postgres') {
      db = createPostgresDb(process.env.DATABASE_URL);
      console.info('[db] PostgreSQL activo via adaptador better-sqlite3 (DATABASE_URL).');
    } else {
      db = createSqliteDb();
      if (process.env.NODE_ENV === 'production') {
        console.info('[db] SQLite activo (archivo en DB_PATH). Sin riesgo de switch accidental a PG.');
      }
    }
  }
  return db;
}

module.exports = {
  getDb,
  isPostgres,
  resolveDbMode,
  getDriverLabel,
};
