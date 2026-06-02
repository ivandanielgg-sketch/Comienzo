'use strict';

const { resolveDbMode, isPostgres } = require('./mode');
const { createSqliteDb } = require('./sqliteDriver');
const { createPostgresDb } = require('./postgresDriver');

let db;
let resolvedMode;

function getDriverLabel() {
  const mode = resolvedMode || resolveDbMode();
  return mode === 'postgres' ? 'postgresql (pg Pool)' : 'sqlite (better-sqlite3)';
}

/**
 * Conexion principal — API compatible con better-sqlite3.
 */
function getDb() {
  if (!db) {
    resolvedMode = resolveDbMode();
    if (resolvedMode === 'postgres') {
      db = createPostgresDb(process.env.DATABASE_URL);
      console.info('[db] PostgreSQL activo (pg/node-postgres, DATABASE_URL).');
    } else {
      db = createSqliteDb();
      console.info(`[db] SQLite activo (archivo en ${process.env.DB_PATH || 'data/app.db'}).`);
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
