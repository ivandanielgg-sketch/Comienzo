'use strict';

/**
 * Resolucion del motor de BD (sin cargar drivers).
 * - DATABASE_URL definida → PostgreSQL (pg Pool + adaptador API better-sqlite3).
 * - Sin DATABASE_URL → SQLite solo en desarrollo.
 * - Produccion sin DATABASE_URL → error (no fallback a disco).
 */
function resolveDbMode() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (url) {
    return 'postgres';
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[db] En produccion se requiere DATABASE_URL (PostgreSQL). '
        + 'SQLite en /var/data/app.db no se usa como base principal.',
    );
  }

  return 'sqlite';
}

function isPostgres() {
  return resolveDbMode() === 'postgres';
}

module.exports = {
  resolveDbMode,
  isPostgres,
};
