#!/usr/bin/env node
'use strict';

/**
 * Aplica src/db/postgresSchema.sql en orden de dependencias FK.
 * El archivo .sql está en orden alfabético; PostgreSQL exige que existan
 * las tablas referenciadas antes de cada CREATE TABLE con FOREIGN KEY.
 */
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'postgresSchema.sql');

/** Orden topológico (41 tablas) — alineado con migrate_data.js + FK del schema. */
const SCHEMA_TABLE_ORDER = [
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
  'employees',
  'sales_commission_agents',
  'ecovis_payments',
  'ecovis_purchase_orders',
  'ecovis_projects',
  'payroll_attendance_weeks',
  'bank_statement_summaries',
  'bank_statement_movements',
  'financial_statements',
  'financial_adjustments',
  'manual_payroll_expenses',
  'projects',
  'ecovis_amount_adjustments',
  'accounts_payable',
  'accounts_payable_payments',
  'ecovis_movements',
  'ecovis_payment_allocations',
  'project_payments',
  'project_costs',
  'project_reports',
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

function parseCreateTableBlocks(sql) {
  const blocks = new Map();
  const pattern = /CREATE TABLE (\w+) \(([\s\S]*?)\);/g;
  let match = pattern.exec(sql);
  while (match) {
    blocks.set(match[1], `CREATE TABLE ${match[1]} (${match[2]});`);
    match = pattern.exec(sql);
  }
  return blocks;
}

function parseIndexStatements(sql) {
  const pattern = /CREATE (?:UNIQUE )?INDEX[\s\S]*?;/g;
  return sql.match(pattern) || [];
}

function toIfNotExists(statement, type) {
  if (type === 'table') {
    return statement.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ');
  }
  return statement.replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ').replace(
    /^CREATE INDEX /,
    'CREATE INDEX IF NOT EXISTS ',
  );
}

async function resetPublicSchema(client) {
  console.log('SCHEMA_RESET=true: reiniciando schema public...');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;');
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL está vacía.');
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`Error: no se encontró ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const tableBlocks = parseCreateTableBlocks(sql);
  const indexStatements = parseIndexStatements(sql);

  const missing = SCHEMA_TABLE_ORDER.filter((name) => !tableBlocks.has(name));
  if (missing.length) {
    console.error(`Faltan tablas en ${SCHEMA_PATH}: ${missing.join(', ')}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('Conectando a PostgreSQL...');
  await client.connect();

  try {
    if (process.env.SCHEMA_RESET === 'true') {
      await resetPublicSchema(client);
    }

    console.log(`Aplicando ${SCHEMA_TABLE_ORDER.length} tablas en orden FK...`);
    for (const tableName of SCHEMA_TABLE_ORDER) {
      const statement = toIfNotExists(tableBlocks.get(tableName), 'table');
      await client.query(statement);
      process.stdout.write(`  ${tableName}\n`);
    }

    console.log(`Aplicando ${indexStatements.length} índices...`);
    for (const indexSql of indexStatements) {
      await client.query(toIfNotExists(indexSql, 'index'));
    }

    const result = await client.query(`
      SELECT COUNT(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    console.log(`OK: ${result.rows[0].table_count} tablas en schema public.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error aplicando schema:', error.message);
  process.exit(1);
});
