#!/usr/bin/env node
'use strict';

/**
 * Migración de datos SQLite → PostgreSQL (solo lectura en SQLite).
 *
 * Requisitos:
 * 1. Orden FK (41 tablas; sessions al final).
 * 2. Conteo en SQLite antes de insertar.
 * 3. Conteo en PostgreSQL después; deben coincidir.
 * 4. Detener al primer error.
 * 5. INSERT ... ON CONFLICT DO NOTHING (idempotente).
 * 6. Resumen final origen vs destino por tabla.
 * 7. Alinear secuencias SERIAL (setval al MAX(id)).
 * 8. No modificar app.db (apertura readonly).
 *
 * Uso:
 *   DATABASE_URL=postgresql://... DB_PATH=data/app.db node migrate_data.js
 *
 * PostgreSQL debe tener el esquema aplicado (src/db/postgresSchema.sql) antes de ejecutar.
 */

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
const DATABASE_URL = process.env.DATABASE_URL;

/** Orden aprobado: sessions en posición 41 (después de user_session_activities). */
const MIGRATION_ORDER = [
  'users',
  'exchange_rates',
  'attendance_statuses',
  'role_permissions',
  'service_types',
  'service_quote_settings',
  'financial_settings',
  'kpi_settings',
  'backup_import_logs',
  'login_attempts',
  'audit_logs',
  'ecovis_payments',
  'ecovis_purchase_orders',
  'employees',
  'sales_commission_agents',
  'payroll_attendance_weeks',
  'bank_statement_summaries',
  'financial_statements',
  'financial_adjustments',
  'manual_payroll_expenses',
  'operating_expenses',
  'projects',
  'ecovis_projects',
  'ecovis_amount_adjustments',
  'accounts_payable',
  'bank_statement_movements',
  'accounts_payable_payments',
  'ecovis_payment_allocations',
  'ecovis_movements',
  'project_payments',
  'project_costs',
  'project_reports',
  'project_failure_reports',
  'sales_commissions',
  'financial_project_omissions',
  'kpi_manual_quote_captures',
  'vacation_requests',
  'payroll_attendance_employees',
  'sales_commission_payments',
  'user_permissions',
  'user_preferences',
  'user_session_activities',
  'sessions',
];

const CONFLICT_COLUMN = {
  exchange_rates: 'currency',
  service_quote_settings: 'key',
  sessions: 'sid',
};

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function getConflictColumn(tableName) {
  return CONFLICT_COLUMN[tableName] || 'id';
}

function getSqliteColumns(sqlite, tableName) {
  const rows = sqlite.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all();
  if (!rows.length) {
    throw new Error(`La tabla ${tableName} no existe en SQLite`);
  }
  return rows.sort((a, b) => a.cid - b.cid).map((row) => row.name);
}

function countSqliteRows(sqlite, tableName) {
  const row = sqlite
    .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(tableName)}`)
    .get();
  return Number(row.count);
}

async function countPgRows(pg, tableName) {
  const result = await pg.query(
    `SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(tableName)}`
  );
  return Number(result.rows[0].count);
}

async function resetSerialSequence(pg, tableName, columns) {
  if (!columns.includes('id')) {
    return;
  }

  const seqResult = await pg.query(
    'SELECT pg_get_serial_sequence($1, $2) AS seq',
    ['public.' + tableName, 'id']
  );
  const sequenceName = seqResult.rows[0]?.seq;
  if (!sequenceName) {
    return;
  }

  await pg.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM ${quoteIdent(tableName)}), 1), true)`,
    [sequenceName]
  );
}

