'use strict';

/**
 * Punto de entrada de base de datos.
 * - Sin DATABASE_URL: SQLite (better-sqlite3) via src/db/sqliteDriver.js
 * - Con DATABASE_URL: PostgreSQL (pg) via src/db/postgresDriver.js
 *
 * Código SQLite original conservado en src/db/sqliteDriver.js (no eliminado).
 */
module.exports = require('./db/index');
