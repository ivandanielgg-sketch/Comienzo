'use strict';

/**
 * Migracion aditiva: snapshots FX de costos de proyecto.
 *
 * Columnas, ambas NULL y sin DEFAULT:
 * - project_costs.exchange_rate_to_mxn
 * - project_costs.amount_mxn
 *
 * NULL significa importe historico desconocido. No hay backfill.
 * No se modifica amount, currency, cost_date ni project_id.
 *
 * Arranque: se ejecuta al abrir SQLite o PostgreSQL, antes de escuchar HTTP.
 * Si el ALTER falla, el error se propaga. Si las columnas no quedan visibles,
 * assertProjectCostFxColumns lanza y el proceso termina sin atender peticiones.
 * Las demas migraciones conservan su manejo de errores.
 *
 * Produccion: no ejecutar esta migracion a mano contra la base real desde aqui.
 * El arranque de la aplicacion la aplica al desplegar, cuando eso se autorice.
 */

const COST_FX_COLUMNS = ['exchange_rate_to_mxn', 'amount_mxn'];

function listProjectCostColumns(database, postgres) {
  if (postgres) {
    return database.prepare(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'project_costs'
         AND column_name IN ('exchange_rate_to_mxn', 'amount_mxn')`,
    ).all().map((row) => row.name);
  }
  return database.prepare('PRAGMA table_info(project_costs)').all().map((column) => column.name);
}

function assertProjectCostFxColumns(database, { postgres = false } = {}) {
  const present = new Set(listProjectCostColumns(database, postgres));
  const missing = COST_FX_COLUMNS.filter((name) => !present.has(name));
  if (missing.length) {
    throw new Error(
      `Falta la migracion de costos historicos (${missing.map((name) => `project_costs.${name}`).join(', ')}). `
      + 'El arranque se detiene para no guardar costos sin esas columnas.',
    );
  }
}

function ensureSqliteProjectCostFxColumns(database) {
  const columns = listProjectCostColumns(database, false);
  if (!columns.includes('exchange_rate_to_mxn')) {
    database.exec('ALTER TABLE project_costs ADD COLUMN exchange_rate_to_mxn REAL');
  }
  if (!columns.includes('amount_mxn')) {
    database.exec('ALTER TABLE project_costs ADD COLUMN amount_mxn REAL');
  }
}

function ensurePostgresProjectCostFxColumns(database) {
  database.exec(
    'ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS exchange_rate_to_mxn DOUBLE PRECISION',
  );
  database.exec(
    'ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS amount_mxn DOUBLE PRECISION',
  );
}

function migrateProjectCostFx(database, { postgres = false } = {}) {
  if (postgres) {
    ensurePostgresProjectCostFxColumns(database);
  } else {
    ensureSqliteProjectCostFxColumns(database);
  }
  assertProjectCostFxColumns(database, { postgres });
}

module.exports = {
  COST_FX_COLUMNS,
  migrateProjectCostFx,
  assertProjectCostFxColumns,
  ensureSqliteProjectCostFxColumns,
  ensurePostgresProjectCostFxColumns,
};