async function migrateTable(sqlite, pg, tableName) {
  const columns = getSqliteColumns(sqlite, tableName);
  const sourceCount = countSqliteRows(sqlite, tableName);
  const conflictColumn = getConflictColumn(tableName);
  const quotedTable = quoteIdent(tableName);
  const columnList = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const insertSql = `INSERT INTO ${quotedTable} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${quoteIdent(conflictColumn)}) DO NOTHING`;

  const selectSql = `SELECT ${columnList} FROM ${quoteIdent(tableName)}`;
  const rows = sqlite.prepare(selectSql).all();

  if (rows.length !== sourceCount) {
    throw new Error(
      `Inconsistencia al leer ${tableName}: COUNT=${sourceCount}, filas=${rows.length}`
    );
  }

  process.stdout.write(`Migrando ${tableName} (${sourceCount} registros en origen)... `);

  await pg.query('BEGIN');
  try {
    for (const row of rows) {
      const values = columns.map((column) => row[column]);
      await pg.query(insertSql, values);
    }

    await resetSerialSequence(pg, tableName, columns);

    const destCount = await countPgRows(pg, tableName);
    if (destCount !== sourceCount) {
      throw new Error(
        `Conteo distinto tras migrar ${tableName}: origen=${sourceCount}, destino=${destCount}`
      );
    }

    await pg.query('COMMIT');
    process.stdout.write('OK\n');

    return {
      table: tableName,
      sourceCount,
      destCount,
      ok: true,
    };
  } catch (error) {
    await pg.query('ROLLBACK');
    throw error;
  }
}

function printSummary(results) {
  const nameWidth = Math.max(...results.map((r) => r.table.length), 5);
  console.log('\n=== Resumen de migración ===');
  console.log(
    `${'Tabla'.padEnd(nameWidth)}  ${'Origen'.padStart(8)}  ${'Destino'.padStart(8)}  Estado`
  );
  console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(8)}  ${'-'.repeat(8)}  ------`);

  let allOk = true;
  for (const row of results) {
    const status = row.ok && row.sourceCount === row.destCount ? 'OK' : 'ERROR';
    if (status !== 'OK') {
      allOk = false;
    }
    console.log(
      `${row.table.padEnd(nameWidth)}  ${String(row.sourceCount).padStart(8)}  ${String(row.destCount).padStart(8)}  ${status}`
    );
  }

  const totalSource = results.reduce((sum, r) => sum + r.sourceCount, 0);
  const totalDest = results.reduce((sum, r) => sum + r.destCount, 0);
  console.log(
    `\nTotal registros: origen=${totalSource}, destino=${totalDest}, tablas=${results.length}`
  );

  if (!allOk) {
    process.exitCode = 1;
  }
}

function validateEnvironment() {
  if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL es obligatorio (PostgreSQL destino).');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: no se encontró la base SQLite en ${DB_PATH}`);
    process.exit(1);
  }
}

function validateSqliteCatalog(sqlite) {
  const sqliteTables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map((row) => row.name);

  const missing = MIGRATION_ORDER.filter((name) => !sqliteTables.includes(name));
  if (missing.length) {
    throw new Error(`Faltan tablas en SQLite: ${missing.join(', ')}`);
  }

  const extras = sqliteTables.filter((name) => !MIGRATION_ORDER.includes(name));
  if (extras.length) {
    throw new Error(
      `Hay tablas en SQLite no incluidas en MIGRATION_ORDER: ${extras.join(', ')}`
    );
  }

  if (MIGRATION_ORDER.length !== 41) {
    throw new Error(`MIGRATION_ORDER debe tener 41 tablas; tiene ${MIGRATION_ORDER.length}`);
  }
}

async function main() {
  validateEnvironment();

  const sqlite = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const pg = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log(`Origen SQLite (solo lectura): ${DB_PATH}`);
  console.log(`Destino PostgreSQL: ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`Tablas en orden: ${MIGRATION_ORDER.length}\n`);

  validateSqliteCatalog(sqlite);

  await pg.connect();

  const summary = [];

  try {
    for (const tableName of MIGRATION_ORDER) {
      try {
        const result = await migrateTable(sqlite, pg, tableName);
        summary.push(result);
      } catch (error) {
        console.error(`\nError en tabla ${tableName}: ${error.message}`);
        if (error.stack) {
          console.error(error.stack);
        }
        process.exitCode = 1;
        break;
      }
    }

    if (summary.length) {
      printSummary(summary);
    }
  } finally {
    sqlite.close();
    await pg.end();
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main().catch((error) => {
  console.error('Error fatal:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
