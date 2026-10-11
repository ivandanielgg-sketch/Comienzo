'use strict';

/**
 * Migración aditiva: snapshots FX para pagos y liquidaciones de proyectos.
 *
 * Columnas:
 * - project_payments.exchange_rate_to_mxn (nullable; NULL = histórico sin tasa verificable)
 * - project_payments.amount_mxn (nullable; NULL = sin equivalente histórico confirmado)
 * - projects.invoiced_exchange_rate_to_mxn (nullable; se llena al liquidar)
 * - projects.invoiced_amount_mxn (nullable; se llena al liquidar)
 *
 * Reglas:
 * - Idempotente (ADD COLUMN IF NOT EXISTS / ensureColumn).
 * - NO backfill con tasas actuales (no inventar historia).
 * - No modifica amount/currency/fechas existentes.
 *
 * Producción: tomar respaldo antes de aplicar (ver docs/PROJECT_IMPLEMENTATION_CONTEXT.md).
 */

function ensureSqliteProjectPaymentFxColumns(database) {
  const columns = database.prepare('PRAGMA table_info(project_payments)').all().map((c) => c.name);
  if (!columns.includes('exchange_rate_to_mxn')) {
    database.exec('ALTER TABLE project_payments ADD COLUMN exchange_rate_to_mxn REAL');
  }
  if (!columns.includes('amount_mxn')) {
    database.exec('ALTER TABLE project_payments ADD COLUMN amount_mxn REAL');
  }

  const projectCols = database.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
  if (!projectCols.includes('invoiced_exchange_rate_to_mxn')) {
    database.exec('ALTER TABLE projects ADD COLUMN invoiced_exchange_rate_to_mxn REAL');
  }
  if (!projectCols.includes('invoiced_amount_mxn')) {
    database.exec('ALTER TABLE projects ADD COLUMN invoiced_amount_mxn REAL');
  }
}

function ensurePostgresProjectPaymentFxColumns(database) {
  const alters = [
    'ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS exchange_rate_to_mxn DOUBLE PRECISION',
    'ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS amount_mxn DOUBLE PRECISION',
    'ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_exchange_rate_to_mxn DOUBLE PRECISION',
    'ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_amount_mxn DOUBLE PRECISION',
  ];
  for (const sql of alters) {
    try {
      database.exec(sql);
    } catch (_) {
      /* idempotent */
    }
  }
}

function migrateProjectPaymentFx(database, { postgres = false } = {}) {
  if (postgres) {
    ensurePostgresProjectPaymentFxColumns(database);
  } else {
    ensureSqliteProjectPaymentFxColumns(database);
  }
}

module.exports = {
  migrateProjectPaymentFx,
  ensureSqliteProjectPaymentFxColumns,
  ensurePostgresProjectPaymentFxColumns,
};
