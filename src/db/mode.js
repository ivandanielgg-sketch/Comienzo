'use strict';

/**
 * Resolucion del motor de BD (sin cargar drivers).
 * Produccion: PG solo con USE_POSTGRES=true ademas de DATABASE_URL.
 */
function resolveDbMode() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    return 'sqlite';
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitPostgres = process.env.USE_POSTGRES === 'true';
  if (isProduction && !explicitPostgres) {
    console.warn(
      '[db] DATABASE_URL definida en produccion pero USE_POSTGRES no es "true". '
        + 'Se mantiene SQLite para proteger datos existentes en disco.',
    );
    return 'sqlite';
  }
  return 'postgres';
}

function isPostgres() {
  return resolveDbMode() === 'postgres';
}

module.exports = {
  resolveDbMode,
  isPostgres,
};
