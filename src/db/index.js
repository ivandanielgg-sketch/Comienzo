'use strict';

const dialect = require('./dialect');
const { createSqliteDb } = require('./sqliteDriver');
const { createPostgresDb } = require('./postgresDriver');

let db;

/**
 * Conexión principal. Sin DATABASE_URL usa SQLite (comportamiento actual).
 * Con DATABASE_URL usa PostgreSQL (Fase 2).
 */
function getDb() {
  if (!db) {
    if (dialect.isPostgres()) {
      db = createPostgresDb(process.env.DATABASE_URL);
    } else {
      db = createSqliteDb();
    }
  }
  return db;
}

module.exports = {
  getDb,
  isPostgres: dialect.isPostgres,
};
