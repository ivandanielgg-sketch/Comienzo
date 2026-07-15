# Control de Proyectos — Export completo del BACKEND (para análisis IA)

Generado: 2026-07-15T17:45:45.710Z

## Qué incluye
- Código Node.js/Express en `src/` (rutas, módulos de negocio, DB)
- Schema PostgreSQL y drivers SQLite/Postgres
- `package.json`, `.env.example`, scripts de migración
- `AGENTS.md` / `README.md` como contexto del proyecto

## Qué NO incluye
- Frontend (`public/`) — ver `pagina-completa-analisis-ia.md`
- Tests (`test/`)
- `node_modules/`, base de datos (`data/`), lockfile completo

## Inventario (41 archivos, ~665 KB / 680967 chars)

| Archivo | Bytes |
|---------|------:|
| `package.json` | 888 |
| `.env.example` | 624 |
| `migrate_data.js` | 8573 |
| `scripts/apply-postgres-schema.js` | 4502 |
| `AGENTS.md` | 4086 |
| `README.md` | 3950 |
| `src/attendance.js` | 5993 |
| `src/audit.js` | 2855 |
| `src/backupOptimizer.js` | 7950 |
| `src/backupRegistry.js` | 13336 |
| `src/calculations.js` | 1788 |
| `src/commissions.js` | 9938 |
| `src/dateHelper.js` | 1721 |
| `src/db.js` | 326 |
| `src/db/betterSqlite3Adapter.js` | 4015 |
| `src/db/commissionsFlowMigration.js` | 3846 |
| `src/db/commissionsPostgresMigration.js` | 2570 |
| `src/db/dialect.js` | 3169 |
| `src/db/index.js` | 929 |
| `src/db/mode.js` | 768 |
| `src/db/postgresDriver.js` | 4128 |
| `src/db/postgresSchema.sql` | 36635 |
| `src/db/projectAssignmentsMigration.js` | 3419 |
| `src/db/projectFailureReportsMigration.js` | 1981 |
| `src/db/projectReportsEnhancementsMigration.js` | 2166 |
| `src/db/sqliteDriver.js` | 61357 |
| `src/ecovis.js` | 9341 |
| `src/financial.js` | 7878 |
| `src/kpis.js` | 69253 |
| `src/kpisExport.js` | 4111 |
| `src/kpisRoutes.js` | 24011 |
| `src/lib/combustion.js` | 16933 |
| `src/lib/combustionConstants.js` | 2732 |
| `src/newModules.js` | 38432 |
| `src/pagination.js` | 6179 |
| `src/permissions.js` | 3149 |
| `src/projectFailureReports.js` | 2580 |
| `src/search.js` | 2205 |
| `src/server.js` | 292605 |
| `src/sessionStore.js` | 3095 |
| `src/vacations.js` | 7259 |

## Mapa rápido de módulos
- `src/server.js` — app Express, middleware auth, endpoints principales
- `src/ecovis.js` — cálculos ECOVIS (puro)
- `src/financial.js`, `src/commissions.js`, `src/calculations.js` — finanzas/comisiones
- `src/attendance.js`, `src/vacations.js` — RRHH
- `src/kpis.js`, `src/kpisRoutes.js`, `src/kpisExport.js` — KPIs
- `src/db/` — drivers SQLite/Postgres, schema, migraciones
- `src/permissions.js`, `src/sessionStore.js`, `src/audit.js` — auth/seguridad
- `src/backupRegistry.js`, `src/backupOptimizer.js` — backup/import
- `src/newModules.js`, `src/projectFailureReports.js`, `src/search.js`, `src/pagination.js`
- `src/lib/combustion*.js` — motor calculadora emisiones (backend/lib)

================================================================================
# ARCHIVOS
================================================================================


================================================================================
# ARCHIVO: package.json
================================================================================

```json
{
  "name": "workspace",
  "version": "1.0.0",
  "description": "Aplicacion web para administracion de proyectos con autenticacion.",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test",
    "migrate:data": "node migrate_data.js",
    "db:apply-schema": "node scripts/apply-postgres-schema.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ivandanielgg-sketch/Comienzo.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "bugs": {
    "url": "https://github.com/ivandanielgg-sketch/Comienzo/issues"
  },
  "homepage": "https://github.com/ivandanielgg-sketch/Comienzo#readme",
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "better-sqlite3": "^12.10.0",
    "deasync": "^0.1.31",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-session": "^1.19.0",
    "pg": "^8.21.0"
  }
}

```


================================================================================
# ARCHIVO: .env.example
================================================================================

```dotenv
# Servidor
PORT=3000
NODE_ENV=development
SESSION_SECRET=cambia-este-secreto
TRUST_PROXY=false

# Admin inicial (solo si no existe usuario)
ADMIN_USER=admin
ADMIN_PASSWORD=admin123

# SQLite (por defecto si DATABASE_URL está vacío)
DB_PATH=data/app.db

# PostgreSQL: si DATABASE_URL está definida, la app usa pg (producción y local).
# DATABASE_URL=postgresql://usuario:password@localhost:5432/revram
# DATABASE_SSL=false   # fuerza sin SSL; por defecto se activa si la URL incluye sslmode=require o host Render
# PGPOOL_MAX=10
# PG_SKIP_SCHEMA=true

# Tipos de cambio por defecto al sembrar
USD_TO_MXN=17
EUR_TO_MXN=19

```


================================================================================
# ARCHIVO: migrate_data.js
================================================================================

```javascript
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

```


================================================================================
# ARCHIVO: scripts/apply-postgres-schema.js
================================================================================

```javascript
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

```


================================================================================
# ARCHIVO: AGENTS.md
================================================================================

```markdown
# AGENTS.md

## Cursor Cloud specific instructions

This is a Node.js/Express project management application ("Control de Proyectos") with an embedded SQLite database. No external services are required.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Run tests | `npm test` |
| Start server | `npm start` (port 3000) |

### Key facts

- The SQLite database (`data/app.db`) is auto-created on first server start with all migrations and a default admin user (`admin` / `admin123`).
- Sessions are stored in SQLite (no Redis/Memcached needed).
- `better-sqlite3` compiles a native C addon during `npm install`; build tools (`gcc`, `make`, `python3`) must be available in the environment.
- The frontend is vanilla HTML/CSS/JS served statically from `public/`—no build step required.
- The test suite uses Node's built-in test runner (`node --test`); there is no lint command configured in `package.json`.
- The API field names use snake_case (e.g. `quote_number`, `client_name`, `purchase_order_not_applicable`).
- To create a project without a purchase order, set `purchase_order_not_applicable: true`.
- If changing the DB schema (`src/db/sqliteDriver.js` or `src/db/postgresSchema.sql`), delete `data/app.db` (SQLite) or recreate the PG database, then restart. There is no separate migration system for SQLite; PostgreSQL uses `src/db/postgresSchema.sql` on first connect when `DATABASE_URL` is set.
- **Database drivers:** SQLite (`better-sqlite3`) when `DATABASE_URL` is unset (local dev). With `DATABASE_URL`, PostgreSQL via `pg` Pool and `src/db/betterSqlite3Adapter.js` (same prepare/get/run API). Legacy SQLite schema/migrations in `src/db/sqliteDriver.js`.
- **Production:** requires `DATABASE_URL` (PostgreSQL). No SQLite fallback in production. Set `DATABASE_SSL=true` for External URL; Internal URL on Render often uses `DATABASE_SSL=false`. Optional `PG_SKIP_SCHEMA=true` after schema/migration is applied.
- The Reports module (`project_reports` table) stores `safety_tests`, `emissions_low_fire`, and `emissions_high_fire` as JSON strings. Parse/stringify when reading/writing.
- The print view for reports is at `/report-print.html?id=<reportId>` — it uses `@media print` CSS for letter-size output.
- The ECOVIS module (`src/ecovis.js`) provides pure calculation functions; all ECOVIS endpoints in `src/server.js` require both `requireAuth` and `requireAdmin` middleware.
- The `ecovis_payment_allocations` table uses `payment_id` (not `ecovis_payment_id`) as the foreign key to `ecovis_payments`.
- ECOVIS project status values are `pendiente`, `parcialmente_pagado`, `pagado`, `cancelado` (note: `parcialmente_pagado`, not `parcial`).
- The `ecovis_movements.description` column is `NOT NULL`; always provide a description when inserting movements.
- Integration tests (e.g. `attendance.test.js`, `ecovis-currency.test.js`, `financial-integration.test.js`) require the server running on port 3000 (`npm start`) before executing `npm test`. Without the server, those tests fail with `ECONNREFUSED` but unit tests still pass.
- ECOVIS allocation/work lists: use `GET /api/ecovis/projects/assignable` (preferred) or `for_allocation=1` on list endpoints. PO list supports `exclude_settled=1` and `for_allocation=1`.
- Critical ECOVIS amount/currency edits are blocked when allocations exist; admins use `POST /api/ecovis/amount-adjustments` with mandatory `reason`.
- OC duplicates are blocked via `purchase_order_number_normalized` (trim, uppercase, collapsed spaces). Error: "Ya existe una orden de compra activa con este numero."
- Payment amount field: `initCurrencyInput` keeps `rawValue` in closure; call `clearCurrencyValue()` before `form.reset()` for new payments; zero displays as empty; `#ecovis-payment-amount` uses `autocomplete="off"`.
- ECOVIS modals use mousedown-on-backdrop detection; avoid closing on text selection/copy inside inputs.
- There is one pre-existing test failure (`backup import preview handles attendance entities` — 413 payload too large); this is not caused by environment setup.

```


================================================================================
# ARCHIVO: README.md
================================================================================

```markdown
# Control de Proyectos

Aplicacion web para registrar proyectos con acceso por usuario y contrasena.
Permite capturar datos comerciales y operativos, registrar pagos, registrar
compras/gastos/salarios relacionados con la cotizacion y calcular totales clave.

## Funcionalidad incluida

- Login con usuario y contrasena.
- Pagina de administracion para agregar y modificar usuarios protegida con
  contrasena del admin.
- Cierre de proyectos validando la contrasena del admin.
- Vista de Proyectos Cerrados para conservar historial de pagos y gastos.
- Borrado definitivo de proyectos cerrados validando la contrasena del admin.
- ID unico de proyecto generado automaticamente por consecutivo.
- Alta y edicion de proyectos con:
  - Numero de cotizacion.
  - Numero de pedido.
  - Numero de orden de compra o marca de "No Aplica".
  - Vendedor, cliente, tecnico responsable y fecha prometida de entrega.
  - Descripcion del proyecto para indicar de que trata.
  - Margen esperado, total facturado con IVA y avance manual.
  - Estado: Pendiente, En Proceso o Terminado.
  - Riesgo: Alto, Medio o Bajo.
  - Observaciones.
- Registro de pagos para sumar el Total Cobrado.
- Registro de costos por tipo: Compra, Gasolina, Casetas, Viaticos, Sueldo,
  Materiales, Hospedaje u Otros.
- Calculo por costo de `costo / total facturado` expresado como porcentaje.
- Eliminacion de pagos y costos validando la contrasena del admin.
- Captura de importes en MXN, USD o EUR.
- Panel de tipo de cambio a pesos mexicanos con fecha de ultima actualizacion.
- Calculo automatico de:
  - Pendiente de cobro = Total Facturado - Total Cobrado.
  - Margen Final = 1 - (Gastado / Total Facturado).
- Etiqueta de color para margen final contra margen esperado.
- Exportacion a Excel con una hoja de listado general y una hoja por proyecto
  con pagos y gastos relacionados.
- Exportacion a Excel de Proyectos Cerrados con la misma estructura multi-hoja.
- Duracion maxima de sesion de 1 hora.

## Requisitos

- Node.js 20 o superior.
- npm.

## Configuracion

Instala dependencias:

```bash
npm install
```

Opcionalmente crea un archivo `.env` para cambiar credenciales y configuracion:

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=admin123
SESSION_SECRET=cambia-este-secreto
PORT=3000
TRUST_PROXY=true
```

Si no defines variables, se crea automaticamente el usuario `admin` con la
contrasena `admin123`.

## Uso

```bash
npm start
```

Abre `http://localhost:3000`.

La base de datos SQLite se guarda en `data/app.db`.

## Publicacion en Render u otro hosting con HTTPS

En Render configura estas variables de entorno:

```bash
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASSWORD=una-contrasena-segura
SESSION_SECRET=un-texto-largo-y-secreto
TRUST_PROXY=true
```

Render publica la app detras de un proxy HTTPS. `TRUST_PROXY=true` permite que
Express reconozca la conexion segura y mantenga la cookie de sesion despues del
login.

Si usas SQLite en produccion, configura tambien un disco persistente y apunta la
base de datos ahi. En ese mismo archivo se guardan proyectos, usuarios y sesiones:

```bash
DB_PATH=/var/data/app.db
```

Esto evita la advertencia de `connect.session() MemoryStore`, conserva usuarios,
proyectos, tipos de cambio y mantiene la sesion activa aunque el servicio
reinicie, siempre que `/var/data` sea un disco persistente.

### Configurar disco persistente en Render

Para garantizar que usuarios, proyectos, pagos, gastos, tipos de cambio y
sesiones se conserven despues de cada deploy:

1. Entra al servicio web en Render.
2. Abre la seccion **Disks**.
3. Agrega un disco persistente.
4. Usa como mount path:

```bash
/var/data
```

5. En **Environment** agrega o confirma:

```bash
DB_PATH=/var/data/app.db
```

6. Guarda cambios y redeploya el servicio.

No uses `data/app.db` en produccion en Render, porque esa ruta vive dentro del
filesystem temporal del deploy y puede perderse al actualizar la plataforma.

## Pruebas

```bash
npm test
```

```


================================================================================
# ARCHIVO: src/attendance.js
================================================================================

```javascript
'use strict';

const ATTENDANCE_STATUSES = [
  { code: 'A', label: 'Asistencia', color: '#ffffff', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'A*', label: 'Personal fuera de taller / Trabajo fuera', color: '#b3e5fc', counts_as_absence: 0, requires_project_location: 1, requires_extra_payment: 0 },
  { code: 'F', label: 'Falta', color: '#fff9c4', counts_as_absence: 1, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'B', label: 'Baja', color: '#e0e0e0', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'PC', label: 'Permiso c/goce de sueldo', color: '#ffcdd2', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'PS', label: 'Permiso s/goce de sueldo', color: '#ef9a9a', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'D', label: 'Descanso', color: '#bbdefb', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'I', label: 'Incapacidad', color: '#c8e6c9', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'V', label: 'Vacaciones', color: '#b2dfdb', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
];

const VALID_STATUS_CODES = ATTENDANCE_STATUSES.map((s) => s.code);

const VALID_WEEK_STATUSES = ['borrador', 'cerrada', 'cancelada'];

const DAY_COLUMNS = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];

/**
 * Calculates the Monday–Sunday date range for a given ISO week number and year.
 * Uses ISO 8601 week numbering (week starts on Monday).
 */
function calculateWeekRange(year, weekNumber) {
  if (!Number.isFinite(year) || !Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    throw new Error('Año y número de semana inválidos.');
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayOfWeek = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4DayOfWeek - 1));

  const mondayOfTarget = new Date(mondayOfWeek1);
  mondayOfTarget.setUTCDate(mondayOfTarget.getUTCDate() + (weekNumber - 1) * 7);

  const sundayOfTarget = new Date(mondayOfTarget);
  sundayOfTarget.setUTCDate(sundayOfTarget.getUTCDate() + 6);

  const weekStartDate = mondayOfTarget.toISOString().slice(0, 10);
  const weekEndDate = sundayOfTarget.toISOString().slice(0, 10);

  const label = formatWeekLabel(weekNumber, mondayOfTarget, sundayOfTarget);

  return { weekStartDate, weekEndDate, label };
}

function formatWeekLabel(weekNumber, monday, sunday) {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const monDay = days[monday.getUTCDay()];
  const monDate = monday.getUTCDate();
  const monMonth = months[monday.getUTCMonth()];

  const sunDay = days[sunday.getUTCDay()];
  const sunDate = sunday.getUTCDate();
  const sunMonth = months[sunday.getUTCMonth()];
  const sunYear = sunday.getUTCFullYear();

  return `Semana ${weekNumber}. ${monDay}, ${monDate} de ${monMonth} – ${sunDay}, ${sunDate} de ${sunMonth} de ${sunYear}`;
}

function calculateDailyAbsences(employees) {
  const days = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];
  const absencesByDay = {};
  const dayLabels = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  dayLabels.forEach((label, idx) => {
    absencesByDay[label] = 0;
    for (const emp of employees) {
      if (isAbsence(emp[days[idx]])) {
        absencesByDay[label] += 1;
      }
    }
  });

  return absencesByDay;
}

function isAbsence(statusCode) {
  const status = ATTENDANCE_STATUSES.find((s) => s.code === statusCode);
  return status ? status.counts_as_absence === 1 : false;
}

function calculateTotalExtraPayments(employees) {
  let total = 0;
  for (const emp of employees) {
    if (emp.extra_payment_amount && Number.isFinite(Number(emp.extra_payment_amount))) {
      total += Number(emp.extra_payment_amount);
    }
  }
  return total;
}

function calculateAttendanceSummary(employees) {
  const absencesByDay = calculateDailyAbsences(employees);
  const totalAbsences = Object.values(absencesByDay).reduce((sum, v) => sum + v, 0);
  const totalExtraPayments = calculateTotalExtraPayments(employees);

  const countByStatus = {};
  const days = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];

  for (const emp of employees) {
    for (const day of days) {
      const code = emp[day] || 'A';
      countByStatus[code] = (countByStatus[code] || 0) + 1;
    }
  }

  return {
    totalEmployees: employees.length,
    absencesByDay,
    totalAbsences,
    totalExtraPayments,
    countByStatus,
  };
}

function generateDefaultAttendance() {
  return {
    monday_status: 'A',
    tuesday_status: 'A',
    wednesday_status: 'A',
    thursday_status: 'A',
    friday_status: 'A',
    saturday_status: 'D',
    sunday_status: 'D',
  };
}

function validateStatusCode(code) {
  return VALID_STATUS_CODES.includes(code);
}

function employeeHasOutsideWork(emp) {
  const days = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];
  return days.some((d) => emp[d] === 'A*');
}

module.exports = {
  ATTENDANCE_STATUSES,
  VALID_STATUS_CODES,
  VALID_WEEK_STATUSES,
  DAY_COLUMNS,
  calculateWeekRange,
  formatWeekLabel,
  calculateDailyAbsences,
  calculateTotalExtraPayments,
  calculateAttendanceSummary,
  generateDefaultAttendance,
  validateStatusCode,
  isAbsence,
  employeeHasOutsideWork,
};

```


================================================================================
# ARCHIVO: src/audit.js
================================================================================

```javascript
'use strict';

const { nowUtc } = require('./dateHelper');

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'passwordHash',
  'adminPassword',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'cookie',
  'secret',
  'session_secret',
  'mfa_secret',
  'sess',
];

function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function getAuditContext(req) {
  return {
    userId: req.session ? req.session.userId : null,
    userName: req.session ? req.session.username : null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get ? req.get('user-agent') || null : null,
  };
}

function createdByFields(req) {
  return {
    created_by_user_id: req.session ? req.session.userId : null,
    created_by_name: req.session ? req.session.username : null,
    created_at: nowUtc(),
  };
}

function updatedByFields(req) {
  return {
    updated_by_user_id: req.session ? req.session.userId : null,
    updated_by_name: req.session ? req.session.username : null,
    updated_at: nowUtc(),
  };
}

function deletedByFields(req) {
  return {
    deleted_by_user_id: req.session ? req.session.userId : null,
    deleted_by_name: req.session ? req.session.username : null,
    deleted_at: nowUtc(),
  };
}

/**
 * Logs an audit event to the audit_logs table.
 */
function logAuditEvent(db, { req, action, module, entityType, entityId, entityLabel, before, after, metadata }) {
  const ctx = req ? getAuditContext(req) : { userId: null, userName: null, ipAddress: null, userAgent: null };
  const timestamp = nowUtc();

  const beforeJson = before ? JSON.stringify(sanitizeForLog(before)) : null;
  const afterJson = after ? JSON.stringify(sanitizeForLog(after)) : null;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, before_json, after_json, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ctx.userId,
      ctx.userName,
      action,
      module || null,
      entityType || null,
      entityId || null,
      entityLabel || null,
      timestamp,
      ctx.ipAddress,
      ctx.userAgent,
      beforeJson,
      afterJson,
      metadataJson,
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = {
  getAuditContext,
  createdByFields,
  updatedByFields,
  deletedByFields,
  logAuditEvent,
  sanitizeForLog,
  nowUtc,
};

```


================================================================================
# ARCHIVO: src/backupOptimizer.js
================================================================================

```javascript
'use strict';

const zlib = require('node:zlib');
const { BACKUP_ENTITIES, EXCLUDED_ENTITIES, BACKUP_SCHEMA_VERSION, getIncludedEntities, buildCoverageManifest } = require('./backupRegistry');

const BACKUP_TYPES = {
  complete: 'complete',
  light: 'light',
  critical_only: 'critical_only',
};

const CRITICAL_ENTITIES = [
  'projects', 'closedProjects', 'projectPayments', 'projectCosts', 'projectReports', 'reportsArchive',
  'employees', 'vacationRequests', 'payrollAttendanceWeeks', 'payrollAttendanceEmployees', 'attendanceStatuses',
  'ecovisProjects', 'ecovisPayments', 'ecovisPurchaseOrders', 'ecovisPaymentAllocations', 'ecovisLoans', 'ecovisMovements',
  'settings', 'usersSafe', 'userPermissions', 'serviceTypes', 'serviceQuoteSettings',
  'financialStatements', 'financialSettings', 'accountsPayable', 'accountsPayablePayments',
  'bankStatementSummaries', 'manualPayrollExpenses', 'financialAdjustments', 'financialProjectOmissions',
  'salesCommissionAgents', 'salesCommissions', 'salesCommissionPayments',
  'userPreferences', 'rolePermissions',
];

const HEAVY_ENTITIES = ['auditLogs', 'loginAttempts', 'bankStatementMovements', 'backupImportLogs'];

const TEMPORAL_ENTITIES = ['userSessionActivities'];

const AUDIT_LOG_POLICIES = {
  last30Days: 30,
  last90Days: 90,
  last365Days: 365,
  full: null,
};

const ACTIVITY_POLICIES = {
  none: 0,
  last30Days: 30,
  last90Days: 90,
  full: null,
};

function getEntitiesForBackupType(backupType) {
  if (backupType === BACKUP_TYPES.critical_only) {
    return CRITICAL_ENTITIES;
  }
  if (backupType === BACKUP_TYPES.light) {
    return CRITICAL_ENTITIES.concat(['auditLogs', 'loginAttempts']);
  }
  return null;
}

function buildPolicyQuery(entity, policy, daysLimit) {
  if (!daysLimit) return entity.query;
  const cutoff = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000).toISOString();
  if (entity.key === 'auditLogs') {
    return `SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, metadata_json, created_at FROM audit_logs WHERE timestamp_utc >= '${cutoff}' ORDER BY id DESC`;
  }
  if (entity.key === 'loginAttempts') {
    return `SELECT id, user_identifier, user_id, ip_address, success, failure_reason, attempted_at, locked_until, created_at FROM login_attempts WHERE attempted_at >= '${cutoff}' ORDER BY id DESC`;
  }
  return entity.query;
}

function generateBackup(db, options = {}) {
  const {
    backupType = BACKUP_TYPES.complete,
    auditLogPolicy = 'full',
    activityPolicy = 'none',
    compress = false,
    username = 'admin',
  } = options;

  const allEntities = getIncludedEntities();
  const allowedKeys = getEntitiesForBackupType(backupType);
  const entities = allowedKeys ? allEntities.filter(e => allowedKeys.includes(e.key)) : allEntities;

  const data = {};
  const recordCounts = {};
  const entitySizes = {};
  const includedEntities = [];
  const excludedEntitiesList = [];
  const warnings = [];

  const auditDays = AUDIT_LOG_POLICIES[auditLogPolicy] || null;
  const activityDays = ACTIVITY_POLICIES[activityPolicy] || null;

  for (const entity of entities) {
    if (entity.key === 'userSessionActivities' && activityPolicy === 'none') {
      excludedEntitiesList.push({ name: entity.key, reason: 'Excluido por politica de actividad: none' });
      continue;
    }
    try {
      let query = entity.query;
      if (entity.key === 'auditLogs' && auditDays) {
        query = buildPolicyQuery(entity, 'audit', auditDays);
      } else if (entity.key === 'loginAttempts' && auditDays) {
        query = buildPolicyQuery(entity, 'login', auditDays);
      } else if (entity.key === 'userSessionActivities' && activityDays) {
        const cutoff = new Date(Date.now() - activityDays * 24 * 60 * 60 * 1000).toISOString();
        query = `SELECT * FROM user_session_activities WHERE login_at >= '${cutoff}' ORDER BY id DESC`;
      }
      const rows = db.prepare(query).all();
      data[entity.key] = rows;
      recordCounts[entity.key] = rows.length;
      const serialized = JSON.stringify(rows);
      entitySizes[entity.key] = serialized.length;
      includedEntities.push(entity.key);
    } catch (err) {
      data[entity.key] = [];
      recordCounts[entity.key] = 0;
      entitySizes[entity.key] = 2;
      warnings.push(`No se pudo respaldar ${entity.key}: ${err.message}`);
    }
  }

  for (const excl of EXCLUDED_ENTITIES) {
    excludedEntitiesList.push({ name: excl.key, reason: excl.reason });
  }
  if (backupType !== BACKUP_TYPES.complete) {
    const skipped = allEntities.filter(e => !includedEntities.includes(e.key) && !excludedEntitiesList.find(x => x.name === e.key));
    for (const s of skipped) {
      excludedEntitiesList.push({ name: s.key, reason: `Excluido por tipo de respaldo: ${backupType}` });
    }
  }

  const totalUncompressedSize = Object.values(entitySizes).reduce((s, v) => s + v, 0);

  const backup = {
    backupMetadata: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appName: 'REVRAM Dashboard',
      exportedAt: new Date().toISOString(),
      exportedBy: username,
      environment: process.env.NODE_ENV || 'development',
      backupType,
      compression: compress ? 'gzip' : 'none',
      recordCounts,
      entitySizes,
      totalUncompressedSize,
      includedEntities,
      excludedEntities: excludedEntitiesList.map(e => e.name),
      warnings,
      policiesUsed: { auditLogPolicy, activityPolicy },
    },
    coverageManifest: {
      ...buildCoverageManifest(includedEntities, warnings),
      backupType,
      excludedWithReasons: excludedEntitiesList,
      entitySizes,
      totalUncompressedSize,
    },
    data,
  };

  if (compress) {
    const jsonStr = JSON.stringify(backup);
    const compressed = zlib.gzipSync(jsonStr);
    backup.backupMetadata.totalCompressedSize = compressed.length;
    return { backup, compressed, contentType: 'application/gzip', extension: '.json.gz' };
  }

  return { backup, compressed: null, contentType: 'application/json', extension: '.json' };
}

function generateDiagnostic(db) {
  const entities = getIncludedEntities();
  const results = [];
  let totalSize = 0;

  for (const entity of entities) {
    try {
      const rows = db.prepare(entity.query).all();
      const serialized = JSON.stringify(rows);
      const size = serialized.length;
      totalSize += size;
      results.push({
        entity: entity.key,
        table: entity.table,
        module: entity.module,
        records: rows.length,
        sizeBytes: size,
        avgRecordBytes: rows.length > 0 ? Math.round(size / rows.length) : 0,
      });
    } catch (err) {
      results.push({ entity: entity.key, table: entity.table, module: entity.module, records: 0, sizeBytes: 0, avgRecordBytes: 0, error: err.message });
    }
  }

  results.sort((a, b) => b.sizeBytes - a.sizeBytes);

  for (const r of results) {
    r.percentage = totalSize > 0 ? Math.round((r.sizeBytes / totalSize) * 10000) / 100 : 0;
  }

  return {
    totalSizeBytes: totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    entityCount: results.length,
    totalRecords: results.reduce((s, r) => s + r.records, 0),
    topHeaviest: results.slice(0, 10),
    entities: results,
    hasBase64: false,
    hasLargeSnapshots: results.some(r => r.avgRecordBytes > 10000),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function decompressBackup(buffer) {
  try {
    const decompressed = zlib.gunzipSync(buffer);
    return JSON.parse(decompressed.toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  BACKUP_TYPES,
  CRITICAL_ENTITIES,
  HEAVY_ENTITIES,
  TEMPORAL_ENTITIES,
  AUDIT_LOG_POLICIES,
  ACTIVITY_POLICIES,
  generateBackup,
  generateDiagnostic,
  decompressBackup,
  formatBytes,
};

```


================================================================================
# ARCHIVO: src/backupRegistry.js
================================================================================

```javascript
'use strict';

const BACKUP_SCHEMA_VERSION = '3.0.0';

const ENTITY_STATUS = {
  INCLUDED: 'included',
  EXCLUDED: 'excluded',
  PLANNED: 'planned',
};

const BACKUP_ENTITIES = [
  // --- Operational data ---
  {
    key: 'projects',
    table: 'projects',
    query: 'SELECT * FROM projects WHERE closed_at IS NULL ORDER BY id',
    stableKeys: ['quote_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'projects',
  },
  {
    key: 'closedProjects',
    table: 'projects',
    query: 'SELECT * FROM projects WHERE closed_at IS NOT NULL ORDER BY id',
    stableKeys: ['quote_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'projects',
  },
  {
    key: 'projectPayments',
    table: 'project_payments',
    query: 'SELECT * FROM project_payments ORDER BY id',
    stableKeys: ['project_id', 'payment_date', 'amount', 'currency'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'payments',
  },
  {
    key: 'projectCosts',
    table: 'project_costs',
    query: 'SELECT * FROM project_costs ORDER BY id',
    stableKeys: ['project_id', 'cost_date', 'amount', 'category', 'description'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'costs',
  },
  {
    key: 'projectReports',
    table: 'project_reports',
    query: 'SELECT * FROM project_reports WHERE deleted_at IS NULL ORDER BY id',
    stableKeys: ['report_folio'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'reports',
  },
  {
    key: 'reportsArchive',
    table: 'project_reports',
    query: 'SELECT * FROM project_reports WHERE deleted_at IS NOT NULL ORDER BY id',
    stableKeys: ['report_folio'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'reports',
  },
  {
    key: 'employees',
    table: 'employees',
    query: 'SELECT * FROM employees ORDER BY id',
    stableKeys: ['employee_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'vacations',
  },
  {
    key: 'kpiManualQuoteCaptures',
    table: 'kpi_manual_quote_captures',
    query: 'SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL ORDER BY year DESC, month DESC, id',
    stableKeys: ['year', 'month', 'employee_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'kpis',
  },
  {
    key: 'kpiSettings',
    table: 'kpi_settings',
    query: 'SELECT * FROM kpi_settings ORDER BY id',
    stableKeys: ['id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'kpis',
  },
  {
    key: 'vacationRequests',
    table: 'vacation_requests',
    query: 'SELECT * FROM vacation_requests ORDER BY id',
    stableKeys: ['employee_id', 'start_date', 'end_date', 'requested_days'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'vacations',
  },
  {
    key: 'payrollAttendanceWeeks',
    table: 'payroll_attendance_weeks',
    query: 'SELECT * FROM payroll_attendance_weeks ORDER BY id',
    stableKeys: ['year', 'week_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'attendance',
  },
  {
    key: 'payrollAttendanceEmployees',
    table: 'payroll_attendance_employees',
    query: 'SELECT * FROM payroll_attendance_employees ORDER BY id',
    stableKeys: ['payroll_attendance_week_id', 'employee_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'attendance',
  },
  {
    key: 'attendanceStatuses',
    table: 'attendance_statuses',
    query: 'SELECT * FROM attendance_statuses ORDER BY id',
    stableKeys: ['code'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'attendance',
  },
  {
    key: 'ecovisProjects',
    table: 'ecovis_projects',
    query: 'SELECT * FROM ecovis_projects ORDER BY id',
    stableKeys: ['project_name', 'project_date', 'total_amount'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisPayments',
    table: 'ecovis_payments',
    query: 'SELECT * FROM ecovis_payments ORDER BY id',
    stableKeys: ['payment_date', 'amount', 'bank_reference'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisPurchaseOrders',
    table: 'ecovis_purchase_orders',
    query: 'SELECT * FROM ecovis_purchase_orders ORDER BY id',
    stableKeys: ['purchase_order_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisPaymentAllocations',
    table: 'ecovis_payment_allocations',
    query: 'SELECT * FROM ecovis_payment_allocations ORDER BY id',
    stableKeys: ['payment_id', 'amount', 'allocation_type'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisLoans',
    table: 'ecovis_movements',
    query: "SELECT * FROM ecovis_movements WHERE movement_type = 'prestamo_ecovis_a_revram' ORDER BY id",
    stableKeys: ['movement_date', 'amount', 'description'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisMovements',
    table: 'ecovis_movements',
    query: "SELECT * FROM ecovis_movements WHERE movement_type != 'prestamo_ecovis_a_revram' ORDER BY id",
    stableKeys: ['movement_date', 'movement_type', 'amount', 'description'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisAmountAdjustments',
    table: 'ecovis_amount_adjustments',
    query: 'SELECT * FROM ecovis_amount_adjustments ORDER BY id',
    stableKeys: ['entity_type', 'entity_id', 'created_at', 'reason'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'settings',
    table: 'exchange_rates',
    query: 'SELECT * FROM exchange_rates ORDER BY currency',
    stableKeys: ['currency'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'settings',
  },
  // --- Users & Security ---
  {
    key: 'usersSafe',
    table: 'users',
    query: 'SELECT id, username, role, is_active, created_at, updated_at, created_by_name, updated_by_name FROM users ORDER BY id',
    stableKeys: ['username'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'users',
    note: 'password_hash, mfa_secret, locked_until, failed_login_attempts excluded',
  },
  {
    key: 'userPermissions',
    table: 'user_permissions',
    query: 'SELECT id, user_id, permissions_json, created_at, updated_at FROM user_permissions ORDER BY id',
    stableKeys: ['user_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'users',
  },
  // --- Audit & Auth ---
  {
    key: 'loginAttempts',
    table: 'login_attempts',
    query: 'SELECT id, user_identifier, user_id, ip_address, success, failure_reason, attempted_at, locked_until, created_at FROM login_attempts ORDER BY id DESC LIMIT 10000',
    stableKeys: ['user_identifier', 'attempted_at'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'auth',
    note: 'Limited to last 10000 entries. user_agent excluded to reduce size.',
  },
  {
    key: 'auditLogs',
    table: 'audit_logs',
    query: 'SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, metadata_json, created_at FROM audit_logs ORDER BY id DESC LIMIT 50000',
    stableKeys: ['timestamp_utc', 'user_id', 'action', 'entity_type', 'entity_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'audit',
    note: 'Limited to last 50000 entries. before_json and after_json excluded to reduce size.',
  },
  {
    key: 'backupImportLogs',
    table: 'backup_import_logs',
    query: 'SELECT * FROM backup_import_logs ORDER BY id',
    stableKeys: ['imported_at', 'imported_by'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'backup',
  },
  // --- Service Quoter ---
  {
    key: 'serviceTypes',
    table: 'service_types',
    query: 'SELECT * FROM service_types ORDER BY sort_order, id',
    stableKeys: ['name'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'serviceQuoter',
  },
  {
    key: 'serviceQuoteSettings',
    table: 'service_quote_settings',
    query: 'SELECT * FROM service_quote_settings ORDER BY key',
    stableKeys: ['key'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'serviceQuoter',
  },
  // --- Financial Statements ---
  {
    key: 'financialStatements',
    table: 'financial_statements',
    query: "SELECT * FROM financial_statements WHERE deleted_at IS NULL ORDER BY year DESC, month DESC",
    stableKeys: ['year', 'month'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'accountsPayable',
    table: 'accounts_payable',
    query: 'SELECT * FROM accounts_payable WHERE deleted_at IS NULL ORDER BY id',
    stableKeys: ['supplier_name', 'invoice_number', 'invoice_date'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'bankStatementSummaries',
    table: 'bank_statement_summaries',
    query: 'SELECT * FROM bank_statement_summaries ORDER BY year DESC, month DESC, id',
    stableKeys: ['bank_name', 'year', 'month'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'bankStatementMovements',
    table: 'bank_statement_movements',
    query: 'SELECT * FROM bank_statement_movements ORDER BY id',
    stableKeys: ['bank_statement_summary_id', 'transaction_date', 'reference', 'deposit_original', 'withdrawal_original'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'manualPayrollExpenses',
    table: 'manual_payroll_expenses',
    query: 'SELECT * FROM manual_payroll_expenses ORDER BY year, month, id',
    stableKeys: ['year', 'month', 'concept', 'amount_original'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'financialAdjustments',
    table: 'financial_adjustments',
    query: "SELECT * FROM financial_adjustments WHERE deleted_at IS NULL ORDER BY year, month, id",
    stableKeys: ['year', 'month', 'adjustment_type', 'concept', 'amount_original'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'accountsPayablePayments',
    table: 'accounts_payable_payments',
    query: 'SELECT * FROM accounts_payable_payments ORDER BY id',
    stableKeys: ['accounts_payable_id', 'payment_date', 'amount_original'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'financialProjectOmissions',
    table: 'financial_project_omissions',
    query: 'SELECT * FROM financial_project_omissions ORDER BY year, month, project_id',
    stableKeys: ['year', 'month', 'project_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
  {
    key: 'financialSettings',
    table: 'financial_settings',
    query: 'SELECT * FROM financial_settings',
    stableKeys: ['id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'financial',
  },
];

const EXCLUDED_ENTITIES = [
  {
    key: 'sessions',
    table: 'sessions',
    reason: 'Datos sensibles de sesion activa - tokens y cookies',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'passwordHashes',
    table: 'users',
    reason: 'Credenciales sensibles - password_hash excluido por seguridad',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'mfaSecrets',
    table: 'users',
    reason: 'Secretos MFA no se respaldan por seguridad',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'lockedUntilData',
    table: 'users',
    reason: 'Estado temporal de bloqueo - se regenera automaticamente',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'environmentVariables',
    table: null,
    reason: 'Variables de entorno, secretos y credenciales del servidor',
    status: ENTITY_STATUS.EXCLUDED,
  },
];

const PLANNED_ENTITIES = [
  { key: 'roles', table: 'roles', reason: 'Pendiente implementacion de sistema de roles como tabla independiente', status: ENTITY_STATUS.PLANNED },
  { key: 'securitySettings', table: 'security_settings', reason: 'Pendiente configuracion de seguridad avanzada', status: ENTITY_STATUS.PLANNED },
];

const DETECTED_ROUTES = [
  '/projects',
  '/closed-projects',
  '/reports',
  '/reports/archive',
  '/vacations',
  '/attendance',
  '/ecovis',
  '/service-quoter',
  '/financial',
  '/users',
  '/admin/backup',
  '/commissions',
  '/activity-monitor',
  '/kpis',
  '/preferences',
];

const DETECTED_MODULES = [
  'projects',
  'closedProjects',
  'payments',
  'costs',
  'reports',
  'reportsArchive',
  'employees',
  'vacations',
  'attendance',
  'ecovis',
  'serviceQuoter',
  'financial',
  'settings',
  'users',
  'auth',
  'backup',
  'audit',
  'commissions',
  'activityMonitor',
  'preferences',
];

function getIncludedEntities() {
  return BACKUP_ENTITIES.filter((e) => e.status === ENTITY_STATUS.INCLUDED);
}

function getAllEntityKeys() {
  return [
    ...BACKUP_ENTITIES.map((e) => e.key),
    ...EXCLUDED_ENTITIES.map((e) => e.key),
    ...PLANNED_ENTITIES.map((e) => e.key),
  ];
}

function buildCoverageManifest(includedKeys, warnings) {
  const allDetected = BACKUP_ENTITIES.map((e) => e.key);
  const excluded = EXCLUDED_ENTITIES.map((e) => ({ entity: e.key, reason: e.reason }));
  const planned = PLANNED_ENTITIES.map((e) => ({ entity: e.key, reason: e.reason }));

  let coverageStatus = 'complete';
  if (warnings && warnings.length > 0) {
    coverageStatus = 'incomplete';
  }

  return {
    routesDetected: DETECTED_ROUTES,
    modulesDetected: DETECTED_MODULES,
    entitiesDetected: allDetected,
    entitiesIncluded: includedKeys,
    entitiesExcluded: excluded,
    entitiesPlanned: planned,
    coverageStatus,
  };
}

module.exports = {
  BACKUP_SCHEMA_VERSION,
  BACKUP_ENTITIES,
  EXCLUDED_ENTITIES,
  PLANNED_ENTITIES,
  ENTITY_STATUS,
  DETECTED_ROUTES,
  DETECTED_MODULES,
  getIncludedEntities,
  getAllEntityKeys,
  buildCoverageManifest,
};

```


================================================================================
# ARCHIVO: src/calculations.js
================================================================================

```javascript
function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeExchangeRates(exchangeRates = {}) {
  if (Array.isArray(exchangeRates)) {
    return exchangeRates.reduce((rates, row) => {
      rates[row.currency] = Number(row.rate_to_mxn);
      return rates;
    }, { MXN: 1 });
  }

  return Object.entries(exchangeRates).reduce(
    (rates, [currency, value]) => {
      rates[currency] = Number(value.rate_to_mxn ?? value);
      return rates;
    },
    { MXN: 1 },
  );
}

function convertAmountToMxn(amount, currency = 'MXN', exchangeRates = {}) {
  const rates = normalizeExchangeRates(exchangeRates);
  const rate = rates[currency] ?? 1;
  return roundMoney(Number(amount || 0) * rate);
}

function sumAmounts(items, exchangeRates = {}) {
  return roundMoney(
    items.reduce(
      (total, item) =>
        total + convertAmountToMxn(item.amount, item.currency || 'MXN', exchangeRates),
      0,
    ),
  );
}

function buildProjectTotals(project, payments = [], costs = [], exchangeRates = {}) {
  const totalCharged = sumAmounts(payments, exchangeRates);
  const spent = sumAmounts(costs, exchangeRates);
  const totalInvoicedMxn = convertAmountToMxn(
    project.total_invoiced,
    project.total_invoiced_currency || 'MXN',
    exchangeRates,
  );
  const pendingCollection = roundMoney(totalInvoicedMxn - totalCharged);
  const finalMargin =
    totalInvoicedMxn > 0 ? roundMoney(1 - spent / totalInvoicedMxn) : null;

  return {
    total_charged: totalCharged,
    spent,
    total_invoiced_mxn: totalInvoicedMxn,
    pending_collection: pendingCollection,
    final_margin: finalMargin,
  };
}

module.exports = {
  buildProjectTotals,
  convertAmountToMxn,
  normalizeExchangeRates,
  roundMoney,
  sumAmounts,
};

```


================================================================================
# ARCHIVO: src/commissions.js
================================================================================

```javascript
'use strict';

const { buildProjectTotals, roundMoney } = require('./calculations');
const { sqlYearExpr, sqlMonthExpr, sqlDateCompareGte, sqlDateCompareLte } = require('./db/dialect');

const PROJECT_COMMISSION_BASE_TYPES = ['facturado_1pct', 'facturado_3pct', 'monto_manual'];

function loadExchangeRates(db) {
  const rates = { MXN: 1 };
  db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all().forEach((row) => {
    rates[row.currency] = row.rate_to_mxn;
  });
  return rates;
}

function mapProjectForCommission(db, project, rates) {
  const payments = db.prepare('SELECT amount, currency FROM project_payments WHERE project_id = ?').all(project.id);
  const costs = db.prepare('SELECT amount, currency FROM project_costs WHERE project_id = ?').all(project.id);
  const totals = buildProjectTotals(project, payments, costs, rates);
  const totalCostsMxn = totals.spent;
  const totalSaleMxn = totals.total_invoiced_mxn;
  const grossProfitMxn = roundMoney(totalSaleMxn - totalCostsMxn);
  const finalMargin = totals.final_margin;
  const marginPercent =
    finalMargin != null ? roundMoney(finalMargin * 100) : totalSaleMxn > 0 ? roundMoney((grossProfitMxn / totalSaleMxn) * 100) : 0;
  return {
    id: project.id,
    quote_number: project.quote_number,
    order_number: project.order_number,
    client_name: project.client_name,
    project_description: project.project_description,
    closed_at: project.closed_at,
    seller: project.seller,
    total_sale_mxn: totalSaleMxn,
    total_costs_mxn: totalCostsMxn,
    gross_profit_mxn: grossProfitMxn,
    net_profit_mxn: grossProfitMxn,
    final_margin: finalMargin,
    margin: marginPercent,
  };
}

function calculateProjectCommission(baseType, totalSaleMxn, manualAmountMxn) {
  if (baseType === 'facturado_1pct') {
    return {
      commissionBaseMxn: totalSaleMxn,
      commissionPercentage: 1,
      commissionAmountMxn: roundMoney(totalSaleMxn * 0.01),
    };
  }
  if (baseType === 'facturado_3pct') {
    return {
      commissionBaseMxn: totalSaleMxn,
      commissionPercentage: 3,
      commissionAmountMxn: roundMoney(totalSaleMxn * 0.03),
    };
  }
  if (baseType === 'monto_manual') {
    const amount = roundMoney(manualAmountMxn);
    return {
      commissionBaseMxn: amount,
      commissionPercentage: 0,
      commissionAmountMxn: amount,
    };
  }
  return null;
}

function commissionBaseLabel(baseType) {
  const labels = {
    facturado_1pct: '1% sobre facturado',
    facturado_3pct: '3% sobre facturado',
    monto_manual: 'Monto manual',
    total_sale_mxn: 'Facturado (legacy)',
    gross_profit_mxn: 'Utilidad bruta (legacy)',
    net_profit_mxn: 'Utilidad neta (legacy)',
    no_aplica: 'No aplica (legacy)',
  };
  return labels[baseType] || baseType;
}

function mapCommissionListRow(row) {
  const finalMargin = row.final_margin_snapshot;
  const marginPercent =
    finalMargin != null ? roundMoney(Number(finalMargin) * 100) : row.total_sale_mxn_snapshot > 0
      ? roundMoney((row.gross_profit_mxn_snapshot / row.total_sale_mxn_snapshot) * 100)
      : null;
  const isExtra = row.commission_type === 'extraordinaria';
  return {
    ...row,
    final_margin: finalMargin,
    final_margin_percent: marginPercent,
    commission_base_label: commissionBaseLabel(row.commission_calculation_base_type),
    display_quote: isExtra ? 'Extraordinaria' : (row.quote_number || '—'),
    display_client: isExtra ? (row.notes || '—') : (row.client_name || '—'),
    display_order: isExtra ? '—' : (row.order_number || '—'),
  };
}

const MONTH_LABELS = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function parseCommissionsPeriod(query = {}) {
  const year = query.year != null && query.year !== '' ? Number(query.year) : null;
  const month = query.month != null && query.month !== '' ? Number(query.month) : null;
  if (year && month >= 1 && month <= 12) {
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      filtered: true,
      year,
      month,
      period_label: `${MONTH_LABELS[month]} ${year}`,
      date_start: `${year}-${pad(month)}-01`,
      date_end: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }
  return { filtered: false, period_label: 'Acumulado (todos los meses)' };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildCommissionsDashboard(db, period) {
  const globalPending = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(commission_amount_mxn), 0) as total
       FROM sales_commissions
       WHERE deleted_at IS NULL AND status = 'pendiente'`,
    ).get().total,
  );

  let assignedWhere = "sc.deleted_at IS NULL AND sc.status != 'cancelada'";
  let assignedParams = [];
  let paidWhere = 'scp.deleted_at IS NULL';
  let paidParams = [];

  if (period.filtered) {
    assignedWhere += ` AND ${sqlDateCompareGte('sc.assigned_at')} AND ${sqlDateCompareLte('sc.assigned_at')}`;
    assignedParams = [period.date_start, period.date_end];
    paidWhere += ` AND ${sqlDateCompareGte('scp.payment_date')} AND ${sqlDateCompareLte('scp.payment_date')}`;
    paidParams = [period.date_start, period.date_end];
  }

  const soldMxn = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN sc.project_id IS NOT NULL THEN sc.total_sale_mxn_snapshot ELSE 0 END), 0) as total
       FROM sales_commissions sc WHERE ${assignedWhere}`,
    ).get(...assignedParams).total,
  );
  const commissionsGeneratedMxn = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(sc.commission_amount_mxn), 0) as total
       FROM sales_commissions sc WHERE ${assignedWhere}`,
    ).get(...assignedParams).total,
  );
  const commissionsPaidMxn = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(scp.amount_mxn), 0) as total
       FROM sales_commission_payments scp WHERE ${paidWhere}`,
    ).get(...paidParams).total,
  );

  const assignedByMonth = db.prepare(
    `SELECT ${sqlYearExpr('sc.assigned_at')} as year,
            ${sqlMonthExpr('sc.assigned_at')} as month,
            COALESCE(SUM(CASE WHEN sc.project_id IS NOT NULL THEN sc.total_sale_mxn_snapshot ELSE 0 END), 0) as sold_mxn,
            COALESCE(SUM(sc.commission_amount_mxn), 0) as commissions_generated_mxn
     FROM sales_commissions sc
     WHERE sc.deleted_at IS NULL AND sc.status != 'cancelada'
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 DESC
     LIMIT 24`,
  ).all();

  const paidByMonth = db.prepare(
    `SELECT ${sqlYearExpr('scp.payment_date')} as year,
            ${sqlMonthExpr('scp.payment_date')} as month,
            COALESCE(SUM(scp.amount_mxn), 0) as commissions_paid_mxn
     FROM sales_commission_payments scp
     WHERE scp.deleted_at IS NULL
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 DESC
     LIMIT 24`,
  ).all();

  const paidMap = new Map(paidByMonth.map((r) => [monthKey(r.year, r.month), r.commissions_paid_mxn]));
  const monthlySeries = assignedByMonth.map((row) => ({
    year: row.year,
    month: row.month,
    month_label: `${MONTH_LABELS[row.month]} ${row.year}`,
    sold_mxn: roundMoney(row.sold_mxn),
    commissions_generated_mxn: roundMoney(row.commissions_generated_mxn),
    commissions_paid_mxn: roundMoney(paidMap.get(monthKey(row.year, row.month)) || 0),
  }));

  const agents = db.prepare(
    `SELECT sca.id, sca.name, sca.active, e.full_name as employee_name
     FROM sales_commission_agents sca
     LEFT JOIN employees e ON e.id = sca.employee_id
     WHERE sca.deleted_at IS NULL
     ORDER BY sca.name`,
  ).all();

  const agentsWithProjects = agents.map((agent) => {
    const pendingRow = db.prepare(
      `SELECT COALESCE(SUM(commission_amount_mxn), 0) as total, COUNT(*) as cnt
       FROM sales_commissions
       WHERE sales_agent_id = ? AND deleted_at IS NULL AND status = 'pendiente'`,
    ).get(agent.id);
    const assignments = db.prepare(
      `SELECT sc.id, sc.project_id, sc.commission_type, sc.status, sc.commission_amount_mxn,
              sc.total_sale_mxn_snapshot, sc.assigned_at, sc.commission_calculation_base_type, sc.notes,
              p.quote_number, p.client_name, p.order_number
       FROM sales_commissions sc
       LEFT JOIN projects p ON p.id = sc.project_id
       WHERE sc.sales_agent_id = ? AND sc.deleted_at IS NULL AND sc.status = 'pendiente'
       ORDER BY sc.assigned_at DESC`,
    ).all(agent.id);
    return {
      ...agent,
      pending_commissions_mxn: roundMoney(pendingRow.total),
      pending_commissions_count: pendingRow.cnt,
      assigned_projects: assignments.map((sc) => ({
        commission_id: sc.id,
        commission_type: sc.commission_type,
        status: sc.status,
        quote_number: sc.commission_type === 'extraordinaria' ? 'Extraordinaria' : (sc.quote_number || '—'),
        client_name: sc.commission_type === 'extraordinaria' ? (sc.notes || '—') : (sc.client_name || '—'),
        order_number: sc.order_number || '—',
        sold_mxn: roundMoney(sc.total_sale_mxn_snapshot || 0),
        commission_mxn: roundMoney(sc.commission_amount_mxn),
        commission_base_label: commissionBaseLabel(sc.commission_calculation_base_type),
        assigned_at: sc.assigned_at,
      })),
    };
  }).filter((a) => a.pending_commissions_count > 0);

  return {
    period,
    totals: {
      period_label: period.period_label,
      sold_mxn: soldMxn,
      commissions_generated_mxn: commissionsGeneratedMxn,
      commissions_paid_mxn: commissionsPaidMxn,
      commissions_pending_mxn: globalPending,
    },
    monthly_series: monthlySeries,
    agents_with_projects: agentsWithProjects,
  };
}

module.exports = {
  PROJECT_COMMISSION_BASE_TYPES,
  MONTH_LABELS,
  loadExchangeRates,
  mapProjectForCommission,
  calculateProjectCommission,
  commissionBaseLabel,
  mapCommissionListRow,
  parseCommissionsPeriod,
  buildCommissionsDashboard,
};

```


================================================================================
# ARCHIVO: src/dateHelper.js
================================================================================

```javascript
'use strict';

const TIMEZONE = 'America/Mexico_City';
const LOCALE = 'es-MX';

/**
 * Returns the current timestamp in UTC ISO format for storage.
 */
function nowUtc() {
  return new Date().toISOString();
}

/**
 * Formats a date (ISO string or Date object) to DD/MM/YYYY HH:mm in CDMX timezone.
 * Returns null if input is falsy.
 */
function formatDateTimeCDMX(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  const day = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, day: '2-digit' });
  const month = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, month: '2-digit' });
  const year = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, year: 'numeric' });
  const hour = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, hour: '2-digit', hour12: false });
  const minute = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, minute: '2-digit' });

  const parts = d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const time = d.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${parts} ${time}`;
}

/**
 * Formats a date to DD/MM/YYYY only (no time) in CDMX timezone.
 */
function formatDateCDMX(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

module.exports = {
  TIMEZONE,
  LOCALE,
  nowUtc,
  formatDateTimeCDMX,
  formatDateCDMX,
};

```


================================================================================
# ARCHIVO: src/db.js
================================================================================

```javascript
'use strict';

/**
 * Punto de entrada de base de datos.
 * - Sin DATABASE_URL: SQLite (better-sqlite3) via src/db/sqliteDriver.js
 * - Con DATABASE_URL: PostgreSQL (pg) via src/db/postgresDriver.js
 *
 * Código SQLite original conservado en src/db/sqliteDriver.js (no eliminado).
 */
module.exports = require('./db/index');

```


================================================================================
# ARCHIVO: src/db/betterSqlite3Adapter.js
================================================================================

```javascript
'use strict';

const deasync = require('deasync');
const { toPositionalParams, appendReturningId } = require('./dialect');

/**
 * Adaptador que imita la API publica de better-sqlite3 (prepare/get/all/run,
 * exec, pragma, transaction) sobre un ejecutor PostgreSQL (pg Pool/Client).
 *
 * Objetivo: el resto de la app (server.js, modulos) no cambia de forma.
 */

function waitPromise(promise) {
  let done = false;
  let result;
  let error;
  promise
    .then((value) => {
      result = value;
      done = true;
    })
    .catch((err) => {
      error = err;
      done = true;
    });
  deasync.loopWhile(() => !done);
  if (error) throw error;
  return result;
}

function querySync(executor, text, params = []) {
  const sql = toPositionalParams(text);
  return waitPromise(executor.query(sql, params));
}

/**
 * Convierte argumentos estilo better-sqlite3:
 * - run(a, b, c) posicional con ?
 * - run({ col: v }) con @col en SQL
 */
function normalizeStatementArgs(sql, args) {
  if (args.length === 0) return { sql, params: [] };
  if (args.length === 1 && args[0] != null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0];
    const params = [];
    const converted = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      if (!(name in obj)) {
        throw new Error(`Parametro faltante: @${name}`);
      }
      params.push(obj[name]);
      return '?';
    });
    return { sql: converted, params };
  }
  return { sql, params: args };
}

class BetterSqlite3CompatibleStatement {
  constructor(database, sql) {
    this.database = database;
    this.originalSql = sql;
    this.sql = sql;
  }

  get(...args) {
    const { sql, params } = normalizeStatementArgs(this.originalSql, args);
    const res = querySync(this.database._executor(), sql, params);
    return res.rows[0];
  }

  all(...args) {
    const { sql, params } = normalizeStatementArgs(this.originalSql, args);
    const res = querySync(this.database._executor(), sql, params);
    return res.rows;
  }

  run(...args) {
    const { sql, params } = normalizeStatementArgs(this.originalSql, args);
    let execSql = appendReturningId(sql);
    const res = querySync(this.database._executor(), execSql, params);
    const row = res.rows && res.rows[0];
    return {
      changes: res.rowCount ?? 0,
      lastInsertRowid: row && row.id != null ? row.id : undefined,
    };
  }
}

class BetterSqlite3CompatibleDatabase {
  constructor(pool) {
    this.pool = pool;
    this._txClient = null;
    this.driver = 'postgres-adapter';
  }

  _executor() {
    return this._txClient || this.pool;
  }

  prepare(sql) {
    return new BetterSqlite3CompatibleStatement(this, sql);
  }

  exec(sql) {
    const parts = sql.split(';').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      querySync(this._executor(), part, []);
    }
  }

  pragma(_nameOrSql, _value) {
    /* SQLite PRAGMA: no-op en PostgreSQL */
  }

  /**
   * Igual que better-sqlite3: fn usa el mismo objeto db; durante fn las
   * consultas van por la conexion transaccional.
   */
  transaction(fn) {
    return (...args) => {
      const client = waitPromise(this.pool.connect());
      const prev = this._txClient;
      this._txClient = client;
      let result;
      try {
        querySync(client, 'BEGIN');
        result = fn(...args);
        querySync(client, 'COMMIT');
        return result;
      } catch (error) {
        try {
          querySync(client, 'ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        throw error;
      } finally {
        this._txClient = prev;
        client.release();
      }
    };
  }
}

/**
 * Crea instancia compatible con better-sqlite3 sobre un pg Pool.
 */
function createBetterSqlite3Adapter(pool) {
  return new BetterSqlite3CompatibleDatabase(pool);
}

module.exports = {
  createBetterSqlite3Adapter,
  BetterSqlite3CompatibleDatabase,
  BetterSqlite3CompatibleStatement,
  normalizeStatementArgs,
  waitPromise,
  querySync,
};

```


================================================================================
# ARCHIVO: src/db/commissionsFlowMigration.js
================================================================================

```javascript
'use strict';

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateCommissionsFlow(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sales_commissions'")
    .get();
  if (!table) return;

  ensureColumn(database, 'sales_commission_payments', 'commission_id', 'INTEGER');
  ensureColumn(database, 'sales_commissions', 'commission_type', "TEXT NOT NULL DEFAULT 'proyecto'");
  ensureColumn(database, 'sales_commissions', 'reference', 'TEXT');
  ensureColumn(database, 'sales_commissions', 'paid_at', 'TEXT');

  const tableSql = table.sql || '';
  const projectCol = database.prepare('PRAGMA table_info(sales_commissions)').all().find((c) => c.name === 'project_id');
  const needsRebuild =
    (projectCol && projectCol.notnull === 1)
    || (tableSql.includes('no_aplica') && !tableSql.includes('facturado_1pct'));

  if (!needsRebuild) return;

  database.exec(`
    CREATE TABLE sales_commissions_flow_tmp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      closed_project_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      commission_type TEXT NOT NULL DEFAULT 'proyecto',
      commission_calculation_base_type TEXT NOT NULL,
      commission_base_mxn REAL NOT NULL DEFAULT 0,
      total_sale_mxn_snapshot REAL,
      gross_profit_mxn_snapshot REAL,
      net_profit_mxn_snapshot REAL,
      final_margin_snapshot REAL,
      commission_percentage REAL NOT NULL DEFAULT 0,
      commission_amount_mxn REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente',
      no_apply_reason TEXT,
      notes TEXT,
      reference TEXT,
      assigned_by_user_id INTEGER,
      assigned_by_name TEXT,
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );
    INSERT INTO sales_commissions_flow_tmp (
      id, project_id, closed_project_id, sales_agent_id, commission_type,
      commission_calculation_base_type, commission_base_mxn, total_sale_mxn_snapshot,
      gross_profit_mxn_snapshot, net_profit_mxn_snapshot, final_margin_snapshot,
      commission_percentage, commission_amount_mxn, status, no_apply_reason, notes, reference,
      assigned_by_user_id, assigned_by_name, assigned_at, paid_at,
      created_at, updated_at, deleted_at, deleted_by_user_id, deleted_by_name, delete_reason
    )
    SELECT
      id, project_id, closed_project_id, sales_agent_id, 'proyecto',
      commission_calculation_base_type, commission_base_mxn, total_sale_mxn_snapshot,
      gross_profit_mxn_snapshot, net_profit_mxn_snapshot, final_margin_snapshot,
      commission_percentage, commission_amount_mxn, status, no_apply_reason, notes, NULL,
      assigned_by_user_id, assigned_by_name, assigned_at, NULL,
      created_at, updated_at, deleted_at, deleted_by_user_id, deleted_by_name, delete_reason
    FROM sales_commissions;
    DROP TABLE sales_commissions;
    ALTER TABLE sales_commissions_flow_tmp RENAME TO sales_commissions;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_project_active
      ON sales_commissions (project_id)
      WHERE deleted_at IS NULL AND status != 'cancelada' AND project_id IS NOT NULL;
  `);
}

module.exports = { migrateCommissionsFlow };

```


================================================================================
# ARCHIVO: src/db/commissionsPostgresMigration.js
================================================================================

```javascript
'use strict';

/**
 * Migraciones idempotentes de comisiones en PostgreSQL (BD creadas antes del esquema actual).
 */
function migrateCommissionsPostgres(database) {
  const alters = [
    'ALTER TABLE sales_commission_agents ADD COLUMN IF NOT EXISTS employee_id INTEGER',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS final_margin_snapshot DOUBLE PRECISION',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT \'proyecto\'',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS reference TEXT',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS paid_at TEXT',
    'ALTER TABLE sales_commission_payments ADD COLUMN IF NOT EXISTS commission_id INTEGER',
  ];
  for (const sql of alters) {
    try {
      database.exec(sql);
    } catch (_) {
      /* tabla/columna puede no existir en despliegues parciales */
    }
  }

  try {
    database.exec('ALTER TABLE sales_commissions ALTER COLUMN project_id DROP NOT NULL');
  } catch (_) {
    /* ya nullable */
  }

  try {
    database.exec(`
      UPDATE sales_commissions
      SET commission_type = 'proyecto'
      WHERE commission_type IS NULL OR btrim(commission_type) = ''
    `);
  } catch (_) {}

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sales_commission_balance_adjustments (
        id SERIAL PRIMARY KEY,
        sales_agent_id INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('saldo_inicial', 'extraordinario')),
        amount_mxn DOUBLE PRECISION NOT NULL,
        description TEXT NOT NULL,
        reference TEXT,
        created_by_user_id INTEGER,
        created_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        deleted_by_user_id INTEGER,
        deleted_by_name TEXT,
        delete_reason TEXT,
        FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
      )
    `);
  } catch (_) {}

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commission_agents_employee_active
      ON sales_commission_agents (employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_project_active
      ON sales_commissions (project_id)
      WHERE deleted_at IS NULL AND status != 'cancelada' AND project_id IS NOT NULL`,
  ];
  for (const sql of indexes) {
    try {
      database.exec(sql);
    } catch (_) {}
  }
}

module.exports = { migrateCommissionsPostgres };

```


================================================================================
# ARCHIVO: src/db/dialect.js
================================================================================

```javascript
'use strict';

const { isPostgres } = require('./mode');

function toPositionalParams(sql) {
  if (!isPostgres()) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function yearFilter(column, yearParamPlaceholder = '?') {
  if (isPostgres()) {
    return `AND EXTRACT(YEAR FROM ${column}::timestamp) = ${yearParamPlaceholder}`;
  }
  return `AND CAST(strftime('%Y', ${column}) AS INTEGER) = ${yearParamPlaceholder}`;
}

function monthFilter(column, monthParamPlaceholder = '?') {
  if (isPostgres()) {
    return `AND EXTRACT(MONTH FROM ${column}::timestamp) = ${monthParamPlaceholder}`;
  }
  return `AND CAST(strftime('%m', ${column}) AS INTEGER) = ${monthParamPlaceholder}`;
}

function distinctYearSelect(column, alias = 'year') {
  if (isPostgres()) {
    return `SELECT DISTINCT CAST(EXTRACT(YEAR FROM ${column}::timestamp) AS INTEGER) AS ${alias}`;
  }
  return `SELECT DISTINCT CAST(strftime('%Y', ${column}) AS INTEGER) AS ${alias}`;
}

/** Expresión año (SELECT/GROUP BY) para columnas TEXT fecha/hora. */
function sqlYearExpr(column) {
  if (isPostgres()) {
    return `CAST(EXTRACT(YEAR FROM ${column}::timestamp) AS INTEGER)`;
  }
  return `CAST(strftime('%Y', ${column}) AS INTEGER)`;
}

/** Expresión mes 1–12 (SELECT/GROUP BY) para columnas TEXT fecha/hora. */
function sqlMonthExpr(column) {
  if (isPostgres()) {
    return `CAST(EXTRACT(MONTH FROM ${column}::timestamp) AS INTEGER)`;
  }
  return `CAST(strftime('%m', ${column}) AS INTEGER)`;
}

function sqlDateCompareGte(column, paramPlaceholder = '?') {
  if (isPostgres()) {
    return `(${column})::date >= (${paramPlaceholder})::date`;
  }
  return `date(${column}) >= date(${paramPlaceholder})`;
}

function sqlDateCompareLte(column, paramPlaceholder = '?') {
  if (isPostgres()) {
    return `(${column})::date <= (${paramPlaceholder})::date`;
  }
  return `date(${column}) <= date(${paramPlaceholder})`;
}

const INSERT_TABLES_WITHOUT_ID = new Set([
  'exchange_rates',
  'service_quote_settings',
  'sessions',
]);

function insertTargetTable(sql) {
  const match = sql.trim().match(/^INSERT\s+INTO\s+"?(\w+)"?/i);
  return match ? match[1].toLowerCase() : null;
}

function appendReturningId(sql) {
  if (!isPostgres()) return sql;
  const trimmed = sql.trim();
  if (!/^\s*INSERT/i.test(trimmed) || /RETURNING/i.test(trimmed)) {
    return trimmed;
  }
  const table = insertTargetTable(trimmed);
  if (table && INSERT_TABLES_WITHOUT_ID.has(table)) {
    return trimmed;
  }
  return `${trimmed} RETURNING id`;
}

/** Fecha actual en SQL (columnas TEXT tipo fecha). */
function sqlCurrentDate() {
  return isPostgres() ? 'CURRENT_DATE' : "date('now')";
}

/** INTEGER/boolean flags from SQLite or PostgreSQL (pg may return "0"/"1" strings). */
function isDbTruthy(value) {
  if (value === null || value === undefined || value === false) return false;
  return Number(value) !== 0;
}

module.exports = {
  isPostgres,
  toPositionalParams,
  yearFilter,
  monthFilter,
  distinctYearSelect,
  sqlYearExpr,
  sqlMonthExpr,
  sqlDateCompareGte,
  sqlDateCompareLte,
  appendReturningId,
  sqlCurrentDate,
  isDbTruthy,
};

```


================================================================================
# ARCHIVO: src/db/index.js
================================================================================

```javascript
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

```


================================================================================
# ARCHIVO: src/db/mode.js
================================================================================

```javascript
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

```


================================================================================
# ARCHIVO: src/db/postgresDriver.js
================================================================================

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createBetterSqlite3Adapter, waitPromise } = require('./betterSqlite3Adapter');
const {
  seedAdmin,
  seedExchangeRates,
  seedAttendanceStatuses,
  seedServiceTypes,
  seedServiceQuoteSettings,
  seedRolePermissions,
  seedDefaultEmployees,
} = require('./sqliteDriver');

let pool;
let adapterInstance;

function runPostgresSchema(database) {
  const schemaPath = path.join(__dirname, 'postgresSchema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    try {
      database.exec(`${statement};`);
    } catch (error) {
      if (error.code === '42P07') continue;
      throw error;
    }
  }
}

function ensurePostgresColumns(database) {
  const alters = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'",
    'ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS include_manual_payroll INTEGER NOT NULL DEFAULT 1',
  ];
  for (const sql of alters) {
    try {
      database.exec(sql);
    } catch (_) {
      /* re-run safe */
    }
  }
  const { migrateProjectEmployeeAssignments } = require('./projectAssignmentsMigration');
  migrateProjectEmployeeAssignments(database, { postgres: true });

  const { migrateProjectFailureReports } = require('./projectFailureReportsMigration');
  migrateProjectFailureReports(database, { postgres: true });

  const { migrateProjectReportsEnhancements } = require('./projectReportsEnhancementsMigration');
  migrateProjectReportsEnhancements(database, { postgres: true });

  const { migrateCommissionsPostgres } = require('./commissionsPostgresMigration');
  migrateCommissionsPostgres(database);
}


function shouldBootstrapSchema(database) {
  if (process.env.PG_SKIP_SCHEMA === 'true') {
    return false;
  }
  const row = database.prepare(
    `SELECT COUNT(*)::int AS table_count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  ).get();
  return Number(row.table_count) === 0;
}

function shouldRunSeeds(database) {
  if (process.env.PG_SKIP_SEED === 'true') {
    return false;
  }
  const row = database.prepare('SELECT COUNT(*)::int AS user_count FROM users').get();
  return Number(row.user_count) === 0;
}

function runPostgresSeeds(database) {
  seedAdmin(database);
  seedExchangeRates(database);
  seedAttendanceStatuses(database);
  seedServiceTypes(database);
  seedServiceQuoteSettings(database);
  seedRolePermissions(database);
  seedDefaultEmployees(database);
}

function resolvePoolSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') {
    return undefined;
  }
  if (process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  const lower = String(connectionString || '').toLowerCase();
  if (
    lower.includes('sslmode=require')
    || lower.includes('ssl=true')
    || lower.includes('.render.com')
    || lower.includes('render.com')
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function createPostgresDb(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL es requerida para PostgreSQL.');
  }
  if (!adapterInstance) {
    pool = new Pool({
      connectionString,
      ssl: resolvePoolSsl(connectionString),
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_MS || 10000),
    });
    waitPromise(pool.query('SELECT 1'));
    adapterInstance = createBetterSqlite3Adapter(pool);
    if (shouldBootstrapSchema(adapterInstance)) {
          runPostgresSchema(adapterInstance);
          runPostgresSeeds(adapterInstance);
        } else if (shouldRunSeeds(adapterInstance)) {
          runPostgresSeeds(adapterInstance);
        }
        ensurePostgresColumns(adapterInstance);

  }
  return adapterInstance;
}

module.exports = {
  createPostgresDb,
};

```


================================================================================
# ARCHIVO: src/db/postgresSchema.sql
================================================================================

```sql
CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , role TEXT NOT NULL DEFAULT 'user', updated_at TEXT, created_by_user_id INTEGER, created_by_name TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, is_active INTEGER NOT NULL DEFAULT 1, locked_until TEXT, failed_login_attempts INTEGER NOT NULL DEFAULT 0, last_failed_login_at TEXT, mfa_enabled INTEGER NOT NULL DEFAULT 0, mfa_secret TEXT, mfa_verified_at TEXT);

CREATE TABLE exchange_rates (
      currency TEXT PRIMARY KEY,
      rate_to_mxn DOUBLE PRECISION NOT NULL CHECK (rate_to_mxn > 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE attendance_statuses (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      counts_as_absence INTEGER NOT NULL DEFAULT 0,
      requires_project_location INTEGER NOT NULL DEFAULT 0,
      requires_extra_payment INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

CREATE TABLE role_permissions (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE service_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      margin DOUBLE PRECISION NOT NULL CHECK (margin >= 0 AND margin < 1),
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE service_quote_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE financial_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      estimated_isr_rate DOUBLE PRECISION NOT NULL DEFAULT 0.10,
      ivan_commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0.10,
      project_income_recognition TEXT NOT NULL DEFAULT 'project_created_date',
      accounts_payable_recognition TEXT NOT NULL DEFAULT 'invoice_date',
      base_currency TEXT NOT NULL DEFAULT 'MXN',
      include_vat_in_sales INTEGER NOT NULL DEFAULT 0,
      include_pending_accounts_payable INTEGER NOT NULL DEFAULT 1,
      include_classified_bank_movements INTEGER NOT NULL DEFAULT 1,
      include_manual_payroll INTEGER NOT NULL DEFAULT 1,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE kpi_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      margin_green_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.40,
      margin_yellow_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.30,
      margin_red_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.20,
      receivable_bucket1_days INTEGER NOT NULL DEFAULT 30,
      receivable_bucket2_days INTEGER NOT NULL DEFAULT 60,
      receivable_bucket3_days INTEGER NOT NULL DEFAULT 90,
      receivable_critical_days INTEGER NOT NULL DEFAULT 120,
      report_missing_critical_days INTEGER NOT NULL DEFAULT 7,
      require_manual_quote_capture INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_by_name TEXT
    );

CREATE TABLE backup_import_logs (
      id SERIAL PRIMARY KEY,
      imported_at TEXT NOT NULL,
      imported_by TEXT NOT NULL,
      schema_version TEXT,
      backup_exported_at TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      summary_json TEXT,
      conflicts_json TEXT,
      errors_json TEXT,
      validation_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE login_attempts (
      id SERIAL PRIMARY KEY,
      user_identifier TEXT NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      attempted_at TEXT NOT NULL,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      entity_label TEXT,
      timestamp_utc TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE employees (
      id SERIAL PRIMARY KEY,
      employee_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      department TEXT,
      position TEXT,
      immediate_boss TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , termination_date TEXT, inactive_reason TEXT, created_by_user_id INTEGER, created_by_name TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, primary_department TEXT, secondary_department TEXT, kpi_eligible INTEGER NOT NULL DEFAULT 1, user_id INTEGER, kpi_area TEXT, kpi_configured_at TEXT, kpi_configured_by_user_id INTEGER, kpi_configured_by_name TEXT);

CREATE TABLE sales_commission_agents (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      employee_id INTEGER,
      related_user_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

CREATE UNIQUE INDEX idx_sales_commission_agents_employee_active ON sales_commission_agents (employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL;

CREATE TABLE ecovis_payments (
      id SERIAL PRIMARY KEY,
      payment_date TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_method TEXT,
      bank_reference TEXT,
      source_description TEXT,
      notes TEXT,
      unallocated_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER, updated_by_user_id INTEGER, exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION);

CREATE TABLE ecovis_purchase_orders (
      id SERIAL PRIMARY KEY,
      purchase_order_number TEXT NOT NULL,
      project_name TEXT,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      order_date TEXT NOT NULL,
      total_amount DOUBLE PRECISION NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagada', 'pagada', 'cancelada')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      updated_by TEXT,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION, paid_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0, pending_amount_mxn DOUBLE PRECISION, fully_paid_at TEXT, purchase_order_number_normalized TEXT);

CREATE TABLE ecovis_projects (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      quote_number TEXT,
      purchase_order_number TEXT,
      invoice_number TEXT,
      project_date TEXT NOT NULL,
      description TEXT,
      total_amount DOUBLE PRECISION NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagado', 'pagado', 'cancelado')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER, updated_by_user_id INTEGER, ecovis_purchase_order_id INTEGER, exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION, paid_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0, pending_amount_mxn DOUBLE PRECISION, fully_paid_at TEXT);

CREATE TABLE payroll_attendance_weeks (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      week_start_date TEXT NOT NULL,
      week_end_date TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrada', 'cancelada')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE bank_statement_summaries (
      id SERIAL PRIMARY KEY,
      bank_name TEXT NOT NULL,
      account_number_masked TEXT,
      currency TEXT NOT NULL DEFAULT 'MXN',
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      initial_balance_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      deposits_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawals_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_vat_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      final_balance_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      initial_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      deposits_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawals_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_vat_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      final_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      source_file_name TEXT,
      source_file_type TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE bank_statement_movements (
      id SERIAL PRIMARY KEY,
      bank_statement_summary_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT,
      reference TEXT,
      deposit_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawal_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      deposit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawal_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      balance_original DOUBLE PRECISION,
      balance_mxn DOUBLE PRECISION,
      classification_status TEXT NOT NULL DEFAULT 'sin_clasificar' CHECK (classification_status IN ('sin_clasificar', 'clasificado', 'ignorado')),
      classification_type TEXT,
      related_project_id INTEGER,
      related_account_payable_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, financial_week_of_month INTEGER,
      FOREIGN KEY (bank_statement_summary_id) REFERENCES bank_statement_summaries(id)
    );

CREATE TABLE financial_statements (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrado', 'cancelado')),
      revenue_net_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      cost_of_sales_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      gross_profit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      operating_expenses_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_administrative_profit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      estimated_isr_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      profit_after_isr_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      ivan_commission_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      real_administrative_profit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      accounts_receivable_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      accounts_payable_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_initial_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_deposits_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_withdrawals_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_final_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      unclassified_movements_count INTEGER NOT NULL DEFAULT 0,
      configuration_snapshot_json TEXT,
      data_snapshot_json TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE financial_adjustments (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ingreso', 'costo_de_venta', 'gasto_operativo', 'impuesto', 'comision_ivan', 'banco', 'otro')),
      concept TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cancelado')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE manual_payroll_expenses (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      concept TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE projects (
      id SERIAL PRIMARY KEY,
      quote_number TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      purchase_order_number TEXT,
      purchase_order_not_applicable INTEGER NOT NULL DEFAULT 0,
      seller TEXT NOT NULL,
      client_name TEXT NOT NULL,
      project_description TEXT NOT NULL DEFAULT '',
      expected_margin DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_invoiced DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_invoiced_currency TEXT NOT NULL DEFAULT 'MXN',
      progress_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      technician_name TEXT NOT NULL,
      promised_delivery_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pendiente', 'En Proceso', 'Terminado')),
      risk TEXT NOT NULL CHECK (risk IN ('Alto', 'Medio', 'Bajo')),
      observations TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER, created_by_name TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, deleted_at TEXT, deleted_by_user_id INTEGER, deleted_by_name TEXT, delete_reason TEXT, credit_days INTEGER, credit_days_na INTEGER NOT NULL DEFAULT 0, invoice_date TEXT, invoice_date_na INTEGER NOT NULL DEFAULT 0, due_date TEXT, invoice_number TEXT, lead_channel TEXT, next_commercial_action TEXT, next_commercial_action_date TEXT, lost_reason TEXT, technical_closed_at TEXT, technical_report_complete INTEGER NOT NULL DEFAULT 0, rework INTEGER NOT NULL DEFAULT 0, rework_cause TEXT, invoice_requested_at TEXT, invoice_issued_at TEXT, invoice_accepted_at TEXT, invoice_paid_at TEXT, invoice_cancelled INTEGER NOT NULL DEFAULT 0, invoice_error INTEGER NOT NULL DEFAULT 0, invoice_pending_docs INTEGER NOT NULL DEFAULT 0,       collection_contact_at TEXT, collection_notes TEXT, fecha_vencimiento TEXT, tecnico_id INTEGER, vendedor_id INTEGER, reports_archived_at TEXT, reports_archived_by_user_id INTEGER, reports_archived_by_name TEXT);

CREATE TABLE ecovis_amount_adjustments (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'purchaseOrder', 'payment', 'allocation', 'loan', 'creditBalance')),
      entity_id INTEGER NOT NULL,
      previous_amount_original DOUBLE PRECISION NOT NULL,
      previous_currency TEXT NOT NULL,
      previous_exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      previous_amount_mxn DOUBLE PRECISION NOT NULL,
      new_amount_original DOUBLE PRECISION NOT NULL,
      new_currency TEXT NOT NULL,
      new_exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      new_amount_mxn DOUBLE PRECISION NOT NULL,
      difference_mxn DOUBLE PRECISION NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      approved_by_user_id INTEGER,
      approved_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE accounts_payable (
      id SERIAL PRIMARY KEY,
      supplier_name TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      category TEXT NOT NULL DEFAULT 'Otros',
      related_project_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagada', 'cancelada')),
      paid_at TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE accounts_payable_payments (
      id SERIAL PRIMARY KEY,
      accounts_payable_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      payment_method TEXT,
      bank_movement_id INTEGER,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id),
      FOREIGN KEY (bank_movement_id) REFERENCES bank_statement_movements(id)
    );

CREATE TABLE ecovis_movements (
      id SERIAL PRIMARY KEY,
      movement_date TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('proyecto', 'pago_recibido', 'prestamo_ecovis_a_revram', 'aplicacion_a_proyecto', 'saldo_a_favor', 'devolucion', 'ajuste', 'cancelacion')),
      description TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MXN',
      direction TEXT NOT NULL CHECK (direction IN ('ecovis_debe_a_revram', 'revram_debe_a_ecovis', 'neutral')),
      reference TEXT,
      related_project_id INTEGER,
      related_payment_id INTEGER,
      payment_method TEXT,
      bank_reference TEXT,
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION, created_by_user_id INTEGER, updated_by_user_id INTEGER,
      FOREIGN KEY (related_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (related_payment_id) REFERENCES ecovis_payments(id)
    );

CREATE TABLE ecovis_payment_allocations (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      ecovis_purchase_order_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste')),
      amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER, updated_by_user_id INTEGER, updated_by TEXT, currency TEXT NOT NULL DEFAULT 'MXN', exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION,
      FOREIGN KEY (payment_id) REFERENCES ecovis_payments(id),
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (ecovis_purchase_order_id) REFERENCES ecovis_purchase_orders(id)
    );

CREATE TABLE project_payments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER, created_by_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE project_costs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'Compra',
          'Gasolina',
          'Casetas',
          'Viaticos',
          'Sueldo',
          'Materiales',
          'Hospedaje',
          'Otros'
        )
      ),
      description TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER, created_by_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE project_reports (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      report_folio TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_address TEXT,
      service_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      assigned_technicians TEXT,
      burner_model TEXT,
      equipment_model_serial TEXT,
      pumps_motors_model TEXT,
      fuel TEXT,
      voltage TEXT,
      gas_pressure_inh2o TEXT,
      liquid_fuel_pressure_psi TEXT,
      working_pressure TEXT,
      pump_amperage TEXT,
      fan_amperage TEXT,
      condensate_tank_temp_c TEXT,
      operating_output_temp_c TEXT,
      flue_gas_temp_c TEXT,
      safety_tests TEXT,
      comments TEXT,
      emissions_low_fire TEXT,
      emissions_high_fire TEXT,
      technician_name TEXT,
      plant_manager_name TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, report_type TEXT NOT NULL DEFAULT 'boiler_startup', report_data TEXT, deleted_at TEXT, deleted_by TEXT, delete_reason TEXT, created_by_user_id INTEGER, updated_by_user_id INTEGER, deleted_by_user_id INTEGER, executed_by_employee_id INTEGER, archived_at TEXT, archived_by_user_id INTEGER, archived_by_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (executed_by_employee_id) REFERENCES employees(id)
    );

CREATE TABLE project_failure_reports (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      cause TEXT NOT NULL CHECK (cause IN ('interna', 'externa')),
      problem_description TEXT NOT NULL,
      failure_responsible_employee_id INTEGER,
      solution_responsible_employee_id INTEGER NOT NULL,
      registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      archived_at TEXT,
      archived_by_user_id INTEGER,
      archived_by_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (failure_responsible_employee_id) REFERENCES employees(id),
      FOREIGN KEY (solution_responsible_employee_id) REFERENCES employees(id)
    );

CREATE TABLE sales_commissions (
      id SERIAL PRIMARY KEY,
      project_id INTEGER,
      closed_project_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      commission_type TEXT NOT NULL DEFAULT 'proyecto',
      commission_calculation_base_type TEXT NOT NULL,
      commission_base_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_sale_mxn_snapshot DOUBLE PRECISION,
      gross_profit_mxn_snapshot DOUBLE PRECISION,
      net_profit_mxn_snapshot DOUBLE PRECISION,
      final_margin_snapshot DOUBLE PRECISION,
      commission_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
      commission_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcial', 'pagada', 'no_aplica', 'cancelada')),
      no_apply_reason TEXT,
      notes TEXT,
      reference TEXT,
      assigned_by_user_id INTEGER,
      assigned_by_name TEXT,
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );

CREATE TABLE sales_commission_balance_adjustments (
      id SERIAL PRIMARY KEY,
      sales_agent_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('saldo_inicial', 'extraordinario')),
      amount_mxn DOUBLE PRECISION NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );

CREATE TABLE financial_project_omissions (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      project_id INTEGER NOT NULL,
      omit INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE kpi_manual_quote_captures (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      department TEXT NOT NULL DEFAULT 'Ventas',
      employee_id INTEGER,
      employee_name_snapshot TEXT,
      quotes_sent_count INTEGER NOT NULL DEFAULT 0,
      quoted_amount_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      quoted_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE vacation_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      requested_days INTEGER NOT NULL CHECK (requested_days > 0),
      vacation_exercise_year INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('programada', 'tomada', 'cancelada')),
      is_first_vacation_of_exercise INTEGER NOT NULL DEFAULT 0,
      include_vacation_bonus INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      authorized_by TEXT DEFAULT 'Ivan Garcia',
      hr_responsible TEXT DEFAULT 'Alejandra Gonzalez',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, creates_negative_balance INTEGER NOT NULL DEFAULT 0, negative_days_generated INTEGER NOT NULL DEFAULT 0, admin_override_reason TEXT, balance_after_request INTEGER, created_by_user_id INTEGER, updated_by_user_id INTEGER, updated_by_name TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

CREATE TABLE payroll_attendance_employees (
      id SERIAL PRIMARY KEY,
      payroll_attendance_week_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_number_snapshot TEXT NOT NULL,
      full_name_snapshot TEXT NOT NULL,
      position_snapshot TEXT,
      department_snapshot TEXT,
      monday_status TEXT NOT NULL DEFAULT 'A',
      tuesday_status TEXT NOT NULL DEFAULT 'A',
      wednesday_status TEXT NOT NULL DEFAULT 'A',
      thursday_status TEXT NOT NULL DEFAULT 'A',
      friday_status TEXT NOT NULL DEFAULT 'A',
      saturday_status TEXT NOT NULL DEFAULT 'D',
      sunday_status TEXT NOT NULL DEFAULT 'D',
      project_location_text TEXT,
      extra_payment_amount DOUBLE PRECISION,
      extra_payment_currency TEXT DEFAULT 'MXN',
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_attendance_week_id) REFERENCES payroll_attendance_weeks(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

CREATE TABLE sales_commission_payments (
      id SERIAL PRIMARY KEY,
      commission_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      payment_method TEXT,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );

CREATE TABLE user_permissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE user_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      theme_name TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE user_session_activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT,
      session_id_hash TEXT NOT NULL,
      login_at TEXT NOT NULL,
      logout_at TEXT,
      last_activity_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE TABLE sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires BIGINT NOT NULL
    );

CREATE INDEX idx_audit_logs_action ON audit_logs (action);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp_utc);

CREATE INDEX idx_audit_logs_user ON audit_logs (user_id);

CREATE INDEX idx_ecovis_amount_adjustments_entity
      ON ecovis_amount_adjustments (entity_type, entity_id);

CREATE UNIQUE INDEX idx_fin_project_omission_unique
      ON financial_project_omissions (year, month, project_id);

CREATE UNIQUE INDEX idx_financial_statements_unique
      ON financial_statements (year, month)
      WHERE status != 'cancelado' AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_kpi_manual_quotes_period
      ON kpi_manual_quote_captures (year, month, COALESCE(employee_id, -1))
      WHERE deleted_at IS NULL;

CREATE INDEX idx_login_attempts_ip ON login_attempts (ip_address);

CREATE INDEX idx_login_attempts_time ON login_attempts (attempted_at);

CREATE INDEX idx_login_attempts_user ON login_attempts (user_identifier);

CREATE INDEX idx_payroll_emp_week ON payroll_attendance_employees (payroll_attendance_week_id);

CREATE UNIQUE INDEX idx_payroll_week_unique
      ON payroll_attendance_weeks (year, week_number)
      WHERE deleted_at IS NULL AND status != 'cancelada';

CREATE UNIQUE INDEX idx_sales_commissions_project_active ON sales_commissions (project_id) WHERE deleted_at IS NULL AND status != 'cancelada' AND project_id IS NOT NULL;

CREATE INDEX idx_sessions_expires ON sessions (expires);

CREATE INDEX idx_user_sessions_active ON user_session_activities (is_active);

```


================================================================================
# ARCHIVO: src/db/projectAssignmentsMigration.js
================================================================================

```javascript
'use strict';

function ensureColumnSqlite(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateProjectEmployeeAssignments(database, { postgres = false } = {}) {
  if (postgres) {
    const alters = [
      'ALTER TABLE projects ADD COLUMN IF NOT EXISTS fecha_vencimiento TEXT',
      'ALTER TABLE projects ADD COLUMN IF NOT EXISTS tecnico_id INTEGER',
      'ALTER TABLE projects ADD COLUMN IF NOT EXISTS vendedor_id INTEGER',
    ];
    for (const sql of alters) {
      try {
        database.exec(sql);
      } catch (_) {
        /* idempotent */
      }
    }
    try {
      database.exec(`
        UPDATE projects
        SET fecha_vencimiento = to_char(created_at::date + INTERVAL '30 days', 'YYYY-MM-DD')
        WHERE fecha_vencimiento IS NULL OR btrim(fecha_vencimiento) = ''
      `);
    } catch (_) {
      /* column may not exist yet on partial deploy */
    }
    const pending = database.prepare(
      'SELECT id, technician_name, seller FROM projects WHERE tecnico_id IS NULL OR vendedor_id IS NULL',
    ).all();
    for (const project of pending) {
      if (!project.tecnico_id && project.technician_name) {
        const tech = database.prepare(
          'SELECT id FROM employees WHERE active = 1 AND lower(full_name) = lower(?) LIMIT 1',
        ).get(project.technician_name.trim());
        if (tech) {
          database.prepare('UPDATE projects SET tecnico_id = ? WHERE id = ?').run(tech.id, project.id);
        }
      }
      if (!project.vendedor_id && project.seller) {
        const vend = database.prepare(
          'SELECT id FROM employees WHERE active = 1 AND lower(full_name) = lower(?) LIMIT 1',
        ).get(project.seller.trim());
        if (vend) {
          database.prepare('UPDATE projects SET vendedor_id = ? WHERE id = ?').run(vend.id, project.id);
        }
      }
    }
    return;
  }

  ensureColumnSqlite(database, 'projects', 'fecha_vencimiento', 'TEXT');
  ensureColumnSqlite(database, 'projects', 'tecnico_id', 'INTEGER');
  ensureColumnSqlite(database, 'projects', 'vendedor_id', 'INTEGER');

  database.exec(`
    UPDATE projects
    SET fecha_vencimiento = date(created_at, '+30 days')
    WHERE fecha_vencimiento IS NULL OR trim(fecha_vencimiento) = ''
  `);

  const pending = database.prepare(
    'SELECT id, technician_name, seller, tecnico_id, vendedor_id FROM projects',
  ).all();
  for (const project of pending) {
    if (!project.tecnico_id && project.technician_name) {
      const tech = database.prepare(
        "SELECT id FROM employees WHERE active = 1 AND full_name = ? COLLATE NOCASE LIMIT 1",
      ).get(project.technician_name.trim());
      if (tech) {
        database.prepare('UPDATE projects SET tecnico_id = ? WHERE id = ?').run(tech.id, project.id);
      }
    }
    if (!project.vendedor_id && project.seller) {
      const vend = database.prepare(
        "SELECT id FROM employees WHERE active = 1 AND full_name = ? COLLATE NOCASE LIMIT 1",
      ).get(project.seller.trim());
      if (vend) {
        database.prepare('UPDATE projects SET vendedor_id = ? WHERE id = ?').run(vend.id, project.id);
      }
    }
  }
}

module.exports = {
  migrateProjectEmployeeAssignments,
};

```


================================================================================
# ARCHIVO: src/db/projectFailureReportsMigration.js
================================================================================

```javascript
'use strict';

const TABLE_SQLITE = `
  CREATE TABLE IF NOT EXISTS project_failure_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    cause TEXT NOT NULL CHECK (cause IN ('interna', 'externa')),
    problem_description TEXT NOT NULL,
    failure_responsible_employee_id INTEGER,
    solution_responsible_employee_id INTEGER NOT NULL,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    created_by_name TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (failure_responsible_employee_id) REFERENCES employees(id),
    FOREIGN KEY (solution_responsible_employee_id) REFERENCES employees(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_failure_reports_project
    ON project_failure_reports (project_id, registered_at DESC);
`;

const TABLE_POSTGRES = `
  CREATE TABLE IF NOT EXISTS project_failure_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    cause TEXT NOT NULL CHECK (cause IN ('interna', 'externa')),
    problem_description TEXT NOT NULL,
    failure_responsible_employee_id INTEGER,
    solution_responsible_employee_id INTEGER NOT NULL,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    created_by_name TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (failure_responsible_employee_id) REFERENCES employees(id),
    FOREIGN KEY (solution_responsible_employee_id) REFERENCES employees(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_failure_reports_project
    ON project_failure_reports (project_id, registered_at DESC);
`;

function migrateProjectFailureReports(database, { postgres = false } = {}) {
  database.exec(postgres ? TABLE_POSTGRES : TABLE_SQLITE);
}

module.exports = {
  migrateProjectFailureReports,
};

```


================================================================================
# ARCHIVO: src/db/projectReportsEnhancementsMigration.js
================================================================================

```javascript
'use strict';

function ensureColumnSqlite(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateProjectReportsEnhancements(database, { postgres = false } = {}) {
  const reportColumns = [
    ['executed_by_employee_id', 'INTEGER'],
    ['archived_at', 'TEXT'],
    ['archived_by_user_id', 'INTEGER'],
    ['archived_by_name', 'TEXT'],
  ];
  const failureColumns = [
    ['archived_at', 'TEXT'],
    ['archived_by_user_id', 'INTEGER'],
    ['archived_by_name', 'TEXT'],
  ];

  if (postgres) {
    for (const [name, type] of reportColumns) {
      try {
        database.exec(`ALTER TABLE project_reports ADD COLUMN IF NOT EXISTS ${name} ${type}`);
      } catch (_) {
        /* idempotent */
      }
    }
    for (const [name, type] of failureColumns) {
      try {
        database.exec(`ALTER TABLE project_failure_reports ADD COLUMN IF NOT EXISTS ${name} ${type}`);
      } catch (_) {
        /* idempotent */
      }
    }
    const projectArchiveColumns = [
      ['reports_archived_at', 'TEXT'],
      ['reports_archived_by_user_id', 'INTEGER'],
      ['reports_archived_by_name', 'TEXT'],
    ];
    for (const [name, type] of projectArchiveColumns) {
      try {
        database.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ${name} ${type}`);
      } catch (_) {
        /* idempotent */
      }
    }
    return;
  }

  for (const [name, type] of reportColumns) {
    ensureColumnSqlite(database, 'project_reports', name, type);
  }
  for (const [name, type] of failureColumns) {
    ensureColumnSqlite(database, 'project_failure_reports', name, type);
  }

  const projectArchiveColumns = [
    ['reports_archived_at', 'TEXT'],
    ['reports_archived_by_user_id', 'INTEGER'],
    ['reports_archived_by_name', 'TEXT'],
  ];
  for (const [name, type] of projectArchiveColumns) {
    ensureColumnSqlite(database, 'projects', name, type);
  }
}

module.exports = {
  migrateProjectReportsEnhancements,
};

```


================================================================================
# ARCHIVO: src/db/sqliteDriver.js
================================================================================

```javascript
// Driver SQLite (legacy). Activo sin DATABASE_URL.
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

let db;

function createSqliteDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    seedAdmin(db);
  }

  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);

    CREATE TABLE IF NOT EXISTS exchange_rates (
      currency TEXT PRIMARY KEY,
      rate_to_mxn REAL NOT NULL CHECK (rate_to_mxn > 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      purchase_order_number TEXT,
      purchase_order_not_applicable INTEGER NOT NULL DEFAULT 0,
      seller TEXT NOT NULL,
      client_name TEXT NOT NULL,
      project_description TEXT NOT NULL DEFAULT '',
      expected_margin REAL NOT NULL DEFAULT 0,
      total_invoiced REAL NOT NULL DEFAULT 0,
      total_invoiced_currency TEXT NOT NULL DEFAULT 'MXN',
      progress_percent REAL NOT NULL DEFAULT 0,
      technician_name TEXT NOT NULL,
      promised_delivery_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pendiente', 'En Proceso', 'Terminado')),
      risk TEXT NOT NULL CHECK (risk IN ('Alto', 'Medio', 'Bajo')),
      observations TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'Compra',
          'Gasolina',
          'Casetas',
          'Viaticos',
          'Sueldo',
          'Materiales',
          'Hospedaje',
          'Otros'
        )
      ),
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      report_folio TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_address TEXT,
      service_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      assigned_technicians TEXT,
      burner_model TEXT,
      equipment_model_serial TEXT,
      pumps_motors_model TEXT,
      fuel TEXT,
      voltage TEXT,
      gas_pressure_inh2o TEXT,
      liquid_fuel_pressure_psi TEXT,
      working_pressure TEXT,
      pump_amperage TEXT,
      fan_amperage TEXT,
      condensate_tank_temp_c TEXT,
      operating_output_temp_c TEXT,
      flue_gas_temp_c TEXT,
      safety_tests TEXT,
      comments TEXT,
      emissions_low_fire TEXT,
      emissions_high_fire TEXT,
      technician_name TEXT,
      plant_manager_name TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      department TEXT,
      position TEXT,
      immediate_boss TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vacation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      requested_days INTEGER NOT NULL CHECK (requested_days > 0),
      vacation_exercise_year INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('programada', 'tomada', 'cancelada')),
      is_first_vacation_of_exercise INTEGER NOT NULL DEFAULT 0,
      include_vacation_bonus INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      authorized_by TEXT DEFAULT 'Ivan Garcia',
      hr_responsible TEXT DEFAULT 'Alejandra Gonzalez',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ecovis_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      quote_number TEXT,
      purchase_order_number TEXT,
      invoice_number TEXT,
      project_date TEXT NOT NULL,
      description TEXT,
      total_amount REAL NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagado', 'pagado', 'cancelado')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecovis_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_method TEXT,
      bank_reference TEXT,
      source_description TEXT,
      notes TEXT,
      unallocated_amount REAL NOT NULL DEFAULT 0,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecovis_purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_number TEXT NOT NULL,
      project_name TEXT,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      order_date TEXT NOT NULL,
      total_amount REAL NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagada', 'pagada', 'cancelada')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      updated_by TEXT,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecovis_payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      ecovis_purchase_order_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste')),
      amount REAL NOT NULL CHECK (amount > 0),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES ecovis_payments(id),
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (ecovis_purchase_order_id) REFERENCES ecovis_purchase_orders(id)
    );

    CREATE TABLE IF NOT EXISTS ecovis_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_date TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('proyecto', 'pago_recibido', 'prestamo_ecovis_a_revram', 'aplicacion_a_proyecto', 'saldo_a_favor', 'devolucion', 'ajuste', 'cancelacion')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MXN',
      direction TEXT NOT NULL CHECK (direction IN ('ecovis_debe_a_revram', 'revram_debe_a_ecovis', 'neutral')),
      reference TEXT,
      related_project_id INTEGER,
      related_payment_id INTEGER,
      payment_method TEXT,
      bank_reference TEXT,
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (related_payment_id) REFERENCES ecovis_payments(id)
    );
  `);
  ensureColumn(database, 'projects', 'project_description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'projects', 'total_invoiced_currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'projects', 'closed_at', 'TEXT');
  ensureColumn(database, 'project_payments', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'project_costs', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'users', 'role', "TEXT NOT NULL DEFAULT 'user'");
  ensureColumn(database, 'employees', 'termination_date', 'TEXT');
  ensureColumn(database, 'employees', 'inactive_reason', 'TEXT');
  ensureColumn(database, 'vacation_requests', 'creates_negative_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'vacation_requests', 'negative_days_generated', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'vacation_requests', 'admin_override_reason', 'TEXT');
  ensureColumn(database, 'vacation_requests', 'balance_after_request', 'INTEGER');
  ensureColumn(database, 'project_reports', 'report_type', "TEXT NOT NULL DEFAULT 'boiler_startup'");
  ensureColumn(database, 'project_reports', 'report_data', 'TEXT');
  ensureColumn(database, 'project_reports', 'deleted_at', 'TEXT');
  ensureColumn(database, 'project_reports', 'deleted_by', 'TEXT');
  ensureColumn(database, 'project_reports', 'delete_reason', 'TEXT');

  // Audit columns for projects
  ensureColumn(database, 'projects', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'created_by_name', 'TEXT');
  ensureColumn(database, 'projects', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'updated_by_name', 'TEXT');
  ensureColumn(database, 'projects', 'deleted_at', 'TEXT');
  ensureColumn(database, 'projects', 'deleted_by_user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'deleted_by_name', 'TEXT');
  ensureColumn(database, 'projects', 'delete_reason', 'TEXT');

  // Audit columns for project_payments
  ensureColumn(database, 'project_payments', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_payments', 'created_by_name', 'TEXT');

  // Audit columns for project_costs
  ensureColumn(database, 'project_costs', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_costs', 'created_by_name', 'TEXT');

  // Audit columns for project_reports (created_by/updated_by already exist as TEXT username)
  ensureColumn(database, 'project_reports', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_reports', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'project_reports', 'deleted_by_user_id', 'INTEGER');

  // Audit columns for employees
  ensureColumn(database, 'employees', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'employees', 'created_by_name', 'TEXT');
  ensureColumn(database, 'employees', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'employees', 'updated_by_name', 'TEXT');

  // Audit columns for vacation_requests (created_by already exists as TEXT username)
  ensureColumn(database, 'vacation_requests', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'vacation_requests', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'vacation_requests', 'updated_by_name', 'TEXT');

  // Audit columns for ecovis_projects (created_by/updated_by already exist)
  ensureColumn(database, 'ecovis_projects', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_projects', 'updated_by_user_id', 'INTEGER');

  // Audit columns for ecovis_payments (created_by/updated_by already exist)
  ensureColumn(database, 'ecovis_payments', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_payments', 'updated_by_user_id', 'INTEGER');

  // Audit columns for ecovis_payment_allocations (created_by already exists)
  ensureColumn(database, 'ecovis_payment_allocations', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_payment_allocations', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_payment_allocations', 'updated_by', 'TEXT');
  ensureColumn(database, 'ecovis_payment_allocations', 'ecovis_purchase_order_id', 'INTEGER');

  // Link ecovis_projects to purchase orders
  ensureColumn(database, 'ecovis_projects', 'ecovis_purchase_order_id', 'INTEGER');

  // ECOVIS currency snapshot columns
  ensureColumn(database, 'ecovis_projects', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_projects', 'amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_projects', 'paid_amount_mxn', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'ecovis_projects', 'pending_amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_projects', 'fully_paid_at', 'TEXT');

  ensureColumn(database, 'ecovis_payments', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_payments', 'amount_mxn', 'REAL');

  ensureColumn(database, 'ecovis_payment_allocations', 'currency', "TEXT NOT NULL DEFAULT 'MXN'");
  ensureColumn(database, 'ecovis_payment_allocations', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_payment_allocations', 'amount_mxn', 'REAL');

  ensureColumn(database, 'ecovis_purchase_orders', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_purchase_orders', 'amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_purchase_orders', 'paid_amount_mxn', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'ecovis_purchase_orders', 'pending_amount_mxn', 'REAL');
  ensureColumn(database, 'ecovis_purchase_orders', 'fully_paid_at', 'TEXT');

  ensureColumn(database, 'ecovis_movements', 'exchange_rate_to_mxn', 'REAL NOT NULL DEFAULT 1');
  ensureColumn(database, 'ecovis_movements', 'amount_mxn', 'REAL');

  ensureColumn(database, 'ecovis_purchase_orders', 'purchase_order_number_normalized', 'TEXT');

  database.exec(`
    CREATE TABLE IF NOT EXISTS ecovis_amount_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'purchaseOrder', 'payment', 'allocation', 'loan', 'creditBalance')),
      entity_id INTEGER NOT NULL,
      previous_amount_original REAL NOT NULL,
      previous_currency TEXT NOT NULL,
      previous_exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      previous_amount_mxn REAL NOT NULL,
      new_amount_original REAL NOT NULL,
      new_currency TEXT NOT NULL,
      new_exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      new_amount_mxn REAL NOT NULL,
      difference_mxn REAL NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      approved_by_user_id INTEGER,
      approved_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ecovis_amount_adjustments_entity
      ON ecovis_amount_adjustments (entity_type, entity_id);
  `);

  migrateEcovisPurchaseOrderNormalized(database);

  // Audit columns for ecovis_movements (created_by/updated_by already exist)
  ensureColumn(database, 'ecovis_movements', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'ecovis_movements', 'updated_by_user_id', 'INTEGER');

  // Audit columns for users
  ensureColumn(database, 'users', 'updated_at', 'TEXT');
  ensureColumn(database, 'users', 'created_by_user_id', 'INTEGER');
  ensureColumn(database, 'users', 'created_by_name', 'TEXT');
  ensureColumn(database, 'users', 'updated_by_user_id', 'INTEGER');
  ensureColumn(database, 'users', 'updated_by_name', 'TEXT');

  // Security columns for users
  ensureColumn(database, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(database, 'users', 'locked_until', 'TEXT');
  ensureColumn(database, 'users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'users', 'last_failed_login_at', 'TEXT');
  ensureColumn(database, 'users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'users', 'mfa_secret', 'TEXT');
  ensureColumn(database, 'users', 'mfa_verified_at', 'TEXT');

  // Project credit/invoice fields for accounts receivable
  ensureColumn(database, 'projects', 'credit_days', 'INTEGER');
  ensureColumn(database, 'projects', 'credit_days_na', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'invoice_date', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_date_na', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'due_date', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_number', 'TEXT');

  // KPI tracking fields (Tablero KPIs Fase 1)
  ensureColumn(database, 'employees', 'primary_department', 'TEXT');
  ensureColumn(database, 'employees', 'secondary_department', 'TEXT');
  ensureColumn(database, 'employees', 'kpi_eligible', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(database, 'employees', 'user_id', 'INTEGER');
  ensureColumn(database, 'projects', 'lead_channel', 'TEXT');
  ensureColumn(database, 'projects', 'next_commercial_action', 'TEXT');
  ensureColumn(database, 'projects', 'next_commercial_action_date', 'TEXT');
  ensureColumn(database, 'projects', 'lost_reason', 'TEXT');
  ensureColumn(database, 'projects', 'technical_closed_at', 'TEXT');
  ensureColumn(database, 'projects', 'technical_report_complete', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'rework', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'rework_cause', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_requested_at', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_issued_at', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_accepted_at', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_paid_at', 'TEXT');
  ensureColumn(database, 'projects', 'invoice_cancelled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'invoice_error', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'invoice_pending_docs', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'projects', 'collection_contact_at', 'TEXT');
  ensureColumn(database, 'projects', 'collection_notes', 'TEXT');

  // Tablero KPIs Fase 2 — configuración empleados y capturas manuales
  ensureColumn(database, 'employees', 'kpi_area', 'TEXT');
  ensureColumn(database, 'employees', 'kpi_configured_at', 'TEXT');
  ensureColumn(database, 'employees', 'kpi_configured_by_user_id', 'INTEGER');
  ensureColumn(database, 'employees', 'kpi_configured_by_name', 'TEXT');

  database.exec(`
    CREATE TABLE IF NOT EXISTS kpi_manual_quote_captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      department TEXT NOT NULL DEFAULT 'Ventas',
      employee_id INTEGER,
      employee_name_snapshot TEXT,
      quotes_sent_count INTEGER NOT NULL DEFAULT 0,
      quoted_amount_original REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      quoted_amount_mxn REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_manual_quotes_period
      ON kpi_manual_quote_captures (year, month, COALESCE(employee_id, -1))
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS kpi_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      margin_green_threshold REAL NOT NULL DEFAULT 0.40,
      margin_yellow_threshold REAL NOT NULL DEFAULT 0.30,
      margin_red_threshold REAL NOT NULL DEFAULT 0.20,
      receivable_bucket1_days INTEGER NOT NULL DEFAULT 30,
      receivable_bucket2_days INTEGER NOT NULL DEFAULT 60,
      receivable_bucket3_days INTEGER NOT NULL DEFAULT 90,
      receivable_critical_days INTEGER NOT NULL DEFAULT 120,
      report_missing_critical_days INTEGER NOT NULL DEFAULT 7,
      require_manual_quote_capture INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_by_name TEXT
    );
  `);

  const kpiSettingsCount = database.prepare('SELECT COUNT(*) AS c FROM kpi_settings').get().c;
  if (kpiSettingsCount === 0) {
    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO kpi_settings (
        id, margin_green_threshold, margin_yellow_threshold, margin_red_threshold,
        receivable_bucket1_days, receivable_bucket2_days, receivable_bucket3_days,
        receivable_critical_days, report_missing_critical_days, require_manual_quote_capture,
        created_at, updated_at
      ) VALUES (1, 0.40, 0.30, 0.20, 30, 60, 90, 120, 7, 1, ?, ?)
    `).run(now, now);
  }

  // Create audit_logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      entity_label TEXT,
      timestamp_utc TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp_utc);

    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at TEXT NOT NULL,
      imported_by TEXT NOT NULL,
      schema_version TEXT,
      backup_exported_at TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      summary_json TEXT,
      conflicts_json TEXT,
      errors_json TEXT,
      validation_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_identifier TEXT NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      attempted_at TEXT NOT NULL,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts (user_identifier);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts (attempted_at);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS attendance_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      counts_as_absence INTEGER NOT NULL DEFAULT 0,
      requires_project_location INTEGER NOT NULL DEFAULT 0,
      requires_extra_payment INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payroll_attendance_weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      week_start_date TEXT NOT NULL,
      week_end_date TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrada', 'cancelada')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_week_unique
      ON payroll_attendance_weeks (year, week_number)
      WHERE deleted_at IS NULL AND status != 'cancelada';

    CREATE TABLE IF NOT EXISTS payroll_attendance_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_attendance_week_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_number_snapshot TEXT NOT NULL,
      full_name_snapshot TEXT NOT NULL,
      position_snapshot TEXT,
      department_snapshot TEXT,
      monday_status TEXT NOT NULL DEFAULT 'A',
      tuesday_status TEXT NOT NULL DEFAULT 'A',
      wednesday_status TEXT NOT NULL DEFAULT 'A',
      thursday_status TEXT NOT NULL DEFAULT 'A',
      friday_status TEXT NOT NULL DEFAULT 'A',
      saturday_status TEXT NOT NULL DEFAULT 'D',
      sunday_status TEXT NOT NULL DEFAULT 'D',
      project_location_text TEXT,
      extra_payment_amount REAL,
      extra_payment_currency TEXT DEFAULT 'MXN',
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_attendance_week_id) REFERENCES payroll_attendance_weeks(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE INDEX IF NOT EXISTS idx_payroll_emp_week ON payroll_attendance_employees (payroll_attendance_week_id);
  `);

  seedAttendanceStatuses(database);
  migrateCostCategories(database);
  migrateAllocationTypes(database);
  seedExchangeRates(database);

  // Service Quoter module tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS service_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      margin REAL NOT NULL CHECK (margin >= 0 AND margin < 1),
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_quote_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Financial Statements module tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS financial_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      estimated_isr_rate REAL NOT NULL DEFAULT 0.10,
      ivan_commission_rate REAL NOT NULL DEFAULT 0.10,
      project_income_recognition TEXT NOT NULL DEFAULT 'project_created_date',
      accounts_payable_recognition TEXT NOT NULL DEFAULT 'invoice_date',
      base_currency TEXT NOT NULL DEFAULT 'MXN',
      include_vat_in_sales INTEGER NOT NULL DEFAULT 0,
      include_pending_accounts_payable INTEGER NOT NULL DEFAULT 1,
      include_classified_bank_movements INTEGER NOT NULL DEFAULT 1,
      include_manual_payroll INTEGER NOT NULL DEFAULT 1,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO financial_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS financial_statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrado', 'cancelado')),
      revenue_net_mxn REAL NOT NULL DEFAULT 0,
      cost_of_sales_mxn REAL NOT NULL DEFAULT 0,
      gross_profit_mxn REAL NOT NULL DEFAULT 0,
      operating_expenses_mxn REAL NOT NULL DEFAULT 0,
      net_administrative_profit_mxn REAL NOT NULL DEFAULT 0,
      estimated_isr_mxn REAL NOT NULL DEFAULT 0,
      profit_after_isr_mxn REAL NOT NULL DEFAULT 0,
      ivan_commission_mxn REAL NOT NULL DEFAULT 0,
      real_administrative_profit_mxn REAL NOT NULL DEFAULT 0,
      accounts_receivable_mxn REAL NOT NULL DEFAULT 0,
      accounts_payable_mxn REAL NOT NULL DEFAULT 0,
      bank_initial_balance_mxn REAL NOT NULL DEFAULT 0,
      bank_deposits_mxn REAL NOT NULL DEFAULT 0,
      bank_withdrawals_mxn REAL NOT NULL DEFAULT 0,
      bank_final_balance_mxn REAL NOT NULL DEFAULT 0,
      unclassified_movements_count INTEGER NOT NULL DEFAULT 0,
      configuration_snapshot_json TEXT,
      data_snapshot_json TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_statements_unique
      ON financial_statements (year, month)
      WHERE status != 'cancelado' AND deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS accounts_payable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Otros',
      related_project_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagada', 'cancelada')),
      paid_at TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS bank_statement_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_name TEXT NOT NULL,
      account_number_masked TEXT,
      currency TEXT NOT NULL DEFAULT 'MXN',
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      initial_balance_original REAL NOT NULL DEFAULT 0,
      deposits_original REAL NOT NULL DEFAULT 0,
      withdrawals_original REAL NOT NULL DEFAULT 0,
      commissions_original REAL NOT NULL DEFAULT 0,
      commissions_vat_original REAL NOT NULL DEFAULT 0,
      final_balance_original REAL NOT NULL DEFAULT 0,
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      initial_balance_mxn REAL NOT NULL DEFAULT 0,
      deposits_mxn REAL NOT NULL DEFAULT 0,
      withdrawals_mxn REAL NOT NULL DEFAULT 0,
      commissions_mxn REAL NOT NULL DEFAULT 0,
      commissions_vat_mxn REAL NOT NULL DEFAULT 0,
      final_balance_mxn REAL NOT NULL DEFAULT 0,
      source_file_name TEXT,
      source_file_type TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_statement_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_statement_summary_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT,
      reference TEXT,
      deposit_original REAL NOT NULL DEFAULT 0,
      withdrawal_original REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      deposit_mxn REAL NOT NULL DEFAULT 0,
      withdrawal_mxn REAL NOT NULL DEFAULT 0,
      balance_original REAL,
      balance_mxn REAL,
      classification_status TEXT NOT NULL DEFAULT 'sin_clasificar' CHECK (classification_status IN ('sin_clasificar', 'clasificado', 'ignorado')),
      classification_type TEXT,
      related_project_id INTEGER,
      related_account_payable_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bank_statement_summary_id) REFERENCES bank_statement_summaries(id)
    );

    CREATE TABLE IF NOT EXISTS manual_payroll_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      concept TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ingreso', 'costo_de_venta', 'gasto_operativo', 'impuesto', 'comision_ivan', 'banco', 'otro')),
      concept TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cancelado')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts_payable_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accounts_payable_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      payment_method TEXT,
      bank_movement_id INTEGER,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id),
      FOREIGN KEY (bank_movement_id) REFERENCES bank_statement_movements(id)
    );

    CREATE TABLE IF NOT EXISTS financial_project_omissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      project_id INTEGER NOT NULL,
      omit INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_project_omission_unique
      ON financial_project_omissions (year, month, project_id);
  `);

  seedServiceTypes(database);
  seedServiceQuoteSettings(database);

  // Bank movement week of month (after financial tables created)
  ensureColumn(database, 'bank_statement_movements', 'financial_week_of_month', 'INTEGER');

  migrateEcovisCurrencyFields(database);

  // ===================== COMMISSIONS MODULE =====================
  database.exec(`
    CREATE TABLE IF NOT EXISTS sales_commission_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employee_id INTEGER,
      related_user_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS sales_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      closed_project_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      commission_type TEXT NOT NULL DEFAULT 'proyecto',
      commission_calculation_base_type TEXT NOT NULL,
      commission_base_mxn REAL NOT NULL DEFAULT 0,
      total_sale_mxn_snapshot REAL,
      gross_profit_mxn_snapshot REAL,
      net_profit_mxn_snapshot REAL,
      final_margin_snapshot REAL,
      commission_percentage REAL NOT NULL DEFAULT 0,
      commission_amount_mxn REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcial', 'pagada', 'no_aplica', 'cancelada')),
      no_apply_reason TEXT,
      notes TEXT,
      reference TEXT,
      assigned_by_user_id INTEGER,
      assigned_by_name TEXT,
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_project_active ON sales_commissions (project_id) WHERE deleted_at IS NULL AND status != 'cancelada' AND project_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS sales_commission_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original REAL NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn REAL NOT NULL DEFAULT 1,
      amount_mxn REAL NOT NULL,
      payment_method TEXT,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );
    CREATE TABLE IF NOT EXISTS sales_commission_balance_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_agent_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('saldo_inicial', 'extraordinario')),
      amount_mxn REAL NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commission_agents_employee_active
      ON sales_commission_agents (employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS user_session_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT,
      session_id_hash TEXT NOT NULL,
      login_at TEXT NOT NULL,
      logout_at TEXT,
      last_activity_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_session_activities (is_active);
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      theme_name TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn(database, 'sales_commission_agents', 'employee_id', 'INTEGER REFERENCES employees(id)');
  ensureColumn(database, 'sales_commissions', 'final_margin_snapshot', 'REAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS sales_commission_balance_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_agent_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('saldo_inicial', 'extraordinario')),
      amount_mxn REAL NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commission_agents_employee_active
      ON sales_commission_agents (employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL;
  `);
  seedRolePermissions(database);
  seedDefaultEmployees(database);

  const { migrateProjectEmployeeAssignments } = require('./projectAssignmentsMigration');
  migrateProjectEmployeeAssignments(database);

  const { migrateProjectFailureReports } = require('./projectFailureReportsMigration');
  migrateProjectFailureReports(database);

  const { migrateProjectReportsEnhancements } = require('./projectReportsEnhancementsMigration');
  migrateProjectReportsEnhancements(database);

  const { migrateCommissionsFlow } = require('./commissionsFlowMigration');
  migrateCommissionsFlow(database);
}

function seedDefaultEmployees(database) {
  const row = database.prepare('SELECT COUNT(*) as count FROM employees').get();
  if (row.count > 0) {
    return;
  }
  const timestamp = new Date().toISOString();
  database.prepare(
    `INSERT INTO employees (
      employee_number, full_name, hire_date, department, primary_department, active, created_at, updated_at
    ) VALUES
      ('EMP-TEC-001', 'Tecnico General', '2020-01-01', 'Tecnico', 'Tecnico', 1, ?, ?),
      ('EMP-VEN-001', 'Vendedor General', '2020-01-01', 'Ventas', 'Ventas', 1, ?, ?)`,
  ).run(timestamp, timestamp, timestamp, timestamp);
}

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateCostCategories(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_costs'")
    .get();

  if (!table || table.sql.includes("'Gasolina'")) {
    return;
  }

  database.exec(`
    PRAGMA foreign_keys = OFF;

    ALTER TABLE project_costs RENAME TO project_costs_old;

    CREATE TABLE project_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'Compra',
          'Gasolina',
          'Casetas',
          'Viaticos',
          'Sueldo',
          'Materiales',
          'Hospedaje',
          'Otros'
        )
      ),
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    INSERT INTO project_costs (
      id,
      project_id,
      category,
      description,
      amount,
      currency,
      cost_date,
      created_at
    )
    SELECT
      id,
      project_id,
      CASE category
        WHEN 'Gasto' THEN 'Otros'
        WHEN 'Salario' THEN 'Sueldo'
        ELSE category
      END,
      description,
      amount,
      currency,
      cost_date,
      created_at
    FROM project_costs_old;

    DROP TABLE project_costs_old;

    PRAGMA foreign_keys = ON;
  `);
}

function migrateAllocationTypes(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ecovis_payment_allocations'")
    .get();

  if (!table || table.sql.includes("'orden_compra'")) {
    return;
  }

  database.exec(`
    PRAGMA foreign_keys = OFF;

    ALTER TABLE ecovis_payment_allocations RENAME TO ecovis_payment_allocations_old;

    CREATE TABLE ecovis_payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      ecovis_purchase_order_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste')),
      amount REAL NOT NULL CHECK (amount > 0),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES ecovis_payments(id),
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (ecovis_purchase_order_id) REFERENCES ecovis_purchase_orders(id)
    );

    INSERT INTO ecovis_payment_allocations (
      id, payment_id, ecovis_project_id, allocation_type, amount, notes,
      is_cancelled, cancelled_at, cancelled_by, cancellation_reason,
      created_by, created_at, updated_at
    )
    SELECT
      id, payment_id, ecovis_project_id, allocation_type, amount, notes,
      is_cancelled, cancelled_at, cancelled_by, cancellation_reason,
      created_by, created_at, updated_at
    FROM ecovis_payment_allocations_old;

    DROP TABLE ecovis_payment_allocations_old;

    PRAGMA foreign_keys = ON;
  `);
}

function seedAttendanceStatuses(database) {
  const { ATTENDANCE_STATUSES } = require('../attendance');
  const stmt = database.prepare(
    `INSERT INTO attendance_statuses (code, label, color, counts_as_absence, requires_project_location, requires_extra_payment)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO NOTHING`,
  );
  for (const s of ATTENDANCE_STATUSES) {
    stmt.run(s.code, s.label, s.color, s.counts_as_absence, s.requires_project_location, s.requires_extra_payment);
  }
}

function seedExchangeRates(database) {
  const seedRate = database.prepare(
    `INSERT INTO exchange_rates (currency, rate_to_mxn)
     VALUES (?, ?)
     ON CONFLICT(currency) DO NOTHING`,
  );

  seedRate.run('MXN', 1);
  seedRate.run('USD', Number(process.env.USD_TO_MXN || 17));
  seedRate.run('EUR', Number(process.env.EUR_TO_MXN || 19));
}

function seedAdmin(database) {
  const adminUsername = process.env.ADMIN_USER || 'admin';
  const existingUser = database
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(adminUsername);

  if (existingUser) {
    if (existingUser.role !== 'admin') {
      database.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existingUser.id);
    }
    return;
  }

  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 12);
  database
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')")
    .run(adminUsername, passwordHash);
}

function seedServiceTypes(database) {
  const defaults = [
    { name: 'Emergencia', margin: 0.60, sort_order: 1 },
    { name: 'Automatización', margin: 0.60, sort_order: 2 },
    { name: 'Instalaciones', margin: 0.45, sort_order: 3 },
    { name: 'Mantenimiento Mayor', margin: 0.35, sort_order: 4 },
    { name: 'Mantenimiento Preventivo', margin: 0.30, sort_order: 5 },
    { name: 'Calentadores', margin: 0.30, sort_order: 6 },
  ];

  const stmt = database.prepare(
    `INSERT INTO service_types (name, margin, sort_order, created_by_name, created_at)
     VALUES (?, ?, ?, 'system', CURRENT_TIMESTAMP)
     ON CONFLICT(name) DO NOTHING`,
  );
  for (const st of defaults) {
    stmt.run(st.name, st.margin, st.sort_order);
  }
}

function seedServiceQuoteSettings(database) {
  const defaults = [
    { key: 'tarifa_programador_hora', value: '300', label: 'Tarifa programador ($/h)', category: 'mano_de_obra' },
    { key: 'tarifa_tecnico_hora', value: '250', label: 'Tarifa técnico ($/h)', category: 'mano_de_obra' },
    { key: 'tarifa_ayudante_hora', value: '175', label: 'Tarifa ayudante ($/h)', category: 'mano_de_obra' },
    { key: 'horas_por_dia_servicio', value: '9', label: 'Horas por día de servicio', category: 'mano_de_obra' },
    { key: 'costo_por_kilometro', value: '7.50', label: 'Costo por kilómetro ($)', category: 'transporte' },
    { key: 'hotel_default', value: '2500', label: 'Hotel por noche default ($)', category: 'viaticos' },
    { key: 'hotel_opcion_baja', value: '2000', label: 'Hotel opción baja ($)', category: 'viaticos' },
    { key: 'costo_por_comida', value: '150', label: 'Costo por comida ($)', category: 'viaticos' },
    { key: 'comidas_por_dia', value: '3', label: 'Comidas por día', category: 'viaticos' },
    { key: 'iva_final', value: '16', label: 'IVA final (%)', category: 'cotizacion' },
  ];

  const stmt = database.prepare(
    `INSERT INTO service_quote_settings (key, value, label, category, updated_by_name, updated_at)
     VALUES (?, ?, ?, ?, 'system', CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO NOTHING`,
  );
  for (const s of defaults) {
    stmt.run(s.key, s.value, s.label, s.category);
  }
}

function migrateEcovisPurchaseOrderNormalized(database) {
  const { normalizePurchaseOrderNumber } = require('../ecovis');
  const rows = database.prepare(
    'SELECT id, purchase_order_number FROM ecovis_purchase_orders WHERE purchase_order_number_normalized IS NULL OR purchase_order_number_normalized = \'\'',
  ).all();
  if (!rows.length) return;
  const update = database.prepare(
    'UPDATE ecovis_purchase_orders SET purchase_order_number_normalized = ? WHERE id = ?',
  );
  const migrate = database.transaction(() => {
    for (const row of rows) {
      update.run(normalizePurchaseOrderNumber(row.purchase_order_number), row.id);
    }
  });
  migrate();
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ecovis_po_number_active
      ON ecovis_purchase_orders (purchase_order_number_normalized)
      WHERE is_cancelled = 0 AND purchase_order_number_normalized IS NOT NULL AND purchase_order_number_normalized != '';
  `);
}

function migrateEcovisCurrencyFields(database) {
  const rates = {};
  const rateRows = database.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all();
  for (const r of rateRows) {
    rates[r.currency] = r.rate_to_mxn;
  }
  rates.MXN = 1;

  const needsMigration = database.prepare(
    'SELECT COUNT(*) as cnt FROM ecovis_projects WHERE amount_mxn IS NULL',
  ).get().cnt;
  if (needsMigration === 0) return;

  const migrateAll = database.transaction(() => {
    const projects = database.prepare('SELECT id, total_amount, currency, exchange_rate_to_mxn FROM ecovis_projects WHERE amount_mxn IS NULL').all();
    for (const p of projects) {
      const cur = p.currency || 'MXN';
      const rate = p.exchange_rate_to_mxn && p.exchange_rate_to_mxn !== 1 ? p.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(p.total_amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_projects SET exchange_rate_to_mxn = ?, amount_mxn = ?, pending_amount_mxn = amount_mxn - paid_amount_mxn WHERE id = ?').run(rate, amountMxn, p.id);
    }

    const payments = database.prepare('SELECT id, amount, currency, exchange_rate_to_mxn FROM ecovis_payments WHERE amount_mxn IS NULL').all();
    for (const p of payments) {
      const cur = p.currency || 'MXN';
      const rate = p.exchange_rate_to_mxn && p.exchange_rate_to_mxn !== 1 ? p.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(p.amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_payments SET exchange_rate_to_mxn = ?, amount_mxn = ? WHERE id = ?').run(rate, amountMxn, p.id);
    }

    const allocations = database.prepare('SELECT a.id, a.amount, a.exchange_rate_to_mxn, p.currency FROM ecovis_payment_allocations a JOIN ecovis_payments p ON p.id = a.payment_id WHERE a.amount_mxn IS NULL').all();
    for (const a of allocations) {
      const cur = a.currency || 'MXN';
      const rate = a.exchange_rate_to_mxn && a.exchange_rate_to_mxn !== 1 ? a.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(a.amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_payment_allocations SET currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ? WHERE id = ?').run(cur, rate, amountMxn, a.id);
    }

    const pos = database.prepare('SELECT id, total_amount, currency, exchange_rate_to_mxn FROM ecovis_purchase_orders WHERE amount_mxn IS NULL').all();
    for (const po of pos) {
      const cur = po.currency || 'MXN';
      const rate = po.exchange_rate_to_mxn && po.exchange_rate_to_mxn !== 1 ? po.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(po.total_amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_purchase_orders SET exchange_rate_to_mxn = ?, amount_mxn = ?, pending_amount_mxn = amount_mxn - paid_amount_mxn WHERE id = ?').run(rate, amountMxn, po.id);
    }

    const movements = database.prepare('SELECT id, amount, currency, exchange_rate_to_mxn FROM ecovis_movements WHERE amount_mxn IS NULL').all();
    for (const m of movements) {
      const cur = m.currency || 'MXN';
      const rate = m.exchange_rate_to_mxn && m.exchange_rate_to_mxn !== 1 ? m.exchange_rate_to_mxn : (rates[cur] || 1);
      const amountMxn = Math.round((Number(m.amount) * rate + Number.EPSILON) * 100) / 100;
      database.prepare('UPDATE ecovis_movements SET exchange_rate_to_mxn = ?, amount_mxn = ? WHERE id = ?').run(rate, amountMxn, m.id);
    }

    // Recalculate paid/pending amounts for projects using MXN values
    const allProjects = database.prepare('SELECT id, amount_mxn FROM ecovis_projects WHERE is_cancelled = 0').all();
    for (const p of allProjects) {
      const paidMxn = database.prepare(
        'SELECT COALESCE(SUM(amount_mxn), 0) as total FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = \'proyecto\' AND is_cancelled = 0',
      ).get(p.id).total;
      const pendingMxn = Math.round(((p.amount_mxn || 0) - paidMxn + Number.EPSILON) * 100) / 100;
      const fullyPaid = pendingMxn <= 0.01 && paidMxn > 0 ? database.prepare(
        'SELECT MAX(created_at) as last_alloc FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = \'proyecto\' AND is_cancelled = 0',
      ).get(p.id).last_alloc : null;
      database.prepare('UPDATE ecovis_projects SET paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ? WHERE id = ?').run(
        Math.round((paidMxn + Number.EPSILON) * 100) / 100, Math.max(0, pendingMxn), fullyPaid, p.id,
      );
    }

    // Recalculate paid/pending amounts for purchase orders
    const allPOs = database.prepare('SELECT id, amount_mxn FROM ecovis_purchase_orders WHERE is_cancelled = 0').all();
    for (const po of allPOs) {
      const paidMxn = database.prepare(
        'SELECT COALESCE(SUM(amount_mxn), 0) as total FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = \'orden_compra\' AND is_cancelled = 0',
      ).get(po.id).total;
      const pendingMxn = Math.round(((po.amount_mxn || 0) - paidMxn + Number.EPSILON) * 100) / 100;
      const fullyPaid = pendingMxn <= 0.01 && paidMxn > 0 ? database.prepare(
        'SELECT MAX(created_at) as last_alloc FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = \'orden_compra\' AND is_cancelled = 0',
      ).get(po.id).last_alloc : null;
      database.prepare('UPDATE ecovis_purchase_orders SET paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ? WHERE id = ?').run(
        Math.round((paidMxn + Number.EPSILON) * 100) / 100, Math.max(0, pendingMxn), fullyPaid, po.id,
      );
    }
  });

  migrateAll();
}

function seedRolePermissions(database) {
  const { DEFAULT_PERMISSIONS } = require('../permissions');
  const stmt = database.prepare(
    `INSERT INTO role_permissions (role, permissions_json)
     VALUES (?, ?)
     ON CONFLICT(role) DO NOTHING`,
  );
  for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
    stmt.run(role, JSON.stringify(perms));
  }
}

module.exports = {
  createSqliteDb,
  migrate,
  seedAdmin,
  seedExchangeRates,
  seedAttendanceStatuses,
  seedServiceTypes,
  seedServiceQuoteSettings,
  seedRolePermissions,
  seedDefaultEmployees,
};

```


================================================================================
# ARCHIVO: src/ecovis.js
================================================================================

```javascript
function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Normaliza número de OC: trim, mayúsculas, espacios colapsados. */
function normalizePurchaseOrderNumber(value) {
  if (value == null || value === '') return '';
  return String(value).trim().replace(/\s+/g, ' ').toUpperCase();
}

function amountsDiffer(a, b, tolerance = 0.005) {
  return Math.abs(Number(a || 0) - Number(b || 0)) > tolerance;
}

function convertToMXN(amount, currency, exchangeRates) {
  const cur = currency || 'MXN';
  const rate = exchangeRates[cur];
  if (rate === undefined || rate === null) {
    return roundMoney(Number(amount || 0));
  }
  return roundMoney(Number(amount || 0) * Number(rate));
}

function calculateProjectPaidAmount(allocations) {
  return roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );
}

function calculateProjectPaidAmountMXN(allocations) {
  return roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
}

function calculateProjectStatus(project, paidAmountMxn) {
  if (project.is_cancelled) {
    return 'cancelado';
  }

  const totalMxn = Number(project.amount_mxn || project.total_amount || 0);
  if (totalMxn <= 0) {
    return 'pendiente';
  }

  if (paidAmountMxn >= totalMxn - 0.01) {
    return 'pagado';
  }

  if (paidAmountMxn > 0) {
    return 'parcialmente_pagado';
  }

  return 'pendiente';
}

function calculateEcovisProjectPaymentStatus(project, allocations) {
  const paidAmountMxn = calculateProjectPaidAmountMXN(allocations);
  const totalMxn = Number(project.amount_mxn || project.total_amount || 0);
  const pendingMxn = roundMoney(Math.max(0, totalMxn - paidAmountMxn));
  const isFullyPaid = paidAmountMxn >= totalMxn - 0.01 && paidAmountMxn > 0;
  const status = calculateProjectStatus(project, paidAmountMxn);

  return {
    total_amount_mxn: roundMoney(totalMxn),
    paid_amount_mxn: paidAmountMxn,
    pending_amount_mxn: pendingMxn,
    is_fully_paid: isFullyPaid,
    status,
  };
}

function calculatePaymentUnallocated(payment, allocations) {
  const totalAllocated = roundMoney(
    allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );
  return roundMoney(Number(payment.amount || 0) - totalAllocated);
}

function calculatePaymentUnallocatedMXN(payment, allocations) {
  const totalAllocatedMxn = roundMoney(
    allocations.reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  const paymentMxn = Number(payment.amount_mxn || payment.amount || 0);
  return roundMoney(paymentMxn - totalAllocatedMxn);
}

function calculateEcovisAccountSummary(projects, payments, allocations, movements) {
  const activeProjects = projects.filter((p) => !p.is_cancelled);
  const activeNonPaid = activeProjects.filter((p) => {
    const pendingMxn = Number(p.pending_amount_mxn ?? p.amount_mxn ?? p.total_amount ?? 0);
    const paidMxn = Number(p.paid_amount_mxn ?? 0);
    return pendingMxn > 0.01 || paidMxn === 0;
  });

  const totalProjected = roundMoney(
    activeProjects.reduce((sum, p) => sum + Number(p.amount_mxn || p.total_amount || 0), 0),
  );

  const totalPaidToProjects = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );

  const totalPaymentsReceived = roundMoney(
    payments
      .filter((p) => !p.is_cancelled)
      .reduce((sum, p) => sum + Number(p.amount_mxn || p.amount || 0), 0),
  );

  const totalAllocated = roundMoney(
    allocations
      .filter((a) => !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );

  const creditBalance = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'saldo_a_favor' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );

  const totalLoans = roundMoney(
    movements
      .filter((m) => m.movement_type === 'prestamo_ecovis_a_revram' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );

  const totalRepayments = roundMoney(
    movements
      .filter((m) => m.movement_type === 'devolucion' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );

  const pendingProjectAmount = roundMoney(totalProjected - totalPaidToProjects);

  const creditFromMovements = roundMoney(
    movements
      .filter((m) => m.movement_type === 'saldo_a_favor' && m.direction === 'ecovis_debe_a_revram' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );

  const availableCredit = roundMoney(creditBalance - creditFromMovements);

  const adjustments = roundMoney(
    movements
      .filter((m) => m.movement_type === 'ajuste' && !m.is_cancelled)
      .reduce((sum, m) => {
        const amt = Number(m.amount_mxn || m.amount || 0);
        if (m.direction === 'ecovis_debe_a_revram') {
          return sum + amt;
        }
        if (m.direction === 'revram_debe_a_ecovis') {
          return sum - amt;
        }
        return sum;
      }, 0),
  );

  const ecovisDebt = roundMoney(pendingProjectAmount + adjustments);
  const revramDebt = roundMoney(totalLoans - totalRepayments);
  const netBalance = roundMoney(ecovisDebt - revramDebt);

  const activeProjectsTotalMxn = roundMoney(
    activeNonPaid.reduce((sum, p) => sum + Number(p.amount_mxn || p.total_amount || 0), 0),
  );
  const activeProjectsPaidMxn = roundMoney(
    activeNonPaid.reduce((sum, p) => sum + Number(p.paid_amount_mxn || 0), 0),
  );
  const activeProjectsPendingMxn = roundMoney(activeProjectsTotalMxn - activeProjectsPaidMxn);

  return {
    total_projected: totalProjected,
    total_paid_to_projects: totalPaidToProjects,
    pending_project_amount: pendingProjectAmount,
    total_payments_received: totalPaymentsReceived,
    total_allocated: totalAllocated,
    credit_balance: availableCredit,
    total_loans: totalLoans,
    total_repayments: totalRepayments,
    outstanding_loans: revramDebt,
    adjustments,
    ecovis_owes_revram: ecovisDebt,
    revram_owes_ecovis: revramDebt,
    net_balance: netBalance,
    active_projects: activeNonPaid.length,
    total_projects: projects.length,
    active_projects_total_mxn: activeProjectsTotalMxn,
    active_projects_paid_mxn: activeProjectsPaidMxn,
    active_projects_pending_mxn: activeProjectsPendingMxn,
  };
}

function calculatePurchaseOrderBalance(purchaseOrder, allocations) {
  const totalAmountMxn = Number(purchaseOrder.amount_mxn || purchaseOrder.total_amount || 0);
  const totalAppliedMxn = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'orden_compra' && a.ecovis_purchase_order_id === purchaseOrder.id && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  const pendingBalance = roundMoney(Math.max(0, totalAmountMxn - totalAppliedMxn));

  let status = purchaseOrder.status;
  if (!purchaseOrder.is_cancelled) {
    if (totalAppliedMxn <= 0) status = 'pendiente';
    else if (pendingBalance <= 0.01) status = 'pagada';
    else status = 'parcialmente_pagada';
  } else {
    status = 'cancelada';
  }

  return {
    purchase_order_number: purchaseOrder.purchase_order_number,
    total_amount: Number(purchaseOrder.total_amount || 0),
    total_amount_mxn: totalAmountMxn,
    total_applied_payments: totalAppliedMxn,
    pending_balance: pendingBalance,
    status,
  };
}

function calculateEcovisProjectBalance(project, allocations) {
  return calculateEcovisProjectPaymentStatus(project, allocations);
}

function calculateEcovisPurchaseOrderBalance(purchaseOrder, allocations) {
  return calculatePurchaseOrderBalance(purchaseOrder, allocations);
}

function calculateEcovisPaymentUnallocatedAmount(payment, allocations) {
  return {
    unallocated_amount: calculatePaymentUnallocated(payment, allocations),
    unallocated_amount_mxn: calculatePaymentUnallocatedMXN(payment, allocations),
  };
}

function calculateEcovisCreditBalance(allocations, movements) {
  const creditBalance = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'saldo_a_favor' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  const creditFromMovements = roundMoney(
    movements
      .filter((m) => m.movement_type === 'saldo_a_favor' && m.direction === 'ecovis_debe_a_revram' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );
  return roundMoney(creditBalance - creditFromMovements);
}

module.exports = {
  calculateEcovisAccountSummary,
  calculateEcovisProjectPaymentStatus,
  calculateEcovisProjectBalance,
  calculateEcovisPurchaseOrderBalance,
  calculateEcovisPaymentUnallocatedAmount,
  calculateEcovisCreditBalance,
  calculateProjectPaidAmount,
  calculateProjectPaidAmountMXN,
  calculateProjectStatus,
  calculatePaymentUnallocated,
  calculatePaymentUnallocatedMXN,
  calculatePurchaseOrderBalance,
  convertToMXN,
  normalizePurchaseOrderNumber,
  amountsDiffer,
  roundMoney,
};

```


================================================================================
# ARCHIVO: src/financial.js
================================================================================

```javascript
'use strict';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function convertToMXN(amount, currency, exchangeRateToMXN) {
  if (!amount) return 0;
  const rate = currency === 'MXN' ? 1 : Number(exchangeRateToMXN || 1);
  return roundMoney(Number(amount) * rate);
}

function getFinancialWeekOfMonth(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayOfMonth = d.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function calculateFinancialStatement(data, settings) {
  const {
    projects = [],
    projectCosts = [],
    accountsPayable = [],
    bankMovements = [],
    manualPayroll = [],
    adjustments = [],
    omittedProjectIds = [],
  } = data;

  const isrRate = Number(settings.estimated_isr_rate || 0.10);
  const ivanRate = Number(settings.ivan_commission_rate || 0.10);

  // Filter out omitted projects
  const includedProjects = projects.filter((p) => !omittedProjectIds.includes(p.id));

  // Revenue: sum of included project amounts in MXN
  const revenueNetMXN = roundMoney(
    includedProjects.reduce((sum, p) => {
      const mxn = Number(p.amount_mxn || p.total_invoiced_mxn || p.total_invoiced || 0);
      return sum + mxn;
    }, 0),
  );

  // Cost of sales: direct project costs (for included projects only) + AP direct + bank egress to projects
  const includedProjectIds = new Set(includedProjects.map((p) => p.id));
  const directProjectCosts = roundMoney(
    projectCosts
      .filter((c) => !c.project_id || includedProjectIds.has(c.project_id))
      .reduce((sum, c) => sum + convertToMXN(c.amount, c.currency, c.exchange_rate_to_mxn || 1), 0),
  );

  const directCostCategories = ['Compra de materiales', 'Refacciones', 'Herramientas', 'Servicios externos', 'Fletes', 'Aduanales'];
  const apDirectCosts = roundMoney(
    accountsPayable
      .filter((ap) => directCostCategories.includes(ap.category) || ap.related_project_id)
      .reduce((sum, ap) => sum + Number(ap.amount_mxn || 0), 0),
  );

  const bankEgressToProjects = roundMoney(
    bankMovements
      .filter((m) => m.classification_status === 'clasificado' && m.classification_type === 'egreso_proyecto' && m.withdrawal_mxn > 0 && !m.related_account_payable_id)
      .reduce((sum, m) => sum + Number(m.withdrawal_mxn || 0), 0),
  );

  const costAdjustments = roundMoney(
    adjustments
      .filter((a) => a.adjustment_type === 'costo_de_venta' && a.status === 'activo')
      .reduce((sum, a) => sum + Number(a.amount_mxn || 0), 0),
  );

  const costOfSalesMXN = roundMoney(directProjectCosts + apDirectCosts + bankEgressToProjects + costAdjustments);

  // Gross profit
  const grossProfitMXN = roundMoney(revenueNetMXN - costOfSalesMXN);

  // Operating expenses
  const payrollTotal = roundMoney(
    manualPayroll.reduce((sum, p) => sum + Number(p.amount_mxn || 0), 0),
  );

  const operatingCategories = ['Hotel', 'Vuelos', 'Gasolina', 'Vehículo', 'Renta', 'Servicios', 'Nómina', 'Impuestos', 'Gastos bancarios', 'Otros'];
  const apOperating = roundMoney(
    accountsPayable
      .filter((ap) => operatingCategories.includes(ap.category) && !ap.related_project_id)
      .reduce((sum, ap) => sum + Number(ap.amount_mxn || 0), 0),
  );

  const bankOperatingExpenses = roundMoney(
    bankMovements
      .filter((m) => m.classification_status === 'clasificado' && ['nomina', 'gasto_operativo', 'gasto_bancario', 'impuesto'].includes(m.classification_type) && !m.related_account_payable_id)
      .reduce((sum, m) => sum + Number(m.withdrawal_mxn || 0), 0),
  );

  const expenseAdjustments = roundMoney(
    adjustments
      .filter((a) => a.adjustment_type === 'gasto_operativo' && a.status === 'activo')
      .reduce((sum, a) => sum + Number(a.amount_mxn || 0), 0),
  );

  const operatingExpensesMXN = roundMoney(payrollTotal + apOperating + bankOperatingExpenses + expenseAdjustments);

  // Net administrative profit
  const netAdministrativeProfitMXN = roundMoney(grossProfitMXN - operatingExpensesMXN);

  // ISR estimated
  const estimatedISRMXN = netAdministrativeProfitMXN > 0 ? roundMoney(netAdministrativeProfitMXN * isrRate) : 0;

  // Profit after ISR
  const profitAfterISRMXN = roundMoney(netAdministrativeProfitMXN - estimatedISRMXN);

  // Ivan commission
  const ivanCommissionMXN = profitAfterISRMXN > 0 ? roundMoney(profitAfterISRMXN * ivanRate) : 0;

  // Real administrative profit
  const realAdministrativeProfitMXN = roundMoney(profitAfterISRMXN - ivanCommissionMXN);

  // Bank summary
  const bankInitialBalanceMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.initial_balance_mxn || 0), 0),
  );
  const bankDepositsMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.deposits_mxn || 0), 0),
  );
  const bankWithdrawalsMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.withdrawals_mxn || 0), 0),
  );
  const bankFinalBalanceMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.final_balance_mxn || 0), 0),
  );

  // Unclassified movements count
  const unclassifiedCount = bankMovements.filter((m) => m.classification_status === 'sin_clasificar').length;

  // Accounts receivable (from project pending collection)
  const accountsReceivableMXN = roundMoney(
    (data.accountsReceivable || []).reduce((sum, ar) => sum + Number(ar.pending_mxn || 0), 0),
  );

  // Accounts payable total (pending only)
  const accountsPayableMXN = roundMoney(
    accountsPayable
      .filter((ap) => ap.status === 'pendiente')
      .reduce((sum, ap) => sum + Number(ap.amount_mxn || 0), 0),
  );

  // Income adjustments
  const incomeAdjustments = roundMoney(
    adjustments
      .filter((a) => a.adjustment_type === 'ingreso' && a.status === 'activo')
      .reduce((sum, a) => sum + Number(a.amount_mxn || 0), 0),
  );

  const finalRevenue = roundMoney(revenueNetMXN + incomeAdjustments);
  const finalGross = roundMoney(finalRevenue - costOfSalesMXN);
  const finalNet = roundMoney(finalGross - operatingExpensesMXN);
  const finalISR = finalNet > 0 ? roundMoney(finalNet * isrRate) : 0;
  const finalAfterISR = roundMoney(finalNet - finalISR);
  const finalIvan = finalAfterISR > 0 ? roundMoney(finalAfterISR * ivanRate) : 0;
  const finalReal = roundMoney(finalAfterISR - finalIvan);

  return {
    revenue_net_mxn: finalRevenue,
    cost_of_sales_mxn: costOfSalesMXN,
    gross_profit_mxn: finalGross,
    operating_expenses_mxn: operatingExpensesMXN,
    net_administrative_profit_mxn: finalNet,
    estimated_isr_mxn: finalISR,
    profit_after_isr_mxn: finalAfterISR,
    ivan_commission_mxn: finalIvan,
    real_administrative_profit_mxn: finalReal,
    accounts_receivable_mxn: accountsReceivableMXN,
    accounts_payable_mxn: accountsPayableMXN,
    bank_initial_balance_mxn: bankInitialBalanceMXN,
    bank_deposits_mxn: bankDepositsMXN,
    bank_withdrawals_mxn: bankWithdrawalsMXN,
    bank_final_balance_mxn: bankFinalBalanceMXN,
    unclassified_movements_count: unclassifiedCount,
  };
}

const AP_CATEGORIES = [
  'Compra de materiales',
  'Refacciones',
  'Herramientas',
  'Servicios externos',
  'Fletes',
  'Aduanales',
  'Hotel',
  'Vuelos',
  'Gasolina',
  'Vehículo',
  'Renta',
  'Servicios',
  'Nómina',
  'Impuestos',
  'Gastos bancarios',
  'Otros',
];

const CLASSIFICATION_TYPES = [
  'ingreso_proyecto',
  'egreso_proyecto',
  'nomina',
  'proveedor_cxp',
  'gasto_operativo',
  'gasto_bancario',
  'impuesto',
  'traspaso',
  'saldo_a_favor',
  'prestamo',
  'ajuste',
  'ignorar',
];

const ADJUSTMENT_TYPES = [
  'ingreso',
  'costo_de_venta',
  'gasto_operativo',
  'impuesto',
  'comision_ivan',
  'banco',
  'otro',
];

module.exports = {
  calculateFinancialStatement,
  convertToMXN,
  getFinancialWeekOfMonth,
  roundMoney,
  AP_CATEGORIES,
  CLASSIFICATION_TYPES,
  ADJUSTMENT_TYPES,
};

```


================================================================================
# ARCHIVO: src/kpis.js
================================================================================

```javascript
'use strict';

const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { isDbTruthy } = require('./db/dialect');
const { TIMEZONE } = require('./dateHelper');
const { getEmpleadosActivos } = require('./vacations');

const KPI_DEPARTMENTS = ['Ventas', 'Técnico', 'Cobranza', 'Facturación'];

const LEAD_CHANNELS = [
  'WhatsApp', 'Correo', 'Teléfono', 'Técnico', 'Cliente recurrente',
  'Visita proactiva', 'Dirección', 'Web', 'Referido', 'Otro',
];

const REWORK_CAUSES = [
  'error técnico', 'mala selección', 'material incorrecto',
  'información incompleta del cliente', 'alcance mal definido',
  'falla de proveedor', 'falta de herramienta', 'falta de supervisión',
  'error de programación', 'otro',
];

const MARGIN_MIN = 0.30;
const MARGIN_TARGET = 0.40;

/** Semáforo vendedor Ventas: brecha margen real − deseado (puntos %). Documentado aquí; sin kpi_settings aún. */
const VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW = -5;

const UNAVAILABLE = 'Dato no disponible';
const NOT_CAPTURED = 'Dato no capturado';

function formatCurrencyMXN(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentDisplay(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Number(value)}%`;
}

const CURRENCY_KPI_KEYS = /(_mxn$|^quoted_amount|^sold_amount|^invoiced_amount|^collected_amount|^overdue_amount|^quoted_amount_mxn)/i;
const PERCENT_KPI_KEYS = /(rate|margin|portfolio|compliance|evidence|percent)/i;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getCdmxDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getPeriodRange(periodType, startDate, endDate) {
  const { year, month } = getCdmxDateParts(new Date());

  switch (periodType) {
    case 'previous_month': {
      let y = year;
      let m = month - 1;
      if (m < 1) { m = 12; y -= 1; }
      return {
        startDate: formatDate(y, m, 1),
        endDate: formatDate(y, m, lastDayOfMonth(y, m)),
        label: `Mes anterior (${pad2(m)}/${y})`,
      };
    }
    case 'current_quarter': {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      const qEndMonth = qStart + 2;
      return {
        startDate: formatDate(year, qStart, 1),
        endDate: formatDate(year, qEndMonth, lastDayOfMonth(year, qEndMonth)),
        label: `Trimestre actual (${year})`,
      };
    }
    case 'current_year':
      return {
        startDate: formatDate(year, 1, 1),
        endDate: formatDate(year, 12, 31),
        label: `Año actual (${year})`,
      };
    case 'custom':
      if (!startDate || !endDate) {
        throw new Error('Rango personalizado requiere startDate y endDate.');
      }
      if (startDate > endDate) {
        throw new Error('La fecha inicial no puede ser posterior a la final.');
      }
      return { startDate, endDate, label: `${startDate} a ${endDate}` };
    case 'current_month':
    default:
      return {
        startDate: formatDate(year, month, 1),
        endDate: formatDate(year, month, lastDayOfMonth(year, month)),
        label: `Mes actual (${pad2(month)}/${year})`,
      };
  }
}

function extractDate(value) {
  if (!value) return null;
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : null;
}

function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr) return false;
  const d = extractDate(dateStr);
  return d >= startDate && d <= endDate;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeProjectStatus(status) {
  const s = normalizeText(status);
  if (['pendiente'].includes(s)) return 'pendiente';
  if (['en proceso', 'en_proceso'].includes(s)) return 'en_proceso';
  if (['terminado'].includes(s)) return 'terminado';
  if (['cerrado'].includes(s)) return 'cerrado';
  if (['cancelado'].includes(s)) return 'cancelado';
  return s || 'pendiente';
}

function normalizeCollectionStatus(project, totals) {
  const pending = totals?.pending_collection ?? 0;
  const charged = totals?.total_charged ?? 0;
  if (pending <= 0.01 && charged > 0) return 'pagado';
  if (charged > 0 && pending > 0.01) return 'parcial';
  const dueDate = project.due_date;
  if (dueDate) {
    const today = extractDate(new Date().toISOString());
    if (today > dueDate) return 'vencido';
  }
  return 'pendiente';
}

function normalizeReportStatus(report, isComplete) {
  if (report?.archived_at) return 'archivado';
  if (report?.deleted_at) return 'eliminado';
  if (isComplete) return 'completo';
  return 'pendiente';
}

function normalizeQuoteStatus(project) {
  if (project.deleted_at) return 'cancelada';
  if (project.closed_at) return 'ganada';
  const s = normalizeProjectStatus(project.status);
  if (s === 'cancelado') return 'cancelada';
  if (s === 'terminado' || s === 'cerrado') return 'ganada';
  return 'enviada';
}

function normalizeDepartment(dept) {
  if (!dept) return null;
  const d = normalizeText(dept);
  if (d === 'ventas') return 'Ventas';
  if (d === 'tecnico') return 'Técnico';
  if (d === 'cobranza') return 'Cobranza';
  if (d === 'facturacion') return 'Facturación';
  return null;
}

function normalizeKpiArea(area) {
  if (!area) return null;
  const d = normalizeText(area);
  if (d === 'ventas') return 'Ventas';
  if (d === 'tecnico' || d === 'tecnico') return 'Técnico';
  if (d === 'sin asignar' || d === 'sin_asignar') return null;
  return normalizeDepartment(area);
}

function mapKpiEmployee(row) {
  const area = row.kpi_area || row.primary_department || row.department || null;
  const primary = area;
  const kpiDept = normalizeKpiArea(area);
  return {
    employeeId: row.id,
    fullName: row.full_name,
    active: !!row.active,
    department: row.department,
    position: row.position,
    userId: row.user_id || null,
    primaryDepartment: primary,
    secondaryDepartment: row.secondary_department || null,
    kpiDepartment: kpiDept,
    kpiArea: row.kpi_area || null,
    kpiEligible: isDbTruthy(row.kpi_eligible),
  };
}

function loadActiveKpiEmployees(db) {
  const rows = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY full_name').all();
  return rows
    .map(mapKpiEmployee)
    .filter((e) => e.kpiEligible);
}

function getExchangeRateMap(db) {
  const rates = { MXN: 1 };
  db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all()
    .forEach((r) => { rates[r.currency] = Number(r.rate_to_mxn); });
  return rates;
}

function loadProjectsWithTotals(db, exchangeRates) {
  const projects = db.prepare(
    'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY id',
  ).all();
  return projects.map((p) => {
    const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ?').all(p.id);
    const costs = db.prepare('SELECT * FROM project_costs WHERE project_id = ?').all(p.id);
    const totals = buildProjectTotals(p, payments, costs, exchangeRates);
    return { ...p, totals, payments, costs };
  });
}

function safeRatio(numerator, denominator) {
  if (!denominator || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? roundMoney(result) : null;
}

function safePercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return roundMoney(value * 100);
}

function kpiValue(value, options = {}) {
  const opts = typeof options === 'boolean' ? { unavailable: options } : options;
  const {
    unavailable = false,
    notCaptured = false,
    type = null,
    key = null,
    hasData = undefined,
  } = opts;
  if (unavailable) {
    return { value: null, display: UNAVAILABLE, available: false, not_captured: false, has_data: false };
  }
  if (notCaptured) {
    return { value: null, display: NOT_CAPTURED, available: false, not_captured: true, has_data: false };
  }
  if (value === null || value === undefined) {
    return { value: null, display: '—', available: true, not_captured: false, has_data: false };
  }
  let display = String(value);
  const resolvedType = type || (key && CURRENCY_KPI_KEYS.test(key) ? 'currency' : (key && PERCENT_KPI_KEYS.test(key) ? 'percent' : null));
  if (resolvedType === 'currency') display = formatCurrencyMXN(value);
  else if (resolvedType === 'percent') display = formatPercentDisplay(value);
  else if (resolvedType === 'points') display = `${Number(value)} pts`;
  const resolvedHasData = hasData !== undefined ? hasData : true;
  return { value, display, available: true, not_captured: false, has_data: resolvedHasData };
}

function isVentasDepartment(dept) {
  if (!dept) return false;
  const d = normalizeText(dept);
  return d === 'ventas';
}

/** Vendedores activos: getEmpleadosActivos (Vacaciones) ∩ departamento Ventas ∩ kpi_eligible. */
function getVentasEmpleadosActivos(db) {
  const activos = getEmpleadosActivos(db);
  if (!activos.length) return [];
  const placeholders = activos.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, full_name, department, primary_department, position, kpi_eligible, active
     FROM employees WHERE id IN (${placeholders})`,
  ).all(...activos.map((e) => e.id));
  return rows
    .filter((row) => {
      const dept = row.primary_department || row.department || '';
      return isVentasDepartment(dept) && isDbTruthy(row.kpi_eligible);
    })
    .map((row) => ({
      employeeId: row.id,
      fullName: row.full_name,
      active: isDbTruthy(row.active),
      department: row.department,
      position: row.position,
      primaryDepartment: row.primary_department || row.department,
      kpiDepartment: 'Ventas',
      kpiEligible: true,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

function projectMatchesSeller(project, seller) {
  const empId = seller.employeeId;
  const name = normalizeText(seller.fullName);
  return project.vendedor_id === empId
    || (!project.vendedor_id && normalizeText(project.seller).includes(name));
}

function filterClosedInPeriod(projects, period) {
  return projects.filter(
    (p) => p.closed_at && isDateInRange(p.closed_at, period.startDate, period.endDate),
  );
}

function countProjectsClosedForSeller(projects, employeeId, start, end) {
  return projects.filter(
    (p) => p.vendedor_id === employeeId
      && p.closed_at
      && isDateInRange(p.closed_at, start, end),
  ).length;
}

function sumCollectedInPeriod(projects, period, exchangeRates, sellerFilter = null) {
  let collected = 0;
  for (const p of projects) {
    if (sellerFilter && !projectMatchesSeller(p, sellerFilter)) continue;
    for (const pay of p.payments || []) {
      if (isDateInRange(pay.payment_date, period.startDate, period.endDate)) {
        collected += convertAmountToMxn(pay.amount, pay.currency || 'MXN', exchangeRates);
      }
    }
  }
  return roundMoney(collected);
}

function getVentasSellerTrafficLight(closedWithSale, complianceProjects) {
  if (!closedWithSale.length) return 'gray';
  if (!complianceProjects.length) return 'gray';
  const gaps = complianceProjects.map((p) => {
    const realPct = (p.totals.final_margin ?? 0) * 100;
    const desiredPct = Number(p.expected_margin);
    return realPct - desiredPct;
  });
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap >= 0) return 'green';
  if (avgGap >= VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW) return 'yellow';
  return 'red';
}

function computeMarginComplianceMetrics(closedProjects) {
  const withSale = closedProjects.filter((p) => (p.totals?.total_invoiced_mxn ?? 0) > 0);
  const realMargins = withSale
    .map((p) => p.totals.final_margin)
    .filter((m) => m !== null && Number.isFinite(m));
  const avgRealMargin = realMargins.length
    ? safePercent(realMargins.reduce((a, b) => a + b, 0) / realMargins.length)
    : null;

  const withDesired = withSale.filter((p) => Number(p.expected_margin) > 0);
  const desiredMargins = withDesired.map((p) => Number(p.expected_margin));
  const avgDesiredMargin = desiredMargins.length
    ? roundMoney(desiredMargins.reduce((a, b) => a + b, 0) / desiredMargins.length)
    : null;

  const gapPoints = withDesired.map((p) => {
    const realPct = (p.totals.final_margin ?? 0) * 100;
    return roundMoney(realPct - Number(p.expected_margin));
  });
  const avgGapPoints = gapPoints.length
    ? roundMoney(gapPoints.reduce((a, b) => a + b, 0) / gapPoints.length)
    : null;

  return {
    avgRealMargin,
    avgDesiredMargin,
    avgGapPoints,
    closedWithSale: withSale,
    complianceProjects: withDesired,
  };
}

function buildVentasAlertsGrouped(projects) {
  const open = projects.filter(
    (p) => !p.closed_at && !p.next_commercial_action && !p.next_commercial_action_date,
  );
  const byKey = {};
  for (const p of open) {
    const sellerId = p.vendedor_id || null;
    const sellerName = p.seller || 'Sin vendedor';
    const key = sellerId != null ? `id:${sellerId}` : `name:${normalizeText(sellerName)}`;
    if (!byKey[key]) {
      byKey[key] = {
        seller_id: sellerId,
        seller_name: sellerName,
        count: 0,
        alerts: [],
      };
    }
    byKey[key].count += 1;
    byKey[key].alerts.push({
      type: 'cotizacion_sin_seguimiento',
      project_id: p.id,
      quote_number: p.quote_number,
      client_name: p.client_name,
      date: extractDate(p.created_at),
      suggested_action: 'Registrar próxima acción comercial',
    });
  }
  return Object.values(byKey).sort((a, b) => b.count - a.count);
}

function getMarginTrafficLight(margin) {
  if (margin === null || margin === undefined || !Number.isFinite(margin)) return 'gray';
  if (margin >= MARGIN_TARGET) return 'green';
  if (margin >= MARGIN_MIN) return 'yellow';
  if (margin >= 0.20) return 'red';
  return 'critical';
}

function getCollectionTrafficLight(daysOverdue) {
  if (daysOverdue === null || daysOverdue === undefined) return 'gray';
  if (daysOverdue <= 0) return 'green';
  if (daysOverdue <= 30) return 'yellow';
  if (daysOverdue <= 120) return 'red';
  return 'critical';
}

function getReportTrafficLight(daysSinceFinished, hasReport) {
  if (hasReport) return 'green';
  if (daysSinceFinished === null) return 'gray';
  if (daysSinceFinished <= 7) return 'yellow';
  return 'red';
}

function getFollowUpTrafficLight(hasNextAction) {
  return hasNextAction ? 'green' : 'red';
}

function parseReportData(report) {
  if (!report?.report_data) return {};
  try {
    return typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data;
  } catch {
    return {};
  }
}

function isReportComplete(report) {
  if (!report) return false;
  if (report.technical_report_complete) return true;

  const hasDate = !!report.report_date;
  const hasClient = !!report.client_name;
  const hasTechnician = !!(
    report.executed_by_employee_id
    || report.technician_name
    || report.assigned_technicians
  );
  const hasActivity = !!(report.service_name || report.comments);

  if (report.report_type === 'boiler_startup') {
    return hasDate && hasClient && hasTechnician && hasActivity
      && !!(report.equipment_model_serial || report.burner_model);
  }

  const data = parseReportData(report);
  const hasEquipment = !!(data.equipment || data.equipment_model || data.plant);
  const hasFindings = !!(data.findings || data.hallazgos || data.observations || report.comments);
  return hasDate && hasClient && hasTechnician && hasActivity && (hasEquipment || hasFindings);
}

function hasReportEvidence(report) {
  const data = parseReportData(report);
  const evidence = data.evidence || data.photos || data.evidencia;
  if (Array.isArray(evidence) && evidence.length > 0) return true;
  if (data.before_photos || data.during_photos || data.after_photos) return true;
  return !!(report.safety_tests || report.emissions_low_fire || report.emissions_high_fire);
}

function daysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const a = new Date(extractDate(fromDate) + 'T12:00:00');
  const b = new Date(extractDate(toDate) + 'T12:00:00');
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

function applyFilters(projects, filters) {
  let result = projects;
  if (filters.clientName) {
    result = result.filter((p) => normalizeText(p.client_name).includes(normalizeText(filters.clientName)));
  }
  if (filters.projectId) {
    result = result.filter((p) => p.id === Number(filters.projectId));
  }
  if (filters.status) {
    const fs = normalizeText(filters.status);
    result = result.filter((p) => {
      const ps = normalizeProjectStatus(p.status);
      const cs = normalizeCollectionStatus(p, p.totals);
      return ps === fs || cs === fs || normalizeText(p.status) === fs;
    });
  }
  if (filters.employeeId && filters.employee) {
    const emp = filters.employee;
    const empId = Number(emp.employeeId);
    result = result.filter((p) => {
      const dept = emp.kpiDepartment;
      if (dept === 'Ventas') {
        return p.vendedor_id === empId
          || (!p.vendedor_id && normalizeText(p.seller).includes(normalizeText(emp.fullName)));
      }
      if (dept === 'Técnico') {
        return p.tecnico_id === empId
          || (!p.tecnico_id && normalizeText(p.technician_name).includes(normalizeText(emp.fullName)));
      }
      return p.vendedor_id === empId || p.tecnico_id === empId
        || normalizeText(p.seller).includes(normalizeText(emp.fullName))
        || normalizeText(p.technician_name).includes(normalizeText(emp.fullName));
    });
  }
  return result;
}

function resolveProjectDueDate(project) {
  return project.fecha_vencimiento || project.due_date || project.promised_delivery_date || null;
}

function loadReportsForKpis(db) {
  const sqlFull = `
    SELECT r.*, e.full_name AS executed_by_name
    FROM project_reports r
    LEFT JOIN employees e ON e.id = r.executed_by_employee_id
    WHERE r.deleted_at IS NULL AND r.archived_at IS NULL`;
  const sqlLegacy = `
    SELECT r.*, NULL AS executed_by_name
    FROM project_reports r
    WHERE r.deleted_at IS NULL`;
  try {
    return db.prepare(sqlFull).all();
  } catch (_) {
    return db.prepare(sqlLegacy).all();
  }
}

function filterReportsForCharts(reports, projects, period, filters, employees) {
  const projectIds = new Set(projects.map((p) => p.id));
  let rows = reports.filter((r) => projectIds.has(r.project_id));
  rows = rows.filter((r) => isDateInRange(r.report_date, period.startDate, period.endDate));
  if (filters.department) {
    const dept = normalizeDepartment(filters.department) || filters.department;
    if (dept === 'Técnico') {
      const techIds = new Set(
        employees.filter((e) => e.kpiDepartment === 'Técnico').map((e) => e.employeeId),
      );
      rows = rows.filter((r) => techIds.has(r.executed_by_employee_id));
    }
  }
  if (filters.employeeId && filters.employee?.kpiDepartment === 'Técnico') {
    rows = rows.filter((r) => r.executed_by_employee_id === filters.employee.employeeId);
  }
  return rows;
}


function ensureKpiSettingsRow(db) {
  const row = db.prepare('SELECT id FROM kpi_settings WHERE id = 1').get();
  if (row) return;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO kpi_settings (
      id, margin_green_threshold, margin_yellow_threshold, margin_red_threshold,
      receivable_bucket1_days, receivable_bucket2_days, receivable_bucket3_days,
      receivable_critical_days, report_missing_critical_days, require_manual_quote_capture,
      created_at, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(MARGIN_TARGET, MARGIN_MIN, 0.20, 30, 60, 90, 120, 7, 1, now, now);
}

function loadKpiSettings(db) {
  ensureKpiSettingsRow(db);
  const row = db.prepare('SELECT * FROM kpi_settings WHERE id = 1').get();
  if (!row) {
    return {
      margin_green_threshold: MARGIN_TARGET,
      margin_yellow_threshold: MARGIN_MIN,
      margin_red_threshold: 0.20,
      receivable_bucket1_days: 30,
      receivable_bucket2_days: 60,
      receivable_bucket3_days: 90,
      receivable_critical_days: 120,
      report_missing_critical_days: 7,
      require_manual_quote_capture: 1,
    };
  }
  return row;
}

function settingsToApi(settings) {
  const marginGreen = Number(settings.margin_green_threshold);
  const marginYellow = Number(settings.margin_yellow_threshold);
  const marginRed = Number(settings.margin_red_threshold);
  return {
    margin_green_percent: roundMoney((Number.isFinite(marginGreen) ? marginGreen : MARGIN_TARGET) * 100),
    margin_yellow_percent: roundMoney((Number.isFinite(marginYellow) ? marginYellow : MARGIN_MIN) * 100),
    margin_red_percent: roundMoney((Number.isFinite(marginRed) ? marginRed : 0.20) * 100),
    receivable_bucket1_days: Number(settings.receivable_bucket1_days) || 30,
    receivable_bucket2_days: Number(settings.receivable_bucket2_days) || 60,
    receivable_bucket3_days: Number(settings.receivable_bucket3_days) || 90,
    receivable_critical_days: Number(settings.receivable_critical_days) || 120,
    report_missing_critical_days: Number(settings.report_missing_critical_days) || 7,
    require_manual_quote_capture: Number(settings.require_manual_quote_capture) !== 0,
    margin_green_threshold: Number.isFinite(marginGreen) ? marginGreen : MARGIN_TARGET,
    margin_yellow_threshold: Number.isFinite(marginYellow) ? marginYellow : MARGIN_MIN,
    margin_red_threshold: Number.isFinite(marginRed) ? marginRed : 0.20,
  };
}

function getMonthsInPeriod(period) {
  const start = period.startDate;
  const end = period.endDate;
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7));
  const months = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

function loadManualQuoteCapturesForPeriod(db, period) {
  const months = getMonthsInPeriod(period);
  if (!months.length) return [];
  const clauses = months.map(() => '(year = ? AND month = ?)').join(' OR ');
  const params = [];
  months.forEach((mo) => { params.push(mo.year, mo.month); });
  return db.prepare(
    `SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL AND (${clauses}) ORDER BY year, month, employee_id`,
  ).all(...params);
}

function aggregateManualQuotesForMonth(captures, year, month) {
  const byEmployee = captures.filter(
    (c) => c.year === year && c.month === month && c.employee_id != null,
  );
  if (!byEmployee.length) {
    return { quotesSent: 0, quotedAmountMxn: 0, hasCapture: false, byEmployee: true };
  }
  return {
    quotesSent: byEmployee.reduce((s, c) => s + (c.quotes_sent_count || 0), 0),
    quotedAmountMxn: roundMoney(byEmployee.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0)),
    hasCapture: true,
    byEmployee: true,
  };
}

function aggregateManualQuotesForPeriod(captures, period) {
  const months = getMonthsInPeriod(period);
  let quotesSent = 0;
  let quotedAmountMxn = 0;
  let missingMonths = [];
  let capturedMonths = 0;
  for (const mo of months) {
    const agg = aggregateManualQuotesForMonth(captures, mo.year, mo.month);
    if (!agg.hasCapture) missingMonths.push(`${mo.month}/${mo.year}`);
    else {
      capturedMonths += 1;
      quotesSent += agg.quotesSent;
      quotedAmountMxn += agg.quotedAmountMxn;
    }
  }
  return {
    quotesSent,
    quotedAmountMxn: roundMoney(quotedAmountMxn),
    hasCapture: capturedMonths > 0,
    hasFullCapture: missingMonths.length === 0,
    missingMonths,
    capturedMonths,
  };
}

function getManualQuotesForEmployee(captures, period, employeeId) {
  const months = getMonthsInPeriod(period);
  let quotesSent = 0;
  let quotedAmountMxn = 0;
  let hasAny = false;
  for (const mo of months) {
    const monthRows = captures.filter((c) => c.year === mo.year && c.month === mo.month);
    const empRow = monthRows.find((c) => c.employee_id === employeeId);
    if (empRow) {
      hasAny = true;
      quotesSent += empRow.quotes_sent_count || 0;
      quotedAmountMxn += empRow.quoted_amount_mxn || 0;
    }
  }
  return { quotesSent, quotedAmountMxn: roundMoney(quotedAmountMxn), hasCapture: hasAny };
}

function getFormulaDefinitions(settings) {
  const s = settingsToApi(settings);
  return [
    {
      key: 'quotes_sent',
      name: 'Cotizaciones enviadas',
      description: 'Numero de cotizaciones enviadas en el periodo segun captura manual mensual.',
      formula_text: 'Cotizaciones enviadas = Suma de capturas manuales del periodo',
      data_source: 'Captura manual de cotizaciones (kpi_manual_quote_captures)',
      periodicity: 'Mensual',
      editable: false,
      parameters: [],
    },
    {
      key: 'quoted_amount_mxn',
      name: 'Monto cotizado',
      description: 'Monto total cotizado en MXN segun captura manual.',
      formula_text: 'Monto cotizado = Suma quoted_amount_mxn de capturas del periodo',
      data_source: 'Captura manual de cotizaciones',
      periodicity: 'Mensual',
      editable: false,
      parameters: [],
    },
    {
      key: 'close_rate',
      name: 'Tasa de cierre',
      description: 'Porcentaje de proyectos autorizados respecto a cotizaciones enviadas capturadas.',
      formula_text: 'Tasa de cierre = Proyectos autorizados / Cotizaciones enviadas',
      data_source: 'Proyectos del sistema + Captura manual',
      periodicity: 'Periodo consultado',
      editable: false,
      parameters: [],
    },
    {
      key: 'gross_margin_real',
      name: 'Margen bruto real',
      description: 'Margen bruto promedio de proyectos.',
      formula_text: 'Margen bruto real = (Venta MXN - Costo directo MXN) / Venta MXN',
      data_source: 'Proyectos, pagos y costos',
      periodicity: 'Periodo consultado',
      editable: true,
      parameters: [
        { key: 'margin_green_percent', label: 'Verde >=', value: s.margin_green_percent, unit: '%' },
        { key: 'margin_yellow_percent', label: 'Amarillo >=', value: s.margin_yellow_percent, unit: '%' },
        { key: 'margin_red_percent', label: 'Rojo >=', value: s.margin_red_percent, unit: '%' },
      ],
      semaphore: {
        green: `>= ${s.margin_green_percent}%`,
        yellow: `${s.margin_yellow_percent}% a ${s.margin_green_percent - 0.01}%`,
        red: `${s.margin_red_percent}% a ${s.margin_yellow_percent - 0.01}%`,
        critical: `< ${s.margin_red_percent}%`,
      },
    },
    {
      key: 'invoices_issued',
      name: 'Facturas emitidas (criterio administrativo)',
      description: 'Todos los proyectos del periodo se consideran facturados para efectos del tablero.',
      formula_text: 'Facturas emitidas = Numero de proyectos creados en el periodo',
      data_source: 'Proyectos',
      periodicity: 'Periodo consultado',
      editable: false,
      parameters: [],
    },
    {
      key: 'invoiced_amount_mxn',
      name: 'Monto facturado (criterio administrativo)',
      description: 'Suma de montos de proyectos del periodo en MXN.',
      formula_text: 'Monto facturado = Suma total_invoiced_mxn de proyectos del periodo',
      data_source: 'Proyectos',
      periodicity: 'Periodo consultado',
      editable: false,
      parameters: [],
    },
  ];
}


function computeVentasBySeller(projects, period, manualQuotes, sellers, exchangeRates) {
  const closed = filterClosedInPeriod(projects, period);
  return sellers.map((seller) => {
    const sellerClosed = closed.filter((p) => projectMatchesSeller(p, seller));
    const manualEmp = getManualQuotesForEmployee(manualQuotes || [], period, seller.employeeId);
    const soldAmount = roundMoney(
      sellerClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
    );
    const closedCount = sellerClosed.length;
    const quotesSent = manualEmp.hasCapture ? manualEmp.quotesSent : null;
    const quotedAmount = manualEmp.hasCapture ? manualEmp.quotedAmountMxn : null;
    const closeRateCount = quotesSent > 0 ? safePercent(safeRatio(closedCount, quotesSent)) : null;
    const closeRateAmount = quotedAmount > 0 ? safePercent(safeRatio(soldAmount, quotedAmount)) : null;
    const marginMetrics = computeMarginComplianceMetrics(sellerClosed);
    const collected = sumCollectedInPeriod(projects, period, exchangeRates, seller);
    const trafficLight = getVentasSellerTrafficLight(
      marginMetrics.closedWithSale,
      marginMetrics.complianceProjects,
    );

    return {
      employee_id: seller.employeeId,
      full_name: seller.fullName,
      quotes_sent: quotesSent,
      quoted_amount_mxn: quotedAmount,
      projects_closed: closedCount,
      sold_amount_mxn: soldAmount,
      close_rate_count: closeRateCount,
      close_rate_amount: closeRateAmount,
      avg_real_margin: marginMetrics.avgRealMargin,
      avg_desired_margin: marginMetrics.avgDesiredMargin,
      margin_gap_points: marginMetrics.avgGapPoints,
      collected_amount_mxn: collected > 0 ? collected : null,
      traffic_light: trafficLight,
      has_sold_data: closedCount > 0 && soldAmount > 0,
      has_quote_data: manualEmp.hasCapture,
    };
  }).sort((a, b) => (b.sold_amount_mxn || 0) - (a.sold_amount_mxn || 0));
}

function computeSalesKpis(projects, period, manualQuotes, settings, exchangeRates, sellers) {
  const manualAgg = aggregateManualQuotesForPeriod(manualQuotes || [], period);
  const closed = filterClosedInPeriod(projects, period);
  const soldAmount = roundMoney(closed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0));
  const closedCount = closed.length;
  const hasQuoteData = manualAgg.hasCapture;

  const quotesSentVal = hasQuoteData ? manualAgg.quotesSent : null;
  const quotedAmountVal = hasQuoteData ? manualAgg.quotedAmountMxn : null;

  const closeRateCount = quotesSentVal > 0 ? safePercent(safeRatio(closedCount, quotesSentVal)) : null;
  const closeRateAmount = quotedAmountVal > 0 ? safePercent(safeRatio(soldAmount, quotedAmountVal)) : null;

  const marginMetrics = computeMarginComplianceMetrics(closed);
  const collectedAmount = sumCollectedInPeriod(projects, period, exchangeRates);

  const pendingCapture = (settings?.require_manual_quote_capture !== 0 && manualAgg.missingMonths.length)
    ? {
        months: manualAgg.missingMonths,
        message: `Falta captura de cotizaciones para: ${manualAgg.missingMonths.join(', ')}`,
      }
    : null;

  const sellersTable = computeVentasBySeller(
    projects,
    period,
    manualQuotes,
    sellers || [],
    exchangeRates,
  );
  const salesAlertsBySeller = buildVentasAlertsGrouped(projects);

  return {
    quotes_sent: kpiValue(quotesSentVal, { hasData: hasQuoteData, key: 'quotes_sent' }),
    quoted_amount_mxn: kpiValue(quotedAmountVal, {
      hasData: hasQuoteData,
      type: 'currency',
      key: 'quoted_amount_mxn',
    }),
    projects_closed: kpiValue(closedCount > 0 ? closedCount : null, { hasData: closedCount > 0 }),
    sold_amount_mxn: kpiValue(closedCount > 0 ? soldAmount : null, {
      hasData: closedCount > 0,
      type: 'currency',
      key: 'sold_amount_mxn',
    }),
    close_rate_count: kpiValue(closeRateCount, { hasData: closeRateCount !== null }),
    close_rate_amount: kpiValue(closeRateAmount, { hasData: closeRateAmount !== null }),
    avg_real_margin: kpiValue(marginMetrics.avgRealMargin, {
      hasData: marginMetrics.avgRealMargin !== null,
    }),
    avg_desired_margin: kpiValue(marginMetrics.avgDesiredMargin, {
      hasData: marginMetrics.avgDesiredMargin !== null,
    }),
    margin_gap_points: kpiValue(marginMetrics.avgGapPoints, {
      hasData: marginMetrics.avgGapPoints !== null,
      type: 'points',
    }),
    collected_amount_mxn: kpiValue(collectedAmount > 0 ? collectedAmount : null, {
      hasData: collectedAmount > 0,
      type: 'currency',
      key: 'collected_amount_mxn',
    }),
    manual_capture_missing_months: manualAgg.missingMonths,
    pending_capture: pendingCapture,
    sellers_table: sellersTable,
    sales_alerts_by_seller: salesAlertsBySeller,
    margin_min_percent: MARGIN_MIN * 100,
    margin_target_percent: MARGIN_TARGET * 100,
  };
}

function computeVentasChartData(sales, chartsPayload) {
  const quoted = sales.quoted_amount_mxn?.value ?? 0;
  const sold = sales.sold_amount_mxn?.value ?? 0;
  const collected = sales.collected_amount_mxn?.value ?? 0;

  const funnelStages = [
    { key: 'quoted', label: 'Cotizado', amount: quoted, color: '#2563eb' },
    { key: 'sold', label: 'Vendido', amount: sold, color: '#0d9488' },
    { key: 'collected', label: 'Cobrado', amount: collected, color: '#eab308' },
  ].filter((s) => s.amount > 0);

  const sellerRanking = (sales.sellers_table || [])
    .filter((s) => (s.sold_amount_mxn || 0) > 0)
    .sort((a, b) => (b.sold_amount_mxn || 0) - (a.sold_amount_mxn || 0))
    .map((s) => ({
      label: s.full_name,
      sold_amount_mxn: roundMoney(s.sold_amount_mxn || 0),
      quoted_amount_mxn: roundMoney(s.quoted_amount_mxn || 0),
    }));

  const marginGapBySeller = (sales.sellers_table || [])
    .filter((s) => s.margin_gap_points != null && s.has_sold_data && s.avg_desired_margin != null)
    .sort((a, b) => (b.margin_gap_points || 0) - (a.margin_gap_points || 0))
    .map((s) => ({
      label: s.full_name,
      gap_points: s.margin_gap_points,
    }));

  return {
    monthly_trend: chartsPayload?.monthly_trend || [],
    sales_funnel: { stages: funnelStages },
    seller_ranking: sellerRanking,
    margin_gap_by_seller: marginGapBySeller,
  };
}

function computeProjectsKpis(projects, reportsByProject, settings) {
  const active = projects.filter((p) => {
    const s = normalizeProjectStatus(p.status);
    return ['pendiente', 'en_proceso'].includes(s) && !p.closed_at;
  });

  const withMargin = projects.map((p) => {
    const sale = p.totals.total_invoiced_mxn;
    const cost = p.totals.spent;
    const grossMargin = sale > 0 ? roundMoney((sale - cost) / sale) : null;
    return { ...p, grossMargin };
  });

  const redMargin = withMargin.filter(
    (p) => p.grossMargin !== null && p.grossMargin < (settings?.margin_yellow_threshold ?? MARGIN_MIN),
  );

  const finished = projects.filter(
    (p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at,
  );
  const onTime = finished.filter((p) => {
    const delivery = extractDate(p.promised_delivery_date);
    const closed = extractDate(p.closed_at || p.technical_closed_at);
    if (!delivery || !closed) return false;
    const report = reportsByProject[p.id];
    const reportComplete = report ? isReportComplete(report) : !!p.technical_report_complete;
    return closed <= delivery && reportComplete;
  });
  const deliveryCompliance = safeRatio(onTime.length, finished.length);

  const rework = projects.filter((p) => p.rework);
  const reworkRate = safeRatio(rework.length, finished.length);

  const technicalPending = finished.filter((p) => {
    const report = reportsByProject[p.id];
    return !report || !isReportComplete(report);
  });

  const marginsWithValue = withMargin.filter((p) => p.grossMargin !== null);
  const avgGrossMargin = marginsWithValue.length
    ? marginsWithValue.reduce((s, p) => s + p.grossMargin, 0) / marginsWithValue.length
    : null;

  return {
    active_projects: kpiValue(active.length),
    gross_margin_real: kpiValue(avgGrossMargin !== null ? safePercent(avgGrossMargin) : null),
    red_margin_projects: kpiValue(redMargin.length),
    red_margin_list: redMargin.map((p) => ({
      project_id: p.id,
      quote_number: p.quote_number,
      client_name: p.client_name,
      margin_percent: safePercent(p.grossMargin),
      traffic_light: getMarginTrafficLight(p.grossMargin),
    })),
    delivery_compliance: kpiValue(deliveryCompliance !== null ? safePercent(deliveryCompliance) : null),
    reworks: kpiValue(rework.length),
    rework_rate: kpiValue(reworkRate !== null ? safePercent(reworkRate) : null),
    rework_causes_catalog: REWORK_CAUSES,
    technical_close_pending: kpiValue(technicalPending.length),
  };
}

function computeReportsKpis(projects, reports) {
  const finished = projects.filter(
    (p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at,
  );
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  let complete = 0;
  let withEvidence = 0;
  let withoutReport = 0;

  for (const p of finished) {
    const report = reportsByProject[p.id];
    if (!report) {
      withoutReport += 1;
      continue;
    }
    if (isReportComplete(report)) complete += 1;
    if (hasReportEvidence(report)) withEvidence += 1;
  }

  const total = finished.length;
  return {
    complete_reports: kpiValue(safeRatio(complete, total) !== null ? safePercent(safeRatio(complete, total)) : null),
    complete_count: kpiValue(complete),
    complete_evidence: kpiValue(safeRatio(withEvidence, total) !== null ? safePercent(safeRatio(withEvidence, total)) : null),
    services_without_report: kpiValue(withoutReport),
    services_total: kpiValue(total),
  };
}

function computeBillingKpis(projects, period) {
  const inPeriod = projects.filter((p) => isDateInRange(p.created_at, period.startDate, period.endDate));
  const invoicedAmount = roundMoney(inPeriod.reduce((s, p) => s + p.totals.total_invoiced_mxn, 0));

  const hasInvoiceIssuedAt = projects.some((p) => p.invoice_issued_at);
  const hasInvoiceDate = projects.some((p) => p.invoice_date && !p.invoice_date_na);
  let billingTimeDays = kpiValue(null, { unavailable: !hasInvoiceIssuedAt && !hasInvoiceDate });
  if (hasInvoiceIssuedAt || hasInvoiceDate) {
    const times = projects
      .map((p) => {
        const techClose = p.technical_closed_at || (normalizeProjectStatus(p.status) === 'terminado' ? p.updated_at : null);
        const invoiceDate = p.invoice_issued_at || (p.invoice_date_na ? null : p.invoice_date);
        return daysBetween(techClose, invoiceDate);
      })
      .filter((d) => d !== null && d >= 0);
    billingTimeDays = kpiValue(
      times.length ? roundMoney(times.reduce((a, b) => a + b, 0) / times.length) : null,
    );
  } else {
    billingTimeDays = kpiValue(null, { unavailable: true });
  }

  const cancelled = projects.filter((p) => p.invoice_cancelled);
  const withError = projects.filter((p) => p.invoice_error);
  const pendingDocs = projects.filter((p) => p.invoice_pending_docs);

  return {
    invoices_issued: kpiValue(inPeriod.length),
    invoiced_amount_mxn: kpiValue(invoicedAmount, { type: 'currency', key: 'invoiced_amount_mxn' }),
    billing_time_days: billingTimeDays,
    billing_admin_note: 'Criterio administrativo: todos los proyectos del periodo se consideran facturados.',
    cancelled_invoices: kpiValue(cancelled.length),
    error_invoices: kpiValue(withError.length),
    pending_documentation: kpiValue(pendingDocs.length),
  };
}

function computeCollectionKpis(projects, period, exchangeRates) {
  const today = extractDate(new Date().toISOString());
  let collectedAmount = 0;
  let collectedInvoices = 0;
  const collectionDays = [];
  let totalReceivable = 0;
  let overdueAmount = 0;
  let over120Count = 0;
  let over120Amount = 0;
  let withoutContact = 0;

  for (const p of projects) {
    const pending = p.totals.pending_collection;
    if (pending > 0) totalReceivable += pending;

    for (const pay of p.payments) {
      if (isDateInRange(pay.payment_date, period.startDate, period.endDate)) {
        collectedAmount += convertAmountToMxn(pay.amount, pay.currency || 'MXN', exchangeRates);
      }
    }

    if (p.totals.total_charged > 0 && pending <= 0.01) collectedInvoices += 1;

    const invoiceDate = p.invoice_date_na ? null : p.invoice_date;
    if (invoiceDate && p.payments.length) {
      const lastPay = [...p.payments].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))[0];
      const days = daysBetween(invoiceDate, lastPay.payment_date);
      if (days !== null && days >= 0) collectionDays.push(days);
    }

    if (pending > 0.01) {
      const dueDate = p.due_date;
      if (dueDate && today > dueDate) {
        overdueAmount += pending;
        const daysOver = daysBetween(dueDate, today);
        if (daysOver !== null && daysOver > 120) {
          over120Count += 1;
          over120Amount += pending;
        }
      }
      if (!p.collection_contact_at && !p.collection_notes) withoutContact += 1;
    }
  }

  return {
    collected_amount_mxn: kpiValue(roundMoney(collectedAmount), { type: 'currency', key: 'collected_amount_mxn' }),
    collected_invoices: kpiValue(collectedInvoices),
    avg_collection_days: kpiValue(
      collectionDays.length
        ? roundMoney(collectionDays.reduce((a, b) => a + b, 0) / collectionDays.length)
        : null,
    ),
    overdue_portfolio: kpiValue(safeRatio(overdueAmount, totalReceivable) !== null ? safePercent(safeRatio(overdueAmount, totalReceivable)) : null),
    overdue_amount_mxn: kpiValue(roundMoney(overdueAmount), { type: 'currency', key: 'overdue_amount_mxn' }),
    accounts_over_120_days: kpiValue(over120Count),
    accounts_over_120_amount_mxn: kpiValue(roundMoney(over120Amount), { type: 'currency', key: 'accounts_over_120_amount_mxn' }),
    invoices_without_contact: kpiValue(withoutContact),
  };
}

function computeDepartmentKpis(department, sales, projectsKpi, reports, billing, collection) {
  const map = {
    Ventas: {
      quotes_sent: sales.quotes_sent,
      quoted_amount_mxn: sales.quoted_amount_mxn,
      projects_closed: sales.projects_closed,
      sold_amount_mxn: sales.sold_amount_mxn,
      close_rate_count: sales.close_rate_count,
      close_rate_amount: sales.close_rate_amount,
      avg_real_margin: sales.avg_real_margin,
      margin_gap_points: sales.margin_gap_points,
      collected_amount_mxn: sales.collected_amount_mxn,
    },
    Técnico: {
      complete_reports: reports.complete_reports,
      services_without_report: reports.services_without_report,
      reworks: projectsKpi.reworks,
      technical_close_pending: projectsKpi.technical_close_pending,
    },
    Cobranza: {
      collected_amount_mxn: collection.collected_amount_mxn,
      overdue_portfolio: collection.overdue_portfolio,
      avg_collection_days: collection.avg_collection_days,
      accounts_over_120_days: collection.accounts_over_120_days,
    },
    Facturación: {
      invoices_issued: billing.invoices_issued,
      billing_time_days: billing.billing_time_days,
      cancelled_invoices: billing.cancelled_invoices,
      pending_documentation: billing.pending_documentation,
    },
  };
  return { department, kpis: map[department] || {} };
}

function computeEmployeeKpis(employee, projects, reports, period, manualQuotes) {
  const name = normalizeText(employee.fullName);
  const dept = employee.kpiDepartment;
  const related = projects.filter((p) => {
    if (dept === 'Ventas') {
      return p.vendedor_id === employee.employeeId
        || (!p.vendedor_id && normalizeText(p.seller).includes(name));
    }
    if (dept === 'Técnico') {
      return p.tecnico_id === employee.employeeId
        || (!p.tecnico_id && normalizeText(p.technician_name).includes(name));
    }
    return p.vendedor_id === employee.employeeId || p.tecnico_id === employee.employeeId
      || normalizeText(p.seller).includes(name) || normalizeText(p.technician_name).includes(name);
  });

  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  let kpis = {};
  let trafficLight = 'gray';

  if (dept === 'Ventas') {
    return null;
  } else if (dept === 'Técnico') {
    const assigned = related.filter(
      (p) => p.tecnico_id === employee.employeeId
        || (!p.tecnico_id && normalizeText(p.technician_name).includes(name)),
    );
    const finished = assigned.filter((p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at);
    const executedInPeriod = reports.filter((r) => (
      r.executed_by_employee_id === employee.employeeId
      && isDateInRange(r.report_date, period.startDate, period.endDate)
    ));
    let complete = 0;
    let noReport = 0;
    for (const p of finished) {
      const r = reportsByProject[p.id];
      if (!r || !isReportComplete(r)) noReport += 1;
      else complete += 1;
    }
    const executedComplete = executedInPeriod.filter((r) => isReportComplete(r)).length;
    kpis = {
      assigned_services: assigned.length,
      services_executed: executedInPeriod.length,
      complete_reports: finished.length ? safePercent(safeRatio(complete, finished.length)) : null,
      executed_reports_complete: executedInPeriod.length
        ? safePercent(safeRatio(executedComplete, executedInPeriod.length))
        : null,
      services_without_report: noReport,
      reworks: assigned.filter((p) => p.rework).length,
    };
    trafficLight = noReport > 0 ? 'red' : 'green';
  } else if (dept === 'Cobranza') {
    const pending = related.filter((p) => p.totals.pending_collection > 0.01);
    const overdue = pending.filter((p) => p.due_date && extractDate(new Date().toISOString()) > p.due_date);
    kpis = {
      collected_amount_mxn: roundMoney(related.reduce((s, p) => s + p.totals.total_charged, 0)),
      overdue_assigned: roundMoney(overdue.reduce((s, p) => s + p.totals.pending_collection, 0)),
      accounts_over_120: overdue.filter((p) => daysBetween(p.due_date, new Date().toISOString()) > 120).length,
      avg_collection_days: null,
    };
    trafficLight = overdue.length > 0 ? 'red' : 'green';
  } else if (dept === 'Facturación') {
    const invoiced = related.filter((p) => {
      const d = p.invoice_issued_at || p.invoice_date;
      return d && isDateInRange(d, period.startDate, period.endDate);
    });
    kpis = {
      invoices_issued: invoiced.length,
      avg_billing_days: null,
      cancelled: related.filter((p) => p.invoice_cancelled).length,
      pending_docs: related.filter((p) => p.invoice_pending_docs).length,
    };
    trafficLight = kpis.pending_docs > 0 ? 'yellow' : 'green';
  } else {
    kpis = { note: 'Sin departamento KPI asignado' };
  }

  return {
    employee: employee.fullName,
    employee_id: employee.employeeId,
    department: dept || 'Sin departamento asignado',
    kpis,
    traffic_light: trafficLight,
    alerts: [],
  };
}

function generateAlerts(projects, reports, settings, sales) {
  const alerts = [];
  const today = extractDate(new Date().toISOString());
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  for (const p of projects) {
    const sale = p.totals.total_invoiced_mxn;
    const margin = sale > 0 ? (sale - p.totals.spent) / sale : null;
    if (margin !== null && margin < MARGIN_MIN) {
      alerts.push({
        type: 'margen_rojo',
        severity: margin < 0.20 ? 'critical' : 'high',
        responsible: p.seller || p.technician_name,
        date: today,
        suggested_action: 'Revisar costos y margen del proyecto',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
        traffic_light: getMarginTrafficLight(margin),
      });
    }

    const finished = normalizeProjectStatus(p.status) === 'terminado' || p.closed_at;
    if (finished) {
      const report = reportsByProject[p.id];
      if (!report || !isReportComplete(report)) {
        alerts.push({
          type: 'servicio_sin_reporte',
          severity: 'high',
          responsible: p.technician_name,
          date: extractDate(p.closed_at || p.updated_at),
          suggested_action: 'Completar reporte técnico',
          link: { module: 'reports', project_id: p.id, quote_number: p.quote_number },
        });
      }
    }

    if (p.invoice_pending_docs) {
      alerts.push({
        type: 'factura_pendiente_documentacion',
        severity: 'medium',
        responsible: 'Facturación',
        date: today,
        suggested_action: 'Completar documentación para facturar',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
      });
    }

    if (p.totals.pending_collection > 0.01) {
      const due = p.due_date;
      if (due && today > due) {
        const days = daysBetween(due, today);
        alerts.push({
          type: days > 120 ? 'cuenta_mayor_120_dias' : 'cuenta_vencida',
          severity: days > 120 ? 'critical' : 'high',
          responsible: 'Cobranza',
          date: due,
          suggested_action: 'Contactar cliente para gestionar cobro',
          link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
          traffic_light: getCollectionTrafficLight(days),
        });
      }
    }

    if (p.closed_at && p.totals.pending_collection > 0.01) {
      alerts.push({
        type: 'proyecto_cerrado_sin_cobro',
        severity: 'high',
        responsible: 'Cobranza',
        date: extractDate(p.closed_at),
        suggested_action: 'Gestionar cobro pendiente',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
      });
    }
  }

  if (settings?.require_manual_quote_capture && sales?.manual_capture_missing_months?.length) {
    // Captura pendiente: ver bloque Ventas (pending_capture), no alerta operativa.
  }

  const sev = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => (sev[a.severity] || 9) - (sev[b.severity] || 9));
}


function computeReceivableBuckets(projects, settings) {
  const today = extractDate(new Date().toISOString());
  const buckets = {
    por_vencer: { label: 'Por vencer', amount: 0, count: 0 },
    vencidos: { label: 'Vencidos', amount: 0, count: 0 },
  };
  for (const p of projects) {
    const pending = p.totals?.pending_collection || 0;
    if (pending <= 0.01) continue;
    const due = resolveProjectDueDate(p);
    if (!due || today <= due) {
      buckets.por_vencer.amount += pending;
      buckets.por_vencer.count += 1;
    } else {
      buckets.vencidos.amount += pending;
      buckets.vencidos.count += 1;
    }
  }
  Object.values(buckets).forEach((b) => { b.amount = roundMoney(b.amount); });
  return Object.values(buckets);
}

function computeSellerSuccessForPeriod(projects, manualQuotes, period, sellers, filters) {
  let ventasSellers = sellers;
  if (filters.department) {
    const dept = normalizeDepartment(filters.department) || filters.department;
    if (dept !== 'Ventas') ventasSellers = [];
    else ventasSellers = sellers;
  }
  if (filters.employeeId && filters.employee?.kpiDepartment === 'Ventas') {
    ventasSellers = ventasSellers.filter((e) => e.employeeId === filters.employee.employeeId);
  }

  const months = getMonthsInPeriod(period).slice(-12);
  const monthlySuccess = [];
  for (const mo of months) {
    const start = formatDate(mo.year, mo.month, 1);
    const end = formatDate(mo.year, mo.month, lastDayOfMonth(mo.year, mo.month));
    const monthCaptures = manualQuotes.filter((c) => c.year === mo.year && c.month === mo.month);
    let quotes = 0;
    let closed = 0;
    let quotedAmount = 0;
    let soldAmount = 0;
    if (ventasSellers.length) {
      for (const seller of ventasSellers) {
        quotes += monthCaptures
          .filter((c) => c.employee_id === seller.employeeId)
          .reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
        quotedAmount += monthCaptures
          .filter((c) => c.employee_id === seller.employeeId)
          .reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0);
        closed += countProjectsClosedForSeller(projects, seller.employeeId, start, end);
      }
      const monthClosed = projects.filter(
        (p) => p.closed_at && isDateInRange(p.closed_at, start, end)
          && ventasSellers.some((s) => projectMatchesSeller(p, s)),
      );
      soldAmount = roundMoney(
        monthClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
      );
    } else {
      quotes = monthCaptures.reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
      quotedAmount = roundMoney(monthCaptures.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0));
      const monthClosed = projects.filter((p) => p.closed_at && isDateInRange(p.closed_at, start, end));
      closed = monthClosed.length;
      soldAmount = roundMoney(
        monthClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
      );
    }
    monthlySuccess.push({
      label: `${pad2(mo.month)}/${mo.year}`,
      quotes_sent: quotes,
      projects_closed: closed,
      quoted_amount_mxn: roundMoney(quotedAmount),
      sold_amount_mxn: soldAmount,
      success_percent: safePercent(safeRatio(closed, quotes)),
    });
  }

  const sellerRates = ventasSellers.map((seller) => {
    const { quotesSent, quotedAmountMxn, hasCapture } = getManualQuotesForEmployee(
      manualQuotes,
      period,
      seller.employeeId,
    );
    const sellerClosed = filterClosedInPeriod(projects, period)
      .filter((p) => projectMatchesSeller(p, seller));
    const won = sellerClosed.length;
    const sold = roundMoney(
      sellerClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
    );
    return {
      employee_id: seller.employeeId,
      full_name: seller.fullName,
      quotes_sent: hasCapture ? quotesSent : 0,
      projects_closed: won,
      quoted_amount_mxn: quotedAmountMxn,
      sold_amount_mxn: sold,
      success_percent: hasCapture && quotesSent > 0 ? safePercent(safeRatio(won, quotesSent)) : null,
    };
  });

  return { monthlySuccess, sellerRates };
}

function computeServicesByMonth(reports, period, employees, filters) {
  const months = getMonthsInPeriod(period).slice(-12);
  const labels = months.map((mo) => `${pad2(mo.month)}/${mo.year}`);
  const techEmployees = employees.filter((e) => e.kpiDepartment === 'Técnico');
  let techIds = new Set(techEmployees.map((e) => e.employeeId));
  if (filters.employeeId && filters.employee?.kpiDepartment === 'Técnico') {
    techIds = new Set([filters.employee.employeeId]);
  } else if (filters.department) {
    const dept = normalizeDepartment(filters.department) || filters.department;
    if (dept === 'Ventas') techIds = new Set();
    else if (dept === 'Técnico') techIds = new Set(techEmployees.map((e) => e.employeeId));
  }

  const counts = {};
  for (const report of reports) {
    const techId = report.executed_by_employee_id;
    if (!techId || !techIds.has(techId)) continue;
    const monthKey = extractDate(report.report_date).slice(0, 7);
    if (!monthKey) continue;
    const key = `${techId}`;
    if (!counts[key]) {
      counts[key] = {
        employee_id: techId,
        full_name: report.executed_by_name || `Tecnico #${techId}`,
        byMonth: {},
      };
    }
    counts[key].byMonth[monthKey] = (counts[key].byMonth[monthKey] || 0) + 1;
  }

  const series = Object.values(counts)
    .map((row) => ({
      employee_id: row.employee_id,
      full_name: row.full_name,
      data: months.map((mo) => {
        const mk = `${mo.year}-${pad2(mo.month)}`;
        return row.byMonth[mk] || 0;
      }),
      total: months.reduce((s, mo) => s + (row.byMonth[`${mo.year}-${pad2(mo.month)}`] || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return { labels, series };
}

function computeEmployeeComparisonChart(sellerRates, servicesByMonth, filters) {
  const dept = filters.department ? (normalizeDepartment(filters.department) || filters.department) : null;
  if (dept === 'Técnico') {
    return {
      mode: 'technician_services',
      items: servicesByMonth.series.map((s) => ({
        label: s.full_name,
        value: s.total,
      })),
    };
  }
  return {
    mode: 'seller_sold_amount',
    items: sellerRates.map((s) => ({
      label: s.full_name,
      value: s.sold_amount_mxn || 0,
      close_rate: s.success_percent,
      projects_closed: s.projects_closed,
      quotes_sent: s.quotes_sent,
    })),
  };
}

function computeKpiCharts(db, {
  projects,
  period,
  manualQuotes,
  exchangeRates,
  reports,
  employees,
  ventasSellers,
  filters,
}) {
  const months = getMonthsInPeriod(period).slice(-12);
  const filteredReports = filterReportsForCharts(reports, projects, period, filters, employees);
  const { monthlySuccess, sellerRates } = computeSellerSuccessForPeriod(
    projects,
    manualQuotes,
    period,
    ventasSellers || [],
    filters,
  );
  const servicesByMonth = computeServicesByMonth(filteredReports, period, employees, filters);

  const trend = [];
  for (const mo of months) {
    const start = formatDate(mo.year, mo.month, 1);
    const end = formatDate(mo.year, mo.month, lastDayOfMonth(mo.year, mo.month));
    const subPeriod = { startDate: start, endDate: end, label: `${pad2(mo.month)}/${mo.year}` };
    const monthQuoteRows = manualQuotes.filter((c) => c.year === mo.year && c.month === mo.month);
    let quotesSent = monthQuoteRows.reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
    let quotedAmount = roundMoney(monthQuoteRows.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0));
    if (filters.employeeId && filters.employee?.kpiDepartment === 'Ventas') {
      quotesSent = monthQuoteRows
        .filter((c) => c.employee_id === filters.employee.employeeId)
        .reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
      quotedAmount = roundMoney(
        monthQuoteRows
          .filter((c) => c.employee_id === filters.employee.employeeId)
          .reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0),
      );
    } else if (ventasSellers?.length) {
      const sellerIds = new Set(ventasSellers.map((s) => s.employeeId));
      const sellerRows = monthQuoteRows.filter((c) => sellerIds.has(c.employee_id));
      quotesSent = sellerRows.reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
      quotedAmount = roundMoney(sellerRows.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0));
    }
    const monthClosed = projects.filter((p) => p.closed_at && isDateInRange(p.closed_at, start, end));
    const sold = roundMoney(
      monthClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
    );
    let collected = 0;
    for (const p of projects) {
      for (const pay of p.payments || []) {
        if (isDateInRange(pay.payment_date, start, end)) {
          collected += convertAmountToMxn(pay.amount, pay.currency || 'MXN', exchangeRates);
        }
      }
    }
    const successRow = monthlySuccess.find((r) => r.label === subPeriod.label);
    trend.push({
      label: subPeriod.label,
      quoted_amount_mxn: quotedAmount,
      sold_amount_mxn: sold,
      collected_amount_mxn: roundMoney(collected),
      quotes_sent: quotesSent,
      projects_closed: successRow?.projects_closed ?? monthClosed.length,
      quote_success_percent: successRow?.success_percent ?? null,
    });
  }

  const settings = loadKpiSettings(db);
  const receivable_buckets = computeReceivableBuckets(projects, settings);
  const employee_comparison = computeEmployeeComparisonChart(sellerRates, servicesByMonth, filters);

  return {
    monthly_trend: trend,
    receivable_buckets,
    seller_close_rates: sellerRates,
    services_by_month: servicesByMonth,
    employee_comparison,
  };
}


function buildVentasSummaryCards(sales) {
  const metricMap = {
    quotes_sent: { label: 'Cotizaciones enviadas (cant.)', group: 'captacion' },
    quoted_amount_mxn: { label: 'Monto cotizado (MXN)', group: 'captacion' },
    projects_closed: { label: 'Proyectos cerrados (cant.)', group: 'cierre' },
    sold_amount_mxn: { label: 'Monto vendido (MXN)', group: 'cierre' },
    close_rate_count: { label: 'Tasa de cierre por cantidad (%)', group: 'cierre' },
    close_rate_amount: { label: 'Tasa de cierre por monto (%)', group: 'cierre' },
    avg_real_margin: { label: 'Margen real promedio (%)', group: 'rentabilidad' },
    avg_desired_margin: { label: 'Margen deseado promedio (%)', group: 'rentabilidad' },
    margin_gap_points: { label: 'Brecha margen (pts)', group: 'rentabilidad' },
    collected_amount_mxn: { label: 'Monto cobrado (MXN)', group: 'cobro' },
  };
  const groups = {
    captacion: { title: 'Captación', cards: [] },
    cierre: { title: 'Cierre', cards: [] },
    rentabilidad: { title: 'Rentabilidad', cards: [] },
    cobro: { title: 'Cobro', cards: [] },
  };
  Object.entries(metricMap).forEach(([key, meta]) => {
    const metric = sales[key];
    if (!metric?.has_data) return;
    groups[meta.group].cards.push({
      label: meta.label,
      value: metric.display,
      section: 'ventas',
      key,
      group: meta.group,
    });
  });
  return Object.values(groups).filter((g) => g.cards.length > 0);
}


function buildKpiContext(db, query) {
  const periodType = query.periodType || 'current_month';
  const period = getPeriodRange(periodType, query.startDate, query.endDate);
  const exchangeRates = getExchangeRateMap(db);

  let employees = loadActiveKpiEmployees(db);
  if (query.department) {
    const dept = normalizeDepartment(query.department) || query.department;
    employees = employees.filter((e) => e.kpiDepartment === dept);
  }
  if (query.employeeId) {
    employees = employees.filter((e) => e.employeeId === Number(query.employeeId));
  }

  const employee = query.employeeId
    ? loadActiveKpiEmployees(db).find((e) => e.employeeId === Number(query.employeeId))
    : null;

  let projects = loadProjectsWithTotals(db, exchangeRates);
  projects = applyFilters(projects, {
    clientName: query.clientName,
    projectId: query.projectId,
    status: query.status,
    employeeId: query.employeeId,
    employee,
  });

  const reports = loadReportsForKpis(db);
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  const settings = loadKpiSettings(db);
  const manualQuotes = loadManualQuoteCapturesForPeriod(db, period);
  let ventasSellers = getVentasEmpleadosActivos(db);
  if (query.employeeId) {
    const empId = Number(query.employeeId);
    ventasSellers = ventasSellers.filter((s) => s.employeeId === empId);
  }
  const sales = computeSalesKpis(projects, period, manualQuotes, settings, exchangeRates, ventasSellers);
  const projectsKpi = computeProjectsKpis(projects, reportsByProject, settings);
  const reportsKpi = computeReportsKpis(projects, reports);
  const billing = computeBillingKpis(projects, period);
  const collection = computeCollectionKpis(projects, period, exchangeRates);
  const charts = computeKpiCharts(db, {
    projects,
    period,
    manualQuotes,
    exchangeRates,
    reports,
    employees,
    ventasSellers,
    filters: {
      department: query.department || null,
      employeeId: query.employeeId ? Number(query.employeeId) : null,
      employee,
    },
  });
  sales.charts = computeVentasChartData(sales, charts);
  const unassigned = loadActiveKpiEmployees(db).filter((e) => !e.kpiDepartment);

  return {
    period, periodType, employees, unassignedEmployees: unassigned, ventasSellers,
    projects, reports, sales, projectsKpi, reportsKpi, billing, collection, settings, manualQuotes, charts,
    filters: {
      department: query.department || null,
      employeeId: query.employeeId ? Number(query.employeeId) : null,
      clientName: query.clientName || null,
      projectId: query.projectId ? Number(query.projectId) : null,
      status: query.status || null,
    },
  };
}

function computeSummary(db, query) {
  const ctx = buildKpiContext(db, query);
  const departments = KPI_DEPARTMENTS.map((d) =>
    computeDepartmentKpis(d, ctx.sales, ctx.projectsKpi, ctx.reportsKpi, ctx.billing, ctx.collection),
  );
  const alerts = generateAlerts(ctx.projects, ctx.reports, ctx.settings, ctx.sales);
  const ventasSummaryGroups = buildVentasSummaryCards(ctx.sales);
  const ventasSummaryCards = ventasSummaryGroups.flatMap((g) => g.cards);

  return {
    period: ctx.period,
    period_type: ctx.periodType,
    filters: ctx.filters,
    timezone: TIMEZONE,
    summary_cards: [
      ...ventasSummaryCards,
      { label: 'Margen real', value: ctx.projectsKpi.gross_margin_real.display, section: 'proyectos' },
      { label: 'CxC vencida', value: ctx.collection.overdue_portfolio.display, section: 'cobranza' },
      { label: 'Reportes completos', value: ctx.reportsKpi.complete_reports.display, section: 'reportes' },
      { label: 'Facturas emitidas', value: ctx.billing.invoices_issued.display, section: 'facturacion' },
      { label: 'Alertas activas', value: String(alerts.length), section: 'alertas' },
    ],
    ventas_summary_cards: ventasSummaryCards,
    ventas_summary_groups: ventasSummaryGroups,
    ventas: ctx.sales,
    proyectos: ctx.projectsKpi,
    reportes: ctx.reportsKpi,
    facturacion: ctx.billing,
    cobranza: ctx.collection,
    departments,
    unassigned_employees: ctx.unassignedEmployees.map((e) => ({
      employeeId: e.employeeId, fullName: e.fullName, department: e.department,
    })),
    charts: ctx.charts,
    settings_display: settingsToApi(ctx.settings),
    has_weighted_score: false,
    has_public_ranking: false,
  };
}

function computeDepartments(db, query) {
  const ctx = buildKpiContext(db, query);
  return {
    period: ctx.period,
    departments: KPI_DEPARTMENTS.map((d) =>
      computeDepartmentKpis(d, ctx.sales, ctx.projectsKpi, ctx.reportsKpi, ctx.billing, ctx.collection),
    ),
    unassigned_employees: ctx.unassignedEmployees,
  };
}

function computeEmployees(db, query) {
  const ctx = buildKpiContext(db, query);
  const allEmployees = loadActiveKpiEmployees(db).filter((e) => e.kpiDepartment !== 'Ventas');
  const filtered = query.department
    ? allEmployees.filter((e) => e.kpiDepartment === (normalizeDepartment(query.department) || query.department))
    : allEmployees;

  return {
    period: ctx.period,
    employees: filtered
      .map((e) => computeEmployeeKpis(e, ctx.projects, ctx.reports, ctx.period, ctx.manualQuotes))
      .filter(Boolean),
    has_weighted_score: false,
    has_public_ranking: false,
  };
}

function computeAlerts(db, query) {
  const ctx = buildKpiContext(db, query);
  const alerts = generateAlerts(ctx.projects, ctx.reports, ctx.settings, ctx.sales);
  return { period: ctx.period, alerts };
}

function computeDetail(db, query) {
  const ctx = buildKpiContext(db, query);
  const section = query.section || 'all';
  const result = { period: ctx.period, filters: ctx.filters, section };

  if (section === 'ventas' || section === 'all') result.ventas = ctx.sales;
  if (section === 'proyectos' || section === 'all') result.proyectos = ctx.projectsKpi;
  if (section === 'reportes' || section === 'all') result.reportes = ctx.reportsKpi;
  if (section === 'facturacion' || section === 'all') result.facturacion = ctx.billing;
  if (section === 'cobranza' || section === 'all') result.cobranza = ctx.collection;
  if (section === 'projects' || section === 'all') {
    result.projects = ctx.projects.map((p) => ({
      id: p.id,
      quote_number: p.quote_number,
      client_name: p.client_name,
      seller: p.seller,
      technician_name: p.technician_name,
      status: normalizeProjectStatus(p.status),
      collection_status: normalizeCollectionStatus(p, p.totals),
      quote_status: normalizeQuoteStatus(p),
      total_invoiced_mxn: p.totals.total_invoiced_mxn,
      spent_mxn: p.totals.spent,
      margin_percent: safePercent(p.totals.final_margin),
      margin_traffic_light: getMarginTrafficLight(p.totals.final_margin),
      pending_collection_mxn: p.totals.pending_collection,
    }));
  }
  return result;
}

module.exports = {
  KPI_DEPARTMENTS,
  LEAD_CHANNELS,
  REWORK_CAUSES,
  MARGIN_MIN,
  MARGIN_TARGET,
  UNAVAILABLE,
  NOT_CAPTURED,
  formatCurrencyMXN,
  formatPercentDisplay,
  loadKpiSettings,
  settingsToApi,
  aggregateManualQuotesForPeriod,
  getFormulaDefinitions,
  normalizeKpiArea,
  getPeriodRange,
  normalizeProjectStatus,
  normalizeCollectionStatus,
  normalizeReportStatus,
  normalizeQuoteStatus,
  normalizeDepartment,
  mapKpiEmployee,
  loadActiveKpiEmployees,
  isReportComplete,
  getMarginTrafficLight,
  getCollectionTrafficLight,
  getReportTrafficLight,
  getFollowUpTrafficLight,
  computeSummary,
  computeDepartments,
  computeEmployees,
  computeAlerts,
  computeDetail,
  generateAlerts,
  computeKpiCharts,
  computeReceivableBuckets,
  resolveProjectDueDate,
  getVentasEmpleadosActivos,
  VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW,
  buildVentasSummaryCards,
  computeVentasBySeller,
  getVentasSellerTrafficLight,
  computeVentasChartData,
};

```


================================================================================
# ARCHIVO: src/kpisExport.js
================================================================================

```javascript
'use strict';

const { TIMEZONE } = require('./dateHelper');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrencyMXN(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentCell(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  return `${Number(value)}%`;
}

function kpiCellDisplay(kpiObj) {
  if (!kpiObj) return '';
  if (typeof kpiObj === 'object' && kpiObj.display != null) return kpiObj.display;
  return String(kpiObj);
}

function buildWorksheet(name, headers, rows) {
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
  const dataRows = rows.map((row) => {
    const cells = row.map((cell) => {
      const type = typeof cell === 'number' ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet>`;
}

function buildKpiExcelWorkbook(payload) {
  const meta = payload.meta || {};
  const worksheets = [];

  worksheets.push(buildWorksheet('Resumen', ['Indicador', 'Valor'], (payload.summary_cards || []).map((c) => [c.label, c.value])));

  worksheets.push(buildWorksheet('Ventas', ['Indicador', 'Valor'], Object.entries(payload.ventas || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Proyectos', ['Indicador', 'Valor'], Object.entries(payload.proyectos || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Reportes', ['Indicador', 'Valor'], Object.entries(payload.reportes || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Cobranza', ['Indicador', 'Valor'], Object.entries(payload.cobranza || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Facturacion', ['Indicador', 'Valor'], Object.entries(payload.facturacion || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Empleados', ['Empleado', 'Departamento', 'Indicadores', 'Semaforo'], (payload.employees || []).map((e) => [
    e.employee,
    e.department,
    JSON.stringify(e.kpis || {}),
    e.traffic_light || '',
  ])));

  worksheets.push(buildWorksheet('Formulas', ['KPI', 'Descripcion', 'Formula', 'Fuente', 'Modificable'], (payload.formulas || []).map((f) => [
    f.name,
    f.description,
    f.formula_text,
    f.data_source,
    f.editable ? 'Si' : 'No',
  ])));

  worksheets.push(buildWorksheet('Configuracion', ['Parametro', 'Valor'], (payload.settings_rows || []).map((r) => [r.label, r.value])));

  worksheets.push(buildWorksheet('Alertas', ['Severidad', 'Tipo', 'Responsable', 'Fecha', 'Accion'], (payload.alerts || []).map((a) => [
    a.severity,
    a.type,
    a.responsible || '',
    a.date || '',
    a.suggested_action || '',
  ])));

  const metaRows = [
    ['Periodo', meta.period_label || ''],
    ['Generado', meta.generated_at || ''],
    ['Generado por', meta.generated_by || ''],
    ['Zona horaria', TIMEZONE],
    ['Filtros', JSON.stringify(meta.filters || {})],
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Currency"><NumberFormat ss:Format="&quot;$&quot;#,##0.00"/></Style>
</Styles>
${buildWorksheet('Meta', ['Campo', 'Valor'], metaRows)}
${worksheets.join('\n')}
</Workbook>`;
}

module.exports = {
  formatCurrencyMXN,
  buildKpiExcelWorkbook,
  escapeXml,
};

```


================================================================================
# ARCHIVO: src/kpisRoutes.js
================================================================================

```javascript
'use strict';

const bcrypt = require('bcryptjs');
const { logAuditEvent, createdByFields, updatedByFields } = require('./audit');
const { isDbTruthy } = require('./db/dialect');
const { TIMEZONE } = require('./dateHelper');
const { buildKpiExcelWorkbook } = require('./kpisExport');
const {
  computeSummary,
  computeDepartments,
  computeEmployees,
  computeAlerts,
  computeDetail,
  getPeriodRange,
  loadKpiSettings,
  settingsToApi,
  getFormulaDefinitions,
  normalizeKpiArea,
  getVentasEmpleadosActivos,
} = require('./kpis');

const KPI_REAUTH_MS = 15 * 60 * 1000;
const KPI_AREAS_PHASE1 = ['Ventas', 'Técnico', 'Sin asignar'];

const KPI_EMPLOYEE_SELECT = `
  SELECT e.id, e.full_name, e.position, e.active, e.department, e.kpi_area, e.kpi_eligible, e.user_id,
         e.kpi_configured_at, e.kpi_configured_by_name,
         EXISTS (SELECT 1 FROM vacation_requests vr WHERE vr.employee_id = e.id) AS has_vacation_requests
  FROM employees e
`;

const KPI_VENDEDOR_WHERE = `
  e.active = 1 AND (
    EXISTS (SELECT 1 FROM vacation_requests vr WHERE vr.employee_id = e.id)
    OR LOWER(COALESCE(e.position, '')) LIKE '%vended%'
    OR LOWER(COALESCE(e.position, '')) LIKE '%ventas%'
    OR e.kpi_area = 'Ventas'
    OR e.primary_department = 'Ventas'
  )
`;

const KPI_TECNICO_WHERE = `
  e.active = 1 AND (
    LOWER(COALESCE(e.position, '')) LIKE '%técnico%'
    OR LOWER(COALESCE(e.position, '')) LIKE '%tecnico%'
    OR e.kpi_area = 'Técnico'
    OR e.primary_department = 'Técnico'
  )
`;

function mapKpiEmployeeConfigRow(r) {
  return {
    employee_id: r.id,
    full_name: r.full_name,
    position: r.position,
    active: isDbTruthy(r.active),
    kpi_area: r.kpi_area || 'Sin asignar',
    kpi_eligible: isDbTruthy(r.kpi_eligible),
    user_id: r.user_id,
    has_vacation_requests: isDbTruthy(r.has_vacation_requests),
    kpi_configured_at: r.kpi_configured_at,
    kpi_configured_by_name: r.kpi_configured_by_name,
  };
}

function requireAdminOnly(db, moduleName, deniedMessage) {
  return (req, res, next) => {
    if (req.session.role !== 'admin') {
      logAuditEvent(db, {
        req,
        action: 'access_denied',
        module: moduleName,
        metadata: { reason: 'admin_only', endpoint: req.originalUrl },
      });
      return res.status(403).json({ message: deniedMessage });
    }
    return next();
  };
}

function isKpiReauthValid(req) {
  const at = req.session.kpiReauthAt || 0;
  return Date.now() - at < KPI_REAUTH_MS;
}

function requireKpiReauth(db) {
  return (req, res, next) => {
    if (!isKpiReauthValid(req)) {
      return res.status(403).json({ message: 'Reautenticacion admin requerida para configuracion KPI.' });
    }
    return next();
  };
}

function parseKpiQuery(query) {
  return {
    periodType: query.periodType || 'current_month',
    startDate: query.startDate || null,
    endDate: query.endDate || null,
    department: query.department || null,
    employeeId: query.employeeId || null,
    clientName: query.clientName || null,
    projectId: query.projectId || null,
    status: query.status || null,
    section: query.section || 'all',
  };
}

function mapManualQuoteRow(row) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    department: row.department,
    employee_id: row.employee_id,
    employee_name_snapshot: row.employee_name_snapshot,
    quotes_sent_count: row.quotes_sent_count,
    quoted_amount_original: row.quoted_amount_original,
    currency: row.currency,
    exchange_rate_to_mxn: row.exchange_rate_to_mxn,
    quoted_amount_mxn: row.quoted_amount_mxn,
    notes: row.notes,
    created_by_name: row.created_by_name,
    updated_by_name: row.updated_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateManualQuoteBody(body, isUpdate = false) {
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw Object.assign(new Error('Ano invalido.'), { statusCode: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw Object.assign(new Error('Mes invalido.'), { statusCode: 400 });
  }
  const quotesSent = Number(body.quotes_sent_count ?? body.quotesSentCount);
  const quotedOriginal = Number(body.quoted_amount_original ?? body.quotedAmountOriginal);
  if (!Number.isFinite(quotesSent) || quotesSent < 0) {
    throw Object.assign(new Error('Numero de cotizaciones debe ser >= 0.'), { statusCode: 400 });
  }
  if (!Number.isFinite(quotedOriginal) || quotedOriginal < 0) {
    throw Object.assign(new Error('Monto cotizado debe ser >= 0.'), { statusCode: 400 });
  }
  const currency = (body.currency || 'MXN').toUpperCase();
  let exchangeRate = Number(body.exchange_rate_to_mxn ?? body.exchangeRateToMXN ?? 1);
  if (currency === 'MXN') exchangeRate = 1;
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw Object.assign(new Error('Tipo de cambio invalido.'), { statusCode: 400 });
  }
  const quotedMxn = Number(body.quoted_amount_mxn ?? body.quotedAmountMXN);
  const computedMxn = currency === 'MXN' ? quotedOriginal : round2(quotedOriginal * exchangeRate);
  const finalMxn = Number.isFinite(quotedMxn) && quotedMxn >= 0 ? round2(quotedMxn) : computedMxn;
  const employeeIdRaw = body.employee_id != null ? body.employee_id : body.employeeId;
  const employeeId = employeeIdRaw != null && employeeIdRaw !== '' ? Number(employeeIdRaw) : null;
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw Object.assign(new Error('Vendedora es obligatoria.'), { statusCode: 400 });
  }

  return {
    year,
    month,
    department: 'Ventas',
    employee_id: employeeId,
    employee_name_snapshot: body.employee_name_snapshot || body.employeeNameSnapshot || null,
    quotes_sent_count: Math.floor(quotesSent),
    quoted_amount_original: round2(quotedOriginal),
    currency,
    exchange_rate_to_mxn: exchangeRate,
    quoted_amount_mxn: finalMxn,
    notes: body.notes || null,
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function validateSalesEmployee(db, employeeId) {
  const match = getVentasEmpleadosActivos(db).find((e) => e.employeeId === Number(employeeId));
  if (!match) {
    throw Object.assign(new Error('Vendedora no encontrada, inactiva o no habilitada para KPI Ventas.'), { statusCode: 400 });
  }
  return {
    id: match.employeeId,
    full_name: match.fullName,
    kpi_area: 'Ventas',
    primary_department: match.primaryDepartment,
    kpi_eligible: 1,
    active: 1,
  };
}


function registerKpiRoutes(app, db, { requireAuth }) {
  const kpiDeniedMessage = 'Acceso restringido. Solo el administrador puede consultar el Tablero KPIs.';
  const requireKpiAdmin = requireAdminOnly(db, 'kpis', kpiDeniedMessage);

  function auditKpiAccess(req, filters, action = 'view') {
    logAuditEvent(db, {
      req,
      action,
      module: 'kpis',
      entityType: 'kpi_dashboard',
      entityLabel: 'Tablero KPIs',
      metadata: { filters },
    });
  }

  function kpiHandler(computeFn, auditAction = 'view') {
    return (req, res, next) => {
      try {
        const params = parseKpiQuery(req.query);
        getPeriodRange(params.periodType, params.startDate, params.endDate);
        auditKpiAccess(req, params, auditAction);
        res.json(computeFn(db, params));
      } catch (error) {
        error.statusCode = error.statusCode || 400;
        next(error);
      }
    };
  }

  app.get('/api/kpis/summary', requireAuth, requireKpiAdmin, kpiHandler(computeSummary));
  app.get('/api/kpis/departments', requireAuth, requireKpiAdmin, kpiHandler(computeDepartments));
  app.get('/api/kpis/employees', requireAuth, requireKpiAdmin, kpiHandler(computeEmployees));
  app.get('/api/kpis/alerts', requireAuth, requireKpiAdmin, kpiHandler(computeAlerts));
  app.get('/api/kpis/detail', requireAuth, requireKpiAdmin, kpiHandler(computeDetail));

  app.get('/api/kpis/formulas', requireAuth, requireKpiAdmin, (req, res) => {
    const settings = loadKpiSettings(db);
    auditKpiAccess(req, {}, 'view_formulas');
    res.json({ formulas: getFormulaDefinitions(settings), timezone: TIMEZONE });
  });

  app.get('/api/kpis/settings', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res) => {
    const settings = loadKpiSettings(db);
    res.json(settingsToApi(settings));
  });

  app.put('/api/kpis/settings', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res, next) => {
    try {
      const body = req.body || {};
      const green = Number(body.margin_green_percent ?? body.marginGreenPercent);
      const yellow = Number(body.margin_yellow_percent ?? body.marginYellowPercent);
      const red = Number(body.margin_red_percent ?? body.marginRedPercent);
      if (![green, yellow, red].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) {
        throw Object.assign(new Error('Umbrales de margen invalidos.'), { statusCode: 400 });
      }
      if (green <= yellow || yellow <= red) {
        throw Object.assign(new Error('Umbrales deben cumplir: verde > amarillo > rojo.'), { statusCode: 400 });
      }
      const before = loadKpiSettings(db);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE kpi_settings SET
          margin_green_threshold = ?,
          margin_yellow_threshold = ?,
          margin_red_threshold = ?,
          receivable_bucket1_days = ?,
          receivable_bucket2_days = ?,
          receivable_bucket3_days = ?,
          receivable_critical_days = ?,
          report_missing_critical_days = ?,
          require_manual_quote_capture = ?,
          updated_at = ?,
          updated_by_user_id = ?,
          updated_by_name = ?
        WHERE id = 1
      `).run(
        green / 100,
        yellow / 100,
        red / 100,
        Number(body.receivable_bucket1_days) || before.receivable_bucket1_days,
        Number(body.receivable_bucket2_days) || before.receivable_bucket2_days,
        Number(body.receivable_bucket3_days) || before.receivable_bucket3_days,
        Number(body.receivable_critical_days) || before.receivable_critical_days,
        Number(body.report_missing_critical_days) || before.report_missing_critical_days,
        body.require_manual_quote_capture === false ? 0 : 1,
        now,
        req.session.userId,
        req.session.userName,
      );
      const after = loadKpiSettings(db);
      logAuditEvent(db, {
        req,
        action: 'update',
        module: 'kpis',
        entityType: 'kpi_settings',
        entityId: 1,
        entityLabel: 'Parametros KPI',
        before: settingsToApi(before),
        after: settingsToApi(after),
      });
      res.json(settingsToApi(after));
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.post('/api/kpis/admin-reauth', requireAuth, requireKpiAdmin, (req, res) => {
    const password = req.body?.password;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Contrasena requerida.' });
    }
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_active = 1").get(req.session.userId);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      logAuditEvent(db, { req, action: 'kpi_reauth_failed', module: 'kpis' });
      return res.status(403).json({
        success: false,
        message: 'Contrasena incorrecta o acceso no autorizado.',
      });
    }
    req.session.kpiReauthAt = Date.now();
    logAuditEvent(db, { req, action: 'kpi_reauth_success', module: 'kpis' });
    const expiresAt = new Date(Date.now() + KPI_REAUTH_MS).toISOString();
    return res.json({ success: true, expires_in_ms: KPI_REAUTH_MS, expiresAt });
  });

  app.get('/api/kpis/reauth-status', requireAuth, requireKpiAdmin, (req, res) => {
    res.json({ authenticated: isKpiReauthValid(req), expires_in_ms: KPI_REAUTH_MS });
  });

  app.get('/api/kpis/manual-quotes', requireAuth, requireKpiAdmin, (req, res) => {
    const year = req.query.year ? Number(req.query.year) : null;
    const month = req.query.month ? Number(req.query.month) : null;
    let rows;
    if (year && month) {
      rows = db.prepare(
        'SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL AND year = ? AND month = ? ORDER BY employee_id',
      ).all(year, month);
    } else {
      rows = db.prepare(
        'SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL ORDER BY year DESC, month DESC, id DESC LIMIT 500',
      ).all();
    }
    auditKpiAccess(req, { year, month }, 'view_manual_quotes');
    res.json({ captures: rows.map(mapManualQuoteRow) });
  });

  app.post('/api/kpis/manual-quotes', requireAuth, requireKpiAdmin, (req, res, next) => {
    try {
      const data = validateManualQuoteBody(req.body);
      const emp = validateSalesEmployee(db, data.employee_id);
      data.employee_name_snapshot = emp.full_name;
      const dup = db.prepare(
        'SELECT id FROM kpi_manual_quote_captures WHERE deleted_at IS NULL AND year = ? AND month = ? AND COALESCE(employee_id, -1) = COALESCE(?, -1)',
      ).get(data.year, data.month, data.employee_id);
      if (dup) {
        logAuditEvent(db, {
          req,
          action: 'duplicate_blocked',
          module: 'kpis',
          entityType: 'kpi_manual_quote_capture',
          metadata: { year: data.year, month: data.month, employee_id: data.employee_id },
        });
        throw Object.assign(new Error('Ya existe captura para este ano, mes y vendedora.'), { statusCode: 409 });
      }
      const audit = createdByFields(req);
      const now = audit.created_at;
      const result = db.prepare(`
        INSERT INTO kpi_manual_quote_captures (
          year, month, department, employee_id, employee_name_snapshot,
          quotes_sent_count, quoted_amount_original, currency, exchange_rate_to_mxn, quoted_amount_mxn,
          notes, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.year, data.month, data.department, data.employee_id, data.employee_name_snapshot,
        data.quotes_sent_count, data.quoted_amount_original, data.currency, data.exchange_rate_to_mxn, data.quoted_amount_mxn,
        data.notes, audit.created_by_user_id, audit.created_by_name, now,
        audit.created_by_user_id, audit.created_by_name, now,
      );
      const row = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, {
        req,
        action: 'create',
        module: 'kpis',
        entityType: 'kpi_manual_quote_capture',
        entityId: row.id,
        entityLabel: `Captura ${data.month}/${data.year}`,
        after: mapManualQuoteRow(row),
      });
      res.status(201).json(mapManualQuoteRow(row));
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.put('/api/kpis/manual-quotes/:id', requireAuth, requireKpiAdmin, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!before) throw Object.assign(new Error('Captura no encontrada.'), { statusCode: 404 });
      const data = validateManualQuoteBody({ ...before, ...req.body }, true);
      const emp = validateSalesEmployee(db, data.employee_id);
      data.employee_name_snapshot = emp.full_name;
      const audit = updatedByFields(req);
      db.prepare(`
        UPDATE kpi_manual_quote_captures SET
          year = ?, month = ?, department = ?, employee_id = ?, employee_name_snapshot = ?,
          quotes_sent_count = ?, quoted_amount_original = ?, currency = ?,
          exchange_rate_to_mxn = ?, quoted_amount_mxn = ?, notes = ?,
          updated_by_user_id = ?, updated_by_name = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.year, data.month, data.department, data.employee_id, data.employee_name_snapshot,
        data.quotes_sent_count, data.quoted_amount_original, data.currency,
        data.exchange_rate_to_mxn, data.quoted_amount_mxn, data.notes,
        audit.updated_by_user_id, audit.updated_by_name, audit.updated_at,
        id,
      );
      const after = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE id = ?').get(id);
      logAuditEvent(db, {
        req,
        action: 'update',
        module: 'kpis',
        entityType: 'kpi_manual_quote_capture',
        entityId: id,
        entityLabel: `Captura ${data.month}/${data.year}`,
        before: mapManualQuoteRow(before),
        after: mapManualQuoteRow(after),
      });
      res.json(mapManualQuoteRow(after));
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.get('/api/kpis/employee-config', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res) => {
    const vendedores = db.prepare(`${KPI_EMPLOYEE_SELECT} WHERE ${KPI_VENDEDOR_WHERE} ORDER BY e.full_name`).all();
    const tecnicos = db.prepare(`${KPI_EMPLOYEE_SELECT} WHERE ${KPI_TECNICO_WHERE} ORDER BY e.full_name`).all();
    logAuditEvent(db, { req, action: 'view', module: 'kpis', entityType: 'kpi_employee_config', entityLabel: 'Config empleados KPI' });
    res.json({
      vendedores: vendedores.map(mapKpiEmployeeConfigRow),
      tecnicos: tecnicos.map(mapKpiEmployeeConfigRow),
      employees: [...vendedores, ...tecnicos].map(mapKpiEmployeeConfigRow),
      allowed_areas: KPI_AREAS_PHASE1,
    });
  });

  app.put('/api/kpis/employee-config/:id', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      if (!before || !before.active) throw Object.assign(new Error('Empleado no encontrado o inactivo.'), { statusCode: 400 });
      const kpiArea = req.body.kpi_area || req.body.kpiArea || 'Sin asignar';
      if (!KPI_AREAS_PHASE1.includes(kpiArea)) {
        throw Object.assign(new Error('Area KPI invalida. Use Ventas, Tecnico o Sin asignar.'), { statusCode: 400 });
      }
      const kpiEligible = req.body.kpi_eligible === false || req.body.kpi_eligible === 0 ? 0 : 1;
      const primaryDept = kpiArea === 'Sin asignar' ? null : kpiArea;
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE employees SET
          kpi_area = ?,
          primary_department = ?,
          kpi_eligible = ?,
          kpi_configured_at = ?,
          kpi_configured_by_user_id = ?,
          kpi_configured_by_name = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        kpiArea === 'Sin asignar' ? null : kpiArea,
        primaryDept,
        kpiEligible,
        now,
        req.session.userId,
        req.session.userName,
        now,
        id,
      );
      const after = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      logAuditEvent(db, {
        req,
        action: 'update',
        module: 'kpis',
        entityType: 'employee_kpi_config',
        entityId: id,
        entityLabel: after.full_name,
        before: { kpi_area: before.kpi_area, kpi_eligible: before.kpi_eligible },
        after: { kpi_area: after.kpi_area, kpi_eligible: after.kpi_eligible },
      });
      res.json({
        employee_id: after.id,
        full_name: after.full_name,
        kpi_area: after.kpi_area || 'Sin asignar',
        kpi_eligible: isDbTruthy(after.kpi_eligible),
      });
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.get('/api/kpis/export/excel', requireAuth, requireKpiAdmin, (req, res, next) => {
    try {
      const params = parseKpiQuery(req.query);
      const period = getPeriodRange(params.periodType, params.startDate, params.endDate);
      const summary = computeSummary(db, params);
      const employees = computeEmployees(db, params);
      const alerts = computeAlerts(db, params);
      const settings = loadKpiSettings(db);
      const settingsApi = settingsToApi(settings);
      const payload = {
        summary_cards: summary.summary_cards,
        ventas: summary.ventas,
        proyectos: summary.proyectos,
        reportes: summary.reportes,
        cobranza: summary.cobranza,
        facturacion: summary.facturacion,
        employees: employees.employees,
        formulas: getFormulaDefinitions(settings),
        alerts: alerts.alerts,
        settings_rows: [
          { label: 'Margen verde >=', value: `${settingsApi.margin_green_percent}%` },
          { label: 'Margen amarillo >=', value: `${settingsApi.margin_yellow_percent}%` },
          { label: 'Margen rojo >=', value: `${settingsApi.margin_red_percent}%` },
          { label: 'Alerta captura cotizaciones', value: settingsApi.require_manual_quote_capture ? 'Activa' : 'Inactiva' },
        ],
        meta: {
          period_label: period.label,
          generated_at: new Date().toLocaleString('es-MX', { timeZone: TIMEZONE }),
          generated_by: req.session.userName,
          filters: params,
        },
      };
      const xml = buildKpiExcelWorkbook(payload);
      logAuditEvent(db, {
        req,
        action: 'export',
        module: 'kpis',
        entityType: 'kpi_export',
        entityLabel: 'Excel Tablero KPIs',
        metadata: { format: 'excel', period: period.label },
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tablero-kpis.xls"');
      res.send(xml);
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.get('/api/kpis/sales-employees', requireAuth, requireKpiAdmin, (req, res) => {
    const employees = getVentasEmpleadosActivos(db);
    res.json({
      employees: employees.map((r) => ({
        employee_id: r.employeeId,
        full_name: r.fullName,
        position: r.position,
        kpi_area: 'Ventas',
        primary_department: r.primaryDepartment,
      })),
    });
  });

  app.get('/api/kpis/filters', requireAuth, requireKpiAdmin, (req, res) => {
    const employees = db.prepare(
      'SELECT id, full_name, department, primary_department, kpi_area, active, kpi_eligible FROM employees WHERE active = 1 AND kpi_eligible != 0 ORDER BY full_name',
    ).all();
    const clients = db.prepare(
      'SELECT DISTINCT client_name FROM projects WHERE deleted_at IS NULL ORDER BY client_name',
    ).all();
    const projects = db.prepare(
      'SELECT id, quote_number, client_name FROM projects WHERE deleted_at IS NULL ORDER BY quote_number',
    ).all();
    auditKpiAccess(req, { action: 'filters' });
    res.json({
      departments: ['Ventas', 'Técnico', 'Cobranza', 'Facturación'],
      kpi_areas_phase1: KPI_AREAS_PHASE1,
      period_types: [
        { value: 'current_month', label: 'Mes actual' },
        { value: 'previous_month', label: 'Mes anterior' },
        { value: 'current_quarter', label: 'Trimestre actual' },
        { value: 'current_year', label: 'Año actual' },
        { value: 'custom', label: 'Rango personalizado' },
      ],
      statuses: {
        proyecto: ['pendiente', 'en_proceso', 'terminado', 'cerrado', 'cancelado'],
        cobranza: ['pendiente', 'parcial', 'pagado', 'vencido'],
        reporte: ['pendiente', 'completo', 'archivado'],
        cotizacion: ['abierta', 'enviada', 'ganada', 'perdida', 'cancelada'],
      },
      employees: employees.map((e) => ({
        employeeId: e.id,
        fullName: e.full_name,
        department: e.kpi_area || e.primary_department || e.department,
      })),
      clients: clients.map((c) => c.client_name),
      projects,
    });
  });
}

module.exports = { registerKpiRoutes, requireAdminOnly, isKpiReauthValid, KPI_REAUTH_MS };

```


================================================================================
# ARCHIVO: src/lib/combustion.js
================================================================================

```javascript
'use strict';

/**
 * Motor de cálculo de emisiones y ahorro de combustible — Autoflame Emissions Calculator 2020.
 * Módulo puro sin dependencias de UI. Comentarios en español.
 */

const { PHYSICAL, FUEL_LIBRARY, PERIOD_HOURS } = require('./combustionConstants');

const { O2_FRACCION_AIRE_MASA, RELACION_MOLAR_N2_O2, R, O2_AIRE } = PHYSICAL;

/** Redondeo a n decimales */
function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * f) / f;
}

/** Convierte °C → K */
function toKelvin(celsius) {
  return Number(celsius) + 273.15;
}

/** Normaliza composición del combustible a fracciones másicas (0–1) */
function normalizeComposition(raw) {
  const C = Number(raw.C || 0);
  const H = Number(raw.H || 0);
  const S = Number(raw.S || 0);
  const N = Number(raw.N || 0);
  const O = Number(raw.O || 0);
  const W = Number(raw.W || 0);
  const sum = C + H + S + N + O + W;
  if (sum <= 0) {
    return { C: 0, H: 0, S: 0, N: 0, O: 0, W: 0, sum: 0 };
  }
  if (Math.abs(sum - 1) > 0.02 && Math.abs(sum - 100) > 2) {
    return { C, H, S, N, O, W, sum, invalid: true };
  }
  const scale = sum > 1.5 ? 1 / 100 : 1;
  return {
    C: C * scale,
    H: H * scale,
    S: S * scale,
    N: N * scale,
    O: O * scale,
    W: W * scale,
    sum: sum * scale,
  };
}

/** Poder calorífico inferior (LHV) a partir del superior (HHV) y fracción H */
function calcLHV(hhv_MJ_kg, H_frac) {
  const waterFromH = 9 * H_frac;
  return hhv_MJ_kg - (waterFromH * PHYSICAL.LATENT_H2O_KJ_KG) / 1000;
}

/** Densidad del aire ideal (kg/m³) a T (K) y P (kPa) */
function rhoAire(T_K, P_kPa) {
  return P_kPa / (R.Aire * T_K);
}

/** Densidad del combustible gaseoso (kg/m³) */
function rhoCombustible(SG, T_K, P_kPa) {
  return SG * rhoAire(T_K, P_kPa);
}

/** O2 estequiométrico requerido (kg O2 / kg combustible) — §5.3 */
function o2Estequiometrico(comp) {
  return 2.664 * comp.C + 7.937 * comp.H + 0.998 * comp.S - comp.O;
}

/** Aire estequiométrico (kg aire / kg combustible) */
function aireEstequiometrico(o2Req) {
  return o2Req / O2_FRACCION_AIRE_MASA;
}

/** Exceso de aire (%) a partir de O2 medido en gases — §5.4 VERIFICADO */
function excessAirFromO2(O2_medido_pct) {
  if (O2_medido_pct >= O2_AIRE) return null;
  return (O2_medido_pct / (O2_AIRE - O2_medido_pct)) * 100;
}

/** O2 a partir de CO2 medido — §5.5 */
function o2FromCO2(CO2_medido_pct, CO2_max_pct) {
  if (CO2_max_pct <= 0) return null;
  return O2_AIRE * (1 - CO2_medido_pct / CO2_max_pct);
}

/** CO2 máximo estequiométrico (%) — §5.5 VERIFICADO */
function calcCO2Max(comp) {
  const nO2_estq = comp.C / 12 + comp.H / 4 + comp.S / 32 - comp.O / 32;
  const nCO2 = comp.C / 12;
  const nSO2 = comp.S / 32;
  const nN2 = RELACION_MOLAR_N2_O2 * nO2_estq + comp.N / 28;
  const nTotal = nCO2 + nSO2 + nN2;
  if (nTotal <= 0) return 0;
  return (nCO2 / nTotal) * 100;
}

/** CO2 actual (%) a partir de O2 medido — §5.5 VERIFICADO */
function calcCO2Actual(CO2_max_pct, O2_medido_pct) {
  return CO2_max_pct * (1 - O2_medido_pct / O2_AIRE);
}

/** Productos de combustión por kg de combustible — §5.6 */
function productosPorKg(comp, excess_air_pct) {
  const o2Req = o2Estequiometrico(comp);
  const airStoich = aireEstequiometrico(o2Req);
  const airTotal = airStoich * (1 + excess_air_pct / 100);

  return {
    m_CO2: 3.664 * comp.C,
    m_H2O: 9.0 * comp.H + comp.W,
    m_SO2: 1.998 * comp.S,
    m_CO: 0,
    m_O2: o2Req * (excess_air_pct / 100),
    m_N2: 0.768 * airTotal + comp.N,
    o2Req,
    airStoich,
    airTotal,
  };
}

/** Volumen de gas ideal a condiciones ambiente — §5.7 VERIFICADO */
function volumenGas(masa_kg, gasKey, T_K, P_kPa) {
  const rGas = R[gasKey];
  if (!rGas || masa_kg <= 0) return 0;
  return (masa_kg * rGas * T_K) / P_kPa;
}

/** Emisiones escaladas por masa total de combustible */
function emisionesEscaladas(productos, masaCombustible_kg, T_K, P_kPa, opts = {}) {
  const gases = ['CO2', 'H2O', 'SO2', 'CO', 'N2'];
  const result = {};
  let masaTotal = 0;
  let volTotal = 0;

  for (const gas of gases) {
    const key = `m_${gas}`;
    const masa = productos[key] * masaCombustible_kg;
    const vol = volumenGas(masa, gas, T_K, P_kPa);
    result[gas] = { masa_kg: masa, volumen_m3: vol };
    masaTotal += masa;
    volTotal += vol;
  }

  // Convención Autoflame para O2 en reporte: volumen proporcional al exceso de aire
  // referenciado al escenario existente (§6 CHACHITOS: vol_O2 = vol_combustible × excess/excess_ref)
  const rhoO2 = P_kPa / (R.O2 * T_K);
  let o2Vol;
  if (opts.fuelVolume_m3 != null && opts.excess_air_pct != null && opts.referenceExcess_pct != null) {
    o2Vol = opts.fuelVolume_m3 * (opts.excess_air_pct / opts.referenceExcess_pct);
  } else {
    const o2Masa = productos.m_O2 * masaCombustible_kg;
    o2Vol = volumenGas(o2Masa, 'O2', T_K, P_kPa);
    result.O2 = { masa_kg: o2Masa, volumen_m3: o2Vol };
    masaTotal += o2Masa;
    volTotal += o2Vol;
    result.total = { masa_kg: masaTotal, volumen_m3: volTotal };
    return result;
  }
  const o2Masa = o2Vol * rhoO2;
  result.O2 = { masa_kg: o2Masa, volumen_m3: o2Vol };
  masaTotal += o2Masa;
  volTotal += o2Vol;

  result.total = { masa_kg: masaTotal, volumen_m3: volTotal };
  return result;
}

/**
 * Pérdidas por chimenea por kg de combustible (kJ/kg) — §5.8
 * Balance entálpico: gases secos (sensible) + humedad (sensible + latente para bruta).
 */
function perdidasChimeneaPorKg(productos, T_flue_C, T_amb_C, includeLatent) {
  const deltaT = T_flue_C - T_amb_C;
  if (deltaT <= 0) return { sensibleDry: 0, moistureSensible: 0, latent: 0, total: 0 };

  const cpDry = PHYSICAL.CP_FLUE_DRY_KJ_KG_K;
  const cpH2O = PHYSICAL.CP_H2O_FLUE_KJ_KG_K;

  const masaSeca = productos.m_CO2 + productos.m_SO2 + productos.m_O2 + productos.m_N2 + productos.m_CO;
  const sensibleDry = masaSeca * cpDry * deltaT;
  const moistureSensible = productos.m_H2O * cpH2O * deltaT;
  const latent = includeLatent
    ? productos.m_H2O * PHYSICAL.LATENT_H2O_KJ_KG * PHYSICAL.LATENT_GROSS_FACTOR
    : 0;

  return {
    sensibleDry,
    moistureSensible,
    latent,
    total: sensibleDry + moistureSensible + latent,
  };
}

/** Eficiencia neta (LHV) y bruta (HHV) — §5.8 */
function calcularEficiencia(comp, CV_HHV, O2_pct, T_flue_C, T_amb_C) {
  const excess = excessAirFromO2(O2_pct);
  if (excess == null) return null;
  const prod = productosPorKg(comp, excess);
  const LHV = calcLHV(CV_HHV, comp.H);

  const lossNet = perdidasChimeneaPorKg(prod, T_flue_C, T_amb_C, false);
  const lossGross = perdidasChimeneaPorKg(prod, T_flue_C, T_amb_C, true);

  const QinNet_kJ = LHV * 1000;
  const QinGross_kJ = CV_HHV * 1000;

  const effNet = Math.max(0, (1 - lossNet.total / QinNet_kJ) * 100);
  const effGross = Math.max(0, (1 - lossGross.total / QinGross_kJ) * 100);

  return {
    net_pct: round(effNet, 2),
    gross_pct: round(effGross, 2),
    stack_loss_MW: null,
    deltaT: T_flue_C - T_amb_C,
    productos: prod,
    lossNet_kJ: lossNet.total,
    lossGross_kJ: lossGross.total,
  };
}

/** Convierte consumo al periodo base en m³/h */
function consumoAFuelFlow(consumo, unidad, periodo) {
  const val = Number(consumo);
  if (val <= 0) return 0;

  let m3PerHour;
  if (unidad === 'm3') {
    const horasPeriodo = PERIOD_HOURS[periodo] || PERIOD_HOURS.month;
    m3PerHour = val / horasPeriodo;
  } else if (unidad === 'kWh') {
    m3PerHour = 0;
  } else {
    m3PerHour = val;
  }
  return m3PerHour;
}

/** Heat input (MW) a partir de flujo volumétrico — §5.9 (CV en MJ/kg → MW = kg/s × MJ/kg) */
function heatInputMW(fuelFlow_m3h, rho_kg_m3, CV_MJ_kg) {
  const kgPerSec = (fuelFlow_m3h * rho_kg_m3) / 3600;
  return kgPerSec * CV_MJ_kg;
}

/**
 * Aplicación de ahorros MM/EGA de forma multiplicativa sobre consumo proyectado.
 * Orden: 1) consumo base proyectado por eficiencia, 2) MM, 3) EGA.
 */
function aplicarAhorrosAdicionales(consumoProyBase, mmEnabled, mmPct, egaEnabled, egaPct) {
  let result = consumoProyBase;
  const steps = [];
  if (mmEnabled && mmPct > 0) {
    result *= 1 - mmPct / 100;
    steps.push({ type: 'MM', pct: mmPct, consumo: result });
  }
  if (egaEnabled && egaPct > 0) {
    result *= 1 - egaPct / 100;
    steps.push({ type: 'EGA', pct: egaPct, consumo: result });
  }
  return { consumo: result, steps };
}

/** Validación de entradas */
function validateInput(input) {
  const errors = [];
  const comp = normalizeComposition(input.fuel || input.composition || {});

  if (comp.invalid || comp.sum <= 0) {
    errors.push('La composición del combustible debe sumar ~100% (C+H+S+N+O+W).');
  }

  const o2Exist = input.existing?.o2_pct ?? input.existing_o2;
  const o2Proj = input.projected?.o2_pct ?? input.projected_o2;

  if (o2Exist != null && Number(o2Exist) >= O2_AIRE) {
    errors.push('O2 existente debe ser menor a 21%.');
  }
  if (o2Proj != null && Number(o2Proj) >= O2_AIRE) {
    errors.push('O2 proyectado debe ser menor a 21%.');
  }

  if (Number(input.consumption?.value ?? input.consumption) <= 0) {
    errors.push('El consumo de combustible debe ser mayor a cero.');
  }

  return { valid: errors.length === 0, errors, composition: comp };
}

/**
 * Cálculo principal — entrada JSON → resultados completos.
 * @param {object} input - Parámetros de la calculadora
 * @returns {object} Resultados Existing / Projected / Savings
 */
function calculate(input) {
  const validation = validateInput(input);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const comp = validation.composition;
  const CV = Number(input.fuel?.CV_MJ_kg ?? input.cv_mj_kg ?? 50);
  const SG = Number(input.fuel?.SG ?? input.sg ?? 0.65);

  const T_amb_C = Number(input.ambient?.temperature_c ?? input.temp_c ?? 25);
  const P_kPa = Number(input.ambient?.pressure_kpa ?? input.pressure_kpa ?? 101.325);
  const T_K = toKelvin(T_amb_C);

  const rhoAir = rhoAire(T_K, P_kPa);
  const rhoFuel = rhoCombustible(SG, T_K, P_kPa);

  const CO2_max = calcCO2Max(comp);

  const useCO2 = input.existing?.use_co2 ?? false;
  let O2_exist = Number(input.existing?.o2_pct ?? input.existing_o2 ?? 7);
  let O2_proj = Number(input.projected?.o2_pct ?? input.projected_o2 ?? 3);

  if (useCO2) {
    const co2e = Number(input.existing?.co2_pct);
    const co2p = Number(input.projected?.co2_pct);
    if (co2e != null) O2_exist = o2FromCO2(co2e, CO2_max);
    if (co2p != null) O2_proj = o2FromCO2(co2p, CO2_max);
  }

  const T_flue_exist = Number(input.existing?.flue_temp_c ?? input.existing_flue_temp ?? 200);
  const T_flue_proj = Number(input.projected?.flue_temp_c ?? input.projected_flue_temp ?? 180);

  const consumoVal = Number(input.consumption?.value ?? input.consumption ?? 0);
  const consumoUnidad = input.consumption?.unit ?? input.consumption_unit ?? 'm3';
  const consumoPeriodo = input.consumption?.period ?? input.consumption_period ?? 'month';
  const costoUnit = Number(input.consumption?.unit_cost ?? input.unit_cost ?? 0);

  const mmEnabled = Boolean(input.savings?.mm_enabled ?? input.mm_enabled);
  const mmPct = Number(input.savings?.mm_pct ?? input.mm_pct ?? 0);
  const egaEnabled = Boolean(input.savings?.ega_enabled ?? input.ega_enabled);
  const egaPct = Number(input.savings?.ega_pct ?? input.ega_pct ?? 0);

  const excessExist = excessAirFromO2(O2_exist);
  const excessProj = excessAirFromO2(O2_proj);
  const CO2_exist = calcCO2Actual(CO2_max, O2_exist);
  const CO2_proj = calcCO2Actual(CO2_max, O2_proj);

  const effExist = calcularEficiencia(comp, CV, O2_exist, T_flue_exist, T_amb_C);
  const effProj = calcularEficiencia(comp, CV, O2_proj, T_flue_proj, T_amb_C);

  const fuelFlowExist = consumoAFuelFlow(consumoVal, consumoUnidad, consumoPeriodo);
  const horasPeriodo = PERIOD_HOURS[consumoPeriodo] || PERIOD_HOURS.month;

  const heatExist = heatInputMW(fuelFlowExist, rhoFuel, CV);
  const masaCombExist = consumoVal * rhoFuel;

  const prodExist = productosPorKg(comp, excessExist);
  const emExist = emisionesEscaladas(prodExist, masaCombExist, T_K, P_kPa, {
    fuelVolume_m3: consumoVal,
    excess_air_pct: excessExist,
    referenceExcess_pct: excessExist,
  });

  const fuelSavingRatio = effExist.gross_pct / effProj.gross_pct;
  const consumoProyBase = consumoVal * fuelSavingRatio;
  const { consumo: consumoProyFinal, steps: mmEgaSteps } = aplicarAhorrosAdicionales(
    consumoProyBase,
    mmEnabled,
    mmPct,
    egaEnabled,
    egaPct,
  );

  const fuelFlowProj = consumoProyFinal / horasPeriodo;
  // Heat input proyectado a carga útil constante (convención Autoflame)
  const heatProj = heatExist * (effExist.net_pct / effProj.net_pct);
  const masaCombProj = consumoProyFinal * rhoFuel;

  const prodProj = productosPorKg(comp, excessProj);
  const emProj = emisionesEscaladas(prodProj, masaCombProj, T_K, P_kPa, {
    fuelVolume_m3: consumoProyFinal,
    excess_air_pct: excessProj,
    referenceExcess_pct: excessExist,
  });

  const costExist = consumoVal * costoUnit;
  const costProj = consumoProyFinal * costoUnit;

  const fuelSavingVol = consumoVal - consumoProyFinal;
  const fuelSavingPct = consumoVal > 0 ? (fuelSavingVol / consumoVal) * 100 : 0;
  const fuelCostSaving = costExist - costProj;

  const volExist = emExist.total.volumen_m3;
  const volProj = emProj.total.volumen_m3;
  const emissionsSavingPct = volExist > 0 ? ((volExist - volProj) / volExist) * 100 : 0;

  const stackLossExistMW = (effExist.lossNet_kJ * fuelFlowExist * rhoFuel) / 3600 / 1000;
  const stackLossProjMW = (effProj.lossNet_kJ * fuelFlowProj * rhoFuel) / 3600 / 1000;
  const stackHeatLossSavingMW = (stackLossExistMW - stackLossProjMW) * PHYSICAL.STACK_SAVINGS_CALIBRATION;

  const deltaExist = T_flue_exist - T_amb_C;
  const deltaProj = T_flue_proj - T_amb_C;
  const exhaustDeltaImprove = deltaExist - deltaProj;

  return {
    ok: true,
    fuel: { composition: comp, CV_MJ_kg: CV, SG, CO2_max_pct: round(CO2_max, 2) },
    ambient: { temperature_c: T_amb_C, pressure_kpa: P_kPa, rho_air: round(rhoAir, 4), rho_fuel: round(rhoFuel, 4) },
    existing: {
      o2_pct: round(O2_exist, 2),
      co2_pct: round(CO2_exist, 2),
      excess_air_pct: round(excessExist, 2),
      flue_temp_c: T_flue_exist,
      delta_t_c: round(deltaExist, 1),
      efficiency: { net_pct: effExist.net_pct, gross_pct: effExist.gross_pct },
      consumption: round(consumoVal, 2),
      fuel_flow_m3h: round(fuelFlowExist, 3),
      heat_input_MW: round(heatExist, 3),
      emissions: formatEmissions(emExist),
      fuel_cost: round(costExist, 2),
    },
    projected: {
      o2_pct: round(O2_proj, 2),
      co2_pct: round(CO2_proj, 2),
      excess_air_pct: round(excessProj, 2),
      flue_temp_c: T_flue_proj,
      delta_t_c: round(deltaProj, 1),
      efficiency: { net_pct: effProj.net_pct, gross_pct: effProj.gross_pct },
      consumption: round(consumoProyFinal, 2),
      consumption_base: round(consumoProyBase, 2),
      fuel_flow_m3h: round(fuelFlowProj, 3),
      heat_input_MW: round(heatProj, 3),
      emissions: formatEmissions(emProj),
      fuel_cost: round(costProj, 2),
      mm_ega_steps: mmEgaSteps,
    },
    savings: {
      emissions_savings_pct: round(emissionsSavingPct, 2),
      fuel_savings_pct: round(fuelSavingPct, 2),
      fuel_savings_volume: round(fuelSavingVol, 3),
      fuel_cost_savings: round(fuelCostSaving, 2),
      efficiency_improvement_net: round(effProj.net_pct - effExist.net_pct, 2),
      efficiency_improvement_gross: round(effProj.gross_pct - effExist.gross_pct, 2),
      exhaust_delta_improvement_c: round(exhaustDeltaImprove, 1),
      stack_heat_loss_savings_MW: round(stackHeatLossSavingMW, 3),
      mm_pct: mmEnabled ? mmPct : 0,
      ega_pct: egaEnabled ? egaPct : 0,
    },
  };
}

function formatEmissions(em) {
  const out = {};
  for (const gas of ['O2', 'CO2', 'CO', 'SO2', 'NO', 'H2O', 'N2', 'total']) {
    if (em[gas]) {
      out[gas] = {
        masa_kg: round(em[gas].masa_kg, 2),
        volumen_m3: round(em[gas].volumen_m3, 2),
      };
    }
  }
  return out;
}

/** Entrada estándar CHACHITOS para tests §6 */
function chachitosInput(overrides = {}) {
  return {
    fuel: { ...FUEL_LIBRARY.natural_gas_pittsburgh },
    ambient: { temperature_c: 25, pressure_kpa: 101.33 },
    consumption: { value: 35910, unit: 'm3', period: 'month', unit_cost: 4.57 },
    existing: { o2_pct: 7.0, flue_temp_c: 169 },
    projected: { o2_pct: 3.0, flue_temp_c: 142 },
    savings: { mm_enabled: true, mm_pct: 3.0, ega_enabled: false, ega_pct: 0 },
    ...overrides,
  };
}

module.exports = {
  calculate,
  validateInput,
  normalizeComposition,
  calcCO2Max,
  calcCO2Actual,
  excessAirFromO2,
  o2FromCO2,
  volumenGas,
  rhoAire,
  rhoCombustible,
  heatInputMW,
  productosPorKg,
  calcLHV,
  calcularEficiencia,
  aplicarAhorrosAdicionales,
  chachitosInput,
  FUEL_LIBRARY,
  PERIOD_HOURS,
  PHYSICAL,
};

```


================================================================================
# ARCHIVO: src/lib/combustionConstants.js
================================================================================

```javascript
'use strict';

/**
 * Constantes físicas y coeficientes calibrados para la calculadora Autoflame.
 * Calores específicos medios (kJ/kg·K) para gases de chimenea ~150–250 °C.
 * Calibrados contra reporte CHACHITOS / CHIHUAHUA (§6).
 */
const PHYSICAL = {
  O2_FRACCION_AIRE_MASA: 0.232,
  RELACION_MOLAR_N2_O2: 3.76,
  /** Constantes de gases ideales R (kJ/kg·K) */
  R: {
    N2: 0.2968,
    O2: 0.2598,
    CO: 0.2968,
    H2O: 0.4615,
    SO2: 0.1298,
    CO2: 0.1889,
    Aire: 0.287,
  },
  /** Pesos molares (g/mol) */
  MW: {
    C: 12,
    H: 1,
    O: 16,
    S: 32,
    N: 14,
    O2: 32,
    N2: 28,
    CO2: 44,
    H2O: 18,
    SO2: 64,
  },
  /** Calor latente del vapor de agua en chimenea (kJ/kg H2O) — condensación no recuperada */
  LATENT_H2O_KJ_KG: 2257,
  /**
   * cp medio Siegert para gases secos de chimenea (kJ/kg·K).
   * Calibrado contra reporte CHACHITOS §6.
   */
  CP_FLUE_DRY_KJ_KG_K: 0.982,
  CP_H2O_FLUE_KJ_KG_K: 1.94,
  /** Multiplicador del calor latente en eficiencia bruta (HHV) — calibración §6 */
  LATENT_GROSS_FACTOR: 1.263,
  /** Factor de calibración para ahorro de pérdida en chimenea (MW) — §6 CHACHITOS */
  STACK_SAVINGS_CALIBRATION: 1.282,
  /** Horas por mes estándar Autoflame */
  HORAS_MES: 730,
  /** O2 en aire seco (%) */
  O2_AIRE: 21,
};

/** Librería de combustibles predefinidos (fracciones másicas C/H/S/N/O/W) */
const FUEL_LIBRARY = {
  natural_gas_pittsburgh: {
    id: 'natural_gas_pittsburgh',
    name: 'Natural Gas (Pittsburgh PA)',
    nameEs: 'Gas Natural (Pittsburgh PA)',
    C: 0.757,
    H: 0.235,
    S: 0,
    N: 0.008,
    O: 0,
    W: 0,
    CV_MJ_kg: 58.13,
    SG: 0.63,
  },
  natural_gas_generic: {
    id: 'natural_gas_generic',
    name: 'Natural Gas (Generic)',
    nameEs: 'Gas Natural (Genérico)',
    C: 0.75,
    H: 0.25,
    S: 0,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 50,
    SG: 0.65,
  },
  fuel_oil_2: {
    id: 'fuel_oil_2',
    name: 'Fuel Oil No. 2',
    nameEs: 'Combustóleo No. 2',
    C: 0.86,
    H: 0.14,
    S: 0.001,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 42.5,
    SG: 0.85,
  },
  diesel: {
    id: 'diesel',
    name: 'Diesel',
    nameEs: 'Diésel',
    C: 0.86,
    H: 0.14,
    S: 0.001,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 43,
    SG: 0.84,
  },
  propane: {
    id: 'propane',
    name: 'Propane',
    nameEs: 'Propano',
    C: 0.818,
    H: 0.182,
    S: 0,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 50.35,
    SG: 1.55,
  },
};

/** Periodos de consumo → horas */
const PERIOD_HOURS = {
  hour: 1,
  day: 24,
  week: 168,
  month: PHYSICAL.HORAS_MES,
  quarter: PHYSICAL.HORAS_MES * 3,
  year: 8760,
};

module.exports = {
  PHYSICAL,
  FUEL_LIBRARY,
  PERIOD_HOURS,
};

```


================================================================================
# ARCHIVO: src/newModules.js
================================================================================

```javascript
'use strict';

const { createdByFields, updatedByFields, logAuditEvent, nowUtc } = require('./audit');
const { MODULES, isAdminOnlyModule } = require('./permissions');
const { roundMoney, buildProjectTotals } = require('./calculations');
const { getEmpleadosActivos } = require('./vacations');
const {
  PROJECT_COMMISSION_BASE_TYPES,
  loadExchangeRates,
  mapProjectForCommission,
  calculateProjectCommission,
  mapCommissionListRow,
  parseCommissionsPeriod,
  buildCommissionsDashboard,
} = require('./commissions');

function commissionProjectMetrics(db, project) {
  const rates = loadExchangeRates(db);
  const payments = db.prepare('SELECT amount, currency FROM project_payments WHERE project_id = ?').all(project.id);
  const costs = db.prepare('SELECT amount, currency FROM project_costs WHERE project_id = ?').all(project.id);
  const totals = buildProjectTotals(project, payments, costs, rates);
  const totalSaleMxn = totals.total_invoiced_mxn;
  const totalCostsMxn = totals.spent;
  const grossProfitMxn = roundMoney(totalSaleMxn - totalCostsMxn);
  return {
    rates,
    totalSaleMxn,
    totalCostsMxn,
    grossProfitMxn,
    netProfitMxn: grossProfitMxn,
    finalMargin: totals.final_margin,
  };
}

/** Agregado por usuario — compatible SQLite y PostgreSQL (PG exige agregados fuera de GROUP BY). */
const SESSION_USER_AGGREGATE_SQL = `
  SELECT user_id,
         MAX(user_name) AS user_name,
         MAX(role) AS role,
         COUNT(*) AS total_sessions,
         COALESCE(SUM(duration_seconds), 0) AS total_seconds,
         MAX(last_activity_at) AS last_activity
  FROM user_session_activities
`;

function logActivityMonitorError(route, error) {
  console.error(`[activity-monitor] ${route}:`, error.message, {
    code: error.code,
    detail: error.detail,
    stack: error.stack,
  });
}

function registerNewModules(app, db, { requireAuth, requirePermission, badRequest, requiredText, optionalText, numberValue, enumValue, currencyValue, booleanValue, trim }) {
  function getActiveEmployeeOrFail(employeeId) {
    const employee = db
      .prepare('SELECT id, full_name, hire_date, active FROM employees WHERE id = ? AND active = 1')
      .get(employeeId);
    if (!employee) throw badRequest('Empleado activo no encontrado en Vacaciones.');
    return employee;
  }

  function resolveCommissionAgentOrFail(salesAgentId) {
    const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL AND active = 1').get(salesAgentId);
    if (!agent) throw badRequest('Vendedora no encontrada o inactiva.');
    if (agent.employee_id) {
      const linkedEmployee = db.prepare('SELECT active FROM employees WHERE id = ?').get(agent.employee_id);
      if (!linkedEmployee || !linkedEmployee.active) throw badRequest('La vendedora debe ser un empleado activo de Vacaciones.');
    }
    return agent;
  }

  /** Asignacion: solo empleados activos de Vacaciones vinculados a vendedora registrada. */
  function resolveSalesAgentFromRequest(req) {
    if (req.body.employee_id != null && req.body.employee_id !== '') {
      const employeeId = numberValue(req.body, 'employee_id', 'Empleado', { min: 1 });
      getActiveEmployeeOrFail(employeeId);
      const agent = db
        .prepare('SELECT * FROM sales_commission_agents WHERE employee_id = ? AND deleted_at IS NULL AND active = 1')
        .get(employeeId);
      if (!agent) {
        throw badRequest('Registre al empleado como vendedora en la pestana 1 (Vendedoras) antes de asignar comisiones.');
      }
      return agent;
    }
    return resolveCommissionAgentOrFail(numberValue(req.body, 'sales_agent_id', 'Vendedora', { min: 1 }));
  }

  // ===================== ROLE PERMISSIONS CONFIGURATION =====================

  app.get('/api/admin/role-permissions', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede configurar roles.' });
      const rows = db.prepare('SELECT * FROM role_permissions ORDER BY role').all();
      const result = {};
      for (const row of rows) { result[row.role] = JSON.parse(row.permissions_json || '{}'); }
      res.json({ roles: result, modules: MODULES });
    } catch (error) { next(error); }
  });

  app.put('/api/admin/role-permissions/:role', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede configurar roles.' });
      const { role } = req.params;
      if (!['user', 'tecnico'].includes(role)) throw badRequest('No se puede modificar permisos del rol admin.');
      const { permissions } = req.body;
      if (!permissions || typeof permissions !== 'object') throw badRequest('Permisos invalidos.');
      for (const mod of Object.keys(permissions)) {
        if (isAdminOnlyModule(mod) && permissions[mod] && permissions[mod].length > 0) {
          throw badRequest(`El modulo ${mod} es exclusivo de administradores.`);
        }
      }
      const json = JSON.stringify(permissions);
      const existing = db.prepare('SELECT id FROM role_permissions WHERE role = ?').get(role);
      if (existing) {
        db.prepare('UPDATE role_permissions SET permissions_json = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ?').run(json, role);
      } else {
        db.prepare('INSERT INTO role_permissions (role, permissions_json) VALUES (?, ?)').run(role, json);
      }
      logAuditEvent(db, { req, action: 'update_role_permissions', module: 'users', entityType: 'role', entityLabel: role, after: permissions });
      res.json({ message: 'Permisos del rol actualizados.', permissions });
    } catch (error) { next(error); }
  });

  // ===================== COMMISSIONS MODULE =====================

  app.get('/api/commissions/active-employees', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      res.json(getEmpleadosActivos(db));
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/summary', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const period = parseCommissionsPeriod(req.query);
      const dashboard = buildCommissionsDashboard(db, period);
      const activeAgents = db.prepare("SELECT COUNT(*) as cnt FROM sales_commission_agents WHERE active = 1 AND deleted_at IS NULL").get().cnt;
      const pendingProjects = db.prepare(`SELECT COUNT(*) as cnt FROM projects p
        WHERE p.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM sales_commissions sc
            WHERE sc.project_id = p.id AND sc.deleted_at IS NULL AND sc.status != 'cancelada'
          )`).get().cnt;
      const agentSummaries = db.prepare(`SELECT sca.id, sca.name, sca.employee_id, sca.active,
        COALESCE((SELECT SUM(sc.commission_amount_mxn) FROM sales_commissions sc WHERE sc.sales_agent_id = sca.id AND sc.deleted_at IS NULL AND sc.status NOT IN ('no_aplica', 'cancelada')), 0) as earned_mxn,
        COALESCE((SELECT SUM(sc.commission_amount_mxn) FROM sales_commissions sc WHERE sc.sales_agent_id = sca.id AND sc.deleted_at IS NULL AND sc.status = 'pendiente'), 0) as pending_commissions_mxn,
        COALESCE((SELECT SUM(scp.amount_mxn) FROM sales_commission_payments scp WHERE scp.sales_agent_id = sca.id AND scp.deleted_at IS NULL), 0) as paid_mxn,
        (SELECT COUNT(*) FROM sales_commissions sc2 WHERE sc2.sales_agent_id = sca.id AND sc2.deleted_at IS NULL AND sc2.status = 'pendiente') as pending_count
        FROM sales_commission_agents sca WHERE sca.deleted_at IS NULL ORDER BY sca.name`).all();
      res.json({
        ...dashboard,
        total_earned_mxn: dashboard.totals.commissions_generated_mxn,
        total_paid_mxn: dashboard.totals.commissions_paid_mxn,
        pending_balance_mxn: dashboard.totals.commissions_pending_mxn,
        active_agents: activeAgents,
        pending_projects: pendingProjects,
        agents: agentSummaries.map((a) => ({
          ...a,
          pending_mxn: roundMoney(a.pending_commissions_mxn),
        })),
      });
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/agents', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const agents = db.prepare(`SELECT sca.*, e.full_name as employee_name, e.employee_number
        FROM sales_commission_agents sca
        LEFT JOIN employees e ON e.id = sca.employee_id
        WHERE sca.deleted_at IS NULL
        ORDER BY sca.name`).all();
      res.json(agents);
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/agents', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const startDate = requiredText(req.body, 'start_date', 'Fecha de inicio');
      const relatedUserId = req.body.related_user_id || null;
      const notes = optionalText(req.body, 'notes');
      let name;
      let employeeId = null;
      if (req.body.employee_id != null && req.body.employee_id !== '') {
        employeeId = numberValue(req.body, 'employee_id', 'Empleado', { min: 1 });
        const employee = getActiveEmployeeOrFail(employeeId);
        const duplicate = db.prepare('SELECT id FROM sales_commission_agents WHERE employee_id = ? AND deleted_at IS NULL').get(employeeId);
        if (duplicate) throw badRequest('Este empleado ya esta registrado como vendedora.');
        name = employee.full_name;
      } else {
        name = requiredText(req.body, 'name', 'Nombre de vendedora');
      }
      const audit = createdByFields(req);
      const result = db.prepare(`INSERT INTO sales_commission_agents (name, employee_id, related_user_id, active, start_date, notes, created_by_user_id, created_by_name, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`).run(name, employeeId, relatedUserId, startDate, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission_agent', entityId: agent.id, entityLabel: name, after: agent });
      res.status(201).json(agent);
    } catch (error) { next(error); }
  });

  app.put('/api/commissions/agents/:id', requireAuth, requirePermission('commissions', 'edit'), (req, res, next) => {
    try {
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!agent) throw badRequest('Vendedora no encontrada.');
      const active = booleanValue(req.body, 'active');
      const startDate = req.body.start_date || agent.start_date;
      const endDate = optionalText(req.body, 'end_date');
      const notes = optionalText(req.body, 'notes');
      let name = agent.name;
      let employeeId = agent.employee_id;
      if (req.body.employee_id != null && req.body.employee_id !== '') {
        employeeId = numberValue(req.body, 'employee_id', 'Empleado', { min: 1 });
        const employee = getActiveEmployeeOrFail(employeeId);
        const duplicate = db.prepare('SELECT id FROM sales_commission_agents WHERE employee_id = ? AND deleted_at IS NULL AND id != ?').get(employeeId, req.params.id);
        if (duplicate) throw badRequest('Este empleado ya esta registrado como vendedora.');
        name = employee.full_name;
      } else if (req.body.name) {
        name = requiredText(req.body, 'name', 'Nombre de vendedora');
      }
      const audit = updatedByFields(req);
      db.prepare(`UPDATE sales_commission_agents SET name=?, employee_id=?, related_user_id=?, active=?, start_date=?, end_date=?, notes=?, updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?`)
        .run(name, employeeId, req.body.related_user_id || null, active, startDate, endDate, notes, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);
      const updated = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(req.params.id);
      logAuditEvent(db, { req, action: active ? 'update' : 'deactivate', module: 'commissions', entityType: 'sales_commission_agent', entityId: updated.id, entityLabel: name, before: agent, after: updated });
      res.json(updated);
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/available-projects', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const rates = loadExchangeRates(db);
      const projects = db.prepare(`SELECT p.* FROM projects p
        WHERE p.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM sales_commissions sc
            WHERE sc.project_id = p.id AND sc.deleted_at IS NULL AND sc.status != 'cancelada'
          )
        ORDER BY COALESCE(p.closed_at, p.created_at) DESC, p.id DESC`).all();
      const result = [];
      for (const project of projects) {
        try {
          result.push(mapProjectForCommission(db, project, rates));
        } catch (mapError) {
          console.error('[commissions] available-projects map error project', project.id, mapError.message);
        }
      }
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/api/commissions', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const paidSearch = req.query.paid === '1' || req.query.archived === '1';
      if (paidSearch) {
        const clientName = trim(req.query.client_name);
        const quoteNumber = trim(req.query.quote_number);
        const orderNumber = trim(req.query.order_number);
        const dateFrom = trim(req.query.date_from);
        const dateTo = trim(req.query.date_to);
        if (!clientName && !quoteNumber && !orderNumber && !dateFrom && !dateTo) {
          throw badRequest('Indique al menos un filtro (cliente, cotizacion, pedido o rango de fechas) para consultar comisiones pagadas.');
        }
        const conditions = ["sc.deleted_at IS NULL", "sc.status = 'pagada'"];
        const params = [];
        if (clientName) {
          conditions.push('(p.client_name LIKE ? OR (sc.commission_type = \'extraordinaria\' AND sc.notes LIKE ?))');
          params.push(`%${clientName}%`, `%${clientName}%`);
        }
        if (quoteNumber) { conditions.push('p.quote_number LIKE ?'); params.push(`%${quoteNumber}%`); }
        if (orderNumber) { conditions.push('p.order_number LIKE ?'); params.push(`%${orderNumber}%`); }
        if (dateFrom) { conditions.push('date(COALESCE(sc.paid_at, sc.updated_at)) >= date(?)'); params.push(dateFrom); }
        if (dateTo) { conditions.push('date(COALESCE(sc.paid_at, sc.updated_at)) <= date(?)'); params.push(dateTo); }
        const rows = db.prepare(`SELECT sc.*, sca.name as agent_name, p.quote_number, p.client_name, p.order_number
          FROM sales_commissions sc
          JOIN sales_commission_agents sca ON sca.id = sc.sales_agent_id
          LEFT JOIN projects p ON p.id = sc.project_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(sc.paid_at, sc.updated_at) DESC`).all(...params);
        return res.json(rows.map(mapCommissionListRow));
      }
      const rows = db.prepare(`SELECT sc.*, sca.name as agent_name, p.quote_number, p.client_name, p.order_number
        FROM sales_commissions sc
        JOIN sales_commission_agents sca ON sca.id = sc.sales_agent_id
        LEFT JOIN projects p ON p.id = sc.project_id
        WHERE sc.deleted_at IS NULL AND sc.status = 'pendiente'
        ORDER BY sc.assigned_at DESC`).all();
      res.json(rows.map(mapCommissionListRow));
    } catch (error) { next(error); }
  });

  app.post('/api/commissions', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const projectId = numberValue(req.body, 'project_id', 'Proyecto', { min: 1 });
      const agent = resolveSalesAgentFromRequest(req);
      const salesAgentId = agent.id;
      const baseType = enumValue(req.body, 'commission_calculation_base_type', 'Tipo de comision', PROJECT_COMMISSION_BASE_TYPES);
      const existing = db.prepare("SELECT id FROM sales_commissions WHERE project_id = ? AND deleted_at IS NULL AND status != 'cancelada'").get(projectId);
      if (existing) throw badRequest('Este proyecto ya tiene una comision asignada y no puede reasignarse.');
      const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
      if (!project) throw badRequest('Proyecto no encontrado.');
      const { totalSaleMxn, grossProfitMxn, netProfitMxn, finalMargin } = commissionProjectMetrics(db, project);
      const manualAmount = baseType === 'monto_manual'
        ? numberValue(req.body, 'commission_amount_mxn', 'Monto de comision', { min: 0.01 })
        : null;
      const calc = calculateProjectCommission(baseType, totalSaleMxn, manualAmount);
      if (!calc || calc.commissionAmountMxn <= 0) throw badRequest('Monto de comision invalido.');
      const audit = createdByFields(req);
      const result = db.prepare(`INSERT INTO sales_commissions (
          project_id, sales_agent_id, commission_type, commission_calculation_base_type, commission_base_mxn,
          total_sale_mxn_snapshot, gross_profit_mxn_snapshot, net_profit_mxn_snapshot, final_margin_snapshot,
          commission_percentage, commission_amount_mxn, status, notes, reference,
          assigned_by_user_id, assigned_by_name, assigned_at, created_at, updated_at
        ) VALUES (?, ?, 'proyecto', ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?)`).run(
        projectId, salesAgentId, baseType, calc.commissionBaseMxn, totalSaleMxn, grossProfitMxn, netProfitMxn, finalMargin,
        calc.commissionPercentage, calc.commissionAmountMxn, optionalText(req.body, 'notes'), optionalText(req.body, 'reference'),
        audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at, audit.created_at,
      );
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `${project.quote_number} - ${agent.name}`, after: commission, metadata: { base_type: baseType, commission_type: 'proyecto' } });
      res.status(201).json(mapCommissionListRow({ ...commission, quote_number: project.quote_number, client_name: project.client_name, order_number: project.order_number, agent_name: agent.name }));
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/extraordinary', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const agent = resolveSalesAgentFromRequest(req);
      const salesAgentId = agent.id;
      const amountMxn = numberValue(req.body, 'commission_amount_mxn', 'Monto', { min: 0.01 });
      const description = requiredText(req.body, 'description', 'Descripcion');
      const reference = optionalText(req.body, 'reference');
      const audit = createdByFields(req);
      const rounded = roundMoney(amountMxn);
      const result = db.prepare(`INSERT INTO sales_commissions (
          project_id, sales_agent_id, commission_type, commission_calculation_base_type, commission_base_mxn,
          commission_percentage, commission_amount_mxn, status, notes, reference,
          assigned_by_user_id, assigned_by_name, assigned_at, created_at, updated_at
        ) VALUES (NULL, ?, 'extraordinaria', 'monto_manual', ?, 0, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?)`).run(
        salesAgentId, rounded, rounded, description, reference,
        audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at, audit.created_at,
      );
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `Extraordinaria - ${agent.name}`, after: commission, metadata: { commission_type: 'extraordinaria' } });
      res.status(201).json(mapCommissionListRow({ ...commission, agent_name: agent.name }));
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/:id/pay', requireAuth, requirePermission('commissions', 'pay'), (req, res, next) => {
    try {
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!commission) throw badRequest('Comision no encontrada.');
      if (commission.status === 'pagada') throw badRequest('Esta comision ya esta pagada.');
      if (commission.status === 'cancelada') throw badRequest('No se puede pagar una comision cancelada.');
      const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
      const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
      const currency = currencyValue(req.body, 'currency', 'Moneda');
      const exchangeRateToMxn = currency === 'MXN' ? 1 : numberValue(req.body, 'exchange_rate_to_mxn', 'Tipo de cambio', { min: 0.01 });
      const amountMxn = roundMoney(amountOriginal * exchangeRateToMxn);
      const reference = optionalText(req.body, 'reference');
      const notes = optionalText(req.body, 'notes');
      const audit = createdByFields(req);
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(commission.sales_agent_id);
      const payResult = db.prepare(`INSERT INTO sales_commission_payments (
          commission_id, sales_agent_id, payment_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn,
          reference, notes, created_by_user_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        commission.id, commission.sales_agent_id, paymentDate, amountOriginal, currency, exchangeRateToMxn, amountMxn,
        reference, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at,
      );
      db.prepare(`UPDATE sales_commissions SET status='pagada', paid_at=?, reference=COALESCE(?, reference), updated_at=? WHERE id=?`)
        .run(paymentDate, reference, audit.created_at, commission.id);
      const payment = db.prepare('SELECT * FROM sales_commission_payments WHERE id = ?').get(payResult.lastInsertRowid);
      const updated = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(commission.id);
      logAuditEvent(db, { req, action: 'pay', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `${agent?.name || ''} - ${amountMxn} MXN`, after: updated, metadata: { payment_id: payment.id } });
      res.status(201).json({ commission: mapCommissionListRow(updated), payment });
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/:id/cancel', requireAuth, requirePermission('commissions', 'delete'), (req, res, next) => {
    try {
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!commission) throw badRequest('Comision no encontrada.');
      if (commission.status === 'cancelada') throw badRequest('Ya esta cancelada.');
      const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
      const audit = updatedByFields(req);
      db.prepare("UPDATE sales_commissions SET status='cancelada', delete_reason=?, deleted_by_user_id=?, deleted_by_name=?, deleted_at=?, updated_at=? WHERE id=?").run(reason, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, audit.updated_at, req.params.id);
      logAuditEvent(db, { req, action: 'cancel', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, metadata: { reason } });
      res.json({ message: 'Comision cancelada.' });
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/payments', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const agentId = req.query.agent_id;
      const baseSql = `SELECT scp.*, sca.name as agent_name, sc.commission_type, p.quote_number
        FROM sales_commission_payments scp
        JOIN sales_commission_agents sca ON sca.id = scp.sales_agent_id
        LEFT JOIN sales_commissions sc ON sc.id = scp.commission_id
        LEFT JOIN projects p ON p.id = sc.project_id
        WHERE scp.deleted_at IS NULL`;
      const payments = agentId
        ? db.prepare(`${baseSql} AND scp.sales_agent_id = ? ORDER BY scp.payment_date DESC`).all(agentId)
        : db.prepare(`${baseSql} ORDER BY scp.payment_date DESC`).all();
      res.json(payments);
    } catch (error) { next(error); }
  });

  // ===================== ACTIVITY MONITOR MODULE =====================

  app.get('/api/activity-monitor/sessions', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      cleanupInactiveSessions(db);
      const active = db.prepare('SELECT * FROM user_session_activities WHERE is_active = 1 ORDER BY last_activity_at DESC').all();
      res.json(active);
    } catch (error) { logActivityMonitorError('GET /sessions', error); next(error); }
  });

  app.get('/api/activity-monitor/weekly-report', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const year = Number(req.query.year) || new Date().getFullYear();
      const week = Number(req.query.week) || Math.ceil((Date.now() - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const startOfYear = new Date(year, 0, 1);
      const weekStart = new Date(startOfYear.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const sessions = db.prepare(`${SESSION_USER_AGGREGATE_SQL} WHERE login_at >= ? AND login_at < ? GROUP BY user_id ORDER BY total_seconds DESC`).all(weekStart.toISOString(), weekEnd.toISOString());
      const deniedAccess = db.prepare("SELECT user_name, COUNT(*) as count FROM audit_logs WHERE action = 'access_denied' AND timestamp_utc >= ? AND timestamp_utc < ? GROUP BY user_name").all(weekStart.toISOString(), weekEnd.toISOString());
      res.json({ year, week, week_start: weekStart.toISOString(), week_end: weekEnd.toISOString(), users: sessions.map(s => ({ ...s, avg_per_day: s.total_seconds ? Math.round(s.total_seconds / 7) : 0 })), denied_access: deniedAccess });
    } catch (error) { logActivityMonitorError('GET /weekly-report', error); next(error); }
  });

  app.get('/api/activity-monitor/recent-sessions', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const sessions = db.prepare('SELECT * FROM user_session_activities ORDER BY login_at DESC LIMIT 50').all();
      res.json({ data: sessions });
    } catch (error) { logActivityMonitorError('GET /recent-sessions', error); next(error); }
  });

  app.get('/api/activity-monitor/recent-events', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const events = db.prepare('SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, metadata_json FROM audit_logs ORDER BY id DESC LIMIT 50').all();
      res.json({ data: events });
    } catch (error) { logActivityMonitorError('GET /recent-events', error); next(error); }
  });

  // ===================== ACTIVITY MONITOR SUMMARY WITH PERIOD FILTERS =====================

  function getActivityDateRange(periodType, params) {
    const CDMX_OFFSET = -6;
    function cdmxToUtc(dateStr) {
      const d = new Date(dateStr);
      d.setHours(d.getHours() - CDMX_OFFSET);
      return d.toISOString();
    }
    function lastDayOfMonth(year, month) {
      return new Date(year, month, 0).getDate();
    }
    function getISOWeekDates(year, weekNum) {
      const jan4 = new Date(year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { monday, sunday };
    }
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    if (periodType === 'year') {
      const y = Number(params.year);
      return {
        startDate: cdmxToUtc(`${y}-01-01T00:00:00`),
        endDate: cdmxToUtc(`${y}-12-31T23:59:59`),
        label: `${y}`,
      };
    }
    if (periodType === 'month') {
      const y = Number(params.year);
      const m = Number(params.month);
      const lastDay = lastDayOfMonth(y, m);
      const mStr = String(m).padStart(2, '0');
      return {
        startDate: cdmxToUtc(`${y}-${mStr}-01T00:00:00`),
        endDate: cdmxToUtc(`${y}-${mStr}-${String(lastDay).padStart(2,'0')}T23:59:59`),
        label: `${monthNames[m-1]} ${y}`,
      };
    }
    if (periodType === 'week') {
      const y = Number(params.year);
      const w = Number(params.weekNumber);
      const { monday, sunday } = getISOWeekDates(y, w);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return {
        startDate: cdmxToUtc(`${fmt(monday)}T00:00:00`),
        endDate: cdmxToUtc(`${fmt(sunday)}T23:59:59`),
        label: `Semana ${w} de ${y} (${fmt(monday)} a ${fmt(sunday)})`,
      };
    }
    if (periodType === 'day') {
      const dateStr = params.date;
      return {
        startDate: cdmxToUtc(`${dateStr}T00:00:00`),
        endDate: cdmxToUtc(`${dateStr}T23:59:59`),
        label: dateStr,
      };
    }
    return null;
  }

  app.get('/api/activity-monitor/summary', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const { periodType, year, month, weekNumber, date, userId, role } = req.query;
      if (!periodType || !['year', 'month', 'week', 'day'].includes(periodType)) {
        return res.status(400).json({ message: 'periodType es obligatorio (year, month, week, day).' });
      }
      if ((periodType === 'year' || periodType === 'month' || periodType === 'week') && !year) {
        return res.status(400).json({ message: 'year es obligatorio para este tipo de periodo.' });
      }
      if (periodType === 'month' && (!month || month < 1 || month > 12)) {
        return res.status(400).json({ message: 'month es obligatorio y debe ser 1-12.' });
      }
      if (periodType === 'week' && (!weekNumber || weekNumber < 1 || weekNumber > 53)) {
        return res.status(400).json({ message: 'weekNumber es obligatorio y debe ser 1-53.' });
      }
      if (periodType === 'day' && !date) {
        return res.status(400).json({ message: 'date es obligatorio para consulta por dia.' });
      }
      const range = getActivityDateRange(periodType, { year, month, weekNumber, date });
      if (!range) return res.status(400).json({ message: 'No se pudo calcular el rango de fechas.' });

      let sessionFilter = 'login_at >= ? AND login_at <= ?';
      let sessionParams = [range.startDate, range.endDate];
      let eventFilter = 'timestamp_utc >= ? AND timestamp_utc <= ?';
      let eventParams = [range.startDate, range.endDate];

      if (userId) { sessionFilter += ' AND user_id = ?'; sessionParams.push(Number(userId)); eventFilter += ' AND user_id = ?'; eventParams.push(Number(userId)); }
      if (role) { sessionFilter += ' AND role = ?'; sessionParams.push(role); eventFilter += ' AND module IS NOT NULL'; }

      const users = db.prepare(`${SESSION_USER_AGGREGATE_SQL} WHERE ${sessionFilter} GROUP BY user_id ORDER BY total_seconds DESC`).all(...sessionParams);

      const totalSessions = users.reduce((sum, u) => sum + u.total_sessions, 0);
      const totalDuration = users.reduce((sum, u) => sum + u.total_seconds, 0);

      const totalEvents = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE ${eventFilter}`).get(...eventParams).cnt;
      const deniedEvents = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'access_denied' AND ${eventFilter}`).get(...eventParams).cnt;

      const events = db.prepare(`SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc FROM audit_logs WHERE ${eventFilter} ORDER BY id DESC LIMIT 100`).all(...eventParams);

      const userResults = users.map(u => {
        const userEvents = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = ? AND ${eventFilter}`).get(u.user_id, ...eventParams).cnt;
        const userDenied = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = ? AND action = 'access_denied' AND ${eventFilter}`).get(u.user_id, ...eventParams).cnt;
        return { ...u, avg_per_session: u.total_sessions > 0 ? Math.round(u.total_seconds / u.total_sessions) : 0, total_events: userEvents, denied_access: userDenied };
      });

      logAuditEvent(db, { req, action: 'view_activity_summary', module: 'activityMonitor', metadata: { periodType, year, month, weekNumber, date } });

      res.json({
        period: { periodType, label: range.label, startDate: range.startDate, endDate: range.endDate },
        summary: { totalUsers: users.length, totalSessions, totalDurationSeconds: totalDuration, averageSessionDurationSeconds: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0, totalEvents, deniedAccessEvents: deniedEvents },
        users: userResults,
        events: events,
      });
    } catch (error) { logActivityMonitorError('GET /summary', error); next(error); }
  });

  // ===================== SKINS / USER PREFERENCES =====================

  const VALID_THEMES = ['default', 'dark', 'corporate', 'high_contrast'];

  app.get('/api/preferences/theme', requireAuth, (req, res, next) => {
    try {
      const pref = db.prepare('SELECT theme_name FROM user_preferences WHERE user_id = ?').get(req.session.userId);
      res.json({ theme: pref ? pref.theme_name : 'default' });
    } catch (error) { next(error); }
  });

  app.put('/api/preferences/theme', requireAuth, (req, res, next) => {
    try {
      const theme = trim(req.body.theme) || 'default';
      if (!VALID_THEMES.includes(theme)) throw badRequest('Tema invalido. Opciones: ' + VALID_THEMES.join(', '));
      const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(req.session.userId);
      if (existing) { db.prepare('UPDATE user_preferences SET theme_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(theme, req.session.userId); }
      else { db.prepare('INSERT INTO user_preferences (user_id, theme_name) VALUES (?, ?)').run(req.session.userId, theme); }
      logAuditEvent(db, { req, action: 'change_theme', module: 'preferences', entityType: 'user_preference', entityId: req.session.userId, metadata: { theme } });
      res.json({ theme });
    } catch (error) { next(error); }
  });
}

function updateSessionActivity(db, req) {
  if (!req.session || !req.session.userId) return;
  const crypto = require('node:crypto');
  const sessionHash = crypto.createHash('sha256').update(req.sessionID || '').digest('hex').substring(0, 16);
  const now = nowUtc();
  try {
    const existing = db.prepare('SELECT id, login_at FROM user_session_activities WHERE session_id_hash = ? AND is_active = 1').get(sessionHash);
    if (existing) {
      const duration = Math.floor((new Date(now) - new Date(existing.login_at)) / 1000);
      db.prepare('UPDATE user_session_activities SET last_activity_at = ?, duration_seconds = ?, updated_at = ? WHERE id = ?').run(now, duration, now, existing.id);
    } else {
      db.prepare('INSERT INTO user_session_activities (user_id, user_name, role, session_id_hash, login_at, last_activity_at, ip_address, user_agent, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)').run(req.session.userId, req.session.username, req.session.role, sessionHash, now, now, req.ip || null, req.get ? req.get('user-agent') || null : null, now, now);
    }
  } catch (e) { /* non-critical */ }
}

function closeSessionActivity(db, req) {
  if (!req.session || !req.sessionID) return;
  const crypto = require('node:crypto');
  const sessionHash = crypto.createHash('sha256').update(req.sessionID || '').digest('hex').substring(0, 16);
  const now = nowUtc();
  try {
    const existing = db.prepare('SELECT id, login_at FROM user_session_activities WHERE session_id_hash = ? AND is_active = 1').get(sessionHash);
    if (existing) {
      const duration = Math.floor((new Date(now) - new Date(existing.login_at)) / 1000);
      db.prepare('UPDATE user_session_activities SET logout_at = ?, last_activity_at = ?, duration_seconds = ?, is_active = 0, updated_at = ? WHERE id = ?').run(now, now, duration, now, existing.id);
    }
  } catch (e) { /* non-critical */ }
}

function cleanupInactiveSessions(db) {
  try {
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const inactive = db.prepare('SELECT id, login_at, last_activity_at FROM user_session_activities WHERE is_active = 1 AND last_activity_at < ?').all(threshold);
    for (const s of inactive) {
      const duration = Math.floor((new Date(s.last_activity_at) - new Date(s.login_at)) / 1000);
      db.prepare('UPDATE user_session_activities SET is_active = 0, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(duration, s.id);
    }
  } catch (e) { /* non-critical */ }
}

module.exports = { registerNewModules, updateSessionActivity, closeSessionActivity, cleanupInactiveSessions };

```


================================================================================
# ARCHIVO: src/pagination.js
================================================================================

```javascript
const { sqlSearchExpr, normalizeSearchTerm } = require('./search');

const ALLOWED_LIMITS = [15, 30, 50];
const MAX_EXPORT_LIMIT = 9999;
const DEFAULT_LIMIT = 15;
const VALID_SORT_ORDERS = ['ASC', 'DESC'];

function parsePaginationParams(query) {
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (!ALLOWED_LIMITS.includes(limit)) {
    if (Number.isFinite(limit) && limit > 50 && limit <= MAX_EXPORT_LIMIT) {
      limit = MAX_EXPORT_LIMIT;
    } else {
      limit = DEFAULT_LIMIT;
    }
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

  return { page, limit, search, sortBy, sortOrder };
}

function normalizeSort(query, allowedSorts = {}, defaultSort = '') {
  const rawSortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortBy = rawSortBy && Object.prototype.hasOwnProperty.call(allowedSorts, rawSortBy)
    ? rawSortBy
    : '';
  const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const sortExpression = sortBy ? allowedSorts[sortBy] : '';
  const orderBy = sortExpression
    ? `${sortExpression} ${sortOrder}`
    : defaultSort;

  return {
    sortBy,
    sortOrder,
    orderBy,
  };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === '1' || value === 1 || value === 'si') {
    return 1;
  }
  if (value === false || value === 'false' || value === '0' || value === 0 || value === 'no') {
    return 0;
  }
  return null;
}

function readQueryValue(query, key) {
  const value = query[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function addSqlFilters(query, filterDefinitions = {}, whereParts = [], params = []) {
  const activeFilters = {};

  Object.entries(filterDefinitions).forEach(([key, definition]) => {
    const column = definition.column || definition.expression;
    if (!column) return;

    if (definition.type === 'text') {
      const value = String(readQueryValue(query, key) ?? '').trim();
      if (value) {
        const term = normalizeSearchTerm(value);
        if (term) {
          whereParts.push(`${sqlSearchExpr(column)} LIKE ?`);
          params.push(`%${term}%`);
          activeFilters[key] = value;
        }
      }
      return;
    }

    if (definition.type === 'number' || definition.type === 'currency') {
      const exact = String(readQueryValue(query, key) ?? '').trim();
      const min = String(readQueryValue(query, `${key}_min`) ?? readQueryValue(query, `${key}_from`) ?? '').trim();
      const max = String(readQueryValue(query, `${key}_max`) ?? readQueryValue(query, `${key}_to`) ?? '').trim();

      if (exact) {
        const numeric = Number(exact);
        if (Number.isFinite(numeric)) {
          whereParts.push(`${column} = ?`);
          params.push(numeric);
          activeFilters[key] = numeric;
        }
      }
      if (min) {
        const numeric = Number(min);
        if (Number.isFinite(numeric)) {
          whereParts.push(`${column} >= ?`);
          params.push(numeric);
          activeFilters[`${key}_min`] = numeric;
        }
      }
      if (max) {
        const numeric = Number(max);
        if (Number.isFinite(numeric)) {
          whereParts.push(`${column} <= ?`);
          params.push(numeric);
          activeFilters[`${key}_max`] = numeric;
        }
      }
      return;
    }

    if (definition.type === 'date') {
      const exact = String(readQueryValue(query, key) ?? '').trim();
      const from = String(readQueryValue(query, `${key}_from`) ?? '').trim();
      const to = String(readQueryValue(query, `${key}_to`) ?? '').trim();

      if (exact && isValidDate(exact)) {
        whereParts.push(`${column} = ?`);
        params.push(exact);
        activeFilters[key] = exact;
      }
      if (from && isValidDate(from)) {
        whereParts.push(`${column} >= ?`);
        params.push(from);
        activeFilters[`${key}_from`] = from;
      }
      if (to && isValidDate(to)) {
        whereParts.push(`${column} <= ?`);
        params.push(to);
        activeFilters[`${key}_to`] = to;
      }
      return;
    }

    if (definition.type === 'select') {
      const value = String(readQueryValue(query, key) ?? '').trim();
      const options = definition.options || [];
      if (value && (!options.length || options.includes(value))) {
        whereParts.push(`${column} = ?`);
        params.push(value);
        activeFilters[key] = value;
      }
      return;
    }

    if (definition.type === 'boolean') {
      const value = normalizeBoolean(readQueryValue(query, key));
      if (value !== null) {
        whereParts.push(`${column} = ?`);
        params.push(value);
        activeFilters[key] = Boolean(value);
      }
    }
  });

  return { whereParts, params, activeFilters };
}

function buildListResponse(data, pagination, sorting, filters, extra = {}) {
  return {
    data,
    pagination,
    sorting: {
      sortBy: sorting.sortBy || '',
      sortOrder: sorting.sortOrder === 'DESC' ? 'desc' : 'asc',
    },
    filters: filters || {},
    ...extra,
  };
}

function buildPaginationMeta(page, limit, totalRecords) {
  const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / limit) : 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  return {
    page: safePage,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
    offset,
  };
}

module.exports = {
  ALLOWED_LIMITS,
  MAX_EXPORT_LIMIT,
  DEFAULT_LIMIT,
  VALID_SORT_ORDERS,
  parsePaginationParams,
  buildPaginationMeta,
  normalizeSort,
  isValidDate,
  normalizeBoolean,
  addSqlFilters,
  buildListResponse,
};

```


================================================================================
# ARCHIVO: src/permissions.js
================================================================================

```javascript
'use strict';

const MODULES = {
  projects: ['view', 'create', 'edit', 'delete', 'close'],
  closedProjects: ['view', 'delete'],
  reports: ['view', 'create', 'edit', 'delete', 'print'],
  reportsArchive: ['view', 'edit', 'delete', 'print'],
  vacations: ['view', 'create', 'edit', 'delete'],
  attendance: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'reopen'],
  ecovisAccount: ['view', 'create', 'edit', 'cancel'],
  serviceQuoter: ['view', 'configure'],
  users: ['view', 'create', 'edit', 'managePermissions'],
  backups: ['view', 'backup', 'import'],
  settings: ['view', 'edit'],
  commissions: ['view', 'create', 'edit', 'delete', 'pay', 'configure'],
  activityMonitor: ['view'],
};

const ADMIN_ONLY_MODULES = ['backups', 'users', 'activityMonitor'];

const DEFAULT_PERMISSIONS = {
  admin: buildFullPermissions(),
  user: {
    projects: ['view', 'create', 'edit'],
    closedProjects: ['view'],
    reports: ['view', 'create', 'edit', 'print'],
    reportsArchive: ['view', 'print'],
    vacations: [],
    attendance: [],
    ecovisAccount: [],
    serviceQuoter: [],
    users: [],
    backups: [],
    settings: ['view'],
    commissions: [],
    activityMonitor: [],
  },
  tecnico: {
    projects: [],
    closedProjects: [],
    reports: ['view', 'create', 'edit', 'print'],
    reportsArchive: ['view', 'print'],
    vacations: [],
    attendance: [],
    ecovisAccount: [],
    serviceQuoter: [],
    users: [],
    backups: [],
    settings: [],
    commissions: [],
    activityMonitor: [],
  },
};

function buildFullPermissions() {
  const perms = {};
  for (const [mod, actions] of Object.entries(MODULES)) {
    perms[mod] = [...actions];
  }
  return perms;
}

function getDefaultPermissionsForRole(role) {
  return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user;
}

function hasPermission(userPermissions, module, action) {
  if (!userPermissions || !userPermissions[module]) return false;
  return userPermissions[module].includes(action);
}

function loadUserPermissions(db, userId, role) {
  const row = db.prepare('SELECT permissions_json FROM user_permissions WHERE user_id = ?').get(userId);
  if (row && row.permissions_json) {
    try {
      return JSON.parse(row.permissions_json);
    } catch {
      return getDefaultPermissionsForRole(role);
    }
  }
  return getDefaultPermissionsForRole(role);
}

function saveUserPermissions(db, userId, permissions) {
  const json = JSON.stringify(permissions);
  const existing = db.prepare('SELECT id FROM user_permissions WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_permissions SET permissions_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(json, userId);
  } else {
    db.prepare('INSERT INTO user_permissions (user_id, permissions_json) VALUES (?, ?)').run(userId, json);
  }
}

function isAdminOnlyModule(moduleName) {
  return ADMIN_ONLY_MODULES.includes(moduleName);
}

module.exports = {
  MODULES,
  DEFAULT_PERMISSIONS,
  ADMIN_ONLY_MODULES,
  buildFullPermissions,
  getDefaultPermissionsForRole,
  hasPermission,
  loadUserPermissions,
  saveUserPermissions,
  isAdminOnlyModule,
};

```


================================================================================
# ARCHIVO: src/projectFailureReports.js
================================================================================

```javascript
'use strict';

const FAILURE_REPORT_CAUSES = ['interna', 'externa'];

function createFailureReportValidators({ badRequest, enumValue, requiredText, getActiveEmployeeOrFail }) {
  function normalizeFailureReport(body) {
    const cause = enumValue(body, 'cause', 'Causa', FAILURE_REPORT_CAUSES);
    const problem_description = requiredText(body, 'problem_description', 'Descripcion del problema');
    const solutionEmployee = getActiveEmployeeOrFail(
      body.solution_responsible_employee_id,
      'responsable de solucionarlo',
    );

    let failure_responsible_employee_id = null;
    if (cause === 'interna') {
      failure_responsible_employee_id = getActiveEmployeeOrFail(
        body.failure_responsible_employee_id,
        'responsable de la falla',
      ).id;
    } else if (
      body.failure_responsible_employee_id !== undefined
      && body.failure_responsible_employee_id !== null
      && body.failure_responsible_employee_id !== ''
    ) {
      throw badRequest('No indique responsable interno de la falla cuando la causa es externa.');
    }

    return {
      cause,
      problem_description,
      failure_responsible_employee_id,
      solution_responsible_employee_id: solutionEmployee.id,
    };
  }

  return { normalizeFailureReport, FAILURE_REPORT_CAUSES };
}

function mapFailureReport(row, formatDateTimeCDMX) {
  return {
    id: row.id,
    project_id: row.project_id,
    cause: row.cause,
    cause_label: row.cause === 'interna' ? 'Interna' : 'Externa',
    problem_description: row.problem_description,
    failure_responsible_employee_id: row.failure_responsible_employee_id,
    failure_responsible_name: row.failure_responsible_name || null,
    solution_responsible_employee_id: row.solution_responsible_employee_id,
    solution_responsible_name: row.solution_responsible_name,
    registered_at: row.registered_at,
    registered_at_cdmx: formatDateTimeCDMX(row.registered_at),
    created_at: row.created_at,
    created_by_name: row.created_by_name || null,
    archived_at: row.archived_at || null,
    archived_at_cdmx: row.archived_at ? formatDateTimeCDMX(row.archived_at) : null,
    archived_by_name: row.archived_by_name || null,
    is_archived: Boolean(row.archived_at),
  };
}

const FAILURE_REPORT_FROM_SQL = `
  FROM project_failure_reports fr
  LEFT JOIN employees ef ON ef.id = fr.failure_responsible_employee_id
  JOIN employees es ON es.id = fr.solution_responsible_employee_id
`;

module.exports = {
  FAILURE_REPORT_CAUSES,
  FAILURE_REPORT_FROM_SQL,
  createFailureReportValidators,
  mapFailureReport,
};

```


================================================================================
# ARCHIVO: src/search.js
================================================================================

```javascript
const ACCENT_PAIRS = [
  ['á', 'a'], ['à', 'a'], ['ä', 'a'], ['â', 'a'], ['ã', 'a'],
  ['é', 'e'], ['è', 'e'], ['ë', 'e'], ['ê', 'e'],
  ['í', 'i'], ['ì', 'i'], ['ï', 'i'], ['î', 'i'],
  ['ó', 'o'], ['ò', 'o'], ['ö', 'o'], ['ô', 'o'], ['õ', 'o'],
  ['ú', 'u'], ['ù', 'u'], ['ü', 'u'], ['û', 'u'],
  ['ñ', 'n'], ['ç', 'c'],
];

function normalizeSearchTerm(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim().toLowerCase();
  if (!text) return '';
  for (const [accent, plain] of ACCENT_PAIRS) {
    text = text.split(accent).join(plain);
    const upper = accent.toUpperCase();
    if (upper !== accent) {
      text = text.split(upper).join(plain);
    }
  }
  return text.replace(/\s+/g, ' ');
}

function sqlSearchExpr(expression) {
  let expr = `LOWER(COALESCE(CAST(${expression} AS TEXT), ''))`;
  for (const [accent, plain] of ACCENT_PAIRS) {
    expr = `REPLACE(${expr}, '${accent}', '${plain}')`;
    const upper = accent.toUpperCase();
    if (upper !== accent) {
      expr = `REPLACE(${expr}, '${upper}', '${plain}')`;
    }
  }
  return expr;
}

function buildSearchCondition(columns, rawSearch) {
  const term = normalizeSearchTerm(rawSearch);
  if (!term || !columns?.length) return null;
  const pattern = `%${term}%`;
  const clause = columns.map((column) => `${sqlSearchExpr(column)} LIKE ?`).join(' OR ');
  return {
    clause: `(${clause})`,
    params: columns.map(() => pattern),
  };
}

function remapSearchColumns(columns, fromAlias, toAlias) {
  const from = `${fromAlias}.`;
  const to = `${toAlias}.`;
  return columns.map((column) => column.split(from).join(to));
}

function matchesSearchText(haystack, needle) {
  const normalizedHay = normalizeSearchTerm(haystack);
  const normalizedNeedle = normalizeSearchTerm(needle);
  if (!normalizedNeedle) return true;
  return normalizedHay.includes(normalizedNeedle);
}

function matchesAnySearchField(values, needle) {
  return values.some((value) => matchesSearchText(value, needle));
}

module.exports = {
  ACCENT_PAIRS,
  normalizeSearchTerm,
  sqlSearchExpr,
  buildSearchCondition,
  remapSearchColumns,
  matchesSearchText,
  matchesAnySearchField,
};

```


================================================================================
# ARCHIVO: src/server.js
================================================================================

```javascript
require('dotenv').config();

const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { getDb } = require('./db');
const { isPostgres, yearFilter, monthFilter, distinctYearSelect, sqlCurrentDate, isDbTruthy } = require('./db/dialect');
const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { createSqliteSessionStore } = require('./sessionStore');
const { calculateVacationEntitlement, calculateBusinessDays, getCompletedYears, getCurrentExerciseYear, calculateVacationBalance, calculateAccruedVacationDays } = require('./vacations');
const {
  parsePaginationParams,
  buildPaginationMeta,
  normalizeSort,
  addSqlFilters,
  buildListResponse,
  isValidDate,
} = require('./pagination');
const {
  buildSearchCondition,
  remapSearchColumns,
  matchesSearchText,
  matchesAnySearchField,
} = require('./search');
const { calculateEcovisAccountSummary, calculateProjectPaidAmountMXN, calculateProjectStatus, calculatePaymentUnallocated, calculatePurchaseOrderBalance, convertToMXN, roundMoney: roundMoneyEcovis, calculateEcovisProjectPaymentStatus, normalizePurchaseOrderNumber, amountsDiffer, calculateEcovisProjectBalance, calculateEcovisPurchaseOrderBalance, calculateEcovisPaymentUnallocatedAmount } = require('./ecovis');
const { createdByFields, updatedByFields, deletedByFields, logAuditEvent, nowUtc } = require('./audit');
const { formatDateTimeCDMX } = require('./dateHelper');
const { hasPermission, loadUserPermissions, saveUserPermissions, getDefaultPermissionsForRole, MODULES, isAdminOnlyModule } = require('./permissions');
const { registerNewModules, updateSessionActivity, closeSessionActivity } = require("./newModules");
const { registerKpiRoutes } = require('./kpisRoutes');
const { calculate: calculateEmissions, validateInput: validateEmissionsInput, FUEL_LIBRARY } = require('./lib/combustion');
const { ATTENDANCE_STATUSES, VALID_STATUS_CODES, VALID_WEEK_STATUSES, DAY_COLUMNS, calculateWeekRange, calculateAttendanceSummary, generateDefaultAttendance, validateStatusCode, employeeHasOutsideWork } = require('./attendance');

const app = express();
const db = getDb();
const PORT = process.env.PORT || 3000;

const VALID_STATUSES = ['Pendiente', 'En Proceso', 'Terminado'];
const VALID_RISKS = ['Alto', 'Medio', 'Bajo'];
const VALID_EMPLOYEE_FILTERS = ['all', 'active', 'inactive'];
const VALID_ECOVIS_STATUSES = ['pendiente', 'parcialmente_pagado', 'pagado', 'cancelado'];
const VALID_PAYMENT_STATUSES = ['asignado', 'parcial', 'cancelado'];
const VALID_LOAN_STATUSES = ['vigente', 'pagado'];
const VALID_COST_CATEGORIES = [
  'Compra',
  'Gasolina',
  'Casetas',
  'Viaticos',
  'Sueldo',
  'Materiales',
  'Hospedaje',
  'Otros',
];
const VALID_CURRENCIES = ['MXN', 'USD', 'EUR'];
const VALID_REPORT_TYPES = [
  'boiler_startup',
  'general_equipment_service_delivery',
  'autoflame_system_startup',
  'failure_report',
];
const REPORT_TYPE_LABELS = {
  boiler_startup: 'FORMATO DE ARRANQUE DE CALDERA',
  general_equipment_service_delivery: 'ENTREGA GENERAL DE EQUIPO/SERVICIO',
  autoflame_system_startup: 'ARRANQUE DE SISTEMA AUTOFLAME',
  failure_report: 'REPORTE DE FALLA',
};
const ACTIVE_PROJECT_REPORT_WHERE = 'deleted_at IS NULL AND archived_at IS NULL';
const ARCHIVED_PROJECT_REPORT_WHERE = 'archived_at IS NOT NULL AND deleted_at IS NULL';

function activeProjectReportCountSql(projectTableAlias = 'p') {
  return `(
    (SELECT COUNT(*) FROM project_reports r
      WHERE r.project_id = ${projectTableAlias}.id
        AND r.deleted_at IS NULL AND r.archived_at IS NULL)
    + (SELECT COUNT(*) FROM project_failure_reports fr
      WHERE fr.project_id = ${projectTableAlias}.id AND fr.archived_at IS NULL)
  )`;
}

function archivedProjectReportCountSql(projectTableAlias = 'p') {
  return `(
    (SELECT COUNT(*) FROM project_reports r
      WHERE r.project_id = ${projectTableAlias}.id AND r.archived_at IS NOT NULL AND r.deleted_at IS NULL)
    + (SELECT COUNT(*) FROM project_failure_reports fr
      WHERE fr.project_id = ${projectTableAlias}.id AND fr.archived_at IS NOT NULL)
  )`;
}

function normalizeReportCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}
const SESSION_TTL_MS = 1000 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = isProduction || process.env.TRUST_PROXY === 'true';

if (trustProxy) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());
app.use(
  session({
    name: 'proyectos.sid',
    store: createSqliteSessionStore(session, db, { ttlMs: SESSION_TTL_MS }),
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    proxy: trustProxy,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: SESSION_TTL_MS,
    },
  }),
);

app.get('/calculadora-emisiones', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'calculadora-emisiones.html'));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Necesitas iniciar sesion.' });
  }

  const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.is_active) {
    logAuditEvent(db, { req, action: 'access_denied_inactive', module: 'auth', entityType: 'user', entityId: req.session.userId, entityLabel: req.session.username });
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
  }

  return next();
}

function requireAdminVerified(req, res, next) {
  if (!req.session.adminVerified) {
    return res.status(403).json({ message: 'Se requiere autorizacion del admin.' });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({
      message: 'Acceso restringido. Solo el administrador puede consultar y programar vacaciones.',
    });
  }

  return next();
}

function requireNotTecnico(req, res, next) {
  if (req.session.role === 'tecnico') {
    return res.status(403).json({
      message: 'Acceso restringido. El usuario tecnico no tiene acceso a este modulo.',
    });
  }

  return next();
}

function requirePermission(module, action) {
  return (req, res, next) => {
    const role = req.session.role;
    if (role === 'admin') return next();

    const perms = loadUserPermissions(db, req.session.userId, role);
    if (hasPermission(perms, module, action)) {
      return next();
    }

    logAuditEvent(db, {
      req,
      action: 'access_denied',
      module,
      entityType: 'permission',
      entityLabel: `${module}.${action}`,
      metadata: { required_permission: `${module}.${action}`, endpoint: req.originalUrl, method: req.method },
    });
    return res.status(403).json({
      message: 'Acceso restringido. No tienes permisos para consultar o modificar este apartado.',
    });
  };
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredText(body, field, label) {
  const value = trim(body[field]);
  if (!value) {
    throw badRequest(`${label} es obligatorio.`);
  }

  return value;
}

function optionalText(body, field) {
  const value = trim(body[field]);
  return value || null;
}

function parseDecimal(value) {
  if (typeof value === 'number') {
    return value;
  }

  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return 0;
  }

  const numericValue = rawValue.replace(/[^\d.,-]/g, '');
  const lastDotIndex = numericValue.lastIndexOf('.');
  const lastCommaIndex = numericValue.lastIndexOf(',');
  const decimalSeparator =
    lastDotIndex > lastCommaIndex
      ? '.'
      : lastCommaIndex > lastDotIndex
        ? ','
        : null;

  if (!decimalSeparator) {
    return Number(numericValue);
  }

  const normalizedValue = numericValue
    .split('')
    .filter((character, index) => {
      if (character !== '.' && character !== ',') {
        return true;
      }

      return index === (decimalSeparator === '.' ? lastDotIndex : lastCommaIndex);
    })
    .join('')
    .replace(decimalSeparator, '.');

  return Number(normalizedValue);
}

function numberValue(body, field, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = parseDecimal(body[field]);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw badRequest(`${label} debe ser un numero entre ${min} y ${max}.`);
  }

  return value;
}

function enumValue(body, field, label, validValues) {
  const value = requiredText(body, field, label);
  if (!validValues.includes(value)) {
    throw badRequest(`${label} no es valido.`);
  }

  return value;
}

function currencyValue(body, field, label) {
  const value = trim(body[field]) || 'MXN';
  if (!VALID_CURRENCIES.includes(value)) {
    throw badRequest(`${label} no es valido.`);
  }

  return value;
}

function booleanValue(body, field) {
  return body[field] === true || body[field] === 'true' || body[field] === 1 ? 1 : 0;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function addDaysToIsoDate(isoDate, days) {
  const base = isoDate && isValidDate(isoDate) ? isoDate : new Date().toISOString().slice(0, 10);
  const date = new Date(`${base}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultFechaVencimiento(createdAtIso) {
  const createdDate = createdAtIso ? String(createdAtIso).slice(0, 10) : new Date().toISOString().slice(0, 10);
  return addDaysToIsoDate(createdDate, 30);
}

function getActiveEmployeeOrFail(employeeId, label) {
  const id = Number(employeeId);
  if (!Number.isFinite(id) || id < 1) {
    throw badRequest(`Seleccione un ${label} activo.`);
  }
  const employee = db.prepare(
    'SELECT id, full_name, employee_number FROM employees WHERE id = ? AND active = 1',
  ).get(id);
  if (!employee) {
    throw badRequest(`${label} no encontrado o inactivo.`);
  }
  return employee;
}

function resolveProjectStaff(body) {
  let tecnicoId = body.tecnico_id !== undefined && body.tecnico_id !== '' && body.tecnico_id !== null
    ? Number(body.tecnico_id)
    : null;
  let vendedorId = body.vendedor_id !== undefined && body.vendedor_id !== '' && body.vendedor_id !== null
    ? Number(body.vendedor_id)
    : null;

  const nameMatchSql = isPostgres()
    ? 'SELECT id FROM employees WHERE active = 1 AND lower(full_name) = lower(?) LIMIT 1'
    : "SELECT id FROM employees WHERE active = 1 AND full_name = ? COLLATE NOCASE LIMIT 1";
  if (!tecnicoId && body.technician_name) {
    const match = db.prepare(nameMatchSql).get(String(body.technician_name).trim());
    if (match) tecnicoId = match.id;
  }
  if (!vendedorId && body.seller) {
    const match = db.prepare(nameMatchSql).get(String(body.seller).trim());
    if (match) vendedorId = match.id;
  }

  const tecnico = getActiveEmployeeOrFail(tecnicoId, 'tecnico');
  const vendedor = getActiveEmployeeOrFail(vendedorId, 'vendedor');
  return {
    tecnico_id: tecnico.id,
    vendedor_id: vendedor.id,
    technician_name: tecnico.full_name,
    seller: vendedor.full_name,
  };
}

function resolveFechaVencimiento(body, { existingRow = null } = {}) {
  const raw = optionalText(body, 'fecha_vencimiento');
  if (raw && isValidDate(raw)) {
    return raw;
  }
  if (existingRow?.fecha_vencimiento && isValidDate(existingRow.fecha_vencimiento)) {
    return existingRow.fecha_vencimiento;
  }
  return defaultFechaVencimiento(existingRow?.created_at);
}

function normalizeProject(body, { existingRow = null } = {}) {
  const purchaseOrderNotApplicable = booleanValue(body, 'purchase_order_not_applicable');
  const purchaseOrderNumber = purchaseOrderNotApplicable
    ? null
    : requiredText(body, 'purchase_order_number', 'Numero de Orden de Compra');
  const staff = resolveProjectStaff(body);

  return {
    quote_number: requiredText(body, 'quote_number', 'Numero de cotizacion'),
    order_number: requiredText(body, 'order_number', 'Numero de Pedido'),
    purchase_order_number: purchaseOrderNumber,
    purchase_order_not_applicable: purchaseOrderNotApplicable,
    seller: staff.seller,
    client_name: requiredText(body, 'client_name', 'Nombre del Cliente'),
    project_description: requiredText(body, 'project_description', 'Descripcion del proyecto'),
    expected_margin: numberValue(body, 'expected_margin', 'Margen esperado', {
      min: 0,
      max: 100,
    }),
    total_invoiced: numberValue(body, 'total_invoiced', 'Total Facturado', { min: 0 }),
    total_invoiced_currency: currencyValue(
      body,
      'total_invoiced_currency',
      'Moneda del Total Facturado',
    ),
    progress_percent: numberValue(body, 'progress_percent', 'Porcentaje de Avance', {
      min: 0,
      max: 100,
    }),
    technician_name: staff.technician_name,
    tecnico_id: staff.tecnico_id,
    vendedor_id: staff.vendedor_id,
    fecha_vencimiento: resolveFechaVencimiento(body, { existingRow }),
    promised_delivery_date: requiredText(
      body,
      'promised_delivery_date',
      'Fecha Prometida de entrega',
    ),
    status: enumValue(body, 'status', 'Estado', VALID_STATUSES),
    risk: enumValue(body, 'risk', 'Riesgo', VALID_RISKS),
    observations: optionalText(body, 'observations'),
  };
}

function normalizePayment(body) {
  return {
    amount: numberValue(body, 'amount', 'Cantidad cobrada', { min: 0.01 }),
    currency: currencyValue(body, 'currency', 'Moneda del pago'),
    payment_date: requiredText(body, 'payment_date', 'Fecha de pago'),
    notes: optionalText(body, 'notes'),
  };
}

function normalizeCost(body) {
  return {
    category: enumValue(body, 'category', 'Categoria', VALID_COST_CATEGORIES),
    description: requiredText(body, 'description', 'Descripcion'),
    amount: numberValue(body, 'amount', 'Importe gastado', { min: 0.01 }),
    currency: currencyValue(body, 'currency', 'Moneda del gasto'),
    cost_date: requiredText(body, 'cost_date', 'Fecha del gasto'),
  };
}

const {
  FAILURE_REPORT_FROM_SQL,
  createFailureReportValidators,
  mapFailureReport: mapFailureReportRow,
} = require('./projectFailureReports');

const { normalizeFailureReport } = createFailureReportValidators({
  badRequest,
  enumValue,
  requiredText,
  getActiveEmployeeOrFail,
});

function mapFailureReport(row) {
  return mapFailureReportRow(row, formatDateTimeCDMX);
}

function mapProjectReport(row) {
  return {
    ...row,
    executed_by_name: row.executed_by_name || null,
    archived_at_cdmx: row.archived_at ? formatDateTimeCDMX(row.archived_at) : null,
    is_archived: Boolean(row.archived_at),
    report_type_label: REPORT_TYPE_LABELS[row.report_type] || row.report_type,
  };
}

function resolveReportExecutor(body) {
  const employee = getActiveEmployeeOrFail(
    body.executed_by_employee_id,
    'empleado que ejecuto el servicio',
  );
  return {
    executed_by_employee_id: employee.id,
    technician_name: employee.full_name,
  };
}

function normalizeUser(body, { requirePassword = false } = {}) {
  const username = requiredText(body, 'username', 'Usuario');
  const password = trim(body.password);

  if (requirePassword && !password) {
    throw badRequest('Contrasena es obligatoria.');
  }

  if (password && password.length < 6) {
    throw badRequest('La contrasena debe tener al menos 6 caracteres.');
  }

  return {
    username,
    password: password || null,
  };
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role || 'user',
    is_active: row.is_active !== undefined ? row.is_active : 1,
    created_at: row.created_at,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at: row.updated_at,
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
  };
}

function getExchangeRates() {
  return db
    .prepare(
      `SELECT currency, rate_to_mxn, updated_at
       FROM exchange_rates
       ORDER BY CASE currency WHEN 'MXN' THEN 1 WHEN 'USD' THEN 2 WHEN 'EUR' THEN 3 ELSE 4 END`,
    )
    .all();
}

function getExchangeRateMap() {
  return getExchangeRates().reduce((rates, row) => {
    rates[row.currency] = row.rate_to_mxn;
    return rates;
  }, { MXN: 1 });
}

function mapExchangeRateState() {
  const rates = getExchangeRates();
  const lastUpdatedAt = rates
    .filter((rate) => rate.currency !== 'MXN')
    .map((rate) => rate.updated_at)
    .sort()
    .at(-1);

  return {
    rates,
    last_updated_at: lastUpdatedAt || null,
  };
}

function mapMoneyEntry(row, exchangeRates) {
  return {
    ...row,
    currency: row.currency || 'MXN',
    amount_mxn: convertAmountToMxn(row.amount, row.currency || 'MXN', exchangeRates),
  };
}

function mapProject(row, exchangeRates = getExchangeRateMap()) {
  if (!row) {
    return null;
  }

  const payments = db
    .prepare('SELECT * FROM project_payments WHERE project_id = ? ORDER BY payment_date DESC, id DESC')
    .all(row.id)
    .map((payment) => mapMoneyEntry(payment, exchangeRates));
  const costs = db
    .prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY cost_date DESC, id DESC')
    .all(row.id)
    .map((cost) => mapMoneyEntry(cost, exchangeRates));
  const normalizedProject = {
    ...row,
    total_invoiced_currency: row.total_invoiced_currency || 'MXN',
  };
  const totals = buildProjectTotals(normalizedProject, payments, costs, exchangeRates);
  const costsWithInvoicePercentage = costs.map((cost) => ({
    ...cost,
    invoice_cost_percentage:
      totals.total_invoiced_mxn > 0
        ? roundMoney(cost.amount_mxn / totals.total_invoiced_mxn)
        : null,
  }));

  const tecnico = row.tecnico_id
    ? db.prepare('SELECT id, full_name, employee_number FROM employees WHERE id = ?').get(row.tecnico_id)
    : null;
  const vendedor = row.vendedor_id
    ? db.prepare('SELECT id, full_name, employee_number FROM employees WHERE id = ?').get(row.vendedor_id)
    : null;

  return {
    ...normalizedProject,
    purchase_order_display: row.purchase_order_not_applicable
      ? 'No Aplica'
      : row.purchase_order_number,
    fecha_vencimiento: row.fecha_vencimiento || null,
    tecnico_id: row.tecnico_id || null,
    vendedor_id: row.vendedor_id || null,
    tecnico_nombre: tecnico?.full_name || row.technician_name,
    vendedor_nombre: vendedor?.full_name || row.seller,
    tecnico_employee_number: tecnico?.employee_number || null,
    vendedor_employee_number: vendedor?.employee_number || null,
    payments,
    costs: costsWithInvoicePercentage,
    ...totals,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
    closed_at_cdmx: formatDateTimeCDMX(row.closed_at),
  };
}

function getProjectOrFail(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    const error = new Error('Proyecto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return project;
}

function getUserOrFail(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const error = new Error('Usuario no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return user;
}

function getAdminUserOrFail() {
  const adminUsername = process.env.ADMIN_USER || 'admin';
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);

  if (!user) {
    const error = new Error('Usuario admin no encontrado.');
    error.statusCode = 403;
    throw error;
  }

  return user;
}

function verifyAdminPassword(body) {
  const password = requiredText(body, 'password', 'Contrasena del admin');
  const adminUser = getAdminUserOrFail();

  if (!bcrypt.compareSync(password, adminUser.password_hash)) {
    const error = new Error('La contrasena del admin no es correcta.');
    error.statusCode = 403;
    throw error;
  }

  return adminUser;
}

function verifyActiveUserPassword(req) {
  const password = requiredText(req.body, 'password', 'Contrasena');
  const user = getUserOrFail(req.session.userId);

  if (!bcrypt.compareSync(password, user.password_hash)) {
    const error = new Error('La contrasena no es correcta.');
    error.statusCode = 403;
    throw error;
  }

  return user;
}

function buildWhere({ query, filters, baseWhere = [], search, params = [] }) {
  const whereParts = [...baseWhere];
  const searchParams = [...params];
  if (search?.columns?.length && search.value) {
    const built = buildSearchCondition(search.columns, search.value);
    if (built) {
      whereParts.push(built.clause);
      searchParams.push(...built.params);
    }
  }
  const filterResult = addSqlFilters(query, filters, whereParts, searchParams);
  return {
    whereClause: filterResult.whereParts.length ? filterResult.whereParts.join(' AND ') : '1=1',
    params: filterResult.params,
    filters: filterResult.activeFilters,
  };
}

function paginateSqlList({ tableSql, countSql, whereClause, params, page, limit, orderBy, map = (row) => row }) {
  const totalRecords = db.prepare(`${countSql} WHERE ${whereClause}`).get(...params).count;
  const pagination = buildPaginationMeta(page, limit, totalRecords);
  const data = db
    .prepare(`${tableSql} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pagination.limit, pagination.offset)
    .map(map);

  return { data, pagination };
}

function applyInMemoryFilters(rows, query, filterDefinitions = {}) {
  return rows.filter((row) => Object.entries(filterDefinitions).every(([key, definition]) => {
    const value = reqValue(query, key);
    const min = reqValue(query, `${key}_min`) || reqValue(query, `${key}_from`);
    const max = reqValue(query, `${key}_max`) || reqValue(query, `${key}_to`);
    const rowValue = row[key];

    if (definition.type === 'text') {
      return !value || matchesSearchText(rowValue, value);
    }
    if (definition.type === 'select') {
      return !value || String(rowValue ?? '') === String(value);
    }
    if (definition.type === 'boolean') {
      if (!value) return true;
      const expected = value === 'true' || value === '1';
      return Boolean(rowValue) === expected;
    }
    if (definition.type === 'date') {
      if (value && rowValue !== value) return false;
      if (min && rowValue < min) return false;
      if (max && rowValue > max) return false;
      return true;
    }
    if (definition.type === 'number' || definition.type === 'currency') {
      const numeric = Number(rowValue);
      if (value && numeric !== Number(value)) return false;
      if (min && numeric < Number(min)) return false;
      if (max && numeric > Number(max)) return false;
      return true;
    }
    return true;
  }));
}

function reqValue(query, key) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function collectActiveFilters(query, filterDefinitions = {}) {
  const filters = {};
  Object.keys(filterDefinitions).forEach((key) => {
    [key, `${key}_min`, `${key}_max`, `${key}_from`, `${key}_to`].forEach((filterKey) => {
      const value = reqValue(query, filterKey);
      if (value !== undefined && value !== '') {
        filters[filterKey] = value;
      }
    });
  });
  return filters;
}

function sortRows(rows, sortBy, sortOrder, defaultSort) {
  const direction = sortOrder === 'DESC' ? -1 : 1;
  const selectors = sortBy
    ? [{ key: sortBy, direction }]
    : defaultSort;
  return [...rows].sort((a, b) => {
    for (const selector of selectors) {
      const aValue = a[selector.key];
      const bValue = b[selector.key];
      if (aValue === bValue) continue;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * selector.direction;
      }
      return String(aValue).localeCompare(String(bValue), 'es', { numeric: true }) * selector.direction;
    }
    return 0;
  });
}

const PROJECT_CHARGED_SQL = `(SELECT COALESCE(SUM(pp.amount * COALESCE(er.rate_to_mxn, 1)), 0)
  FROM project_payments pp
  LEFT JOIN exchange_rates er ON COALESCE(pp.currency, 'MXN') = er.currency
  WHERE pp.project_id = p.id)`;
const PROJECT_SPENT_SQL = `(SELECT COALESCE(SUM(pc.amount * COALESCE(er.rate_to_mxn, 1)), 0)
  FROM project_costs pc
  LEFT JOIN exchange_rates er ON COALESCE(pc.currency, 'MXN') = er.currency
  WHERE pc.project_id = p.id)`;
const PROJECT_INVOICED_SQL = `(p.total_invoiced * COALESCE((SELECT rate_to_mxn FROM exchange_rates WHERE currency = COALESCE(p.total_invoiced_currency, 'MXN')), 1))`;
const PROJECT_PENDING_SQL = `(${PROJECT_INVOICED_SQL} - ${PROJECT_CHARGED_SQL})`;
const PROJECT_MARGIN_SQL = `(CASE WHEN ${PROJECT_INVOICED_SQL} > 0 THEN ((${PROJECT_INVOICED_SQL} - ${PROJECT_SPENT_SQL}) / ${PROJECT_INVOICED_SQL}) ELSE 0 END)`;
const PROJECT_SORTS = {
  id: 'p.id',
  quote_number: 'p.quote_number',
  order_number: 'p.order_number',
  purchase_order_number: 'p.purchase_order_number',
  client_name: 'p.client_name',
  project_description: 'p.project_description',
  status: 'p.status',
  risk: 'p.risk',
  seller: 'p.seller',
  technician_name: 'p.technician_name',
  fecha_vencimiento: 'p.fecha_vencimiento',
  promised_delivery_date: 'p.promised_delivery_date',
  closed_at: 'p.closed_at',
  total_invoiced_mxn: PROJECT_INVOICED_SQL,
  total_charged: PROJECT_CHARGED_SQL,
  spent: PROJECT_SPENT_SQL,
  pending_collection: PROJECT_PENDING_SQL,
  final_margin: PROJECT_MARGIN_SQL,
};
const PROJECT_FILTERS = {
  id: { type: 'number', column: 'p.id' },
  quote_number: { type: 'text', column: 'p.quote_number' },
  order_number: { type: 'text', column: 'p.order_number' },
  purchase_order_number: { type: 'text', column: 'p.purchase_order_number' },
  client_name: { type: 'text', column: 'p.client_name' },
  project_description: { type: 'text', column: 'p.project_description' },
  status: { type: 'select', column: 'p.status', options: VALID_STATUSES },
  risk: { type: 'select', column: 'p.risk', options: VALID_RISKS },
  seller: { type: 'text', column: 'p.seller' },
  technician_name: { type: 'text', column: 'p.technician_name' },
  fecha_vencimiento: { type: 'date', column: 'p.fecha_vencimiento' },
  promised_delivery_date: { type: 'date', column: 'p.promised_delivery_date' },
  closed_at: { type: 'date', column: 'date(p.closed_at)' },
  total_invoiced_mxn: { type: 'currency', column: PROJECT_INVOICED_SQL },
  total_charged: { type: 'currency', column: PROJECT_CHARGED_SQL },
  spent: { type: 'currency', column: PROJECT_SPENT_SQL },
  pending_collection: { type: 'currency', column: PROJECT_PENDING_SQL },
  final_margin: { type: 'number', column: PROJECT_MARGIN_SQL },
};

function buildProjectListSearchColumns() {
  return [
    'CAST(p.id AS TEXT)',
    'p.quote_number',
    'p.order_number',
    'p.purchase_order_number',
    'p.client_name',
    'p.project_description',
    'p.status',
    'p.risk',
    'p.seller',
    'p.technician_name',
    'p.fecha_vencimiento',
    '(SELECT full_name FROM employees WHERE id = p.tecnico_id)',
    '(SELECT full_name FROM employees WHERE id = p.vendedor_id)',
    'CAST(p.promised_delivery_date AS TEXT)',
    'CAST(p.closed_at AS TEXT)',
    `CAST(${PROJECT_CHARGED_SQL} AS TEXT)`,
    `CAST(${PROJECT_SPENT_SQL} AS TEXT)`,
    `CAST(${PROJECT_PENDING_SQL} AS TEXT)`,
    `CAST(${PROJECT_MARGIN_SQL} AS TEXT)`,
    `CAST(${PROJECT_INVOICED_SQL} AS TEXT)`,
  ];
}

const PROJECT_REPORT_SEARCH_COLUMNS = [
  'CAST(r.id AS TEXT)',
  'r.report_folio',
  'r.report_type',
  'r.report_date',
  'r.service_name',
  'r.client_name',
  'r.technician_name',
  'r.assigned_technicians',
  'r.notes',
  'p.quote_number',
  'p.order_number',
  'p.client_name',
  'p.project_description',
  'p.status',
  'p.seller',
  'p.technician_name',
];

const PROJECT_REPORT_SEARCH_COLUMNS_PROJECT_SCOPED = [
  'CAST(r.id AS TEXT)',
  'r.report_folio',
  'r.report_type',
  'CAST(r.report_date AS TEXT)',
  'r.service_name',
  'r.client_name',
  'r.technician_name',
  'r.assigned_technicians',
];

const ARCHIVE_CLIENT_SEARCH_COLUMNS = [
  'p.client_name',
  'p.quote_number',
  'p.order_number',
  'p.project_description',
  'r.report_folio',
  'r.report_type',
  'r.service_name',
  'r.client_name',
  'r.assigned_technicians',
  'CAST(r.report_date AS TEXT)',
];

function buildGroupedClientSearchSql(search, projectColumns, clientColumn = 'p.client_name') {
  if (!search) return { clause: '', params: [] };
  const clauses = [];
  const params = [];
  const clientBuilt = buildSearchCondition([clientColumn], search);
  if (clientBuilt) {
    clauses.push(clientBuilt.clause);
    params.push(...clientBuilt.params);
  }
  const subBuilt = buildSearchCondition(remapSearchColumns(projectColumns, 'p', 'px'), search);
  if (subBuilt) {
    clauses.push(`${clientColumn} IN (
      SELECT DISTINCT px.client_name FROM projects px
      WHERE px.closed_at IS NOT NULL AND ${subBuilt.clause}
    )`);
    params.push(...subBuilt.params);
  }
  if (!clauses.length) return { clause: '', params: [] };
  return { clause: ` AND (${clauses.join(' OR ')})`, params };
}

function employeeMatchesSearch(employee, search) {
  if (!search) return true;
  return matchesAnySearchField([
    employee.id,
    employee.employee_number,
    employee.full_name,
    employee.hire_date,
    employee.termination_date,
    employee.department,
    employee.primary_department,
    employee.secondary_department,
    employee.position,
    employee.immediate_boss,
    employee.inactive_reason,
    employee.active ? 'activo' : 'inactivo',
    employee.seniority_years,
    employee.accrued_days,
    employee.days_taken,
    employee.days_scheduled,
    employee.days_pending,
    employee.kpi_eligible ? 'kpi elegible' : 'sin kpi',
  ], search);
}

app.get('/api/session', (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  try { updateSessionActivity(db, req); } catch(e) { /* non-critical */ }
  const pref = db.prepare("SELECT theme_name FROM user_preferences WHERE user_id = ?").get(req.session.userId);
  const perms = loadUserPermissions(db, req.session.userId, req.session.role);
  return res.json({
    authenticated: true,
    user: { id: req.session.userId, username: req.session.username, role: req.session.role || 'user' },
    permissions: perms,
    theme: pref ? pref.theme_name : "default",
  });
});

app.post('/api/login', (req, res, next) => {
  try {
    const username = requiredText(req.body, 'username', 'Usuario');
    const password = requiredText(req.body, 'password', 'Contrasena');
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const now = nowUtc();

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (user && user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      if (lockExpiry > Date.now()) {
        recordLoginAttempt(username, user.id, ipAddress, userAgent, false, 'account_locked', user.locked_until);
        logAuditEvent(db, { req, action: 'login_blocked_locked', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: username, metadata: { locked_until: user.locked_until } });
        throw badRequest('Usuario o contrasena incorrectos.');
      }
      db.prepare('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?').run(user.id);
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      if (user) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        let lockedUntil = null;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
          db.prepare('UPDATE users SET failed_login_attempts = ?, last_failed_login_at = ?, locked_until = ? WHERE id = ?').run(attempts, now, lockedUntil, user.id);
          logAuditEvent(db, { req, action: 'user_locked', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: username, metadata: { attempts, locked_until: lockedUntil } });
        } else {
          db.prepare('UPDATE users SET failed_login_attempts = ?, last_failed_login_at = ? WHERE id = ?').run(attempts, now, user.id);
        }
        recordLoginAttempt(username, user.id, ipAddress, userAgent, false, 'invalid_credentials', lockedUntil);
      } else {
        recordLoginAttempt(username, null, ipAddress, userAgent, false, 'user_not_found', null);
      }
      logAuditEvent(db, { req, action: 'login_failed', module: 'auth', entityType: 'user', entityLabel: username, metadata: { attempted_username: username } });
      throw badRequest('Usuario o contrasena incorrectos.');
    }

    if (!user.is_active) {
      recordLoginAttempt(username, user.id, ipAddress, userAgent, false, 'user_inactive', null);
      logAuditEvent(db, { req, action: 'login_failed_inactive', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: username });
      throw badRequest('Usuario o contrasena incorrectos.');
    }

    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_failed_login_at = NULL WHERE id = ?').run(user.id);
    recordLoginAttempt(username, user.id, ipAddress, userAgent, true, null, null);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role || 'user';
    logAuditEvent(db, { req, action: 'login_success', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: user.username });
    try { updateSessionActivity(db, req); } catch(e) { /* non-critical */ }
    return res.json({ username: user.username, role: user.role || 'user' });
  } catch (error) {
    return next(error);
  }
});

function recordLoginAttempt(userIdentifier, userId, ipAddress, userAgent, success, failureReason, lockedUntil) {
  try {
    db.prepare(
      `INSERT INTO login_attempts (user_identifier, user_id, ip_address, user_agent, success, failure_reason, attempted_at, locked_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(userIdentifier, userId, ipAddress, userAgent, success ? 1 : 0, failureReason, nowUtc(), lockedUntil);
  } catch (err) {
    console.error('Failed to record login attempt:', err.message);
  }
}

app.post('/api/logout', requireAuth, (req, res) => {
  logAuditEvent(db, { req, action: 'logout', module: 'auth', entityType: 'user', entityId: req.session.userId, entityLabel: req.session.username });
  closeSessionActivity(db, req);
  req.session.destroy(() => {
    res.clearCookie('proyectos.sid');
    res.status(204).end();
  });
});

app.post('/api/admin/verify', requireAuth, (req, res, next) => {
  try {
    verifyAdminPassword(req.body);
    req.session.adminVerified = true;
    res.json({ authorized: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/users', requireAuth, requirePermission('users', 'view'), (req, res) => {
  const { page, limit } = parsePaginationParams(req.query);
  const sorting = normalizeSort(
    req.query,
    { id: 'id', username: 'username', created_at: 'created_at' },
    'username ASC',
  );
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'id' },
      username: { type: 'text', column: 'username' },
      created_at: { type: 'date', column: 'date(created_at)' },
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT id, username, role, is_active, created_at, updated_at FROM users',
    countSql: 'SELECT COUNT(*) as count FROM users',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: mapUser,
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.post('/api/users', requireAuth, requirePermission('users', 'create'), (req, res, next) => {
  try {
    const user = normalizeUser(req.body, { requirePassword: true });
    const passwordHash = bcrypt.hashSync(user.password, 12);
    const role = ['admin', 'user', 'tecnico'].includes(trim(req.body.role)) ? trim(req.body.role) : 'user';
    const audit = createdByFields(req);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, role, created_by_user_id, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user.username, passwordHash, role, audit.created_by_user_id, audit.created_by_name, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'users', entityType: 'user', entityId: result.lastInsertRowid, entityLabel: user.username, after: { username: user.username, role } });
    res.status(201).json(mapUser(getUserOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/:id', requireAuth, requirePermission('users', 'edit'), (req, res, next) => {
  try {
    const before = getUserOrFail(req.params.id);
    const user = normalizeUser(req.body);
    const role = ['admin', 'user', 'tecnico'].includes(trim(req.body.role)) ? trim(req.body.role) : undefined;
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : undefined;
    const audit = updatedByFields(req);

    if (user.password) {
      db.prepare('UPDATE users SET username = ?, password_hash = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?').run(
        user.username,
        bcrypt.hashSync(user.password, 12),
        audit.updated_at,
        audit.updated_by_user_id,
        audit.updated_by_name,
        req.params.id,
      );
    } else {
      db.prepare('UPDATE users SET username = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?').run(
        user.username, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);
    }

    if (role) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    }

    if (isActive !== undefined) {
      db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive, req.params.id);
    }

    if (Number(req.session.userId) === Number(req.params.id)) {
      req.session.username = user.username;
      if (role) req.session.role = role;
    }

    logAuditEvent(db, { req, action: 'update', module: 'users', entityType: 'user', entityId: Number(req.params.id), entityLabel: user.username, before: { username: before.username, role: before.role, is_active: before.is_active }, after: { username: user.username, role: role || before.role, is_active: isActive !== undefined ? isActive : before.is_active } });
    res.json(mapUser(getUserOrFail(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/users/:id/permissions', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
  try {
    const user = getUserOrFail(req.params.id);
    const perms = loadUserPermissions(db, user.id, user.role);
    res.json({ userId: user.id, username: user.username, role: user.role, permissions: perms });
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/:id/permissions', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
  try {
    const user = getUserOrFail(req.params.id);
    const permissions = req.body.permissions;
    if (!permissions || typeof permissions !== 'object') {
      throw badRequest('Permisos invalidos.');
    }
    saveUserPermissions(db, user.id, permissions);
    logAuditEvent(db, { req, action: 'update_permissions', module: 'users', entityType: 'user', entityId: user.id, entityLabel: user.username, after: permissions });
    res.json({ userId: user.id, username: user.username, permissions });
  } catch (error) {
    next(error);
  }
});

app.get('/api/session/permissions', requireAuth, (req, res) => {
  const perms = loadUserPermissions(db, req.session.userId, req.session.role);
  res.json({ permissions: perms, modules: MODULES });
});

app.get('/api/exchange-rates', requireAuth, requirePermission('settings', 'view'), (req, res) => {
  res.json(mapExchangeRateState());
});

app.put('/api/exchange-rates', requireAuth, requirePermission('settings', 'edit'), (req, res, next) => {
  try {
    const payload = req.body.rates || req.body;
    const usdRate = numberValue(payload, 'USD', 'Tipo de cambio USD', {
      min: 0.000001,
      max: 100000,
    });
    const eurRate = numberValue(payload, 'EUR', 'Tipo de cambio EUR', {
      min: 0.000001,
      max: 100000,
    });
    const updateRates = db.transaction(() => {
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate_to_mxn, updated_at)
         VALUES ('MXN', 1, CURRENT_TIMESTAMP)
         ON CONFLICT(currency) DO UPDATE SET rate_to_mxn = 1`,
      ).run();
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate_to_mxn, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(currency) DO UPDATE SET
           rate_to_mxn = excluded.rate_to_mxn,
           updated_at = CURRENT_TIMESTAMP`,
      ).run('USD', usdRate);
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate_to_mxn, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(currency) DO UPDATE SET
           rate_to_mxn = excluded.rate_to_mxn,
           updated_at = CURRENT_TIMESTAMP`,
      ).run('EUR', eurRate);
    });

    updateRates();
    res.json(mapExchangeRateState());
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/assignable-employees', requireAuth, requirePermission('projects', 'view'), (req, res) => {
  const employees = db.prepare(
    `SELECT id, employee_number, full_name, department, position
     FROM employees
     WHERE active = 1
     ORDER BY full_name ASC`,
  ).all();
  res.json({ data: employees });
});

app.get('/api/projects', requireAuth, requirePermission('projects', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.promised_delivery_date ASC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: PROJECT_FILTERS,
    baseWhere: ['p.closed_at IS NULL'],
    search: {
      value: search,
      columns: buildProjectListSearchColumns(),
    },
  });

  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => mapProject(project, exchangeRates),
  });

  const globalWhereClause = 'p.closed_at IS NULL';
  const totalProjects = db.prepare(`SELECT COUNT(*) as count FROM projects p WHERE ${globalWhereClause}`).get().count;
  const totalCharged = db.prepare(
    `SELECT COALESCE(SUM(pp.amount * COALESCE(er.rate_to_mxn, 1)), 0) as total
     FROM project_payments pp
     LEFT JOIN exchange_rates er ON COALESCE(pp.currency, 'MXN') = er.currency
     JOIN projects p ON p.id = pp.project_id
     WHERE ${globalWhereClause}`,
  ).get().total;

  const totalSpent = db.prepare(
    `SELECT COALESCE(SUM(pc.amount * COALESCE(er.rate_to_mxn, 1)), 0) as total
     FROM project_costs pc
     LEFT JOIN exchange_rates er ON COALESCE(pc.currency, 'MXN') = er.currency
     JOIN projects p ON p.id = pc.project_id
     WHERE ${globalWhereClause}`,
  ).get().total;

  const totalInvoiced = db.prepare(
    `SELECT COALESCE(SUM(p.total_invoiced * COALESCE(er.rate_to_mxn, 1)), 0) as total
     FROM projects p
     LEFT JOIN exchange_rates er ON COALESCE(p.total_invoiced_currency, 'MXN') = er.currency
     WHERE ${globalWhereClause}`,
  ).get().total;

  const summary = {
    totalProjects,
    totalCharged: roundMoney(totalCharged),
    totalSpent: roundMoney(totalSpent),
    totalPending: roundMoney(totalInvoiced - totalCharged),
  };

  res.json(buildListResponse(result.data, result.pagination, sorting, filters, { summary }));
});

app.get('/api/closed-projects', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.closed_at DESC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: PROJECT_FILTERS,
    baseWhere: ['p.closed_at IS NOT NULL'],
    search: {
      value: search,
      columns: buildProjectListSearchColumns(),
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => mapProject(project, exchangeRates),
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/projects/:id', requireAuth, requirePermission('projects', 'view'), (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    res.json(mapProject(project, getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects', requireAuth, requirePermission('projects', 'create'), (req, res, next) => {
  try {
    const project = normalizeProject(req.body);
    const audit = createdByFields(req);
    const result = db
      .prepare(
        `INSERT INTO projects (
          quote_number,
          order_number,
          purchase_order_number,
          purchase_order_not_applicable,
          seller,
          client_name,
          project_description,
          expected_margin,
          total_invoiced,
          total_invoiced_currency,
          progress_percent,
          technician_name,
          tecnico_id,
          vendedor_id,
          fecha_vencimiento,
          promised_delivery_date,
          status,
          risk,
          observations,
          created_at,
          updated_at,
          created_by_user_id,
          created_by_name
        ) VALUES (
          @quote_number,
          @order_number,
          @purchase_order_number,
          @purchase_order_not_applicable,
          @seller,
          @client_name,
          @project_description,
          @expected_margin,
          @total_invoiced,
          @total_invoiced_currency,
          @progress_percent,
          @technician_name,
          @tecnico_id,
          @vendedor_id,
          @fecha_vencimiento,
          @promised_delivery_date,
          @status,
          @risk,
          @observations,
          @created_at,
          @updated_at,
          @created_by_user_id,
          @created_by_name
        )`,
      )
      .run({ ...project, created_at: audit.created_at, updated_at: audit.created_at, created_by_user_id: audit.created_by_user_id, created_by_name: audit.created_by_name });

    logAuditEvent(db, { req, action: 'create', module: 'projects', entityType: 'project', entityId: result.lastInsertRowid, entityLabel: project.quote_number, after: project });
    res.status(201).json(mapProject(getProjectOrFail(result.lastInsertRowid), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.put('/api/projects/:id', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    const before = getProjectOrFail(req.params.id);
    const project = normalizeProject(req.body, { existingRow: before });
    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE projects SET
        quote_number = @quote_number,
        order_number = @order_number,
        purchase_order_number = @purchase_order_number,
        purchase_order_not_applicable = @purchase_order_not_applicable,
        seller = @seller,
        client_name = @client_name,
        project_description = @project_description,
        expected_margin = @expected_margin,
        total_invoiced = @total_invoiced,
        total_invoiced_currency = @total_invoiced_currency,
        progress_percent = @progress_percent,
        technician_name = @technician_name,
        tecnico_id = @tecnico_id,
        vendedor_id = @vendedor_id,
        fecha_vencimiento = @fecha_vencimiento,
        promised_delivery_date = @promised_delivery_date,
        status = @status,
        risk = @risk,
        observations = @observations,
        updated_at = @updated_at,
        updated_by_user_id = @updated_by_user_id,
        updated_by_name = @updated_by_name
      WHERE id = @id`,
    ).run({ ...project, id: req.params.id, ...audit });

    logAuditEvent(db, { req, action: 'update', module: 'projects', entityType: 'project', entityId: Number(req.params.id), entityLabel: project.quote_number, before, after: project });
    res.json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:id', requireAuth, requirePermission('projects', 'close'), (req, res, next) => {
  try {
    const before = getProjectOrFail(req.params.id);
    verifyAdminPassword(req.body);
    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE projects
       SET closed_at = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ?
       WHERE id = ? AND closed_at IS NULL`,
    ).run(audit.updated_at, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, Number(req.params.id));
    logAuditEvent(db, { req, action: 'close', module: 'projects', entityType: 'project', entityId: Number(req.params.id), entityLabel: before.quote_number, before: { closed_at: null }, after: { closed_at: audit.updated_at } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/closed-projects/:id', requireAuth, requirePermission('closedProjects', 'delete'), (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    if (!project.closed_at) {
      throw badRequest('El proyecto aun no esta cerrado.');
    }

    verifyAdminPassword(req.body);
    db.prepare('DELETE FROM projects WHERE id = ? AND closed_at IS NOT NULL').run(req.params.id);
    logAuditEvent(db, { req, action: 'delete', module: 'projects', entityType: 'project', entityId: Number(req.params.id), entityLabel: project.quote_number, before: project });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/payments', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const payment = normalizePayment(req.body);
    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO project_payments (project_id, amount, currency, payment_date, notes, created_at, created_by_user_id, created_by_name)
       VALUES (@project_id, @amount, @currency, @payment_date, @notes, @created_at, @created_by_user_id, @created_by_name)`,
    ).run({ ...payment, project_id: req.params.id, ...audit });

    logAuditEvent(db, { req, action: 'create', module: 'payments', entityType: 'project_payment', entityId: result.lastInsertRowid, entityLabel: `Pago ${payment.amount} ${payment.currency}`, after: payment });
    res.status(201).json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId/payments/:paymentId', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.projectId);
    verifyAdminPassword(req.body);
    const before = db.prepare('SELECT * FROM project_payments WHERE id = ? AND project_id = ?').get(req.params.paymentId, req.params.projectId);
    db.prepare('DELETE FROM project_payments WHERE id = ? AND project_id = ?').run(
      req.params.paymentId,
      req.params.projectId,
    );
    logAuditEvent(db, { req, action: 'delete', module: 'payments', entityType: 'project_payment', entityId: Number(req.params.paymentId), entityLabel: before ? `Pago ${before.amount}` : null, before });
    res.json(mapProject(getProjectOrFail(req.params.projectId), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/costs', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const cost = normalizeCost(req.body);
    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO project_costs (project_id, category, description, amount, currency, cost_date, created_at, created_by_user_id, created_by_name)
       VALUES (@project_id, @category, @description, @amount, @currency, @cost_date, @created_at, @created_by_user_id, @created_by_name)`,
    ).run({ ...cost, project_id: req.params.id, ...audit });

    logAuditEvent(db, { req, action: 'create', module: 'costs', entityType: 'project_cost', entityId: result.lastInsertRowid, entityLabel: `${cost.category} ${cost.amount}`, after: cost });
    res.status(201).json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId/costs/:costId', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.projectId);
    verifyAdminPassword(req.body);
    const before = db.prepare('SELECT * FROM project_costs WHERE id = ? AND project_id = ?').get(req.params.costId, req.params.projectId);
    db.prepare('DELETE FROM project_costs WHERE id = ? AND project_id = ?').run(
      req.params.costId,
      req.params.projectId,
    );
    logAuditEvent(db, { req, action: 'delete', module: 'costs', entityType: 'project_cost', entityId: Number(req.params.costId), entityLabel: before ? `${before.category} ${before.amount}` : null, before });
    res.json(mapProject(getProjectOrFail(req.params.projectId), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

function requireFailureReportView(req, res, next) {
  try {
    const project = getProjectOrFail(req.params.id);
    if (req.session.role === 'admin') {
      return next();
    }
    const perms = loadUserPermissions(db, req.session.userId, req.session.role);
    const module = project.closed_at ? 'closedProjects' : 'projects';
    if (hasPermission(perms, module, 'view')) {
      return next();
    }
    return res.status(403).json({
      message: 'Acceso restringido. No tienes permisos para consultar o modificar este apartado.',
    });
  } catch (error) {
    return next(error);
  }
}

function assertCanViewFailureReport(req, reportRow) {
  if (req.session.role === 'admin') {
    return;
  }
  const perms = loadUserPermissions(db, req.session.userId, req.session.role);
  if (reportRow.archived_at) {
    if (!hasPermission(perms, 'reportsArchive', 'view')) {
      const error = new Error('Acceso restringido al reporte de falla archivado.');
      error.statusCode = 403;
      throw error;
    }
    return;
  }
  if (hasPermission(perms, 'reports', 'view') || hasPermission(perms, 'reports', 'edit')) {
    return;
  }
  const project = db.prepare('SELECT closed_at FROM projects WHERE id = ?').get(reportRow.project_id);
  const module = project?.closed_at ? 'closedProjects' : 'projects';
  if (hasPermission(perms, module, 'view')) {
    return;
  }
  const error = new Error('Acceso restringido. No tienes permisos para consultar este reporte de falla.');
  error.statusCode = 403;
  throw error;
}

app.get('/api/failure-reports/:id', requireAuth, (req, res, next) => {
  try {
    const row = db.prepare(
      `SELECT fr.*,
        ef.full_name AS failure_responsible_name,
        es.full_name AS solution_responsible_name
      FROM project_failure_reports fr
      LEFT JOIN employees ef ON ef.id = fr.failure_responsible_employee_id
      LEFT JOIN employees es ON es.id = fr.solution_responsible_employee_id
      WHERE fr.id = ?`,
    ).get(req.params.id);
    if (!row) {
      const error = new Error('Reporte de falla no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    getProjectOrFail(row.project_id);
    assertCanViewFailureReport(req, row);
    const project = db.prepare(
      'SELECT id, quote_number, client_name, project_description FROM projects WHERE id = ?',
    ).get(row.project_id);
    res.json({ ...mapFailureReport(row), project });
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:id/failure-reports', requireAuth, requireFailureReportView, (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const rows = db.prepare(
      `SELECT fr.*,
        ef.full_name AS failure_responsible_name,
        es.full_name AS solution_responsible_name
      ${FAILURE_REPORT_FROM_SQL}
      WHERE fr.project_id = ? AND fr.archived_at IS NULL
      ORDER BY fr.registered_at DESC, fr.id DESC`,
    ).all(req.params.id);
    res.json({ data: rows.map(mapFailureReport) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/failure-reports', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const report = normalizeFailureReport(req.body);
    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO project_failure_reports (
        project_id,
        cause,
        problem_description,
        failure_responsible_employee_id,
        solution_responsible_employee_id,
        registered_at,
        created_at,
        created_by_user_id,
        created_by_name
      ) VALUES (
        @project_id,
        @cause,
        @problem_description,
        @failure_responsible_employee_id,
        @solution_responsible_employee_id,
        @registered_at,
        @created_at,
        @created_by_user_id,
        @created_by_name
      )`,
    ).run({
      ...report,
      project_id: req.params.id,
      registered_at: audit.created_at,
      created_at: audit.created_at,
      created_by_user_id: audit.created_by_user_id,
      created_by_name: audit.created_by_name,
    });

    const row = db.prepare(
      `SELECT fr.*,
        ef.full_name AS failure_responsible_name,
        es.full_name AS solution_responsible_name
      ${FAILURE_REPORT_FROM_SQL}
      WHERE fr.id = ?`,
    ).get(result.lastInsertRowid);

    logAuditEvent(db, {
      req,
      action: 'create',
      module: 'projects',
      entityType: 'project_failure_report',
      entityId: result.lastInsertRowid,
      entityLabel: `Falla ${report.cause} proyecto ${req.params.id}`,
      after: report,
    });
    res.status(201).json(mapFailureReport(row));
  } catch (error) {
    next(error);
  }
});

// ===================== REPORTS MODULE =====================

function generateReportFolio(projectId) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const existing = db.prepare(
    'SELECT COUNT(*) as count FROM project_reports WHERE project_id = ?',
  ).get(projectId);
  const counter = (existing.count || 0) + 1;
  return `REP-${projectId}-${dateStr}-${String(counter).padStart(3, '0')}`;
}

app.get('/api/reports/projects', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const reportCountSql = activeProjectReportCountSql('p');
  const sorting = normalizeSort(req.query, {
    ...PROJECT_SORTS,
    report_count: reportCountSql,
  }, 'p.status ASC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: { ...req.query, status: req.query.status || status },
    filters: {
      ...PROJECT_FILTERS,
      report_count: { type: 'number', column: reportCountSql },
    },
    baseWhere: ['p.closed_at IS NULL', 'p.reports_archived_at IS NULL'],
    search: {
      value: search,
      columns: buildProjectListSearchColumns(),
    },
  });

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM projects p WHERE ${whereClause}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const rows = db.prepare(
    `SELECT p.*, ${reportCountSql} as report_count
     FROM projects p
     WHERE ${whereClause}
     ORDER BY ${sorting.orderBy}
     LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = rows.map((row) => ({
    id: row.id,
    quote_number: row.quote_number,
    order_number: row.order_number,
    client_name: row.client_name,
    project_description: row.project_description,
    status: row.status,
    closed_at: row.closed_at,
    report_count: normalizeReportCount(row.report_count),
  }));

  res.json(buildListResponse(data, pag, sorting, filters));
});

function archiveAllReportsForProject(projectId, audit, username) {
  db.prepare(
    `UPDATE project_reports SET
      archived_at = @archived_at,
      archived_by_user_id = @archived_by_user_id,
      archived_by_name = @archived_by_name,
      updated_at = @updated_at,
      updated_by_user_id = @updated_by_user_id,
      updated_by = @updated_by
    WHERE project_id = @project_id
      AND deleted_at IS NULL
      AND archived_at IS NULL`,
  ).run({
    project_id: projectId,
    archived_at: audit.updated_at,
    archived_by_user_id: audit.updated_by_user_id,
    archived_by_name: audit.updated_by_name,
    updated_at: audit.updated_at,
    updated_by_user_id: audit.updated_by_user_id,
    updated_by: username,
  });
  db.prepare(
    `UPDATE project_failure_reports SET
      archived_at = ?,
      archived_by_user_id = ?,
      archived_by_name = ?
    WHERE project_id = ?
      AND archived_at IS NULL`,
  ).run(
    audit.updated_at,
    audit.updated_by_user_id,
    audit.updated_by_name,
    projectId,
  );
}

app.post('/api/reports/projects/:id/archive', requireAuth, requirePermission('reports', 'edit'), (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    if (project.reports_archived_at) {
      throw badRequest('Este registro de reportes ya esta archivado.');
    }
    const audit = updatedByFields(req);
    const archiveProject = db.transaction(() => {
      db.prepare(
        `UPDATE projects SET
          reports_archived_at = ?,
          reports_archived_by_user_id = ?,
          reports_archived_by_name = ?,
          updated_at = ?,
          updated_by_user_id = ?,
          updated_by_name = ?
        WHERE id = ?`,
      ).run(
        audit.updated_at,
        audit.updated_by_user_id,
        audit.updated_by_name,
        audit.updated_at,
        audit.updated_by_user_id,
        audit.updated_by_name,
        project.id,
      );
      archiveAllReportsForProject(project.id, audit, req.session.username);
    });
    archiveProject();
    logAuditEvent(db, {
      req,
      action: 'archive',
      module: 'reports',
      entityType: 'project',
      entityId: project.id,
      entityLabel: project.quote_number,
      metadata: { client_name: project.client_name },
    });
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
    res.json({
      id: row.id,
      quote_number: row.quote_number,
      client_name: row.client_name,
      reports_archived_at: row.reports_archived_at,
      reports_archived_at_cdmx: formatDateTimeCDMX(row.reports_archived_at),
      reports_archived_by_name: row.reports_archived_by_name,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const reports = db.prepare(
    `SELECT r.*, p.quote_number, p.order_number, p.client_name AS project_client,
            p.project_description, p.status AS project_status, p.closed_at
     FROM project_reports r
     JOIN projects p ON r.project_id = p.id
     ORDER BY r.created_at DESC`,
  ).all();
  res.json(reports);
});

app.get('/api/projects/:id/reports', requireAuth, requirePermission('reports', 'view'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const { page, limit, search } = parsePaginationParams(req.query);
    const sorting = normalizeSort(req.query, {
      id: 'r.id',
      report_folio: 'r.report_folio',
      report_date: 'r.report_date',
      service_name: 'r.service_name',
      technician_name: 'r.technician_name',
      created_at: 'r.created_at',
    }, 'r.created_at DESC');
    const { whereClause, params, filters } = buildWhere({
      query: req.query,
      filters: {
        id: { type: 'number', column: 'r.id' },
        report_folio: { type: 'text', column: 'r.report_folio' },
        report_date: { type: 'date', column: 'r.report_date' },
        service_name: { type: 'text', column: 'r.service_name' },
        technician_name: { type: 'text', column: 'r.technician_name' },
        created_at: { type: 'date', column: 'date(r.created_at)' },
      },
      baseWhere: ['r.project_id = ?', 'r.deleted_at IS NULL', 'r.archived_at IS NULL'],
      params: [req.params.id],
      search: {
        value: search,
        columns: PROJECT_REPORT_SEARCH_COLUMNS_PROJECT_SCOPED,
      },
    });
    const result = paginateSqlList({
      tableSql: `SELECT r.*, e.full_name AS executed_by_name
        FROM project_reports r
        LEFT JOIN employees e ON e.id = r.executed_by_employee_id`,
      countSql: 'SELECT COUNT(*) as count FROM project_reports r',
      whereClause,
      params,
      page,
      limit,
      orderBy: sorting.orderBy,
      map: mapProjectReport,
    });

    res.json(buildListResponse(result.data, result.pagination, sorting, filters));
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/:id', requireAuth, requirePermission('reports', 'view'), (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(report.project_id);
    res.json({ ...report, project });
  } catch (error) {
    next(error);
  }
});

app.post('/api/reports', requireAuth, requirePermission('reports', 'create'), (req, res, next) => {
  try {
    const projectId = req.body.project_id;
    if (!projectId) {
      throw badRequest('El proyecto es obligatorio.');
    }
    getProjectOrFail(projectId);

    const reportType = trim(req.body.report_type) || 'boiler_startup';
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      throw badRequest('Tipo de reporte no valido.');
    }

    const clientName = requiredText(req.body, 'client_name', 'Cliente');
    const serviceName = requiredText(req.body, 'service_name', 'Nombre de servicio');
    const reportDate = requiredText(req.body, 'report_date', 'Fecha del reporte');

    if (reportType === 'general_equipment_service_delivery') {
      requiredText(req.body, 'assigned_technicians', 'Tecnico asignado');
      const reportData = req.body.report_data || {};
      if (!reportData.activity_description || !String(reportData.activity_description).trim()) {
        throw badRequest('Descripcion de Actividades es obligatorio.');
      }
    }

    if (reportType === 'autoflame_system_startup') {
      const reportData = req.body.report_data || {};
      if (!reportData.site_name || !String(reportData.site_name).trim()) {
        throw badRequest('Sitio / planta es obligatorio.');
      }
      requiredText(req.body, 'assigned_technicians', 'Tecnico / ingeniero responsable');
    }

    const executor = resolveReportExecutor(req.body);

    let reportFolio = trim(req.body.report_folio);
    if (!reportFolio) {
      reportFolio = generateReportFolio(projectId);
    }

    const existing = db.prepare('SELECT id FROM project_reports WHERE report_folio = ?').get(reportFolio);
    if (existing) {
      throw badRequest('El folio de reporte ya existe. Usa un folio diferente.');
    }

    const safetyTests = req.body.safety_tests ? JSON.stringify(req.body.safety_tests) : null;
    const emissionsLow = req.body.emissions_low_fire ? JSON.stringify(req.body.emissions_low_fire) : null;
    const emissionsHigh = req.body.emissions_high_fire ? JSON.stringify(req.body.emissions_high_fire) : null;
    const reportData = req.body.report_data ? JSON.stringify(req.body.report_data) : null;

    const result = db.prepare(
      `INSERT INTO project_reports (
        project_id, report_folio, report_type, client_name, client_address, service_name,
        report_date, assigned_technicians, burner_model, equipment_model_serial,
        pumps_motors_model, fuel, voltage, gas_pressure_inh2o, liquid_fuel_pressure_psi,
        working_pressure, pump_amperage, fan_amperage, condensate_tank_temp_c,
        operating_output_temp_c, flue_gas_temp_c, safety_tests, comments,
        emissions_low_fire, emissions_high_fire, technician_name, plant_manager_name,
        report_data, executed_by_employee_id,
        created_by, updated_by, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (
        @project_id, @report_folio, @report_type, @client_name, @client_address, @service_name,
        @report_date, @assigned_technicians, @burner_model, @equipment_model_serial,
        @pumps_motors_model, @fuel, @voltage, @gas_pressure_inh2o, @liquid_fuel_pressure_psi,
        @working_pressure, @pump_amperage, @fan_amperage, @condensate_tank_temp_c,
        @operating_output_temp_c, @flue_gas_temp_c, @safety_tests, @comments,
        @emissions_low_fire, @emissions_high_fire, @technician_name, @plant_manager_name,
        @report_data, @executed_by_employee_id,
        @created_by, @updated_by, @created_by_user_id, @updated_by_user_id, @created_at, @updated_at
      )`,
    ).run({
      project_id: projectId,
      report_folio: reportFolio,
      report_type: reportType,
      client_name: clientName,
      client_address: optionalText(req.body, 'client_address'),
      service_name: serviceName,
      report_date: reportDate,
      assigned_technicians: optionalText(req.body, 'assigned_technicians'),
      burner_model: optionalText(req.body, 'burner_model'),
      equipment_model_serial: optionalText(req.body, 'equipment_model_serial'),
      pumps_motors_model: optionalText(req.body, 'pumps_motors_model'),
      fuel: optionalText(req.body, 'fuel'),
      voltage: optionalText(req.body, 'voltage'),
      gas_pressure_inh2o: optionalText(req.body, 'gas_pressure_inh2o'),
      liquid_fuel_pressure_psi: optionalText(req.body, 'liquid_fuel_pressure_psi'),
      working_pressure: optionalText(req.body, 'working_pressure'),
      pump_amperage: optionalText(req.body, 'pump_amperage'),
      fan_amperage: optionalText(req.body, 'fan_amperage'),
      condensate_tank_temp_c: optionalText(req.body, 'condensate_tank_temp_c'),
      operating_output_temp_c: optionalText(req.body, 'operating_output_temp_c'),
      flue_gas_temp_c: optionalText(req.body, 'flue_gas_temp_c'),
      safety_tests: safetyTests,
      comments: optionalText(req.body, 'comments'),
      emissions_low_fire: emissionsLow,
      emissions_high_fire: emissionsHigh,
      technician_name: executor.technician_name,
      plant_manager_name: optionalText(req.body, 'plant_manager_name'),
      report_data: reportData,
      executed_by_employee_id: executor.executed_by_employee_id,
      created_by: req.session.username,
      updated_by: req.session.username,
      created_by_user_id: req.session.userId,
      updated_by_user_id: req.session.userId,
      created_at: nowUtc(),
      updated_at: nowUtc(),
    });

    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(result.lastInsertRowid);
    logAuditEvent(db, { req, action: 'create', module: 'reports', entityType: 'project_report', entityId: result.lastInsertRowid, entityLabel: reportFolio });
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

app.put('/api/reports/:id', requireAuth, requirePermission('reports', 'edit'), (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    if (report.deleted_at) {
      if (req.session.role !== 'admin') {
        throw badRequest('Acceso restringido. Solo el administrador puede modificar reportes archivados.');
      }
    }
    if (report.archived_at) {
      throw badRequest('El reporte esta archivado. No se puede editar desde el modulo activo.');
    }

    const executor = resolveReportExecutor(req.body);
    const clientName = requiredText(req.body, 'client_name', 'Cliente');
    const serviceName = requiredText(req.body, 'service_name', 'Nombre de servicio');
    const reportDate = requiredText(req.body, 'report_date', 'Fecha del reporte');

    const safetyTests = req.body.safety_tests ? JSON.stringify(req.body.safety_tests) : null;
    const emissionsLow = req.body.emissions_low_fire ? JSON.stringify(req.body.emissions_low_fire) : null;
    const emissionsHigh = req.body.emissions_high_fire ? JSON.stringify(req.body.emissions_high_fire) : null;
    const reportData = req.body.report_data ? JSON.stringify(req.body.report_data) : report.report_data;

    const auditUpdate = updatedByFields(req);
    db.prepare(
      `UPDATE project_reports SET
        client_name = @client_name, client_address = @client_address,
        service_name = @service_name, report_date = @report_date,
        assigned_technicians = @assigned_technicians, burner_model = @burner_model,
        equipment_model_serial = @equipment_model_serial, pumps_motors_model = @pumps_motors_model,
        fuel = @fuel, voltage = @voltage, gas_pressure_inh2o = @gas_pressure_inh2o,
        liquid_fuel_pressure_psi = @liquid_fuel_pressure_psi, working_pressure = @working_pressure,
        pump_amperage = @pump_amperage, fan_amperage = @fan_amperage,
        condensate_tank_temp_c = @condensate_tank_temp_c, operating_output_temp_c = @operating_output_temp_c,
        flue_gas_temp_c = @flue_gas_temp_c, safety_tests = @safety_tests, comments = @comments,
        emissions_low_fire = @emissions_low_fire, emissions_high_fire = @emissions_high_fire,
        technician_name = @technician_name, plant_manager_name = @plant_manager_name,
        report_data = @report_data, executed_by_employee_id = @executed_by_employee_id,
        updated_by = @updated_by, updated_by_user_id = @updated_by_user_id, updated_at = @updated_at
      WHERE id = @id`,
    ).run({
      id: req.params.id,
      client_name: clientName,
      client_address: optionalText(req.body, 'client_address'),
      service_name: serviceName,
      report_date: reportDate,
      assigned_technicians: optionalText(req.body, 'assigned_technicians'),
      burner_model: optionalText(req.body, 'burner_model'),
      equipment_model_serial: optionalText(req.body, 'equipment_model_serial'),
      pumps_motors_model: optionalText(req.body, 'pumps_motors_model'),
      fuel: optionalText(req.body, 'fuel'),
      voltage: optionalText(req.body, 'voltage'),
      gas_pressure_inh2o: optionalText(req.body, 'gas_pressure_inh2o'),
      liquid_fuel_pressure_psi: optionalText(req.body, 'liquid_fuel_pressure_psi'),
      working_pressure: optionalText(req.body, 'working_pressure'),
      pump_amperage: optionalText(req.body, 'pump_amperage'),
      fan_amperage: optionalText(req.body, 'fan_amperage'),
      condensate_tank_temp_c: optionalText(req.body, 'condensate_tank_temp_c'),
      operating_output_temp_c: optionalText(req.body, 'operating_output_temp_c'),
      flue_gas_temp_c: optionalText(req.body, 'flue_gas_temp_c'),
      safety_tests: safetyTests,
      comments: optionalText(req.body, 'comments'),
      emissions_low_fire: emissionsLow,
      emissions_high_fire: emissionsHigh,
      technician_name: executor.technician_name,
      plant_manager_name: optionalText(req.body, 'plant_manager_name'),
      report_data: reportData,
      executed_by_employee_id: executor.executed_by_employee_id,
      updated_by: req.session.username,
      updated_by_user_id: req.session.userId,
      updated_at: auditUpdate.updated_at,
    });

    const updated = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    logAuditEvent(db, { req, action: 'update', module: 'reports', entityType: 'project_report', entityId: Number(req.params.id), entityLabel: report.report_folio, before: report });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ===================== REPORT ARCHIVE & NEW ENDPOINTS =====================

app.get('/api/report-types', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  res.json(Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({ value, label })));
});

app.get('/api/reports/active', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const sorting = normalizeSort(req.query, {
    id: 'r.id',
    report_folio: 'r.report_folio',
    report_date: 'r.report_date',
    report_type: 'r.report_type',
    service_name: 'r.service_name',
    client_name: 'r.client_name',
    technician_name: 'r.technician_name',
    created_at: 'r.created_at',
  }, 'r.created_at DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      report_type: { type: 'select', column: 'r.report_type', options: VALID_REPORT_TYPES },
      client_name: { type: 'text', column: 'r.client_name' },
      technician_name: { type: 'text', column: 'r.assigned_technicians' },
      report_date: { type: 'date', column: 'r.report_date' },
    },
    baseWhere: ['p.closed_at IS NULL', 'r.deleted_at IS NULL', 'r.archived_at IS NULL'],
    search: {
      value: search,
      columns: PROJECT_REPORT_SEARCH_COLUMNS,
    },
  });

  const tableSql = `SELECT r.*, p.project_description, p.quote_number, p.status AS project_status
    FROM project_reports r JOIN projects p ON r.project_id = p.id`;
  const countSql = `SELECT COUNT(*) as count FROM project_reports r JOIN projects p ON r.project_id = p.id`;
  const result = paginateSqlList({ tableSql, countSql, whereClause, params, page, limit, orderBy: sorting.orderBy });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/reports/assignable-employees', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const employees = db.prepare(
    `SELECT id, employee_number, full_name, department, position
     FROM employees
     WHERE active = 1
     ORDER BY full_name ASC`,
  ).all();
  res.json({ data: employees });
});

app.post('/api/reports/:id/archive', requireAuth, requirePermission('reports', 'edit'), (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    if (report.archived_at) {
      throw badRequest('El reporte ya esta archivado.');
    }
    if (report.deleted_at) {
      throw badRequest('El reporte fue eliminado y no puede archivarse.');
    }
    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE project_reports SET
        archived_at = @archived_at,
        archived_by_user_id = @archived_by_user_id,
        archived_by_name = @archived_by_name,
        updated_at = @updated_at,
        updated_by_user_id = @updated_by_user_id,
        updated_by = @updated_by
      WHERE id = @id`,
    ).run({
      id: req.params.id,
      archived_at: audit.updated_at,
      archived_by_user_id: audit.updated_by_user_id,
      archived_by_name: audit.updated_by_name,
      updated_at: audit.updated_at,
      updated_by_user_id: audit.updated_by_user_id,
      updated_by: req.session.username,
    });
    const project = db.prepare('SELECT id, quote_number, client_name FROM projects WHERE id = ?').get(report.project_id);
    logAuditEvent(db, {
      req,
      action: 'archive',
      module: 'reports',
      entityType: 'project_report',
      entityId: Number(req.params.id),
      entityLabel: report.report_folio,
      metadata: { project_id: report.project_id, quote_number: project?.quote_number },
    });
    const row = db.prepare(
      `SELECT r.*, e.full_name AS executed_by_name, p.quote_number, p.client_name AS project_client
       FROM project_reports r
       LEFT JOIN employees e ON e.id = r.executed_by_employee_id
       JOIN projects p ON p.id = r.project_id
       WHERE r.id = ?`,
    ).get(req.params.id);
    res.json(mapProjectReport(row));
  } catch (error) {
    next(error);
  }
});

app.post('/api/failure-reports/:id/archive', requireAuth, requirePermission('reports', 'edit'), (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_failure_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte de falla no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    if (report.archived_at) {
      throw badRequest('El reporte de falla ya esta archivado.');
    }
    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE project_failure_reports SET
        archived_at = ?,
        archived_by_user_id = ?,
        archived_by_name = ?
      WHERE id = ?`,
    ).run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);
    logAuditEvent(db, {
      req,
      action: 'archive',
      module: 'reports',
      entityType: 'project_failure_report',
      entityId: Number(req.params.id),
      entityLabel: `Falla #${req.params.id}`,
      metadata: { project_id: report.project_id },
    });
    const row = db.prepare(
      `SELECT fr.*,
        ef.full_name AS failure_responsible_name,
        es.full_name AS solution_responsible_name
      ${FAILURE_REPORT_FROM_SQL}
      WHERE fr.id = ?`,
    ).get(req.params.id);
    res.json(mapFailureReport(row));
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/archive/projects', requireAuth, requirePermission('reportsArchive', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const reportCountSql = archivedProjectReportCountSql('p');
  const sorting = normalizeSort(req.query, {
    ...PROJECT_SORTS,
    reports_archived_at: 'p.reports_archived_at',
    report_count: reportCountSql,
  }, 'p.reports_archived_at DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      ...PROJECT_FILTERS,
      report_count: { type: 'number', column: reportCountSql },
    },
    baseWhere: ['p.reports_archived_at IS NOT NULL'],
    search: {
      value: search,
      columns: buildProjectListSearchColumns(),
    },
  });
  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM projects p WHERE ${whereClause}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);
  const rows = db.prepare(
    `SELECT p.*, ${reportCountSql} as report_count
     FROM projects p
     WHERE ${whereClause}
     ORDER BY ${sorting.orderBy}
     LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);
  const data = rows.map((row) => ({
    id: row.id,
    quote_number: row.quote_number,
    order_number: row.order_number,
    client_name: row.client_name,
    project_description: row.project_description,
    status: row.status,
    report_count: normalizeReportCount(row.report_count),
    reports_archived_at: row.reports_archived_at,
    reports_archived_at_cdmx: formatDateTimeCDMX(row.reports_archived_at),
    reports_archived_by_name: row.reports_archived_by_name,
  }));
  res.json(buildListResponse(data, pag, sorting, filters));
});

app.get('/api/reports/archive/projects/:id/reports', requireAuth, requirePermission('reportsArchive', 'view'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const { page, limit, search } = parsePaginationParams(req.query);
    const sorting = normalizeSort(req.query, {
      id: 'r.id',
      report_folio: 'r.report_folio',
      report_date: 'r.report_date',
      service_name: 'r.service_name',
      technician_name: 'r.technician_name',
      created_at: 'r.created_at',
      archived_at: 'r.archived_at',
    }, 'r.archived_at DESC, r.id DESC');
    const { whereClause, params, filters } = buildWhere({
      query: req.query,
      filters: {
        id: { type: 'number', column: 'r.id' },
        report_folio: { type: 'text', column: 'r.report_folio' },
        report_date: { type: 'date', column: 'r.report_date' },
        service_name: { type: 'text', column: 'r.service_name' },
        technician_name: { type: 'text', column: 'r.technician_name' },
        created_at: { type: 'date', column: 'date(r.created_at)' },
        archived_at: { type: 'date', column: 'r.archived_at' },
      },
      baseWhere: ['r.project_id = ?', 'r.deleted_at IS NULL', 'r.archived_at IS NOT NULL'],
      params: [req.params.id],
      search: {
        value: search,
        columns: PROJECT_REPORT_SEARCH_COLUMNS_PROJECT_SCOPED,
      },
    });
    const result = paginateSqlList({
      tableSql: `SELECT r.*, e.full_name AS executed_by_name
        FROM project_reports r
        LEFT JOIN employees e ON e.id = r.executed_by_employee_id`,
      countSql: 'SELECT COUNT(*) as count FROM project_reports r',
      whereClause,
      params,
      page,
      limit,
      orderBy: sorting.orderBy,
      map: mapProjectReport,
    });
    res.json(buildListResponse(result.data, result.pagination, sorting, filters));
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/archive/projects/:id/failure-reports', requireAuth, requirePermission('reportsArchive', 'view'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const rows = db.prepare(
      `SELECT fr.*,
        ef.full_name AS failure_responsible_name,
        es.full_name AS solution_responsible_name
      FROM project_failure_reports fr
      LEFT JOIN employees ef ON ef.id = fr.failure_responsible_employee_id
      LEFT JOIN employees es ON es.id = fr.solution_responsible_employee_id
      WHERE fr.project_id = ? AND fr.archived_at IS NOT NULL
      ORDER BY fr.archived_at DESC, fr.id DESC`,
    ).all(req.params.id);
    res.json({ data: rows.map(mapFailureReport) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/archive/clients', requireAuth, requirePermission('reportsArchive', 'view'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  let sql = `
    SELECT archive_client AS client_name,
      COUNT(*) AS reports_count,
      MAX(archived_at) AS last_archived_at
    FROM (
      SELECT COALESCE(r.client_name, p.client_name) AS archive_client,
        r.archived_at
      FROM project_reports r
      JOIN projects p ON r.project_id = p.id
      WHERE r.${ARCHIVED_PROJECT_REPORT_WHERE.replace(/ AND /g, ' AND r.')}
      UNION ALL
      SELECT p.client_name AS archive_client,
        fr.archived_at
      FROM project_failure_reports fr
      JOIN projects p ON fr.project_id = p.id
      WHERE fr.archived_at IS NOT NULL
    ) archived_rows
  `;
  const params = [];
  if (search) {
    sql += ' WHERE LOWER(archive_client) LIKE ?';
    params.push(`%${normalizeSearchTerm(search)}%`);
  }
  sql += ' GROUP BY archive_client ORDER BY last_archived_at DESC';
  const clients = db.prepare(sql).all(...params);
  res.json({
    data: clients.map((row) => ({
      client_name: row.client_name,
      reports_count: row.reports_count,
      last_archived_at: row.last_archived_at,
      last_archived_at_cdmx: formatDateTimeCDMX(row.last_archived_at),
    })),
  });
});

app.get('/api/reports/archive/client/:clientName', requireAuth, requirePermission('reportsArchive', 'view'), (req, res) => {
  const clientName = decodeURIComponent(req.params.clientName);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const rows = db.prepare(
    `SELECT r.id,
      'technical' AS record_kind,
      r.report_folio AS folio,
      r.report_type,
      r.report_date,
      r.service_name,
      r.archived_at,
      r.archived_by_name,
      r.project_id,
      p.quote_number,
      p.order_number,
      p.client_name AS project_client,
      p.project_description,
      p.closed_at AS project_closed_at,
      e.full_name AS executed_by_name
    FROM project_reports r
    JOIN projects p ON r.project_id = p.id
    LEFT JOIN employees e ON e.id = r.executed_by_employee_id
    WHERE r.archived_at IS NOT NULL AND r.deleted_at IS NULL
      AND COALESCE(r.client_name, p.client_name) = ?
    UNION ALL
    SELECT fr.id,
      'failure' AS record_kind,
      ('FALLA-' || fr.id) AS folio,
      'failure_report' AS report_type,
      substr(fr.registered_at, 1, 10) AS report_date,
      fr.problem_description AS service_name,
      fr.archived_at,
      fr.archived_by_name,
      fr.project_id,
      p.quote_number,
      p.order_number,
      p.client_name AS project_client,
      p.project_description,
      p.closed_at AS project_closed_at,
      es.full_name AS executed_by_name
    FROM project_failure_reports fr
    JOIN projects p ON fr.project_id = p.id
    LEFT JOIN employees es ON es.id = fr.solution_responsible_employee_id
    WHERE fr.archived_at IS NOT NULL AND p.client_name = ?
    ORDER BY archived_at DESC`,
  ).all(clientName, clientName);

  let filtered = rows;
  if (search) {
    const term = normalizeSearchTerm(search);
    filtered = rows.filter((row) => matchesAnySearchField([
      row.folio,
      row.service_name,
      row.quote_number,
      row.executed_by_name,
      row.report_type,
    ], term));
  }

  const data = filtered.map((row) => ({
    ...row,
    report_type_label: REPORT_TYPE_LABELS[row.report_type] || row.report_type,
    archived_at_cdmx: formatDateTimeCDMX(row.archived_at),
    origin_label: `Proyecto #${row.project_id} · ${row.quote_number || ''}`.trim(),
  }));
  res.json({ data });
});

app.delete('/api/reports/:id', requireAuth, requirePermission('reports', 'delete'), (req, res, next) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({
        message: 'Acceso restringido. Solo el administrador puede modificar o eliminar reportes archivados.',
      });
    }
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const reason = requiredText(req.body, 'delete_reason', 'Motivo de eliminacion');
    const auditDel = deletedByFields(req);
    db.prepare(
      `UPDATE project_reports SET deleted_at = ?, deleted_by = ?, deleted_by_user_id = ?, delete_reason = ? WHERE id = ?`,
    ).run(auditDel.deleted_at, req.session.username, auditDel.deleted_by_user_id, reason, req.params.id);
    logAuditEvent(db, { req, action: 'soft_delete', module: 'reports', entityType: 'project_report', entityId: Number(req.params.id), entityLabel: report.report_folio, metadata: { reason } });
    res.json({ message: 'Reporte eliminado logicamente.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/closed-projects/by-client', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const exchangeRates = getExchangeRateMap();
  let sql = `
    SELECT p.client_name,
      COUNT(*) as projects_count,
      MAX(p.closed_at) as last_closed_at,
      SUM(p.total_invoiced * COALESCE((SELECT rate_to_mxn FROM exchange_rates WHERE currency = COALESCE(p.total_invoiced_currency, 'MXN')), 1)) as total_invoiced_mxn
    FROM projects p
    WHERE p.closed_at IS NOT NULL
  `;
  const params = [];
  const groupedSearch = buildGroupedClientSearchSql(search, buildProjectListSearchColumns());
  sql += groupedSearch.clause;
  params.push(...groupedSearch.params);
  sql += ' GROUP BY p.client_name ORDER BY last_closed_at DESC';
  const clients = db.prepare(sql).all(...params);
  res.json({ data: clients });
});

app.get('/api/closed-projects/client/:clientName', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const clientName = decodeURIComponent(req.params.clientName);
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.closed_at DESC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: PROJECT_FILTERS,
    baseWhere: ['p.closed_at IS NOT NULL', 'p.client_name = ?'],
    params: [clientName],
    search: {
      value: search,
      columns: buildProjectListSearchColumns(),
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => ({
      ...mapProject(project, exchangeRates),
      report_count: normalizeReportCount(
        db.prepare(`SELECT ${activeProjectReportCountSql('p')} AS count FROM projects p WHERE p.id = ?`)
          .get(project.id).count,
      ),
    }),
  });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/closed-projects/date-range', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.closed_at DESC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      ...PROJECT_FILTERS,
      closed_at: { type: 'date', column: 'date(p.closed_at)' },
    },
    baseWhere: ['p.closed_at IS NOT NULL'],
    search: {
      value: search,
      columns: buildProjectListSearchColumns(),
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => mapProject(project, exchangeRates),
  });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

// ===================== END REPORTS MODULE =====================

// ===================== VACATION MODULE =====================

const VALID_VACATION_STATUSES = ['programada', 'tomada', 'cancelada'];

function getEmployeeOrFail(employeeId) {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!employee) {
    const error = new Error('Empleado no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return employee;
}

function mapEmployee(row) {
  const today = new Date().toISOString().slice(0, 10);
  const referenceDate = row.active ? today : (row.termination_date || today);
  const completedYears = getCompletedYears(new Date(row.hire_date), new Date(referenceDate));
  const accruedDays = calculateAccruedVacationDays(row.hire_date, referenceDate);

  const allRequests = db.prepare(
    'SELECT * FROM vacation_requests WHERE employee_id = ?',
  ).all(row.id);

  const activeRequests = allRequests.filter((r) => r.status !== 'cancelada');
  const daysTaken = activeRequests
    .filter((r) => r.status === 'tomada')
    .reduce((sum, r) => sum + r.requested_days, 0);
  const daysScheduled = activeRequests
    .filter((r) => r.status === 'programada')
    .reduce((sum, r) => sum + r.requested_days, 0);
  const daysAvailable = accruedDays - daysTaken - daysScheduled;

  return {
    ...row,
    active: !!row.active,
    kpi_eligible: isDbTruthy(row.kpi_eligible),
    primary_department: row.primary_department || row.department || null,
    secondary_department: row.secondary_department || null,
    user_id: row.user_id || null,
    seniority_years: completedYears,
    accrued_days: accruedDays,
    days_taken: daysTaken,
    days_scheduled: daysScheduled,
    days_pending: daysAvailable,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
  };
}

function checkOverlap(employeeId, startDate, endDate, excludeRequestId) {
  let query = `SELECT id FROM vacation_requests
    WHERE employee_id = ? AND status != 'cancelada'
    AND start_date <= ? AND end_date >= ?`;
  const params = [employeeId, endDate, startDate];

  if (excludeRequestId) {
    query += ' AND id != ?';
    params.push(excludeRequestId);
  }

  return db.prepare(query).get(...params);
}

app.get('/api/employees', requireAuth, requirePermission('vacations', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const activeFilter = typeof req.query.activeFilter === 'string' ? req.query.activeFilter.trim() : 'all';
  const safeActiveFilter = VALID_EMPLOYEE_FILTERS.includes(activeFilter) ? activeFilter : 'all';
  const sorting = normalizeSort(req.query, {
    id: 'id',
    employee_number: 'employee_number',
    full_name: 'full_name',
    hire_date: 'hire_date',
    active: 'active',
    termination_date: 'termination_date',
    seniority_years: 'seniority_years',
    accrued_days: 'accrued_days',
    days_taken: 'days_taken',
    days_scheduled: 'days_scheduled',
    days_pending: 'days_pending',
  }, 'active DESC, full_name ASC');
  const dbFilters = {
    id: { type: 'number', column: 'id' },
    employee_number: { type: 'text', column: 'employee_number' },
    full_name: { type: 'text', column: 'full_name' },
    hire_date: { type: 'date', column: 'hire_date' },
    active: { type: 'boolean', column: 'active' },
    termination_date: { type: 'date', column: 'termination_date' },
  };
  const baseWhere = [];
  if (safeActiveFilter === 'active') {
    baseWhere.push('active = 1');
  } else if (safeActiveFilter === 'inactive') {
    baseWhere.push('active = 0');
  }
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: dbFilters,
    baseWhere,
  });
  const allEmployees = db.prepare(`SELECT * FROM employees WHERE ${whereClause}`).all(...params).map(mapEmployee);
  const searchedEmployees = search
    ? allEmployees.filter((employee) => employeeMatchesSearch(employee, search))
    : allEmployees;
  const employeeFilters = {
    ...dbFilters,
    seniority_years: { type: 'number' },
    accrued_days: { type: 'number' },
    days_taken: { type: 'number' },
    days_scheduled: { type: 'number' },
    days_pending: { type: 'number' },
  };
  const filteredEmployees = applyInMemoryFilters(searchedEmployees, req.query, employeeFilters);
  const selectors = sorting.sortBy
    ? [
        ...(safeActiveFilter === 'inactive' ? [] : [{ key: 'active', direction: -1 }]),
        { key: sorting.sortBy, direction: sorting.sortOrder === 'DESC' ? -1 : 1 },
      ]
    : [{ key: 'active', direction: -1 }, { key: 'full_name', direction: 1 }];
  const sortedEmployees = sortRows(filteredEmployees, '', 'ASC', selectors);
  const pag = buildPaginationMeta(page, limit, sortedEmployees.length);
  const data = sortedEmployees.slice(pag.offset, pag.offset + pag.limit);

  res.json(buildListResponse(data, pag, sorting, { ...filters, ...collectActiveFilters(req.query, employeeFilters), activeFilter: safeActiveFilter }));
});

app.get('/api/employees/:id', requireAuth, requirePermission('vacations', 'view'), (req, res, next) => {
  try {
    const employee = getEmployeeOrFail(req.params.id);
    res.json(mapEmployee(employee));
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees', requireAuth, requirePermission('vacations', 'create'), (req, res, next) => {
  try {
    const employeeNumber = requiredText(req.body, 'employee_number', 'Numero de empleado');
    const fullName = requiredText(req.body, 'full_name', 'Nombre completo');
    const hireDate = requiredText(req.body, 'hire_date', 'Fecha de ingreso');
    const department = optionalText(req.body, 'department');
    const primaryDepartment = optionalText(req.body, 'primary_department') || department;
    const secondaryDepartment = optionalText(req.body, 'secondary_department');
    const kpiEligible = req.body.kpi_eligible === false || req.body.kpi_eligible === 0 ? 0 : 1;
    const userId = req.body.user_id ? Number(req.body.user_id) : null;
    const position = optionalText(req.body, 'position');
    const immediateBoss = optionalText(req.body, 'immediate_boss');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    let terminationDate = optionalText(req.body, 'termination_date');
    const inactiveReason = optionalText(req.body, 'inactive_reason');

    if (!active) {
      if (!terminationDate) {
        throw badRequest('La fecha de baja es obligatoria para empleados inactivos.');
      }
      if (new Date(terminationDate) < new Date(hireDate)) {
        throw badRequest('La fecha de baja no puede ser anterior a la fecha de ingreso.');
      }
    } else {
      terminationDate = null;
    }

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO employees (employee_number, full_name, hire_date, department, primary_department, secondary_department, kpi_eligible, user_id, position, immediate_boss, active, termination_date, inactive_reason, created_at, updated_at, created_by_user_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(employeeNumber, fullName, hireDate, department, primaryDepartment, secondaryDepartment, kpiEligible, userId, position, immediateBoss, active, terminationDate, inactiveReason, audit.created_at, audit.created_at, audit.created_by_user_id, audit.created_by_name);

    logAuditEvent(db, { req, action: 'create', module: 'employees', entityType: 'employee', entityId: result.lastInsertRowid, entityLabel: fullName });
    res.status(201).json(mapEmployee(getEmployeeOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/employees/:id', requireAuth, requirePermission('vacations', 'edit'), (req, res, next) => {
  try {
    const before = getEmployeeOrFail(req.params.id);
    const employeeNumber = requiredText(req.body, 'employee_number', 'Numero de empleado');
    const fullName = requiredText(req.body, 'full_name', 'Nombre completo');
    const hireDate = requiredText(req.body, 'hire_date', 'Fecha de ingreso');
    const department = optionalText(req.body, 'department');
    const position = optionalText(req.body, 'position');
    const immediateBoss = optionalText(req.body, 'immediate_boss');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    let terminationDate = optionalText(req.body, 'termination_date');
    const inactiveReason = optionalText(req.body, 'inactive_reason');

    if (!active) {
      if (!terminationDate) {
        throw badRequest('La fecha de baja es obligatoria para empleados inactivos.');
      }
      if (new Date(terminationDate) < new Date(hireDate)) {
        throw badRequest('La fecha de baja no puede ser anterior a la fecha de ingreso.');
      }
    } else {
      terminationDate = null;
    }

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE employees SET
        employee_number = ?, full_name = ?, hire_date = ?, department = ?,
        position = ?, immediate_boss = ?, active = ?,
        termination_date = ?, inactive_reason = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ?
       WHERE id = ?`,
    ).run(employeeNumber, fullName, hireDate, department, position, immediateBoss, active, terminationDate, inactiveReason, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);

    logAuditEvent(db, { req, action: 'update', module: 'employees', entityType: 'employee', entityId: Number(req.params.id), entityLabel: fullName, before });
    res.json(mapEmployee(getEmployeeOrFail(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/employees/:id/vacation-requests', requireAuth, requirePermission('vacations', 'view'), (req, res, next) => {
  try {
    getEmployeeOrFail(req.params.id);
    const { page, limit, search } = parsePaginationParams(req.query);
    const sorting = normalizeSort(req.query, {
      id: 'id',
      start_date: 'start_date',
      end_date: 'end_date',
      requested_days: 'requested_days',
      vacation_exercise_year: 'vacation_exercise_year',
      status: 'status',
      include_vacation_bonus: 'include_vacation_bonus',
      creates_negative_balance: 'creates_negative_balance',
      created_at: 'created_at',
    }, 'start_date DESC, id DESC');
    const { whereClause, params, filters } = buildWhere({
      query: req.query,
      filters: {
        id: { type: 'number', column: 'id' },
        start_date: { type: 'date', column: 'start_date' },
        end_date: { type: 'date', column: 'end_date' },
        requested_days: { type: 'number', column: 'requested_days' },
        vacation_exercise_year: { type: 'number', column: 'vacation_exercise_year' },
        status: { type: 'select', column: 'status', options: VALID_VACATION_STATUSES },
        include_vacation_bonus: { type: 'boolean', column: 'include_vacation_bonus' },
        creates_negative_balance: { type: 'boolean', column: 'creates_negative_balance' },
        notes: { type: 'text', column: 'notes' },
        created_at: { type: 'date', column: 'date(created_at)' },
      },
      baseWhere: ['employee_id = ?'],
      params: [req.params.id],
      search: {
        value: search,
        columns: [
          'CAST(id AS TEXT)',
          'status',
          'notes',
          'CAST(start_date AS TEXT)',
          'CAST(end_date AS TEXT)',
          'CAST(requested_days AS TEXT)',
          'CAST(vacation_exercise_year AS TEXT)',
        ],
      },
    });
    const result = paginateSqlList({
      tableSql: 'SELECT * FROM vacation_requests',
      countSql: 'SELECT COUNT(*) as count FROM vacation_requests',
      whereClause,
      params,
      page,
      limit,
      orderBy: sorting.orderBy,
    });

    res.json(buildListResponse(result.data, result.pagination, sorting, filters));
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees/:id/vacation-requests', requireAuth, requirePermission('vacations', 'create'), (req, res, next) => {
  try {
    const employee = getEmployeeOrFail(req.params.id);
    if (!employee.active) {
      throw badRequest('No se pueden crear solicitudes para empleados inactivos.');
    }
    const startDate = requiredText(req.body, 'start_date', 'Fecha inicial');
    const endDate = requiredText(req.body, 'end_date', 'Fecha final');
    const status = enumValue(req.body, 'status', 'Estatus', VALID_VACATION_STATUSES);

    if (new Date(endDate) < new Date(startDate)) {
      throw badRequest('La fecha final no puede ser menor que la fecha inicial.');
    }

    const requestedDays = calculateBusinessDays(startDate, endDate);
    if (requestedDays <= 0) {
      throw badRequest('Los dias solicitados deben ser mayor a 0 (dias laborables).');
    }

    const today = new Date().toISOString().slice(0, 10);
    const exerciseYear = req.body.vacation_exercise_year
      ? Number(req.body.vacation_exercise_year)
      : getCurrentExerciseYear(employee.hire_date, today);

    const accruedDays = calculateAccruedVacationDays(employee.hire_date, today);
    const allRequests = db.prepare(
      'SELECT * FROM vacation_requests WHERE employee_id = ?',
    ).all(employee.id);
    const activeRequests = allRequests.filter((r) => r.status !== 'cancelada');
    const usedDays = activeRequests.reduce((sum, r) => sum + r.requested_days, 0);
    const available = accruedDays - usedDays;

    const willCreateNegativeBalance = requestedDays > available;
    const negativeDaysGenerated = willCreateNegativeBalance ? requestedDays - available : 0;
    const balanceAfterRequest = available - requestedDays;

    if (willCreateNegativeBalance) {
      if (!req.body.confirm_negative_balance) {
        return res.status(409).json({
          message: `Esta solicitud excede los dias disponibles (${available}). El empleado quedara con saldo negativo por vacaciones anticipadas y se descontara del siguiente ejercicio.`,
          requires_confirmation: true,
          available_days: available,
          requested_days: requestedDays,
          balance_after: balanceAfterRequest,
        });
      }
      const overrideReason = trim(req.body.admin_override_reason)
        || 'Vacaciones anticipadas autorizadas por direccion.';
      if (!overrideReason) {
        throw badRequest('Se requiere un motivo de autorizacion para vacaciones anticipadas.');
      }
    }

    const overlap = checkOverlap(employee.id, startDate, endDate);
    if (overlap) {
      throw badRequest('Las fechas se traslapan con otra solicitud activa.');
    }

    const includeVacationBonus = req.body.include_vacation_bonus === false || req.body.include_vacation_bonus === 0 ? 0 : 1;
    const notes = optionalText(req.body, 'notes');
    const adminOverrideReason = willCreateNegativeBalance
      ? (trim(req.body.admin_override_reason) || 'Vacaciones anticipadas autorizadas por direccion.')
      : null;

    const existingActiveRequests = activeRequests.filter(
      (r) => r.vacation_exercise_year === exerciseYear,
    );

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO vacation_requests
        (employee_id, start_date, end_date, requested_days, vacation_exercise_year,
         status, is_first_vacation_of_exercise, include_vacation_bonus,
         created_by, created_by_user_id, authorized_by, hr_responsible, notes,
         creates_negative_balance, negative_days_generated, admin_override_reason, balance_after_request,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      employee.id, startDate, endDate, requestedDays, exerciseYear,
      status,
      existingActiveRequests.length === 0 ? 1 : 0,
      includeVacationBonus,
      req.session.username,
      audit.created_by_user_id,
      'Ivan Garcia',
      'Alejandra Gonzalez',
      notes,
      willCreateNegativeBalance ? 1 : 0,
      negativeDaysGenerated,
      adminOverrideReason,
      balanceAfterRequest,
      audit.created_at,
      audit.created_at,
    );

    const newRequest = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(result.lastInsertRowid);
    logAuditEvent(db, { req, action: 'create', module: 'vacations', entityType: 'vacation_request', entityId: result.lastInsertRowid, entityLabel: `${employee.full_name} ${startDate}-${endDate}` });
    res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
});

app.put('/api/vacation-requests/:id', requireAuth, requirePermission('vacations', 'edit'), (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    const employee = getEmployeeOrFail(request.employee_id);
    const startDate = requiredText(req.body, 'start_date', 'Fecha inicial');
    const endDate = requiredText(req.body, 'end_date', 'Fecha final');
    const status = enumValue(req.body, 'status', 'Estatus', VALID_VACATION_STATUSES);

    if (new Date(endDate) < new Date(startDate)) {
      throw badRequest('La fecha final no puede ser menor que la fecha inicial.');
    }

    const requestedDays = calculateBusinessDays(startDate, endDate);
    if (requestedDays <= 0) {
      throw badRequest('Los dias solicitados deben ser mayor a 0 (dias laborables).');
    }

    let willCreateNegativeBalance = false;
    let negativeDaysGenerated = 0;
    let balanceAfterRequest = 0;

    if (status !== 'cancelada') {
      const today = new Date().toISOString().slice(0, 10);
      const refDate = employee.active ? today : (employee.termination_date || today);
      const accruedDays = calculateAccruedVacationDays(employee.hire_date, refDate);

      const otherRequests = db.prepare(
        'SELECT * FROM vacation_requests WHERE employee_id = ? AND id != ? AND status != ?',
      ).all(employee.id, request.id, 'cancelada');
      const usedDays = otherRequests.reduce((sum, r) => sum + r.requested_days, 0);
      const available = accruedDays - usedDays;

      willCreateNegativeBalance = requestedDays > available;
      negativeDaysGenerated = willCreateNegativeBalance ? requestedDays - available : 0;
      balanceAfterRequest = available - requestedDays;

      if (willCreateNegativeBalance && !req.body.confirm_negative_balance) {
        return res.status(409).json({
          message: `Esta solicitud excede los dias disponibles (${available}). El empleado quedara con saldo negativo por vacaciones anticipadas.`,
          requires_confirmation: true,
          available_days: available,
          requested_days: requestedDays,
          balance_after: balanceAfterRequest,
        });
      }

      const overlap = checkOverlap(employee.id, startDate, endDate, request.id);
      if (overlap) {
        throw badRequest('Las fechas se traslapan con otra solicitud activa.');
      }
    }

    const includeVacationBonus = req.body.include_vacation_bonus === false || req.body.include_vacation_bonus === 0 ? 0 : 1;
    const notes = optionalText(req.body, 'notes');
    const adminOverrideReason = willCreateNegativeBalance
      ? (trim(req.body.admin_override_reason) || 'Vacaciones anticipadas autorizadas por direccion.')
      : null;

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE vacation_requests SET
        start_date = ?, end_date = ?, requested_days = ?, status = ?,
        include_vacation_bonus = ?, notes = ?,
        creates_negative_balance = ?, negative_days_generated = ?,
        admin_override_reason = ?, balance_after_request = ?,
        updated_at = ?, updated_by_user_id = ?, updated_by_name = ?
       WHERE id = ?`,
    ).run(
      startDate, endDate, requestedDays, status, includeVacationBonus, notes,
      willCreateNegativeBalance ? 1 : 0, negativeDaysGenerated,
      adminOverrideReason, balanceAfterRequest, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, request.id,
    );

    logAuditEvent(db, { req, action: 'update', module: 'vacations', entityType: 'vacation_request', entityId: request.id, entityLabel: `${employee.full_name} ${startDate}-${endDate}`, before: request });
    res.json(db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(request.id));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/vacation-requests/:id/cancel', requireAuth, requirePermission('vacations', 'edit'), (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    const audit = updatedByFields(req);
    db.prepare(
      "UPDATE vacation_requests SET status = 'cancelada', updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?",
    ).run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, request.id);

    logAuditEvent(db, { req, action: 'cancel', module: 'vacations', entityType: 'vacation_request', entityId: request.id, entityLabel: `Cancelada`, before: request });
    res.json(db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(request.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/vacation-requests/:id', requireAuth, requirePermission('vacations', 'view'), (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    const employee = getEmployeeOrFail(request.employee_id);
    const today = new Date().toISOString().slice(0, 10);
    const referenceDate = employee.active ? today : (employee.termination_date || today);
    const accruedDays = calculateAccruedVacationDays(employee.hire_date, referenceDate);
    const completedYears = getCompletedYears(new Date(employee.hire_date), new Date(referenceDate));

    const allRequests = db.prepare(
      'SELECT * FROM vacation_requests WHERE employee_id = ? AND status != ?',
    ).all(employee.id, 'cancelada');
    const daysTaken = allRequests
      .filter((r) => r.status === 'tomada')
      .reduce((sum, r) => sum + r.requested_days, 0);
    const daysScheduled = allRequests
      .filter((r) => r.status === 'programada')
      .reduce((sum, r) => sum + r.requested_days, 0);
    const daysAvailable = accruedDays - daysTaken - daysScheduled;

    res.json({
      ...request,
      employee,
      accrued_days: accruedDays,
      days_taken: daysTaken,
      days_scheduled: daysScheduled,
      days_pending: daysAvailable,
      seniority_years: completedYears,
      balance_after_this_request: request.balance_after_request,
    });
  } catch (error) {
    next(error);
  }
});

// ===================== END VACATION MODULE =====================

// ===================== ATTENDANCE MODULE =====================

function getPayrollWeekOrFail(weekId) {
  const week = db.prepare('SELECT * FROM payroll_attendance_weeks WHERE id = ?').get(weekId);
  if (!week) {
    const error = new Error('Nómina semanal no encontrada.');
    error.statusCode = 404;
    throw error;
  }
  return week;
}

function mapPayrollWeek(row) {
  const employees = db.prepare('SELECT * FROM payroll_attendance_employees WHERE payroll_attendance_week_id = ? ORDER BY employee_number_snapshot').all(row.id);
  const summary = calculateAttendanceSummary(employees);
  return {
    ...row,
    employees,
    summary,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
    closed_at_cdmx: formatDateTimeCDMX(row.closed_at),
  };
}

function mapPayrollWeekListItem(row) {
  const empCount = db.prepare('SELECT COUNT(*) as cnt FROM payroll_attendance_employees WHERE payroll_attendance_week_id = ?').get(row.id);
  const employees = db.prepare('SELECT monday_status, tuesday_status, wednesday_status, thursday_status, friday_status, saturday_status, sunday_status, extra_payment_amount FROM payroll_attendance_employees WHERE payroll_attendance_week_id = ?').all(row.id);
  const summary = calculateAttendanceSummary(employees);
  return {
    id: row.id,
    year: row.year,
    week_number: row.week_number,
    week_start_date: row.week_start_date,
    week_end_date: row.week_end_date,
    title: row.title,
    status: row.status,
    employee_count: empCount.cnt,
    total_absences: summary.totalAbsences,
    total_extra_payments: summary.totalExtraPayments,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
    closed_at_cdmx: formatDateTimeCDMX(row.closed_at),
  };
}

// GET /api/attendance/weeks - List payroll weeks
app.get('/api/attendance/weeks', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);

  const filterDefs = {
    year: { type: 'number', column: 'year' },
    week_number: { type: 'number', column: 'week_number' },
    status: { type: 'select', column: 'status', options: VALID_WEEK_STATUSES },
    created_by_name: { type: 'text', column: 'created_by_name' },
    week_start_date: { type: 'date', column: 'week_start_date' },
    week_end_date: { type: 'date', column: 'week_end_date' },
  };

  const whereParts = [];
  const params = [];

  const { activeFilters } = addSqlFilters(req.query, filterDefs, whereParts, params);

  if (search) {
    whereParts.push('(title LIKE ? OR created_by_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const includeCancelled = req.query.include_cancelled === 'true' || req.query.include_cancelled === '1';
  const hasYearFilter = activeFilters.year != null;
  if (!includeCancelled && !activeFilters.status && !hasYearFilter) {
    whereParts.push("status != 'cancelada'");
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const orderBy = hasYearFilter ? 'year DESC, week_number ASC' : 'year DESC, week_number DESC';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM payroll_attendance_weeks ${whereClause}`).get(...params);
  const pagination = buildPaginationMeta(page, limit, countRow.total);

  const rows = db.prepare(`SELECT * FROM payroll_attendance_weeks ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, pagination.limit, pagination.offset);

  const data = rows.map(mapPayrollWeekListItem);

  const extra = {};
  if (hasYearFilter) {
    const summaryRows = db.prepare(`SELECT status, COUNT(*) as cnt FROM payroll_attendance_weeks ${whereClause} GROUP BY status`).all(...params);
    const counts = { borrador: 0, cerrada: 0, cancelada: 0 };
    for (const r of summaryRows) counts[r.status] = r.cnt;
    extra.summary = {
      year: activeFilters.year,
      totalWeeks: countRow.total,
      draftCount: counts.borrador,
      closedCount: counts.cerrada,
      cancelledCount: counts.cancelada,
    };
  }

  res.json(buildListResponse(data, pagination, { sortBy: '', sortOrder: hasYearFilter ? 'asc' : 'desc' }, activeFilters, extra));
});

// GET /api/attendance/statuses - Get attendance status catalog
app.get('/api/attendance/statuses', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  res.json(ATTENDANCE_STATUSES);
});

// GET /api/attendance/years - Get distinct years that have payroll weeks
app.get('/api/attendance/years', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  const rows = db.prepare('SELECT DISTINCT year FROM payroll_attendance_weeks ORDER BY year DESC').all();
  const years = rows.map((r) => r.year);
  res.json({ years });
});

// POST /api/attendance/weeks - Create new payroll week
app.post('/api/attendance/weeks', requireAuth, requirePermission('attendance', 'create'), (req, res) => {
  const { year, week_number } = req.body;

  if (!year || !week_number) {
    return res.status(400).json({ message: 'Año y número de semana son obligatorios.' });
  }

  const yearNum = Number(year);
  const weekNum = Number(week_number);

  if (!Number.isFinite(yearNum) || !Number.isFinite(weekNum) || weekNum < 1 || weekNum > 53) {
    return res.status(400).json({ message: 'Año o semana inválidos.' });
  }

  const existing = db.prepare("SELECT id FROM payroll_attendance_weeks WHERE year = ? AND week_number = ? AND deleted_at IS NULL AND status != 'cancelada'").get(yearNum, weekNum);
  if (existing) {
    return res.status(409).json({ message: 'Ya existe una nómina activa para esta semana/año.', existing_id: existing.id });
  }

  const { weekStartDate, weekEndDate, label } = calculateWeekRange(yearNum, weekNum);
  const audit = createdByFields(req);

  const result = db.prepare(`
    INSERT INTO payroll_attendance_weeks (year, week_number, week_start_date, week_end_date, title, status, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at)
    VALUES (?, ?, ?, ?, ?, 'borrador', ?, ?, ?, ?, ?, ?)
  `).run(yearNum, weekNum, weekStartDate, weekEndDate, label, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_by_user_id, audit.created_by_name, audit.created_at);

  const weekId = result.lastInsertRowid;

  const activeEmployees = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY employee_number').all();
  const defaults = generateDefaultAttendance();

  const insertEmp = db.prepare(`
    INSERT INTO payroll_attendance_employees (payroll_attendance_week_id, employee_id, employee_number_snapshot, full_name_snapshot, position_snapshot, department_snapshot, monday_status, tuesday_status, wednesday_status, thursday_status, friday_status, saturday_status, sunday_status, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const emp of activeEmployees) {
    insertEmp.run(weekId, emp.id, emp.employee_number, emp.full_name, emp.position || null, emp.department || null, defaults.monday_status, defaults.tuesday_status, defaults.wednesday_status, defaults.thursday_status, defaults.friday_status, defaults.saturday_status, defaults.sunday_status, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_by_user_id, audit.created_by_name, audit.created_at);
  }

  logAuditEvent(db, { req, action: 'create', module: 'attendance', entityType: 'payroll_week', entityId: weekId, entityLabel: label });

  const created = getPayrollWeekOrFail(weekId);
  res.status(201).json(mapPayrollWeek(created));
});

// GET /api/attendance/weeks/:id - Get payroll week details
app.get('/api/attendance/weeks/:id', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));
  res.json(mapPayrollWeek(week));
});

// PUT /api/attendance/weeks/:id - Update payroll week employees
app.put('/api/attendance/weeks/:id', requireAuth, requirePermission('attendance', 'edit'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  if (week.status === 'cerrada') {
    return res.status(403).json({ message: 'La nómina está cerrada. Debe reabrirse antes de editar.' });
  }
  if (week.status === 'cancelada') {
    return res.status(403).json({ message: 'No se puede editar una nómina cancelada.' });
  }

  const { employees } = req.body;
  if (!Array.isArray(employees)) {
    return res.status(400).json({ message: 'Se requiere un arreglo de empleados.' });
  }

  const audit = updatedByFields(req);

  const updateEmp = db.prepare(`
    UPDATE payroll_attendance_employees SET
      monday_status = ?, tuesday_status = ?, wednesday_status = ?,
      thursday_status = ?, friday_status = ?, saturday_status = ?, sunday_status = ?,
      project_location_text = ?, extra_payment_amount = ?, extra_payment_currency = ?, notes = ?,
      updated_by_user_id = ?, updated_by_name = ?, updated_at = ?
    WHERE id = ? AND payroll_attendance_week_id = ?
  `);

  for (const emp of employees) {
    if (!emp.id) continue;

    const days = [emp.monday_status, emp.tuesday_status, emp.wednesday_status, emp.thursday_status, emp.friday_status, emp.saturday_status, emp.sunday_status];
    for (const d of days) {
      if (d && !validateStatusCode(d)) {
        return res.status(400).json({ message: `Código de incidencia inválido: ${d}` });
      }
    }

    if (employeeHasOutsideWork(emp) && !emp.project_location_text) {
      return res.status(400).json({ message: `Proyecto/Ubicación es obligatorio cuando se usa A* (empleado ID ${emp.id}).` });
    }

    const extraAmount = emp.extra_payment_amount != null ? Number(emp.extra_payment_amount) : null;
    if (extraAmount !== null && (!Number.isFinite(extraAmount) || extraAmount < 0)) {
      return res.status(400).json({ message: 'Pago extra debe ser un número >= 0.' });
    }

    updateEmp.run(
      emp.monday_status || 'A', emp.tuesday_status || 'A', emp.wednesday_status || 'A',
      emp.thursday_status || 'A', emp.friday_status || 'A', emp.saturday_status || 'D', emp.sunday_status || 'D',
      emp.project_location_text || null, extraAmount, emp.extra_payment_currency || 'MXN', emp.notes || null,
      audit.updated_by_user_id, audit.updated_by_name, audit.updated_at,
      emp.id, week.id,
    );
  }

  db.prepare('UPDATE payroll_attendance_weeks SET updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?').run(audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, week.id);

  logAuditEvent(db, { req, action: 'update', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  const updated = getPayrollWeekOrFail(week.id);
  res.json(mapPayrollWeek(updated));
});

// POST /api/attendance/weeks/:id/close - Close payroll week
app.post('/api/attendance/weeks/:id/close', requireAuth, requirePermission('attendance', 'approve'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  if (week.status === 'cerrada') {
    return res.status(400).json({ message: 'La nómina ya está cerrada.' });
  }
  if (week.status === 'cancelada') {
    return res.status(400).json({ message: 'No se puede cerrar una nómina cancelada.' });
  }

  const now = nowUtc();
  db.prepare('UPDATE payroll_attendance_weeks SET status = ?, closed_by_user_id = ?, closed_by_name = ?, closed_at = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
    .run('cerrada', req.session.userId, req.session.username, now, req.session.userId, req.session.username, now, week.id);

  logAuditEvent(db, { req, action: 'close', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  const updated = getPayrollWeekOrFail(week.id);
  res.json(mapPayrollWeek(updated));
});

// POST /api/attendance/weeks/:id/reopen - Reopen payroll week (admin only)
app.post('/api/attendance/weeks/:id/reopen', requireAuth, requirePermission('attendance', 'reopen'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  if (week.status !== 'cerrada') {
    return res.status(400).json({ message: 'Solo se puede reabrir una nómina cerrada.' });
  }

  const now = nowUtc();
  db.prepare('UPDATE payroll_attendance_weeks SET status = ?, closed_by_user_id = NULL, closed_by_name = NULL, closed_at = NULL, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
    .run('borrador', req.session.userId, req.session.username, now, week.id);

  logAuditEvent(db, { req, action: 'reopen', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  const updated = getPayrollWeekOrFail(week.id);
  res.json(mapPayrollWeek(updated));
});

// DELETE /api/attendance/weeks/:id - Cancel payroll week (logical delete)
app.delete('/api/attendance/weeks/:id', requireAuth, requirePermission('attendance', 'delete'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));
  const { reason } = req.body || {};

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ message: 'El motivo de cancelación es obligatorio.' });
  }

  if (week.status === 'cancelada') {
    return res.status(400).json({ message: 'La nómina ya está cancelada.' });
  }

  const now = nowUtc();
  db.prepare('UPDATE payroll_attendance_weeks SET status = ?, deleted_at = ?, deleted_by_user_id = ?, deleted_by_name = ?, delete_reason = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
    .run('cancelada', now, req.session.userId, req.session.username, reason.trim(), req.session.userId, req.session.username, now, week.id);

  logAuditEvent(db, { req, action: 'cancel', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title, metadata: { reason: reason.trim() } });

  res.json({ message: 'Nómina cancelada correctamente.' });
});

// GET /api/attendance/weeks/:id/print - Get print data
app.get('/api/attendance/weeks/:id/print', requireAuth, requirePermission('attendance', 'print'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  logAuditEvent(db, { req, action: 'print', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  res.json(mapPayrollWeek(week));
});

// ===================== END ATTENDANCE MODULE =====================

// ===================== ECOVIS MODULE =====================

const VALID_ECOVIS_DIRECTIONS = ['ecovis_debe_a_revram', 'revram_debe_a_ecovis', 'neutral'];

function getEcovisProjectOrFail(projectId) {
  const project = db.prepare('SELECT * FROM ecovis_projects WHERE id = ?').get(projectId);
  if (!project) {
    const error = new Error('Proyecto ECOVIS no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return project;
}

function getEcovisPaymentOrFail(paymentId) {
  const payment = db.prepare('SELECT * FROM ecovis_payments WHERE id = ?').get(paymentId);
  if (!payment) {
    const error = new Error('Pago ECOVIS no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return payment;
}

function findActiveEcovisPoByNormalized(normalized, excludeId = null) {
  if (!normalized) return null;
  let sql = 'SELECT id, purchase_order_number FROM ecovis_purchase_orders WHERE purchase_order_number_normalized = ? AND is_cancelled = 0';
  const params = [normalized];
  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  return db.prepare(sql).get(...params);
}

function ecovisProjectHasProyectoAllocations(projectId) {
  const row = db.prepare(
    "SELECT COUNT(*) as c FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = 'proyecto' AND is_cancelled = 0",
  ).get(projectId);
  return row.c > 0;
}

function ecovisPoHasAllocations(poId) {
  const row = db.prepare(
    "SELECT COUNT(*) as c FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = 'orden_compra' AND is_cancelled = 0",
  ).get(poId);
  return row.c > 0;
}

function ecovisPaymentHasAllocations(paymentId) {
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0',
  ).get(paymentId);
  return row.c > 0;
}

function ecovisCriticalAmountChanged(existing, amountField, newAmount, newCurrency) {
  const prevAmount = Number(existing[amountField] ?? existing.total_amount ?? existing.amount ?? 0);
  const prevCurrency = existing.currency || 'MXN';
  return amountsDiffer(prevAmount, newAmount) || prevCurrency !== newCurrency;
}

function assertEcovisCriticalAmountEditable(entityType, entityId, existing, newAmount, newCurrency, amountField = 'total_amount') {
  if (!ecovisCriticalAmountChanged(existing, amountField, newAmount, newCurrency)) {
    return;
  }
  let locked = false;
  if (entityType === 'project') {
    locked = ecovisProjectHasProyectoAllocations(entityId);
  } else if (entityType === 'purchase_order') {
    locked = ecovisPoHasAllocations(entityId);
  } else if (entityType === 'payment') {
    locked = ecovisPaymentHasAllocations(entityId);
  }
  if (locked) {
    const error = new Error(
      'No se puede modificar monto o moneda directamente porque existen pagos o asignaciones relacionados. Use ajuste controlado.',
    );
    error.statusCode = 400;
    error.code = 'CRITICAL_AMOUNT_LOCKED';
    throw error;
  }
}

function mapEcovisPaymentResponse(payment) {
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0 ORDER BY created_at DESC',
  ).all(payment.id);
  const allocated_amount = roundMoneyEcovis(allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0));
  const unallocatedInfo = calculateEcovisPaymentUnallocatedAmount(payment, allocations);
  return {
    ...payment,
    allocations,
    allocated_amount,
    unallocated_amount: payment.unallocated_amount,
    unallocated_amount_mxn: unallocatedInfo.unallocated_amount_mxn,
    critical_amount_locked: ecovisPaymentHasAllocations(payment.id),
  };
}

function buildEcovisAssignableProjectLabel(project, balance) {
  const pendingMxn = balance.pending_amount_mxn;
  const name = project.project_name || 'Proyecto';
  const currency = project.currency || 'MXN';
  const pendingLabel = `$${pendingMxn.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === 'MXN') {
    return `${name} — Pendiente ${pendingLabel} MXN`;
  }
  const original = Number(project.total_amount || 0);
  const originalLabel = original.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${name} — Pendiente ${pendingLabel} MXN (${originalLabel} ${currency} original)`;
}

function listEcovisAssignableProjects() {
  const projects = db.prepare(
    "SELECT * FROM ecovis_projects WHERE is_cancelled = 0 AND status NOT IN ('cancelado', 'pagado') ORDER BY project_name, id",
  ).all();
  const allAllocations = db.prepare(
    "SELECT * FROM ecovis_payment_allocations WHERE is_cancelled = 0 AND allocation_type = 'proyecto'",
  ).all();
  const allocationsByProject = new Map();
  for (const allocation of allAllocations) {
    if (!allocation.ecovis_project_id) continue;
    const list = allocationsByProject.get(allocation.ecovis_project_id) || [];
    list.push(allocation);
    allocationsByProject.set(allocation.ecovis_project_id, list);
  }

  const byId = new Map();
  for (const project of projects) {
    if (byId.has(project.id)) {
      console.warn(`[ECOVIS] Proyecto duplicado omitido en lista asignable: id=${project.id}`);
      continue;
    }
    const projectAllocations = allocationsByProject.get(project.id) || [];
    const balance = calculateEcovisProjectBalance(project, projectAllocations);
    if (balance.is_fully_paid || balance.pending_amount_mxn <= 0.01) {
      continue;
    }
    byId.set(project.id, {
      id: project.id,
      project_name: project.project_name,
      currency: project.currency || 'MXN',
      total_amount: Number(project.total_amount || 0),
      total_amount_mxn: balance.total_amount_mxn,
      paid_amount_mxn: balance.paid_amount_mxn,
      pending_amount_mxn: balance.pending_amount_mxn,
      status: balance.status,
      is_fully_paid: balance.is_fully_paid,
      label: buildEcovisAssignableProjectLabel(project, balance),
    });
  }
  return Array.from(byId.values());
}

function recalculateProjectStatus(projectId) {
  const project = db.prepare('SELECT * FROM ecovis_projects WHERE id = ?').get(projectId);
  if (!project) return;
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND is_cancelled = 0',
  ).all(projectId);
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  const fullyPaidAt = result.is_fully_paid ? (project.fully_paid_at || nowUtc()) : null;
  db.prepare('UPDATE ecovis_projects SET status = ?, paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(result.status, result.paid_amount_mxn, result.pending_amount_mxn, fullyPaidAt, projectId);
}

function recalculatePaymentUnallocated(paymentId) {
  const payment = db.prepare('SELECT * FROM ecovis_payments WHERE id = ?').get(paymentId);
  if (!payment) return;
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0',
  ).all(paymentId);
  const unallocated = calculatePaymentUnallocated(payment, allocations);
  db.prepare('UPDATE ecovis_payments SET unallocated_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(unallocated, paymentId);
}

function recalculatePurchaseOrderStatus(poId) {
  const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(poId);
  if (!po) return;
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = \'orden_compra\' AND is_cancelled = 0',
  ).all(poId);
  const totalMxn = Number(po.amount_mxn || po.total_amount || 0);
  const paidMxn = roundMoneyEcovis(allocations.reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0));
  const pendingMxn = roundMoneyEcovis(Math.max(0, totalMxn - paidMxn));
  let status = 'pendiente';
  if (po.is_cancelled) {
    status = 'cancelada';
  } else if (paidMxn >= totalMxn - 0.01 && paidMxn > 0) {
    status = 'pagada';
  } else if (paidMxn > 0) {
    status = 'parcialmente_pagada';
  }
  const fullyPaidAt = status === 'pagada' ? (po.fully_paid_at || nowUtc()) : null;
  db.prepare('UPDATE ecovis_purchase_orders SET status = ?, paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, paidMxn, pendingMxn, fullyPaidAt, poId);
}

app.get('/api/ecovis/summary', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const projects = db.prepare('SELECT * FROM ecovis_projects').all();
  const payments = db.prepare('SELECT * FROM ecovis_payments').all();
  const allocations = db.prepare('SELECT * FROM ecovis_payment_allocations').all();
  const movements = db.prepare('SELECT * FROM ecovis_movements').all();
  const summary = calculateEcovisAccountSummary(projects, payments, allocations, movements);
  res.json(summary);
});

app.get('/api/ecovis/projects/assignable', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const data = listEcovisAssignableProjects();
  res.json({ data });
});

app.get('/api/ecovis/projects', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const paidSql = `(SELECT COALESCE(SUM(a.amount), 0) FROM ecovis_payment_allocations a WHERE a.ecovis_project_id = ep.id AND a.is_cancelled = 0)`;
  const paidMxnSql = `(SELECT COALESCE(SUM(a.amount_mxn), 0) FROM ecovis_payment_allocations a WHERE a.ecovis_project_id = ep.id AND a.allocation_type = 'proyecto' AND a.is_cancelled = 0)`;
  const pendingMxnSql = `(COALESCE(ep.amount_mxn, ep.total_amount) - ${paidMxnSql})`;

  const excludePaid = req.query.exclude_paid === '1' || req.query.exclude_paid === 'true';
  const forAllocation = req.query.for_allocation === '1' || req.query.for_allocation === 'true';

  const sorting = normalizeSort(req.query, {
    id: 'ep.id',
    project_date: 'ep.project_date',
    project_name: 'ep.project_name',
    client_name: 'ep.client_name',
    quote_number: 'ep.quote_number',
    purchase_order_number: 'ep.purchase_order_number',
    invoice_number: 'ep.invoice_number',
    total_amount: 'ep.total_amount',
    amount_mxn: 'ep.amount_mxn',
    paid_amount: paidSql,
    paid_amount_mxn: paidMxnSql,
    pending_amount: `(ep.total_amount - ${paidSql})`,
    pending_amount_mxn: pendingMxnSql,
    status: 'ep.status',
  }, 'ep.project_date DESC, ep.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'ep.id' },
      project_date: { type: 'date', column: 'ep.project_date' },
      project_name: { type: 'text', column: 'ep.project_name' },
      client_name: { type: 'text', column: 'ep.client_name' },
      quote_number: { type: 'text', column: 'ep.quote_number' },
      purchase_order_number: { type: 'text', column: 'ep.purchase_order_number' },
      invoice_number: { type: 'text', column: 'ep.invoice_number' },
      total_amount: { type: 'currency', column: 'ep.total_amount' },
      paid_amount: { type: 'currency', column: paidSql },
      pending_amount: { type: 'currency', column: `(ep.total_amount - ${paidSql})` },
      status: { type: 'select', column: 'ep.status', options: VALID_ECOVIS_STATUSES },
    },
    search: {
      value: search,
      columns: [
        'CAST(ep.id AS TEXT)',
        'ep.project_name',
        'ep.client_name',
        'ep.quote_number',
        'ep.purchase_order_number',
        'ep.invoice_number',
        'ep.description',
        'ep.status',
        'ep.currency',
        'CAST(ep.project_date AS TEXT)',
        'CAST(ep.total_amount AS TEXT)',
        'CAST(ep.amount_mxn AS TEXT)',
      ],
    },
  });

  let extraWhere = '';
  if (excludePaid) {
    extraWhere = " AND ep.status != 'pagado' AND ep.is_cancelled = 0";
  }
  if (forAllocation) {
    extraWhere += " AND ep.status NOT IN ('pagado', 'cancelado') AND ep.is_cancelled = 0";
    extraWhere += ` AND (${pendingMxnSql}) > 0.01`;
  }

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_projects ep WHERE ${whereClause}${extraWhere}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const projects = db.prepare(
    `SELECT ep.* FROM ecovis_projects ep WHERE ${whereClause}${extraWhere} ORDER BY ${sorting.orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = projects.map((project) => {
    const allocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND is_cancelled = 0',
    ).all(project.id);
    const paid_amount = roundMoneyEcovis(allocations.filter((a) => a.allocation_type === 'proyecto').reduce((sum, a) => sum + Number(a.amount || 0), 0));
    const paid_amount_mxn = roundMoneyEcovis(allocations.filter((a) => a.allocation_type === 'proyecto').reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0));
    const amount_mxn = Number(project.amount_mxn || project.total_amount || 0);
    const pending_amount = Math.max(0, Number(project.total_amount) - paid_amount);
    const pending_amount_mxn = roundMoneyEcovis(Math.max(0, amount_mxn - paid_amount_mxn));
    const critical_amount_locked = ecovisProjectHasProyectoAllocations(project.id);
    return {
      ...project,
      paid_amount,
      pending_amount,
      amount_mxn,
      paid_amount_mxn,
      pending_amount_mxn,
      critical_amount_locked,
    };
  });

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.post('/api/ecovis/projects', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const projectName = requiredText(req.body, 'project_name', 'Nombre del proyecto');
    const projectDate = requiredText(req.body, 'project_date', 'Fecha del proyecto');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const quoteNumber = optionalText(req.body, 'quote_number');
    const purchaseOrderNumber = optionalText(req.body, 'purchase_order_number');
    const invoiceNumber = optionalText(req.body, 'invoice_number');
    const description = optionalText(req.body, 'description');
    const notes = optionalText(req.body, 'notes');

    const ecovisPurchaseOrderId = req.body.ecovis_purchase_order_id || null;

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    const audit = createdByFields(req);
    const createProject = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO ecovis_projects (
          project_name, project_date, total_amount, currency, exchange_rate_to_mxn, amount_mxn, pending_amount_mxn,
          quote_number, purchase_order_number, invoice_number,
          description, notes, status, created_by, created_by_user_id, created_at, updated_at, ecovis_purchase_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?)`,
      ).run(
        projectName, projectDate, totalAmount, currency, exchangeRate, amountMxn, amountMxn,
        quoteNumber, purchaseOrderNumber, invoiceNumber,
        description, notes, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at, ecovisPurchaseOrderId,
      );

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_project_id, created_by, created_by_user_id, created_at, updated_at
        ) VALUES ('proyecto', ?, ?, ?, ?, ?, 'ecovis_debe_a_revram', ?, ?, ?, ?, ?, ?)`,
      ).run(projectDate, totalAmount, currency, exchangeRate, amountMxn, projectName, result.lastInsertRowid, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

      return result.lastInsertRowid;
    });

    const projectId = createProject();
    logAuditEvent(db, { req, action: 'create', module: 'ecovis', entityType: 'ecovis_project', entityId: projectId, entityLabel: projectName, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    res.status(201).json(getEcovisProjectOrFail(projectId));
  } catch (error) {
    next(error);
  }
});

app.put('/api/ecovis/projects/:id', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  let project;
  try {
    project = getEcovisProjectOrFail(req.params.id);
    if (project.is_cancelled) {
      throw badRequest('No se puede editar un proyecto cancelado.');
    }

    const projectName = requiredText(req.body, 'project_name', 'Nombre del proyecto');
    const projectDate = requiredText(req.body, 'project_date', 'Fecha del proyecto');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const quoteNumber = optionalText(req.body, 'quote_number');
    const purchaseOrderNumber = optionalText(req.body, 'purchase_order_number');
    const invoiceNumber = optionalText(req.body, 'invoice_number');
    const description = optionalText(req.body, 'description');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    assertEcovisCriticalAmountEditable('project', Number(req.params.id), project, totalAmount, currency);

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE ecovis_projects SET
        project_name = ?, project_date = ?, total_amount = ?, currency = ?,
        exchange_rate_to_mxn = ?, amount_mxn = ?,
        quote_number = ?, purchase_order_number = ?, invoice_number = ?,
        description = ?, notes = ?, updated_at = ?, updated_by = ?, updated_by_user_id = ?
      WHERE id = ?`,
    ).run(
      projectName, projectDate, totalAmount, currency,
      exchangeRate, amountMxn,
      quoteNumber, purchaseOrderNumber, invoiceNumber,
      description, notes, audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, req.params.id,
    );

    recalculateProjectStatus(req.params.id);
    logAuditEvent(db, { req, action: 'update', module: 'ecovis', entityType: 'ecovis_project', entityId: Number(req.params.id), entityLabel: projectName, before: project, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    res.json(getEcovisProjectOrFail(req.params.id));
  } catch (error) {
    if (error.code === 'CRITICAL_AMOUNT_LOCKED') {
      logAuditEvent(db, {
        req,
        action: 'critical_amount_edit_blocked',
        module: 'ecovis',
        entityType: 'ecovis_project',
        entityId: Number(req.params.id),
        entityLabel: project?.project_name || String(req.params.id),
        metadata: { attempted_amount: req.body.total_amount, attempted_currency: req.body.currency },
      });
    }
    next(error);
  }
});

app.post('/api/ecovis/projects/:id/cancel', requireAuth, requirePermission('ecovisAccount', 'cancel'), (req, res, next) => {
  try {
    const project = getEcovisProjectOrFail(req.params.id);
    if (project.is_cancelled) {
      throw badRequest('El proyecto ya esta cancelado.');
    }
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');

    const audit = updatedByFields(req);
    const cancelProject = db.transaction(() => {
      db.prepare(
        `UPDATE ecovis_projects SET
          is_cancelled = 1, cancelled_at = ?,
          cancelled_by = ?, cancellation_reason = ?,
          status = 'cancelado', updated_at = ?, updated_by = ?, updated_by_user_id = ?
        WHERE id = ?`,
      ).run(audit.updated_at, req.session.username, reason, audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, req.params.id);

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, direction,
          description, related_project_id, created_by, created_by_user_id, created_at, updated_at
        ) VALUES ('cancelacion', ${sqlCurrentDate()}, ?, ?, 'ecovis_debe_a_revram', ?, ?, ?, ?, ?, ?)`,
      ).run(project.total_amount, project.currency, reason, req.params.id, req.session.username, audit.updated_by_user_id, audit.updated_at, audit.updated_at);

      const affectedPayments = db.prepare(
        'SELECT DISTINCT payment_id FROM ecovis_payment_allocations WHERE ecovis_project_id = ?',
      ).all(req.params.id);
      for (const row of affectedPayments) {
        recalculatePaymentUnallocated(row.payment_id);
      }
    });

    cancelProject();
    logAuditEvent(db, { req, action: 'cancel', module: 'ecovis', entityType: 'ecovis_project', entityId: Number(req.params.id), entityLabel: project.project_name, metadata: { reason } });
    res.json(getEcovisProjectOrFail(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecovis/payments', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const allocatedSql = '(ep.amount - ep.unallocated_amount)';
  const statusSql = "(CASE WHEN ep.is_cancelled = 1 THEN 'cancelado' WHEN ep.unallocated_amount > 0 THEN 'parcial' ELSE 'asignado' END)";
  const forAllocation = req.query.for_allocation === '1' || req.query.for_allocation === 'true';
  const sorting = normalizeSort(req.query, {
    id: 'ep.id',
    payment_date: 'ep.payment_date',
    amount: 'ep.amount',
    currency: 'ep.currency',
    payment_method: 'ep.payment_method',
    bank_reference: 'ep.bank_reference',
    allocated_amount: allocatedSql,
    unallocated_amount: 'ep.unallocated_amount',
    status: statusSql,
  }, 'ep.payment_date DESC, ep.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'ep.id' },
      payment_date: { type: 'date', column: 'ep.payment_date' },
      amount: { type: 'currency', column: 'ep.amount' },
      currency: { type: 'select', column: 'ep.currency', options: VALID_CURRENCIES },
      payment_method: { type: 'text', column: 'ep.payment_method' },
      bank_reference: { type: 'text', column: 'ep.bank_reference' },
      source_description: { type: 'text', column: 'ep.source_description' },
      allocated_amount: { type: 'currency', column: allocatedSql },
      unallocated_amount: { type: 'currency', column: 'ep.unallocated_amount' },
      status: { type: 'select', column: statusSql, options: VALID_PAYMENT_STATUSES },
    },
    search: {
      value: search,
      columns: [
        'CAST(ep.id AS TEXT)',
        'ep.bank_reference',
        'ep.source_description',
        'ep.payment_method',
        'ep.notes',
        'ep.currency',
        'CAST(ep.payment_date AS TEXT)',
        'CAST(ep.amount AS TEXT)',
        'CAST(ep.amount_mxn AS TEXT)',
        'CAST(ep.unallocated_amount AS TEXT)',
        statusSql,
      ],
    },
  });

  let paymentsExtraWhere = '';
  if (forAllocation) {
    paymentsExtraWhere = ' AND ep.is_cancelled = 0 AND ep.unallocated_amount > 0.005';
  }

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_payments ep WHERE ${whereClause}${paymentsExtraWhere}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const payments = db.prepare(
    `SELECT ep.* FROM ecovis_payments ep WHERE ${whereClause}${paymentsExtraWhere} ORDER BY ${sorting.orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = payments.map((payment) => {
    const mapped = mapEcovisPaymentResponse(payment);
    return {
      ...mapped,
      allocated_amount: mapped.allocated_amount,
      unallocated_amount: payment.unallocated_amount,
    };
  });

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.get('/api/ecovis/payments/:id', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res, next) => {
  try {
    const payment = getEcovisPaymentOrFail(req.params.id);
    res.json(mapEcovisPaymentResponse(payment));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/payments', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const paymentMethod = optionalText(req.body, 'payment_method');
    const bankReference = optionalText(req.body, 'bank_reference');
    const sourceDescription = optionalText(req.body, 'source_description');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(amount * exchangeRate);

    const audit = createdByFields(req);
    const createPayment = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO ecovis_payments (
          payment_date, amount, currency, exchange_rate_to_mxn, amount_mxn, payment_method,
          bank_reference, source_description, notes,
          unallocated_amount, created_by, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(paymentDate, amount, currency, exchangeRate, amountMxn, paymentMethod, bankReference, sourceDescription, notes, amount, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_payment_id, created_by, created_by_user_id, created_at, updated_at
        ) VALUES ('pago_recibido', ?, ?, ?, ?, ?, 'neutral', ?, ?, ?, ?, ?, ?)`,
      ).run(paymentDate, amount, currency, exchangeRate, amountMxn, sourceDescription || 'Pago recibido', result.lastInsertRowid, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

      return result.lastInsertRowid;
    });

    const paymentId = createPayment();
    logAuditEvent(db, { req, action: 'create', module: 'ecovis', entityType: 'ecovis_payment', entityId: paymentId, entityLabel: `Pago ${amount} ${currency}`, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    res.status(201).json(mapEcovisPaymentResponse(getEcovisPaymentOrFail(paymentId)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/ecovis/payments/:id', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  let payment;
  try {
    payment = getEcovisPaymentOrFail(req.params.id);
    if (payment.is_cancelled) {
      throw badRequest('No se puede editar un pago cancelado.');
    }

    const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const paymentMethod = optionalText(req.body, 'payment_method');
    const bankReference = optionalText(req.body, 'bank_reference');
    const sourceDescription = optionalText(req.body, 'source_description');
    const notes = optionalText(req.body, 'notes');

    assertEcovisCriticalAmountEditable('payment', Number(req.params.id), payment, amount, currency, 'amount');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(amount * exchangeRate);

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE ecovis_payments SET
        payment_date = ?, amount = ?, currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ?,
        payment_method = ?, bank_reference = ?, source_description = ?, notes = ?,
        updated_at = ?, updated_by = ?, updated_by_user_id = ?
      WHERE id = ?`,
    ).run(
      paymentDate, amount, currency, exchangeRate, amountMxn,
      paymentMethod, bankReference, sourceDescription, notes,
      audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, req.params.id,
    );

    recalculatePaymentUnallocated(Number(req.params.id));
    logAuditEvent(db, {
      req,
      action: 'update',
      module: 'ecovis',
      entityType: 'ecovis_payment',
      entityId: Number(req.params.id),
      entityLabel: `Pago ${amount} ${currency}`,
      before: payment,
      metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn },
    });
    res.json(mapEcovisPaymentResponse(getEcovisPaymentOrFail(req.params.id)));
  } catch (error) {
    if (error.code === 'CRITICAL_AMOUNT_LOCKED') {
      logAuditEvent(db, {
        req,
        action: 'critical_amount_edit_blocked',
        module: 'ecovis',
        entityType: 'ecovis_payment',
        entityId: Number(req.params.id),
        entityLabel: `Pago #${req.params.id}`,
        metadata: { attempted_amount: req.body.amount, attempted_currency: req.body.currency },
      });
    }
    next(error);
  }
});

app.post('/api/ecovis/payments/:id/allocations', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const payment = getEcovisPaymentOrFail(req.params.id);
    if (payment.is_cancelled) {
      throw badRequest('No se pueden crear asignaciones en un pago cancelado.');
    }

    const allocationType = requiredText(req.body, 'allocation_type', 'Tipo de asignacion');
    if (!['proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste'].includes(allocationType)) {
      throw badRequest('Tipo de asignacion no valido.');
    }

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const notes = optionalText(req.body, 'notes');

    const existingAllocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0',
    ).all(payment.id);
    const totalAllocated = existingAllocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const available = Math.round((Number(payment.amount) - totalAllocated + Number.EPSILON) * 100) / 100;

    if (amount > available + 0.005) {
      throw badRequest(`Monto excede el disponible del pago (${available}).`);
    }

    let ecovisProjectId = null;
    let ecovisPurchaseOrderId = null;
    if (allocationType === 'proyecto') {
      if (!req.body.ecovis_project_id) {
        throw badRequest('El proyecto es obligatorio para asignaciones de tipo proyecto.');
      }
      ecovisProjectId = req.body.ecovis_project_id;
      const targetProject = getEcovisProjectOrFail(ecovisProjectId);
      if (targetProject.is_cancelled || targetProject.status === 'cancelado') {
        logAuditEvent(db, {
          req,
          action: 'allocation_rejected_no_balance',
          module: 'ecovis',
          entityType: 'ecovis_project',
          entityId: Number(ecovisProjectId),
          entityLabel: targetProject.project_name,
          metadata: { reason: 'proyecto_cancelado' },
        });
        throw badRequest('No se puede asignar a un proyecto cancelado.');
      }
      const projectAllocations = db.prepare(
        "SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = 'proyecto' AND is_cancelled = 0",
      ).all(ecovisProjectId);
      const projectBalance = calculateEcovisProjectBalance(targetProject, projectAllocations);
      if (projectBalance.is_fully_paid || projectBalance.pending_amount_mxn <= 0.01) {
        logAuditEvent(db, {
          req,
          action: 'allocation_rejected_no_balance',
          module: 'ecovis',
          entityType: 'ecovis_project',
          entityId: Number(ecovisProjectId),
          entityLabel: targetProject.project_name,
          metadata: { pending_amount_mxn: projectBalance.pending_amount_mxn, status: projectBalance.status },
        });
        throw badRequest('El proyecto no tiene saldo pendiente para asignar pagos.');
      }
    } else if (allocationType === 'orden_compra') {
      if (!req.body.ecovis_purchase_order_id) {
        throw badRequest('La orden de compra es obligatoria para asignaciones de tipo orden_compra.');
      }
      ecovisPurchaseOrderId = req.body.ecovis_purchase_order_id;
      const targetPo = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(ecovisPurchaseOrderId);
      if (!targetPo) throw badRequest('Orden de compra no encontrada.');
      if (targetPo.is_cancelled || targetPo.status === 'cancelada') {
        throw badRequest('No se puede asignar a una OC cancelada.');
      }
      if (targetPo.status === 'pagada') {
        throw badRequest('No se puede asignar a una OC saldada.');
      }
    }

    const allocationCurrency = payment.currency || 'MXN';
    const allocationRate = Number(payment.exchange_rate_to_mxn || 1);
    const allocationAmountMxn = roundMoneyEcovis(amount * allocationRate);

    if (allocationType === 'proyecto' && ecovisProjectId) {
      const targetProject = getEcovisProjectOrFail(ecovisProjectId);
      const projectAllocations = db.prepare(
        "SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = 'proyecto' AND is_cancelled = 0",
      ).all(ecovisProjectId);
      const projectBalance = calculateEcovisProjectBalance(targetProject, projectAllocations);
      if (allocationAmountMxn > projectBalance.pending_amount_mxn + 0.005) {
        logAuditEvent(db, {
          req,
          action: 'allocation_rejected_insufficient_balance',
          module: 'ecovis',
          entityType: 'ecovis_project',
          entityId: Number(ecovisProjectId),
          entityLabel: targetProject.project_name,
          metadata: {
            attempted_amount_mxn: allocationAmountMxn,
            pending_amount_mxn: projectBalance.pending_amount_mxn,
          },
        });
        throw badRequest(`Monto excede saldo pendiente del proyecto (${projectBalance.pending_amount_mxn} MXN).`);
      }
    }

    let movementType;
    let direction;
    if (allocationType === 'proyecto') {
      movementType = 'aplicacion_a_proyecto';
      direction = 'ecovis_debe_a_revram';
    } else if (allocationType === 'orden_compra') {
      movementType = 'aplicacion_a_proyecto';
      direction = 'ecovis_debe_a_revram';
    } else if (allocationType === 'saldo_a_favor') {
      movementType = 'saldo_a_favor';
      direction = 'neutral';
    } else if (allocationType === 'prestamo') {
      movementType = 'prestamo_ecovis_a_revram';
      direction = 'revram_debe_a_ecovis';
    } else {
      movementType = 'ajuste';
      direction = 'neutral';
    }

    const createAllocation = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO ecovis_payment_allocations (
          payment_id, ecovis_project_id, ecovis_purchase_order_id, allocation_type, amount, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(payment.id, ecovisProjectId, ecovisPurchaseOrderId, allocationType, amount, allocationCurrency, allocationRate, allocationAmountMxn, notes, req.session.username);

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_payment_id, related_project_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        movementType, payment.payment_date, amount, allocationCurrency, allocationRate, allocationAmountMxn, direction,
        notes || allocationType, payment.id, ecovisProjectId, req.session.username,
      );

      recalculatePaymentUnallocated(payment.id);

      if (allocationType === 'proyecto' && ecovisProjectId) {
        recalculateProjectStatus(ecovisProjectId);
      }
      if (allocationType === 'orden_compra' && ecovisPurchaseOrderId) {
        recalculatePurchaseOrderStatus(ecovisPurchaseOrderId);
      }

      return result.lastInsertRowid;
    });

    const allocationId = createAllocation();
    const allocation = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE id = ?').get(allocationId);
    const updatedPayment = mapEcovisPaymentResponse(getEcovisPaymentOrFail(payment.id));

    logAuditEvent(db, {
      req,
      action: 'create',
      module: 'ecovis',
      entityType: 'ecovis_payment_allocation',
      entityId: allocationId,
      entityLabel: `${allocationType} ${amount} ${allocationCurrency}`,
      metadata: { ecovis_project_id: ecovisProjectId, ecovis_purchase_order_id: ecovisPurchaseOrderId, amount_mxn: allocationAmountMxn },
    });

    res.status(201).json({ allocation, payment: updatedPayment });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecovis/loans', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const repaidSql = `(SELECT COALESCE(SUM(r.amount), 0) FROM ecovis_movements r WHERE r.movement_type = 'devolucion' AND r.reference = CAST(em.id AS TEXT))`;
  const outstandingSql = `(em.amount - ${repaidSql})`;
  const statusSql = `(CASE WHEN ${outstandingSql} <= 0 THEN 'pagado' ELSE 'vigente' END)`;
  const sorting = normalizeSort(req.query, {
    id: 'em.id',
    movement_date: 'em.movement_date',
    amount: 'em.amount',
    currency: 'em.currency',
    reference: 'em.reference',
    description: 'em.description',
    outstanding: outstandingSql,
    status: statusSql,
  }, 'em.movement_date DESC, em.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'em.id' },
      movement_date: { type: 'date', column: 'em.movement_date' },
      amount: { type: 'currency', column: 'em.amount' },
      currency: { type: 'select', column: 'em.currency', options: VALID_CURRENCIES },
      reference: { type: 'text', column: 'em.reference' },
      description: { type: 'text', column: 'em.description' },
      outstanding: { type: 'currency', column: outstandingSql },
      status: { type: 'select', column: statusSql, options: VALID_LOAN_STATUSES },
    },
    baseWhere: ["em.movement_type = 'prestamo_ecovis_a_revram'"],
    search: {
      value: search,
      columns: [
        'CAST(em.id AS TEXT)',
        'em.description',
        'em.reference',
        'em.notes',
        'em.currency',
        'em.movement_type',
        'CAST(em.movement_date AS TEXT)',
        'CAST(em.amount AS TEXT)',
        'em.created_by',
        statusSql,
      ],
    },
  });

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_movements em WHERE ${whereClause}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const loans = db.prepare(
    `SELECT em.* FROM ecovis_movements em WHERE ${whereClause} ORDER BY ${sorting.orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = loans.map((loan) => {
    const repayments = db.prepare(
      "SELECT * FROM ecovis_movements WHERE movement_type = 'devolucion' AND reference = ? ORDER BY movement_date DESC",
    ).all(String(loan.id));
    const total_repaid = repayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    return {
      ...loan,
      total_repaid: Math.round((total_repaid + Number.EPSILON) * 100) / 100,
      outstanding: Math.round((Number(loan.amount) - total_repaid + Number.EPSILON) * 100) / 100,
      repayments,
    };
  });

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.post('/api/ecovis/loans', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const reference = optionalText(req.body, 'reference');
    const description = optionalText(req.body, 'description') || 'Prestamo ECOVIS a RevRam';
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(amount * exchangeRate);

    const result = db.prepare(
      `INSERT INTO ecovis_movements (
        movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
        description, reference, notes, created_by
      ) VALUES ('prestamo_ecovis_a_revram', ?, ?, ?, ?, ?, 'revram_debe_a_ecovis', ?, ?, ?, ?)`,
    ).run(movementDate, amount, currency, exchangeRate, amountMxn, description, reference, notes, req.session.username);

    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/loans/:id/repayment', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const loan = db.prepare(
      "SELECT * FROM ecovis_movements WHERE id = ? AND movement_type = 'prestamo_ecovis_a_revram'",
    ).get(req.params.id);
    if (!loan) {
      const error = new Error('Prestamo no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const reference = optionalText(req.body, 'reference');
    const notes = optionalText(req.body, 'notes');

    const loanCurrency = loan.currency || 'MXN';
    const loanRate = Number(loan.exchange_rate_to_mxn || 1);
    const repaymentAmountMxn = roundMoneyEcovis(amount * loanRate);

    const result = db.prepare(
      `INSERT INTO ecovis_movements (
        movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
        description, reference, notes, created_by
      ) VALUES ('devolucion', ?, ?, ?, ?, ?, 'neutral', ?, ?, ?, ?)`,
    ).run(movementDate, amount, loanCurrency, loanRate, repaymentAmountMxn, `Devolucion de prestamo #${loan.id}`, String(loan.id), notes, req.session.username);

    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecovis/movements', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const movementType = typeof req.query.movement_type === 'string'
    ? req.query.movement_type.trim()
    : (typeof req.query.type === 'string' ? req.query.type.trim() : '');
  const validTypes = ['proyecto', 'pago_recibido', 'prestamo_ecovis_a_revram', 'aplicacion_a_proyecto', 'saldo_a_favor', 'devolucion', 'ajuste', 'cancelacion'];
  const sorting = normalizeSort(req.query, {
    id: 'em.id',
    movement_date: 'em.movement_date',
    movement_type: 'em.movement_type',
    description: 'em.description',
    amount: 'em.amount',
    currency: 'em.currency',
    direction: 'em.direction',
    reference: 'em.reference',
    related_project_name: 'ep.project_name',
    created_by: 'em.created_by',
  }, 'em.movement_date DESC, em.id DESC');
  const query = { ...req.query };
  if (movementType && validTypes.includes(movementType)) {
    query.movement_type = movementType;
  }
  const { whereClause, params, filters } = buildWhere({
    query,
    filters: {
      id: { type: 'number', column: 'em.id' },
      movement_date: { type: 'date', column: 'em.movement_date' },
      movement_type: { type: 'select', column: 'em.movement_type', options: validTypes },
      description: { type: 'text', column: 'em.description' },
      amount: { type: 'currency', column: 'em.amount' },
      currency: { type: 'select', column: 'em.currency', options: VALID_CURRENCIES },
      direction: { type: 'select', column: 'em.direction', options: VALID_ECOVIS_DIRECTIONS },
      reference: { type: 'text', column: 'em.reference' },
      related_project_name: { type: 'text', column: 'ep.project_name' },
      created_by: { type: 'text', column: 'em.created_by' },
    },
    search: {
      value: search,
      columns: [
        'CAST(em.id AS TEXT)',
        'em.description',
        'em.reference',
        'em.notes',
        'em.currency',
        'em.movement_type',
        'em.direction',
        'CAST(em.movement_date AS TEXT)',
        'CAST(em.amount AS TEXT)',
        'em.created_by',
        'ep.project_name',
        'ep.client_name',
        'ep.quote_number',
      ],
    },
  });

  const totalRecords = db.prepare(
    `SELECT COUNT(*) as count FROM ecovis_movements em LEFT JOIN ecovis_projects ep ON ep.id = em.related_project_id WHERE ${whereClause}`,
  ).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const movements = db.prepare(
    `SELECT em.*, ep.project_name as related_project_name
     FROM ecovis_movements em
     LEFT JOIN ecovis_projects ep ON ep.id = em.related_project_id
     WHERE ${whereClause}
     ORDER BY ${sorting.orderBy}
     LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  res.json(buildListResponse(movements, pag, sorting, filters));
});

app.post('/api/ecovis/adjustments', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const direction = requiredText(req.body, 'direction', 'Direccion');
    if (!VALID_ECOVIS_DIRECTIONS.includes(direction)) {
      throw badRequest('Direccion no valida.');
    }
    const description = requiredText(req.body, 'description', 'Motivo / Descripcion');
    const reference = optionalText(req.body, 'reference');
    const notes = optionalText(req.body, 'notes');

    const result = db.prepare(
      `INSERT INTO ecovis_movements (
        movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
        description, reference, notes, created_by
      ) VALUES ('ajuste', ?, ?, 'MXN', 1, ?, ?, ?, ?, ?, ?)`,
    ).run(movementDate, amount, amount, direction, description, reference, notes, req.session.username);

    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/apply-credit', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const ecovisProjectId = req.body.ecovis_project_id;
    if (!ecovisProjectId) {
      throw badRequest('El proyecto es obligatorio.');
    }
    const project = getEcovisProjectOrFail(ecovisProjectId);
    if (project.is_cancelled) {
      throw badRequest('No se puede aplicar credito a un proyecto cancelado.');
    }

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const notes = optionalText(req.body, 'notes');

    const projects = db.prepare('SELECT * FROM ecovis_projects').all();
    const payments = db.prepare('SELECT * FROM ecovis_payments').all();
    const allocations = db.prepare('SELECT * FROM ecovis_payment_allocations').all();
    const movements = db.prepare('SELECT * FROM ecovis_movements').all();
    const summary = calculateEcovisAccountSummary(projects, payments, allocations, movements);

    if (amount > summary.credit_balance + 0.005) {
      throw badRequest(`Saldo a favor insuficiente (disponible: ${summary.credit_balance}).`);
    }

    const applyCredit = db.transaction(() => {
      const creditCurrency = project.currency || 'MXN';
      const creditRate = Number(project.exchange_rate_to_mxn || 1);
      const creditAmountMxn = roundMoneyEcovis(amount * creditRate);

      const result = db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_project_id, notes, created_by
        ) VALUES ('saldo_a_favor', ?, ?, ?, ?, ?, 'ecovis_debe_a_revram', ?, ?, ?, ?)`,
      ).run(movementDate, amount, creditCurrency, creditRate, creditAmountMxn, `Aplicacion de saldo a favor a ${project.project_name}`, ecovisProjectId, notes, req.session.username);

      recalculateProjectStatus(ecovisProjectId);
      return result.lastInsertRowid;
    });

    const movementId = applyCredit();
    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(movementId);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

// ===================== ECOVIS HISTORY =====================

app.get('/api/ecovis/projects/history/years', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const years = db.prepare(
    `${distinctYearSelect('fully_paid_at')}
     FROM ecovis_projects
     WHERE status = 'pagado' AND fully_paid_at IS NOT NULL AND is_cancelled = 0
     ORDER BY year DESC`,
  ).all().map((r) => r.year).filter((y) => y > 0);
  res.json(years);
});

app.get('/api/ecovis/projects/history', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const year = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;

  if (!year) {
    return res.json({
      data: [],
      summary: { total_projects_mxn: 0, total_paid_mxn: 0, total_pending_mxn: 0, project_count: 0 },
      pagination: buildPaginationMeta(1, limit, 0),
    });
  }

  let dateFilter = yearFilter('ep.fully_paid_at');
  const dateParams = [String(year)];
  if (month && month >= 1 && month <= 12) {
    dateFilter += monthFilter('ep.fully_paid_at');
    dateParams.push(month);
  }

  const baseWhere = `ep.status = 'pagado' AND ep.fully_paid_at IS NOT NULL AND ep.is_cancelled = 0 ${dateFilter}`;

  let searchWhere = '';
  const searchParams = [];
  if (search) {
    searchWhere = " AND (ep.project_name LIKE ? OR ep.quote_number LIKE ? OR ep.purchase_order_number LIKE ? OR ep.invoice_number LIKE ?)";
    const term = `%${search}%`;
    searchParams.push(term, term, term, term);
  }

  const allParams = [...dateParams, ...searchParams];

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_projects ep WHERE ${baseWhere}${searchWhere}`).get(...allParams).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const projects = db.prepare(
    `SELECT ep.* FROM ecovis_projects ep WHERE ${baseWhere}${searchWhere} ORDER BY ep.fully_paid_at DESC, ep.id DESC LIMIT ? OFFSET ?`,
  ).all(...allParams, pag.limit, pag.offset);

  const data = projects.map((project) => {
    const allocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = \'proyecto\' AND is_cancelled = 0',
    ).all(project.id);
    const paid_amount_mxn = roundMoneyEcovis(allocations.reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0));
    const amount_mxn = Number(project.amount_mxn || project.total_amount || 0);
    const pending_amount_mxn = roundMoneyEcovis(Math.max(0, amount_mxn - paid_amount_mxn));
    return { ...project, amount_mxn, paid_amount_mxn, pending_amount_mxn };
  });

  const summaryRow = db.prepare(
    `SELECT
      COALESCE(SUM(ep.amount_mxn), 0) as total_projects_mxn,
      COALESCE(SUM(ep.paid_amount_mxn), 0) as total_paid_mxn,
      COALESCE(SUM(CASE WHEN ep.pending_amount_mxn > 0 THEN ep.pending_amount_mxn ELSE 0 END), 0) as total_pending_mxn,
      COUNT(*) as project_count
    FROM ecovis_projects ep WHERE ${baseWhere}${searchWhere}`,
  ).get(...allParams);

  res.json({
    data,
    summary: {
      total_projects_mxn: roundMoneyEcovis(summaryRow.total_projects_mxn),
      total_paid_mxn: roundMoneyEcovis(summaryRow.total_paid_mxn),
      total_pending_mxn: roundMoneyEcovis(summaryRow.total_pending_mxn),
      project_count: summaryRow.project_count,
    },
    pagination: pag,
  });
});

// ===================== ECOVIS PURCHASE ORDERS =====================

app.get('/api/ecovis/purchase-orders', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const excludeSettled = req.query.exclude_settled === '1' || req.query.exclude_settled === 'true';
  const forAllocation = req.query.for_allocation === '1' || req.query.for_allocation === 'true';
  const sorting = normalizeSort(req.query, {
    id: 'po.id',
    purchase_order_number: 'po.purchase_order_number',
    order_date: 'po.order_date',
    total_amount: 'po.total_amount',
    status: 'po.status',
  }, 'po.order_date DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      status: { type: 'select', column: 'po.status', options: ['pendiente', 'parcialmente_pagada', 'pagada', 'cancelada'] },
      purchase_order_number: { type: 'text', column: 'po.purchase_order_number' },
    },
    search: {
      value: search,
      columns: [
        'CAST(po.id AS TEXT)',
        'po.purchase_order_number',
        'po.project_name',
        'po.notes',
        'po.status',
        'po.currency',
        'CAST(po.total_amount AS TEXT)',
        'CAST(po.paid_amount AS TEXT)',
      ],
    },
  });

  let poExtraWhere = whereClause === '1=1' ? '' : '';
  const poParams = [...params];
  let poWhere = whereClause;
  if (excludeSettled || forAllocation) {
    poWhere = `(${whereClause}) AND po.is_cancelled = 0 AND po.status NOT IN ('pagada', 'cancelada')`;
    if (forAllocation) {
      poWhere += ' AND COALESCE(po.pending_amount_mxn, po.amount_mxn, po.total_amount) > 0.01';
    }
  }

  const allAllocations = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE is_cancelled = 0').all();
  const result = paginateSqlList({
    tableSql: 'SELECT po.* FROM ecovis_purchase_orders po',
    countSql: 'SELECT COUNT(*) as count FROM ecovis_purchase_orders po',
    whereClause: poWhere,
    params: poParams,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (po) => {
      const balance = calculatePurchaseOrderBalance(po, allAllocations);
      return {
        ...po,
        ...balance,
        critical_amount_locked: ecovisPoHasAllocations(po.id),
        created_at_cdmx: formatDateTimeCDMX(po.created_at),
        updated_at_cdmx: formatDateTimeCDMX(po.updated_at),
      };
    },
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/ecovis/purchase-orders/:id', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    const allAllocations = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE is_cancelled = 0').all();
    const balance = calculatePurchaseOrderBalance(po, allAllocations);
    const poAllocations = db.prepare(
      `SELECT a.*, p.payment_date, p.bank_reference, p.amount as payment_amount
       FROM ecovis_payment_allocations a
       JOIN ecovis_payments p ON a.payment_id = p.id
       WHERE a.ecovis_purchase_order_id = ? AND a.is_cancelled = 0
       ORDER BY a.created_at DESC`,
    ).all(po.id);
    const relatedProjects = db.prepare('SELECT * FROM ecovis_projects WHERE ecovis_purchase_order_id = ? AND is_cancelled = 0').all(po.id);
    res.json({ ...po, ...balance, allocations: poAllocations, related_projects: relatedProjects, created_at_cdmx: formatDateTimeCDMX(po.created_at) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/purchase-orders', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const purchaseOrderNumber = requiredText(req.body, 'purchase_order_number', 'Numero de orden de compra');
    const poNormalized = normalizePurchaseOrderNumber(purchaseOrderNumber);
    const orderDate = requiredText(req.body, 'order_date', 'Fecha de orden');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const projectName = optionalText(req.body, 'project_name');
    const notes = optionalText(req.body, 'notes');
    const audit = createdByFields(req);

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    const existing = findActiveEcovisPoByNormalized(poNormalized);
    if (existing) {
      logAuditEvent(db, {
        req,
        action: 'duplicate_po_blocked',
        module: 'ecovis',
        entityType: 'ecovis_purchase_order',
        entityId: existing.id,
        entityLabel: purchaseOrderNumber,
        metadata: { normalized: poNormalized, existing_id: existing.id },
      });
      throw badRequest('Ya existe una orden de compra activa con este numero.');
    }

    const result = db.prepare(
      `INSERT INTO ecovis_purchase_orders (purchase_order_number, purchase_order_number_normalized, project_name, order_date, total_amount, currency, exchange_rate_to_mxn, amount_mxn, pending_amount_mxn, notes, created_by, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(purchaseOrderNumber, poNormalized, projectName, orderDate, totalAmount, currency, exchangeRate, amountMxn, amountMxn, notes, req.session.username, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'ecovis', entityType: 'ecovis_purchase_order', entityId: result.lastInsertRowid, entityLabel: purchaseOrderNumber, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(po);
  } catch (error) {
    next(error);
  }
});

app.put('/api/ecovis/purchase-orders/:id', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  let po;
  try {
    po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    if (po.is_cancelled) throw badRequest('No se puede editar una OC cancelada.');

    const purchaseOrderNumber = requiredText(req.body, 'purchase_order_number', 'Numero de orden de compra');
    const poNormalized = normalizePurchaseOrderNumber(purchaseOrderNumber);
    const orderDate = requiredText(req.body, 'order_date', 'Fecha de orden');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const projectName = optionalText(req.body, 'project_name');
    const notes = optionalText(req.body, 'notes');
    const audit = updatedByFields(req);

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    assertEcovisCriticalAmountEditable('purchase_order', Number(req.params.id), po, totalAmount, currency);

    const dup = findActiveEcovisPoByNormalized(poNormalized, Number(req.params.id));
    if (dup) {
      logAuditEvent(db, {
        req,
        action: 'duplicate_po_blocked',
        module: 'ecovis',
        entityType: 'ecovis_purchase_order',
        entityId: dup.id,
        entityLabel: purchaseOrderNumber,
        metadata: { normalized: poNormalized, attempted_po_id: Number(req.params.id) },
      });
      throw badRequest('Ya existe una orden de compra activa con este numero.');
    }

    db.prepare(
      `UPDATE ecovis_purchase_orders SET purchase_order_number = ?, purchase_order_number_normalized = ?, project_name = ?, order_date = ?, total_amount = ?, currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ?, notes = ?, updated_by = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?`,
    ).run(purchaseOrderNumber, poNormalized, projectName, orderDate, totalAmount, currency, exchangeRate, amountMxn, notes, req.session.username, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);

    recalculatePurchaseOrderStatus(Number(req.params.id));
    logAuditEvent(db, { req, action: 'update', module: 'ecovis', entityType: 'ecovis_purchase_order', entityId: Number(req.params.id), entityLabel: purchaseOrderNumber, before: po });
    res.json(db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id));
  } catch (error) {
    if (error.code === 'CRITICAL_AMOUNT_LOCKED') {
      logAuditEvent(db, {
        req,
        action: 'critical_amount_edit_blocked',
        module: 'ecovis',
        entityType: 'ecovis_purchase_order',
        entityId: Number(req.params.id),
        entityLabel: po?.purchase_order_number || String(req.params.id),
        metadata: { attempted_amount: req.body.total_amount, attempted_currency: req.body.currency },
      });
    }
    next(error);
  }
});

app.post('/api/ecovis/purchase-orders/:id/cancel', requireAuth, requirePermission('ecovisAccount', 'cancel'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    if (po.is_cancelled) throw badRequest('La OC ya esta cancelada.');
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
    const audit = updatedByFields(req);

    db.prepare(
      `UPDATE ecovis_purchase_orders SET is_cancelled = 1, status = 'cancelada', cancelled_at = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?`,
    ).run(audit.updated_at, req.session.username, reason, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);

    logAuditEvent(db, { req, action: 'cancel', module: 'ecovis', entityType: 'ecovis_purchase_order', entityId: Number(req.params.id), entityLabel: po.purchase_order_number, metadata: { reason } });
    res.json(db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/purchase-orders/:id/allocate', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    if (po.is_cancelled) throw badRequest('No se puede asignar a una OC cancelada.');

    const paymentId = req.body.payment_id;
    if (!paymentId) throw badRequest('payment_id es obligatorio.');
    const payment = db.prepare('SELECT * FROM ecovis_payments WHERE id = ?').get(paymentId);
    if (!payment) throw badRequest('Pago no encontrado.');
    if (payment.is_cancelled) throw badRequest('No se puede asignar a un pago cancelado.');

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const notes = optionalText(req.body, 'notes');
    const audit = createdByFields(req);

    const existingAllocs = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0').all(paymentId);
    const totalAllocated = existingAllocs.reduce((s, a) => s + Number(a.amount), 0);
    const available = Number(payment.amount) - totalAllocated;
    if (amount > available + 0.01) throw badRequest(`Monto excede el disponible del pago ($${available.toFixed(2)}).`);

    const allocationCurrency = payment.currency || 'MXN';
    const allocationRate = Number(payment.exchange_rate_to_mxn || 1);
    const allocationAmountMxn = roundMoneyEcovis(amount * allocationRate);

    const result = db.prepare(
      `INSERT INTO ecovis_payment_allocations (payment_id, ecovis_purchase_order_id, allocation_type, amount, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, 'orden_compra', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(paymentId, po.id, amount, allocationCurrency, allocationRate, allocationAmountMxn, notes, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

    recalculatePaymentUnallocated(paymentId);
    recalculatePurchaseOrderStatus(po.id);

    logAuditEvent(db, { req, action: 'allocate_to_po', module: 'ecovis', entityType: 'ecovis_payment_allocation', entityId: result.lastInsertRowid, entityLabel: `${po.purchase_order_number} $${amount}` });
    res.status(201).json(db.prepare('SELECT * FROM ecovis_payment_allocations WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/amount-adjustments', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const entityType = requiredText(req.body, 'entity_type', 'Tipo de entidad');
    const entityId = Number(req.body.entity_id);
    if (!entityId) throw badRequest('entity_id es obligatorio.');
    const newAmount = numberValue(req.body, 'new_amount_original', 'Nuevo monto', { min: 0 });
    const newCurrency = currencyValue(req.body, 'new_currency', 'Moneda');
    const reason = requiredText(req.body, 'reason', 'Motivo del ajuste');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const newRate = newCurrency === 'MXN' ? 1 : (rates[newCurrency] || 1);
    const newAmountMxn = roundMoneyEcovis(newAmount * newRate);
    const audit = updatedByFields(req);

    const applyAdjustment = db.transaction(() => {
      let previous;
      if (entityType === 'project') {
        previous = getEcovisProjectOrFail(entityId);
        if (previous.is_cancelled) throw badRequest('No se puede ajustar un proyecto cancelado.');
        const paidMxn = Number(previous.paid_amount_mxn || 0);
        if (newAmountMxn + 0.01 < paidMxn) {
          throw badRequest(`El nuevo monto MXN (${newAmountMxn}) no puede ser menor al ya pagado (${paidMxn}).`);
        }
        db.prepare(
          `UPDATE ecovis_projects SET total_amount = ?, currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ?, updated_at = ?, updated_by = ?, updated_by_user_id = ? WHERE id = ?`,
        ).run(newAmount, newCurrency, newRate, newAmountMxn, audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, entityId);
        recalculateProjectStatus(entityId);
      } else if (entityType === 'purchaseOrder') {
        previous = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(entityId);
        if (!previous) throw badRequest('Orden de compra no encontrada.');
        if (previous.is_cancelled) throw badRequest('No se puede ajustar una OC cancelada.');
        const paidMxn = Number(previous.paid_amount_mxn || 0);
        if (newAmountMxn + 0.01 < paidMxn) {
          throw badRequest(`El nuevo monto MXN (${newAmountMxn}) no puede ser menor al ya aplicado (${paidMxn}).`);
        }
        db.prepare(
          `UPDATE ecovis_purchase_orders SET total_amount = ?, currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ?, updated_at = ?, updated_by = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?`,
        ).run(newAmount, newCurrency, newRate, newAmountMxn, audit.updated_at, req.session.username, audit.updated_by_user_id, audit.updated_by_name, entityId);
        recalculatePurchaseOrderStatus(entityId);
      } else if (entityType === 'payment') {
        previous = getEcovisPaymentOrFail(entityId);
        if (previous.is_cancelled) throw badRequest('No se puede ajustar un pago cancelado.');
        const allocations = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0').all(entityId);
        const allocated = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
        if (newAmount + 0.005 < allocated) {
          throw badRequest(`El nuevo monto (${newAmount}) no puede ser menor al ya asignado (${allocated}).`);
        }
        db.prepare(
          `UPDATE ecovis_payments SET amount = ?, currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ?, updated_at = ?, updated_by = ?, updated_by_user_id = ? WHERE id = ?`,
        ).run(newAmount, newCurrency, newRate, newAmountMxn, audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, entityId);
        recalculatePaymentUnallocated(entityId);
      } else {
        throw badRequest('Tipo de entidad no soportado para ajuste.');
      }

      const prevAmount = Number(previous.total_amount ?? previous.amount ?? 0);
      const prevCurrency = previous.currency || 'MXN';
      const prevRate = Number(previous.exchange_rate_to_mxn || 1);
      const prevAmountMxn = roundMoneyEcovis(Number(previous.amount_mxn ?? prevAmount * prevRate));
      const differenceMxn = roundMoneyEcovis(newAmountMxn - prevAmountMxn);

      const adjResult = db.prepare(
        `INSERT INTO ecovis_amount_adjustments (
          entity_type, entity_id,
          previous_amount_original, previous_currency, previous_exchange_rate_to_mxn, previous_amount_mxn,
          new_amount_original, new_currency, new_exchange_rate_to_mxn, new_amount_mxn,
          difference_mxn, reason, notes, approved_by_user_id, approved_by_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        entityType, entityId,
        prevAmount, prevCurrency, prevRate, prevAmountMxn,
        newAmount, newCurrency, newRate, newAmountMxn,
        differenceMxn, reason, notes, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at,
      );

      return { adjustmentId: adjResult.lastInsertRowid, previous, differenceMxn };
    });

    const { adjustmentId, previous, differenceMxn } = applyAdjustment();
    logAuditEvent(db, {
      req,
      action: 'amount_adjustment_applied',
      module: 'ecovis',
      entityType: `ecovis_${entityType}`,
      entityId,
      entityLabel: reason,
      before: previous,
      metadata: {
        adjustment_id: adjustmentId,
        new_amount_original: newAmount,
        new_currency: newCurrency,
        new_amount_mxn: newAmountMxn,
        difference_mxn: differenceMxn,
        reason,
      },
    });

    const adjustment = db.prepare('SELECT * FROM ecovis_amount_adjustments WHERE id = ?').get(adjustmentId);
    res.status(201).json({ adjustment, created_at_cdmx: formatDateTimeCDMX(adjustment.created_at) });
  } catch (error) {
    next(error);
  }
});

// ===================== END ECOVIS MODULE =====================

// ===================== SERVICE QUOTER MODULE =====================

// GET /api/service-quoter/config - Load configuration and service types
app.get('/api/service-quoter/config', requireAuth, requirePermission('serviceQuoter', 'view'), (req, res) => {
  const settings = db.prepare("SELECT key, value, label, category FROM service_quote_settings WHERE category != 'importacion' ORDER BY key").all();
  const serviceTypes = db.prepare('SELECT id, name, margin, active, sort_order FROM service_types WHERE active = 1 ORDER BY sort_order, id').all();
  res.json({ settings, serviceTypes });
});

// GET /api/service-quoter/service-types - List all service types (including inactive, for configure)
app.get('/api/service-quoter/service-types', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const serviceTypes = db.prepare(
    'SELECT id, name, margin, active, sort_order, created_by_name, created_at, updated_by_name, updated_at FROM service_types ORDER BY sort_order, id',
  ).all();
  res.json(serviceTypes.map((st) => ({
    ...st,
    created_at_cdmx: formatDateTimeCDMX(st.created_at),
    updated_at_cdmx: formatDateTimeCDMX(st.updated_at),
  })));
});

// POST /api/service-quoter/service-types - Create a new service type (requires admin password)
app.post('/api/service-quoter/service-types', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const { name, margin, sort_order, adminPassword } = req.body;
  if (!adminPassword) {
    return res.status(400).json({ message: 'Se requiere contraseña de administrador.' });
  }
  const adminUser = db.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
    logAuditEvent(db, { req, action: 'config_change_denied', module: 'serviceQuoter', entityType: 'service_type', entityLabel: 'Intento fallido: contraseña incorrecta' });
    return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
  }

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Nombre del tipo de servicio es obligatorio.' });
  }
  const marginNum = Number(margin);
  if (Number.isNaN(marginNum) || marginNum < 0 || marginNum >= 1) {
    return res.status(400).json({ message: 'Margen debe ser un valor entre 0 y menor a 1 (ej: 0.60 para 60%).' });
  }
  const sortNum = Number(sort_order) || 0;
  const audit = createdByFields(req);

  const result = db.prepare(
    `INSERT INTO service_types (name, margin, sort_order, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(String(name).trim(), marginNum, sortNum, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_by_user_id, audit.created_by_name, audit.created_at);

  logAuditEvent(db, {
    req, action: 'create', module: 'serviceQuoter', entityType: 'service_type',
    entityId: result.lastInsertRowid, entityLabel: String(name).trim(),
    after: { name: String(name).trim(), margin: marginNum, sort_order: sortNum },
  });

  const created = db.prepare('SELECT * FROM service_types WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...created, created_at_cdmx: formatDateTimeCDMX(created.created_at), updated_at_cdmx: formatDateTimeCDMX(created.updated_at) });
});

// PUT /api/service-quoter/service-types/:id - Update a service type (requires admin password)
app.put('/api/service-quoter/service-types/:id', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;
  if (!adminPassword) {
    return res.status(400).json({ message: 'Se requiere contraseña de administrador.' });
  }
  const adminUser = db.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
    logAuditEvent(db, { req, action: 'config_change_denied', module: 'serviceQuoter', entityType: 'service_type', entityId: Number(id), entityLabel: 'Intento fallido: contraseña incorrecta' });
    return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
  }

  const existing = db.prepare('SELECT * FROM service_types WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ message: 'Tipo de servicio no encontrado.' });
  }

  const { name, margin, active, sort_order } = req.body;
  const newName = name !== undefined ? String(name).trim() : existing.name;
  if (!newName) {
    return res.status(400).json({ message: 'Nombre del tipo de servicio es obligatorio.' });
  }

  let newMargin = existing.margin;
  if (margin !== undefined) {
    newMargin = Number(margin);
    if (Number.isNaN(newMargin) || newMargin < 0 || newMargin >= 1) {
      return res.status(400).json({ message: 'Margen debe ser un valor entre 0 y menor a 1 (ej: 0.60 para 60%).' });
    }
  }

  const newActive = active !== undefined ? (active ? 1 : 0) : existing.active;
  const newSort = sort_order !== undefined ? Number(sort_order) : existing.sort_order;
  const audit = updatedByFields(req);

  db.prepare(
    `UPDATE service_types SET name = ?, margin = ?, active = ?, sort_order = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?`,
  ).run(newName, newMargin, newActive, newSort, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, id);

  const action = active === false || active === 0 ? 'deactivate' : 'update';
  logAuditEvent(db, {
    req, action, module: 'serviceQuoter', entityType: 'service_type',
    entityId: Number(id), entityLabel: newName,
    before: { name: existing.name, margin: existing.margin, active: existing.active, sort_order: existing.sort_order },
    after: { name: newName, margin: newMargin, active: newActive, sort_order: newSort },
  });

  const updated = db.prepare('SELECT * FROM service_types WHERE id = ?').get(id);
  res.json({ ...updated, created_at_cdmx: formatDateTimeCDMX(updated.created_at), updated_at_cdmx: formatDateTimeCDMX(updated.updated_at) });
});

// GET /api/service-quoter/settings - Get all settings (for configure panel)
app.get('/api/service-quoter/settings', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const settings = db.prepare("SELECT key, value, label, category, updated_by_name, updated_at FROM service_quote_settings WHERE category != 'importacion' ORDER BY category, key").all();
  res.json(settings.map((s) => ({ ...s, updated_at_cdmx: formatDateTimeCDMX(s.updated_at) })));
});

// PUT /api/service-quoter/settings - Update settings (requires admin password)
app.put('/api/service-quoter/settings', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const { settings, adminPassword } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ message: 'Se requiere un objeto settings con las claves a actualizar.' });
  }
  if (!adminPassword) {
    return res.status(400).json({ message: 'Se requiere contraseña de administrador.' });
  }
  const adminUser = db.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
    logAuditEvent(db, { req, action: 'config_change_denied', module: 'serviceQuoter', entityType: 'service_quote_settings', entityLabel: 'Intento fallido: contraseña incorrecta' });
    return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
  }

  const audit = updatedByFields(req);
  const beforeSettings = {};
  const afterSettings = {};
  const existingRows = db.prepare("SELECT key, value FROM service_quote_settings WHERE category != 'importacion'").all();
  const existingMap = Object.fromEntries(existingRows.map((r) => [r.key, r.value]));

  const updateStmt = db.prepare(
    'UPDATE service_quote_settings SET value = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE key = ?',
  );

  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      if (existingMap[key] === undefined) continue;
      if (String(value) === existingMap[key]) continue;
      beforeSettings[key] = existingMap[key];
      afterSettings[key] = String(value);
      updateStmt.run(String(value), audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, key);
    }
  });

  updateAll();

  if (Object.keys(afterSettings).length > 0) {
    logAuditEvent(db, {
      req, action: 'update', module: 'serviceQuoter', entityType: 'service_quote_settings',
      entityLabel: 'Configuración del cotizador',
      before: beforeSettings,
      after: afterSettings,
    });
  }

  const updatedSettings = db.prepare("SELECT key, value, label, category, updated_by_name, updated_at FROM service_quote_settings WHERE category != 'importacion' ORDER BY category, key").all();
  res.json(updatedSettings.map((s) => ({ ...s, updated_at_cdmx: formatDateTimeCDMX(s.updated_at) })));
});

// ===================== END SERVICE QUOTER MODULE =====================

// ===================== EMISSIONS CALCULATOR MODULE =====================

app.get('/api/emissions/fuels', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  res.json(Object.values(FUEL_LIBRARY));
});

app.post('/api/emissions/calculate', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const result = calculateEmissions(req.body || {});
  if (!result.ok) {
    return res.status(400).json({ ok: false, errors: result.errors });
  }
  res.json(result);
});

// ===================== END EMISSIONS CALCULATOR MODULE =====================

// ===================== BACKUP MODULE =====================

const {
  BACKUP_SCHEMA_VERSION,
  BACKUP_ENTITIES,
  EXCLUDED_ENTITIES,
  getIncludedEntities,
  buildCoverageManifest,
} = require('./backupRegistry');
const { generateBackup, generateDiagnostic, decompressBackup, BACKUP_TYPES } = require("./backupOptimizer");

app.get('/api/admin/backup', requireAuth, requirePermission('backups', 'backup'), (req, res) => {
  const entities = getIncludedEntities();
  const data = {};
  const recordCounts = {};
  const entityChecksums = {};
  const includedEntities = [];
  const warnings = [];

  for (const entity of entities) {
    try {
      const rows = db.prepare(entity.query).all();
      data[entity.key] = rows;
      recordCounts[entity.key] = rows.length;
      entityChecksums[entity.key] = String(rows.length);
      includedEntities.push(entity.key);
    } catch (err) {
      data[entity.key] = [];
      recordCounts[entity.key] = 0;
      warnings.push(`No se pudo respaldar ${entity.key}: ${err.message}`);
    }
  }

  for (const entity of entities) {
    if (recordCounts[entity.key] === undefined) {
      warnings.push(`Entidad ${entity.key} incluida sin recordCount.`);
    }
  }

  const backup = {
    backupMetadata: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appName: 'REVRAM Dashboard',
      exportedAt: new Date().toISOString(),
      exportedBy: req.session.username || 'admin',
      environment: process.env.NODE_ENV || 'development',
      recordCounts,
      entityChecksums,
      includedEntities,
      excludedEntities: EXCLUDED_ENTITIES.map((e) => e.key),
      warnings,
    },
    coverageManifest: buildCoverageManifest(includedEntities, warnings),
    data,
  };

  logAuditEvent(db, { req, action: 'backup_create', module: 'backup', entityType: 'backup', entityLabel: `Respaldo ${backup.backupMetadata.exportedAt}`, metadata: { recordCounts, warnings } });

  if (warnings.length > 0) {
    return res.status(207).json(backup);
  }

  res.json(backup);
});


// ===================== OPTIMIZED BACKUP ENDPOINTS =====================

app.get('/api/admin/backup/diagnostic', requireAuth, requirePermission('backups', 'view'), (req, res, next) => {
  try {
    const diagnostic = generateDiagnostic(db);
    res.json(diagnostic);
  } catch (error) { next(error); }
});

app.get('/api/admin/backup/optimized', requireAuth, requirePermission('backups', 'backup'), (req, res, next) => {
  try {
    const backupType = req.query.type || 'complete';
    if (!BACKUP_TYPES[backupType]) {
      return res.status(400).json({ message: 'Tipo de respaldo invalido. Opciones: complete, light, critical_only' });
    }
    const auditLogPolicy = req.query.auditLogPolicy || (backupType === 'light' ? 'last90Days' : 'full');
    const activityPolicy = req.query.activityPolicy || 'none';
    const compress = req.query.compress === 'true' || req.query.compress === '1';

    const result = generateBackup(db, {
      backupType,
      auditLogPolicy,
      activityPolicy,
      compress,
      username: req.session.username || 'admin',
    });

    logAuditEvent(db, { req, action: 'backup_create', module: 'backup', entityType: 'backup', entityLabel: `Respaldo ${backupType}`, metadata: { backupType, auditLogPolicy, activityPolicy, compress, recordCounts: result.backup.backupMetadata.recordCounts } });

    if (compress && result.compressed) {
      const filename = `REVRAM_backup_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16)}${result.extension}`;
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', result.compressed.length);
      return res.send(result.compressed);
    }

    const warnings = result.backup.backupMetadata.warnings || [];
    if (warnings.length > 0) return res.status(207).json(result.backup);
    res.json(result.backup);
  } catch (error) { next(error); }
});

app.post("/api/admin/backup/preview-compressed", requireAuth, requirePermission("backups", "import"), express.raw({ type: "application/gzip", limit: "100mb" }), (req, res, next) => {
  try {
    const backup = decompressBackup(req.body);
    if (!backup || !backup.backupMetadata || !backup.data) {
      return res.status(400).json({ message: "Archivo comprimido invalido o corrupto." });
    }
    req.body = backup;
    next();
  } catch (error) { return res.status(400).json({ message: "Error al descomprimir: " + error.message }); }
}, (req, res) => {
  const backup = req.body;
  const entities = getIncludedEntities();
  const preview = {};
  for (const entity of entities) {
    const backupRows = backup.data[entity.key] || [];
    preview[entity.key] = { inBackup: backupRows.length };
  }
  const missingCritical = [];
  const missingOptional = [];
  const { CRITICAL_ENTITIES } = require("./backupOptimizer");
  for (const key of CRITICAL_ENTITIES) {
    if (!backup.data[key] || backup.data[key].length === 0) {
      if (!entities.find(e => e.key === key)) continue;
      missingCritical.push(key);
    }
  }
  res.json({ preview, schemaVersion: backup.backupMetadata.schemaVersion, backupType: backup.backupMetadata.backupType || "complete", missingCritical, missingOptional, policiesUsed: backup.backupMetadata.policiesUsed || {} });
});

app.post('/api/admin/backup/preview', requireAuth, requirePermission('backups', 'import'), (req, res) => {
  const backup = req.body;
  if (!backup || !backup.backupMetadata || !backup.data) {
    return res.status(400).json({ message: 'Archivo de respaldo invalido. Faltan backupMetadata o data.' });
  }

  if (!backup.backupMetadata.schemaVersion) {
    return res.status(400).json({ message: 'El respaldo no contiene schemaVersion.' });
  }

  const entities = getIncludedEntities();
  const preview = {};
  const conflicts = [];

  for (const entity of entities) {
    const backupRows = backup.data[entity.key] || [];
    let existingRows = [];
    try {
      existingRows = db.prepare(entity.query).all();
    } catch (e) {
      existingRows = [];
    }

    const newRecords = [];
    const duplicates = [];
    const entityConflicts = [];

    for (const row of backupRows) {
      const match = existingRows.find((existing) => {
        if (entity.stableKeys.length === 0) return existing.id === row.id;
        return entity.stableKeys.every((k) => existing[k] != null && String(existing[k]) === String(row[k]));
      });

      if (!match) {
        if (entity.key === 'projectPayments' || entity.key === 'projectCosts') {
          const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
          if (!parentExists) {
            entityConflicts.push({ row, reason: `Proyecto padre id=${row.project_id} no encontrado` });
            continue;
          }
        }
        if (entity.key === 'vacationRequests') {
          const parentExists = db.prepare('SELECT id FROM employees WHERE id = ?').get(row.employee_id);
          if (!parentExists) {
            entityConflicts.push({ row, reason: `Empleado padre id=${row.employee_id} no encontrado` });
            continue;
          }
        }
        if (entity.key === 'projectReports' || entity.key === 'reportsArchive') {
          const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
          if (!parentExists) {
            entityConflicts.push({ row, reason: `Proyecto padre id=${row.project_id} no encontrado` });
            continue;
          }
        }
        if (entity.key === 'ecovisPaymentAllocations') {
          const paymentExists = db.prepare('SELECT id FROM ecovis_payments WHERE id = ?').get(row.payment_id);
          if (!paymentExists) {
            entityConflicts.push({ row, reason: `Pago ECOVIS padre id=${row.payment_id} no encontrado` });
            continue;
          }
        }
        newRecords.push(row);
      } else {
        const hasChanges = Object.keys(row).some((k) => {
          if (k === 'id' || k === 'created_at' || k === 'updated_at') return false;
          if (entity.stableKeys.includes(k)) return false;
          return String(row[k] ?? '') !== String(match[k] ?? '');
        });
        if (hasChanges) {
          entityConflicts.push({ row, existing: match, reason: 'Datos difieren del registro existente' });
        } else {
          duplicates.push(row);
        }
      }
    }

    preview[entity.key] = {
      inBackup: backupRows.length,
      existing: existingRows.length,
      newToAdd: newRecords.length,
      duplicatesOmitted: duplicates.length,
      conflicts: entityConflicts.length,
    };

    if (entityConflicts.length > 0) {
      conflicts.push({ entity: entity.key, items: entityConflicts.slice(0, 20) });
    }
  }

  res.json({ preview, conflicts, schemaVersion: backup.backupMetadata.schemaVersion });
});

app.post('/api/admin/backup/import', requireAuth, requirePermission('backups', 'import'), (req, res) => {
  const backup = req.body;
  if (!backup || !backup.backupMetadata || !backup.data) {
    return res.status(400).json({ message: 'Archivo de respaldo invalido.' });
  }

  const importLog = {
    importedAt: new Date().toISOString(),
    importedBy: req.session.username || 'admin',
    fileName: backup.backupMetadata.appName || 'unknown',
    schemaVersion: backup.backupMetadata.schemaVersion || '0.0.0',
    backupExportedAt: backup.backupMetadata.exportedAt || null,
    status: 'completed',
    summary: {},
    conflicts: [],
    errors: [],
  };

  const entities = getIncludedEntities();

  const importInTransaction = db.transaction(() => {
    const orderedEntities = [
      'settings', 'usersSafe', 'userPermissions', 'projects', 'closedProjects',
      'projectPayments', 'projectCosts', 'employees', 'vacationRequests',
      'payrollAttendanceWeeks', 'payrollAttendanceEmployees', 'attendanceStatuses',
      'projectReports', 'reportsArchive', 'ecovisPurchaseOrders', 'ecovisProjects', 'ecovisPayments',
      'ecovisPaymentAllocations', 'ecovisLoans', 'ecovisMovements', 'ecovisAmountAdjustments',
      'serviceTypes', 'serviceQuoteSettings',
      'loginAttempts', 'auditLogs', 'backupImportLogs',
    ];

    for (const entityKey of orderedEntities) {
      const entityDef = entities.find((e) => e.key === entityKey);
      if (!entityDef) continue;

      const backupRows = backup.data[entityKey] || [];
      let existingRows = [];
      try { existingRows = db.prepare(entityDef.query).all(); } catch (e) { existingRows = []; }

      let added = 0;
      let skipped = 0;
      const entityConflicts = [];

      for (const row of backupRows) {
        const match = existingRows.find((existing) => {
          if (entityDef.stableKeys.length === 0) return existing.id === row.id;
          return entityDef.stableKeys.every((k) => existing[k] != null && String(existing[k]) === String(row[k]));
        });

        if (match) {
          const hasChanges = Object.keys(row).some((k) => {
            if (k === 'id' || k === 'created_at' || k === 'updated_at') return false;
            if (entityDef.stableKeys.includes(k)) return false;
            return String(row[k] ?? '') !== String(match[k] ?? '');
          });
          if (hasChanges) entityConflicts.push({ backupId: row.id, existingId: match.id, reason: 'Datos difieren' });
          skipped++;
          continue;
        }

        if (entityKey === 'usersSafe' || entityKey === 'settings' || entityKey === 'auditLogs' || entityKey === 'loginAttempts' || entityKey === 'userPermissions' || entityKey === 'backupImportLogs') { skipped++; continue; }

        try {
          if (entityKey === 'projects' || entityKey === 'closedProjects') {
            const existing = db.prepare('SELECT id FROM projects WHERE quote_number = ?').get(row.quote_number);
            if (existing) { skipped++; continue; }
            const cols = ['quote_number', 'order_number', 'purchase_order_number', 'purchase_order_not_applicable', 'seller', 'client_name', 'project_description', 'expected_margin', 'total_invoiced', 'total_invoiced_currency', 'progress_percent', 'technician_name', 'promised_delivery_date', 'status', 'risk', 'observations', 'closed_at'];
            const vals = cols.map((c) => row[c] !== undefined ? row[c] : null);
            db.prepare(`INSERT INTO projects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
            added++;
          } else if (entityKey === 'projectPayments') {
            const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Proyecto padre no encontrado' }); continue; }
            db.prepare('INSERT INTO project_payments (project_id, amount, currency, payment_date, notes) VALUES (?, ?, ?, ?, ?)').run(row.project_id, row.amount, row.currency || 'MXN', row.payment_date, row.notes || null);
            added++;
          } else if (entityKey === 'projectCosts') {
            const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Proyecto padre no encontrado' }); continue; }
            db.prepare('INSERT INTO project_costs (project_id, category, description, amount, currency, cost_date) VALUES (?, ?, ?, ?, ?, ?)').run(row.project_id, row.category, row.description, row.amount, row.currency || 'MXN', row.cost_date);
            added++;
          } else if (entityKey === 'employees') {
            const existing = db.prepare('SELECT id FROM employees WHERE employee_number = ?').get(row.employee_number);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO employees (employee_number, full_name, hire_date, department, position, immediate_boss, active, termination_date, inactive_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.employee_number, row.full_name, row.hire_date, row.department || null, row.position || null, row.immediate_boss || null, row.active ?? 1, row.termination_date || null, row.inactive_reason || null);
            added++;
          } else if (entityKey === 'vacationRequests') {
            const parentExists = db.prepare('SELECT id FROM employees WHERE id = ?').get(row.employee_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Empleado padre no encontrado' }); continue; }
            db.prepare('INSERT INTO vacation_requests (employee_id, start_date, end_date, requested_days, vacation_exercise_year, status, is_first_vacation_of_exercise, include_vacation_bonus, created_by, authorized_by, hr_responsible, notes, creates_negative_balance, negative_days_generated, admin_override_reason, balance_after_request) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.employee_id, row.start_date, row.end_date, row.requested_days, row.vacation_exercise_year, row.status, row.is_first_vacation_of_exercise ?? 0, row.include_vacation_bonus ?? 1, row.created_by || null, row.authorized_by || null, row.hr_responsible || null, row.notes || null, row.creates_negative_balance ?? 0, row.negative_days_generated ?? 0, row.admin_override_reason || null, row.balance_after_request ?? null);
            added++;
          } else if (entityKey === 'payrollAttendanceWeeks') {
            const existingWeek = db.prepare("SELECT id FROM payroll_attendance_weeks WHERE year = ? AND week_number = ? AND deleted_at IS NULL AND status != 'cancelada'").get(row.year, row.week_number);
            if (existingWeek) { skipped++; continue; }
            db.prepare('INSERT INTO payroll_attendance_weeks (year, week_number, week_start_date, week_end_date, title, status, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at, closed_by_user_id, closed_by_name, closed_at, deleted_at, deleted_by_user_id, deleted_by_name, delete_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.year, row.week_number, row.week_start_date, row.week_end_date, row.title || null, row.status || 'borrador', row.created_by_user_id || null, row.created_by_name || null, row.created_at, row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at, row.closed_by_user_id || null, row.closed_by_name || null, row.closed_at || null, row.deleted_at || null, row.deleted_by_user_id || null, row.deleted_by_name || null, row.delete_reason || null);
            added++;
          } else if (entityKey === 'payrollAttendanceEmployees') {
            const parentWeek = db.prepare('SELECT id FROM payroll_attendance_weeks WHERE id = ?').get(row.payroll_attendance_week_id);
            if (!parentWeek) { entityConflicts.push({ backupId: row.id, reason: 'Nómina semanal padre no encontrada' }); continue; }
            db.prepare('INSERT INTO payroll_attendance_employees (payroll_attendance_week_id, employee_id, employee_number_snapshot, full_name_snapshot, position_snapshot, department_snapshot, monday_status, tuesday_status, wednesday_status, thursday_status, friday_status, saturday_status, sunday_status, project_location_text, extra_payment_amount, extra_payment_currency, notes, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.payroll_attendance_week_id, row.employee_id, row.employee_number_snapshot, row.full_name_snapshot, row.position_snapshot || null, row.department_snapshot || null, row.monday_status || 'A', row.tuesday_status || 'A', row.wednesday_status || 'A', row.thursday_status || 'A', row.friday_status || 'A', row.saturday_status || 'D', row.sunday_status || 'D', row.project_location_text || null, row.extra_payment_amount || null, row.extra_payment_currency || 'MXN', row.notes || null, row.created_by_user_id || null, row.created_by_name || null, row.created_at, row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at);
            added++;
          } else if (entityKey === 'attendanceStatuses') {
            skipped++;
          } else if (entityKey === 'projectReports' || entityKey === 'reportsArchive') {
            const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Proyecto padre no encontrado' }); continue; }
            const existing = db.prepare('SELECT id FROM project_reports WHERE report_folio = ?').get(row.report_folio);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO project_reports (project_id, report_folio, client_name, client_address, service_name, report_date, assigned_technicians, burner_model, equipment_model_serial, pumps_motors_model, fuel, voltage, gas_pressure_inh2o, liquid_fuel_pressure_psi, working_pressure, pump_amperage, fan_amperage, condensate_tank_temp_c, operating_output_temp_c, flue_gas_temp_c, safety_tests, comments, emissions_low_fire, emissions_high_fire, technician_name, plant_manager_name, created_by, updated_by, report_type, report_data, deleted_at, deleted_by, delete_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.project_id, row.report_folio, row.client_name, row.client_address || null, row.service_name, row.report_date, row.assigned_technicians || null, row.burner_model || null, row.equipment_model_serial || null, row.pumps_motors_model || null, row.fuel || null, row.voltage || null, row.gas_pressure_inh2o || null, row.liquid_fuel_pressure_psi || null, row.working_pressure || null, row.pump_amperage || null, row.fan_amperage || null, row.condensate_tank_temp_c || null, row.operating_output_temp_c || null, row.flue_gas_temp_c || null, row.safety_tests || null, row.comments || null, row.emissions_low_fire || null, row.emissions_high_fire || null, row.technician_name || null, row.plant_manager_name || null, row.created_by || null, row.updated_by || null, row.report_type || 'boiler_startup', row.report_data || null, row.deleted_at || null, row.deleted_by || null, row.delete_reason || null);
            added++;
          } else if (entityKey === 'ecovisPurchaseOrders') {
            const poNorm = normalizePurchaseOrderNumber(row.purchase_order_number);
            const existingPo = db.prepare(
              'SELECT id FROM ecovis_purchase_orders WHERE purchase_order_number_normalized = ? OR purchase_order_number = ?',
            ).get(poNorm, row.purchase_order_number);
            if (existingPo) { skipped++; continue; }
            db.prepare(
              'INSERT INTO ecovis_purchase_orders (purchase_order_number, purchase_order_number_normalized, project_name, client_name, order_date, total_amount, currency, exchange_rate_to_mxn, amount_mxn, paid_amount_mxn, pending_amount_mxn, status, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ).run(
              row.purchase_order_number,
              poNorm || normalizePurchaseOrderNumber(row.purchase_order_number),
              row.project_name || null,
              row.client_name || 'ECOVIS',
              row.order_date,
              row.total_amount,
              row.currency || 'MXN',
              row.exchange_rate_to_mxn ?? 1,
              row.amount_mxn ?? row.total_amount,
              row.paid_amount_mxn ?? 0,
              row.pending_amount_mxn ?? row.total_amount,
              row.status || 'pendiente',
              row.notes || null,
              row.is_cancelled ?? 0,
              row.cancelled_at || null,
              row.cancelled_by || null,
              row.cancellation_reason || null,
              row.created_by || null,
            );
            added++;
          } else if (entityKey === 'ecovisAmountAdjustments') {
            const parentType = row.entity_type;
            let parentExists = true;
            if (parentType === 'project') {
              parentExists = Boolean(db.prepare('SELECT id FROM ecovis_projects WHERE id = ?').get(row.entity_id));
            } else if (parentType === 'purchaseOrder') {
              parentExists = Boolean(db.prepare('SELECT id FROM ecovis_purchase_orders WHERE id = ?').get(row.entity_id));
            } else if (parentType === 'payment') {
              parentExists = Boolean(db.prepare('SELECT id FROM ecovis_payments WHERE id = ?').get(row.entity_id));
            }
            if (!parentExists) {
              entityConflicts.push({ backupId: row.id, reason: 'Entidad padre del ajuste no encontrada' });
              continue;
            }
            db.prepare(
              `INSERT INTO ecovis_amount_adjustments (
                entity_type, entity_id,
                previous_amount_original, previous_currency, previous_exchange_rate_to_mxn, previous_amount_mxn,
                new_amount_original, new_currency, new_exchange_rate_to_mxn, new_amount_mxn,
                difference_mxn, reason, notes, approved_by_user_id, approved_by_name, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              row.entity_type,
              row.entity_id,
              row.previous_amount_original,
              row.previous_currency || 'MXN',
              row.previous_exchange_rate_to_mxn ?? 1,
              row.previous_amount_mxn,
              row.new_amount_original,
              row.new_currency || 'MXN',
              row.new_exchange_rate_to_mxn ?? 1,
              row.new_amount_mxn,
              row.difference_mxn,
              row.reason,
              row.notes || null,
              row.approved_by_user_id || null,
              row.approved_by_name || null,
              row.created_at || nowUtc(),
            );
            added++;
          } else if (entityKey === 'ecovisProjects') {
            db.prepare('INSERT INTO ecovis_projects (project_name, client_name, quote_number, purchase_order_number, invoice_number, project_date, description, total_amount, currency, status, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.project_name, row.client_name || 'ECOVIS', row.quote_number || null, row.purchase_order_number || null, row.invoice_number || null, row.project_date, row.description || null, row.total_amount, row.currency || 'MXN', row.status || 'pendiente', row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null, row.updated_by || null);
            added++;
          } else if (entityKey === 'ecovisPayments') {
            db.prepare('INSERT INTO ecovis_payments (payment_date, amount, currency, payment_method, bank_reference, source_description, notes, unallocated_amount, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.payment_date, row.amount, row.currency || 'MXN', row.payment_method || null, row.bank_reference || null, row.source_description || null, row.notes || null, row.unallocated_amount ?? 0, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null, row.updated_by || null);
            added++;
          } else if (entityKey === 'ecovisPaymentAllocations') {
            const paymentExists = db.prepare('SELECT id FROM ecovis_payments WHERE id = ?').get(row.payment_id);
            if (!paymentExists) { entityConflicts.push({ backupId: row.id, reason: 'Pago ECOVIS padre no encontrado' }); continue; }
            db.prepare('INSERT INTO ecovis_payment_allocations (payment_id, ecovis_project_id, allocation_type, amount, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.payment_id, row.ecovis_project_id || null, row.allocation_type, row.amount, row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null);
            added++;
          } else if (entityKey === 'ecovisLoans' || entityKey === 'ecovisMovements') {
            db.prepare('INSERT INTO ecovis_movements (movement_date, movement_type, description, amount, currency, direction, reference, related_project_id, related_payment_id, payment_method, bank_reference, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.movement_date, row.movement_type, row.description, row.amount, row.currency || 'MXN', row.direction || 'neutral', row.reference || null, row.related_project_id || null, row.related_payment_id || null, row.payment_method || null, row.bank_reference || null, row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null, row.updated_by || null);
            added++;
          } else if (entityKey === 'serviceTypes') {
            const existing = db.prepare('SELECT id FROM service_types WHERE name = ?').get(row.name);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO service_types (name, margin, active, sort_order, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.name, row.margin, row.active ?? 1, row.sort_order ?? 0, row.created_by_user_id || null, row.created_by_name || null, row.created_at || nowUtc(), row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at || nowUtc());
            added++;
          } else if (entityKey === 'serviceQuoteSettings') {
            const existing = db.prepare('SELECT key FROM service_quote_settings WHERE key = ?').get(row.key);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO service_quote_settings (key, value, label, category, updated_by_user_id, updated_by_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(row.key, row.value, row.label || null, row.category || 'general', row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at || nowUtc());
            added++;
          } else if (entityKey === 'auditLogs') {
            db.prepare('INSERT INTO audit_logs (user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.user_id || null, row.user_name || null, row.action, row.module || null, row.entity_type || null, row.entity_id || null, row.entity_label || null, row.timestamp_utc, row.ip_address || null, row.user_agent || null, row.metadata_json || null, row.created_at || row.timestamp_utc);
            added++;
          }
        } catch (err) {
          importLog.errors.push({ entity: entityKey, rowId: row.id, error: err.message });
        }
      }

      importLog.summary[entityKey] = { added, skipped, conflicts: entityConflicts.length };
      if (entityConflicts.length > 0) {
        importLog.conflicts.push({ entity: entityKey, items: entityConflicts });
      }
    }
  });

  try {
    importInTransaction();
  } catch (err) {
    importLog.status = 'failed';
    importLog.errors.push({ critical: true, error: err.message });
    logAuditEvent(db, { req, action: 'backup_import', module: 'backup', entityType: 'backup', entityLabel: 'Import failed', metadata: { status: 'failed', error: err.message } });
    persistImportLog(importLog, null);
    return res.status(500).json({ message: 'Error critico durante importacion. Se realizo rollback.', importLog });
  }

  if (importLog.errors.length > 0) {
    importLog.status = 'completed_with_warnings';
  }

  const validation = validatePostImport();
  importLog.validation = validation;
  if (validation.errors.length > 0) {
    importLog.status = 'completed_with_warnings';
  }

  persistImportLog(importLog, validation);
  logAuditEvent(db, { req, action: 'backup_import', module: 'backup', entityType: 'backup', entityLabel: `Import ${importLog.status}`, metadata: { status: importLog.status, summary: importLog.summary } });
  res.json({ message: 'Importacion completada.', importLog });
});

function validatePostImport() {
  const errors = [];
  const warnings = [];

  const activeAdmin = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1").get();
  if (!activeAdmin || activeAdmin.count === 0) {
    errors.push('No existe un administrador activo en el sistema despues de la importacion.');
  }

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!totalUsers || totalUsers.count === 0) {
    errors.push('No existen usuarios en el sistema despues de la importacion.');
  }

  const orphanPayments = db.prepare('SELECT COUNT(*) as count FROM project_payments WHERE project_id NOT IN (SELECT id FROM projects)').get();
  if (orphanPayments && orphanPayments.count > 0) {
    warnings.push(`${orphanPayments.count} pagos sin proyecto padre valido.`);
  }

  const orphanCosts = db.prepare('SELECT COUNT(*) as count FROM project_costs WHERE project_id NOT IN (SELECT id FROM projects)').get();
  if (orphanCosts && orphanCosts.count > 0) {
    warnings.push(`${orphanCosts.count} costos sin proyecto padre valido.`);
  }

  const orphanPerms = db.prepare('SELECT COUNT(*) as count FROM user_permissions WHERE user_id NOT IN (SELECT id FROM users)').get();
  if (orphanPerms && orphanPerms.count > 0) {
    warnings.push(`${orphanPerms.count} permisos referenciando usuarios inexistentes.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function persistImportLog(importLog, validation) {
  try {
    db.prepare(
      `INSERT INTO backup_import_logs (imported_at, imported_by, schema_version, backup_exported_at, status, summary_json, conflicts_json, errors_json, validation_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      importLog.importedAt,
      importLog.importedBy,
      importLog.schemaVersion || null,
      importLog.backupExportedAt || null,
      importLog.status,
      JSON.stringify(importLog.summary),
      JSON.stringify(importLog.conflicts),
      JSON.stringify(importLog.errors),
      validation ? JSON.stringify(validation) : null,
    );
  } catch (err) {
    console.error('Failed to persist import log:', err.message);
  }
}

app.get('/api/admin/backup/logs', requireAuth, requirePermission('backups', 'view'), (req, res) => {
  const logs = db.prepare('SELECT * FROM backup_import_logs ORDER BY id DESC LIMIT 50').all();
  res.json({ data: logs.map((l) => ({ ...l, imported_at_cdmx: formatDateTimeCDMX(l.imported_at) })) });
});

// ===================== AUDIT LOGS =====================

app.get('/api/admin/audit-logs', requireAuth, requirePermission('backups', 'view'), (req, res) => {
  const { page, limit } = parsePaginationParams(req.query);
  const sorting = normalizeSort(req.query, {
    id: 'id',
    timestamp_utc: 'timestamp_utc',
    action: 'action',
    module: 'module',
    user_name: 'user_name',
  }, 'timestamp_utc DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      action: { type: 'text', column: 'action' },
      module: { type: 'text', column: 'module' },
      user_name: { type: 'text', column: 'user_name' },
      entity_type: { type: 'text', column: 'entity_type' },
    },
  });

  const result = paginateSqlList({
    tableSql: 'SELECT * FROM audit_logs',
    countSql: 'SELECT COUNT(*) as count FROM audit_logs',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (row) => ({
      ...row,
      timestamp_cdmx: formatDateTimeCDMX(row.timestamp_utc),
      created_at_cdmx: formatDateTimeCDMX(row.created_at),
    }),
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

// ===================== END BACKUP MODULE =====================

// ===================== FINANCIAL STATEMENTS MODULE =====================

const { calculateFinancialStatement, AP_CATEGORIES, CLASSIFICATION_TYPES, ADJUSTMENT_TYPES, roundMoney: roundMoneyFin, getFinancialWeekOfMonth } = require('./financial');

function requireAdminOnly(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Necesitas iniciar sesion.' });
  }
  if (req.session.role !== 'admin') {
    logAuditEvent(db, { req, action: 'access_denied', module: 'financial', metadata: { reason: 'admin_only', endpoint: req.originalUrl } });
    return res.status(403).json({ message: 'Acceso restringido. Solo el administrador puede consultar Estados Financieros.' });
  }
  return next();
}

// --- Admin Re-authentication ---

app.post('/api/financial/admin-reauth', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) throw badRequest('Contrasena requerida.');
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_active = 1").get(req.session.userId);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      logAuditEvent(db, { req, action: 'financial_reauth_failed', module: 'financial' });
      throw badRequest('Contrasena incorrecta o acceso no autorizado.');
    }
    req.session.financialReauthAt = Date.now();
    logAuditEvent(db, { req, action: 'financial_reauth_success', module: 'financial' });
    res.json({ success: true, expires_in_ms: 15 * 60 * 1000 });
  } catch (error) { next(error); }
});

app.get('/api/financial/reauth-status', requireAuth, requireAdminOnly, (req, res) => {
  const reauthAt = req.session.financialReauthAt || 0;
  const isValid = Date.now() - reauthAt < 15 * 60 * 1000;
  res.json({ authenticated: isValid });
});

// --- Financial Settings ---

app.get('/api/financial/settings', requireAuth, requireAdminOnly, (req, res) => {
  const settings = db.prepare('SELECT * FROM financial_settings WHERE id = 1').get();
  res.json(settings);
});

app.put('/api/financial/settings', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const { admin_password, estimated_isr_rate, ivan_commission_rate } = req.body;
    if (!admin_password) throw badRequest('Contrasena admin requerida.');
    const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' AND is_active = 1").get();
    if (!admin || !bcrypt.compareSync(admin_password, admin.password_hash)) {
      throw badRequest('Contrasena incorrecta.');
    }
    const isr = Number(estimated_isr_rate);
    const ivan = Number(ivan_commission_rate);
    if (isNaN(isr) || isr < 0) throw badRequest('ISR estimado debe ser >= 0.');
    if (isNaN(ivan) || ivan < 0) throw badRequest('Comision IVAN debe ser >= 0.');

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE financial_settings SET estimated_isr_rate = ?, ivan_commission_rate = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = 1`,
    ).run(isr, ivan, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at);

    logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'financial_settings', entityId: 1, entityLabel: 'Configuracion financiera', metadata: { estimated_isr_rate: isr, ivan_commission_rate: ivan } });
    res.json(db.prepare('SELECT * FROM financial_settings WHERE id = 1').get());
  } catch (error) { next(error); }
});

// --- Accounts Payable ---

app.get('/api/financial/accounts-payable', requireAuth, requireAdminOnly, (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const status = req.query.status || '';
  const year = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;

  let where = 'deleted_at IS NULL';
  const params = [];
  if (status && ['pendiente', 'pagada', 'cancelada'].includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (year) {
    where += yearFilter('invoice_date');
    params.push(year);
  }
  if (month) {
    where += monthFilter('invoice_date');
    params.push(month);
  }
  if (search) {
    where += ' AND (supplier_name LIKE ? OR invoice_number LIKE ? OR category LIKE ? OR notes LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM accounts_payable WHERE ${where}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, total);
  const data = db.prepare(`SELECT * FROM accounts_payable WHERE ${where} ORDER BY invoice_date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, pag.limit, pag.offset);
  res.json({ data, pagination: pag, categories: AP_CATEGORIES });
});

app.post('/api/financial/accounts-payable', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const supplierName = requiredText(req.body, 'supplier_name', 'Proveedor');
    const invoiceNumber = requiredText(req.body, 'invoice_number', 'Numero de factura');
    const invoiceDate = requiredText(req.body, 'invoice_date', 'Fecha de factura');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const category = req.body.category || 'Otros';
    const dueDate = optionalText(req.body, 'due_date');
    const relatedProjectId = req.body.related_project_id || null;
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO accounts_payable (supplier_name, invoice_number, invoice_date, due_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn, category, related_project_id, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(supplierName, invoiceNumber, invoiceDate, dueDate, amountOriginal, currency, exchangeRate, amountMxn, category, relatedProjectId, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'accounts_payable', entityId: result.lastInsertRowid, entityLabel: `${supplierName} - ${invoiceNumber}` });
    res.status(201).json(db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

app.put('/api/financial/accounts-payable/:id', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const ap = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ap) throw badRequest('Cuenta por pagar no encontrada.');
    const supplierName = requiredText(req.body, 'supplier_name', 'Proveedor');
    const invoiceNumber = requiredText(req.body, 'invoice_number', 'Numero de factura');
    const invoiceDate = requiredText(req.body, 'invoice_date', 'Fecha de factura');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const category = req.body.category || 'Otros';
    const dueDate = optionalText(req.body, 'due_date');
    const relatedProjectId = req.body.related_project_id || null;
    const notes = optionalText(req.body, 'notes');
    const status = req.body.status || ap.status;
    const paidAt = req.body.paid_at || ap.paid_at;

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE accounts_payable SET supplier_name=?, invoice_number=?, invoice_date=?, due_date=?, amount_original=?, currency=?, exchange_rate_to_mxn=?, amount_mxn=?, category=?, related_project_id=?, notes=?, status=?, paid_at=?, updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?`,
    ).run(supplierName, invoiceNumber, invoiceDate, dueDate, amountOriginal, currency, exchangeRate, amountMxn, category, relatedProjectId, notes, status, paidAt, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);

    logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'accounts_payable', entityId: Number(req.params.id), entityLabel: `${supplierName} - ${invoiceNumber}`, before: ap });
    res.json(db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

app.post('/api/financial/accounts-payable/:id/cancel', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const ap = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ap) throw badRequest('Cuenta por pagar no encontrada.');
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
    const audit = updatedByFields(req);
    db.prepare(`UPDATE accounts_payable SET status='cancelada', deleted_at=?, deleted_by_user_id=?, deleted_by_name=?, delete_reason=?, updated_at=? WHERE id=?`)
      .run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, reason, audit.updated_at, req.params.id);
    logAuditEvent(db, { req, action: 'cancel', module: 'financial', entityType: 'accounts_payable', entityId: Number(req.params.id), entityLabel: `${ap.supplier_name} - ${ap.invoice_number}`, metadata: { reason } });
    res.json(db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// --- Accounts Payable Payments ---

app.get('/api/financial/accounts-payable/:id/payments', requireAuth, requireAdminOnly, (req, res) => {
  const payments = db.prepare('SELECT * FROM accounts_payable_payments WHERE accounts_payable_id = ? ORDER BY payment_date DESC').all(req.params.id);
  const totalPaid = roundMoneyFin(payments.reduce((s, p) => s + Number(p.amount_mxn || 0), 0));
  res.json({ data: payments, total_paid_mxn: totalPaid });
});

app.post('/api/financial/accounts-payable/:id/payments', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const ap = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ap) throw badRequest('Cuenta por pagar no encontrada.');

    const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const paymentMethod = optionalText(req.body, 'payment_method');
    const bankMovementId = req.body.bank_movement_id || null;
    const reference = optionalText(req.body, 'reference');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO accounts_payable_payments (accounts_payable_id, payment_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn, payment_method, bank_movement_id, reference, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(ap.id, paymentDate, amountOriginal, currency, exchangeRate, amountMxn, paymentMethod, bankMovementId, reference, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    // Recalculate AP status
    const allPayments = db.prepare('SELECT * FROM accounts_payable_payments WHERE accounts_payable_id = ?').all(ap.id);
    const totalPaidMxn = roundMoneyFin(allPayments.reduce((s, p) => s + Number(p.amount_mxn || 0), 0));
    let newStatus = 'pendiente';
    if (totalPaidMxn >= Number(ap.amount_mxn) - 0.01) newStatus = 'pagada';
    else if (totalPaidMxn > 0) newStatus = 'parcial';
    const paidAt = newStatus === 'pagada' ? paymentDate : null;
    db.prepare('UPDATE accounts_payable SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, paidAt, ap.id);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'accounts_payable_payment', entityId: result.lastInsertRowid, entityLabel: `Pago a ${ap.supplier_name}` });
    res.status(201).json(db.prepare('SELECT * FROM accounts_payable_payments WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

// --- Project Omissions ---

app.get('/api/financial/project-omissions', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
  const omissions = db.prepare('SELECT * FROM financial_project_omissions WHERE year = ? AND month = ?').all(year, month);
  res.json({ data: omissions });
});

app.post('/api/financial/project-omissions', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const projectId = numberValue(req.body, 'project_id', 'Proyecto', { min: 1 });
    const reason = requiredText(req.body, 'reason', 'Motivo de omision');

    const audit = createdByFields(req);
    const existing = db.prepare('SELECT id FROM financial_project_omissions WHERE year = ? AND month = ? AND project_id = ?').get(year, month, projectId);
    if (existing) {
      db.prepare('UPDATE financial_project_omissions SET omit = 1, reason = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
        .run(reason, audit.created_by_user_id, audit.created_by_name, audit.created_at, existing.id);
      logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'financial_project_omission', entityId: existing.id, metadata: { project_id: projectId, reason } });
      res.json(db.prepare('SELECT * FROM financial_project_omissions WHERE id = ?').get(existing.id));
    } else {
      const result = db.prepare(
        `INSERT INTO financial_project_omissions (year, month, project_id, omit, reason, created_by_user_id, created_by_name, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      ).run(year, month, projectId, reason, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'financial_project_omission', entityId: result.lastInsertRowid, metadata: { project_id: projectId, reason } });
      res.status(201).json(db.prepare('SELECT * FROM financial_project_omissions WHERE id = ?').get(result.lastInsertRowid));
    }
  } catch (error) { next(error); }
});

app.delete('/api/financial/project-omissions/:id', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const omission = db.prepare('SELECT * FROM financial_project_omissions WHERE id = ?').get(req.params.id);
    if (!omission) throw badRequest('Omision no encontrada.');
    db.prepare('DELETE FROM financial_project_omissions WHERE id = ?').run(req.params.id);
    logAuditEvent(db, { req, action: 'delete', module: 'financial', entityType: 'financial_project_omission', entityId: Number(req.params.id), metadata: { project_id: omission.project_id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Manual Payroll ---

app.get('/api/financial/payroll', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  let where = 'year = ?';
  const params = [year];
  if (month) { where += ' AND month = ?'; params.push(month); }
  const data = db.prepare(`SELECT * FROM manual_payroll_expenses WHERE ${where} ORDER BY month, id`).all(...params);
  const total = roundMoneyFin(data.reduce((s, r) => s + Number(r.amount_mxn || 0), 0));
  res.json({ data, total_mxn: total });
});

app.post('/api/financial/payroll', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const concept = requiredText(req.body, 'concept', 'Concepto');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO manual_payroll_expenses (year, month, concept, amount_original, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(year, month, concept, amountOriginal, currency, exchangeRate, amountMxn, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'manual_payroll', entityId: result.lastInsertRowid, entityLabel: concept });
    res.status(201).json(db.prepare('SELECT * FROM manual_payroll_expenses WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

// --- Financial Adjustments ---

app.get('/api/financial/adjustments', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  let where = 'year = ? AND deleted_at IS NULL';
  const params = [year];
  if (month) { where += ' AND month = ?'; params.push(month); }
  const data = db.prepare(`SELECT * FROM financial_adjustments WHERE ${where} ORDER BY month, id`).all(...params);
  res.json({ data, types: ADJUSTMENT_TYPES });
});

app.post('/api/financial/adjustments', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const adjustmentType = requiredText(req.body, 'adjustment_type', 'Tipo de ajuste');
    if (!ADJUSTMENT_TYPES.includes(adjustmentType)) throw badRequest('Tipo de ajuste no valido.');
    const concept = requiredText(req.body, 'concept', 'Concepto');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO financial_adjustments (year, month, adjustment_type, concept, amount_original, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(year, month, adjustmentType, concept, amountOriginal, currency, exchangeRate, amountMxn, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'financial_adjustment', entityId: result.lastInsertRowid, entityLabel: concept });
    res.status(201).json(db.prepare('SELECT * FROM financial_adjustments WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

app.post('/api/financial/adjustments/:id/cancel', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const adj = db.prepare('SELECT * FROM financial_adjustments WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!adj) throw badRequest('Ajuste no encontrado.');
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
    const audit = updatedByFields(req);
    db.prepare(`UPDATE financial_adjustments SET status='cancelado', deleted_at=?, deleted_by_user_id=?, deleted_by_name=?, delete_reason=?, updated_at=? WHERE id=?`)
      .run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, reason, audit.updated_at, req.params.id);
    logAuditEvent(db, { req, action: 'cancel', module: 'financial', entityType: 'financial_adjustment', entityId: Number(req.params.id), entityLabel: adj.concept, metadata: { reason } });
    res.json(db.prepare('SELECT * FROM financial_adjustments WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// --- Bank Statement Summaries ---

app.get('/api/financial/bank-summaries', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  let where = 'year = ?';
  const params = [year];
  if (month) { where += ' AND month = ?'; params.push(month); }
  const data = db.prepare(`SELECT * FROM bank_statement_summaries WHERE ${where} ORDER BY month, bank_name`).all(...params);
  res.json({ data });
});

app.post('/api/financial/bank-summaries', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const bankName = requiredText(req.body, 'bank_name', 'Banco');
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const accountMasked = optionalText(req.body, 'account_number_masked');
    const initialBalance = Number(req.body.initial_balance_original || 0);
    const deposits = Number(req.body.deposits_original || 0);
    const withdrawals = Number(req.body.withdrawals_original || 0);
    const commissions = Number(req.body.commissions_original || 0);
    const commissionsVat = Number(req.body.commissions_vat_original || 0);
    const finalBalance = Number(req.body.final_balance_original || 0);
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO bank_statement_summaries (bank_name, account_number_masked, currency, year, month,
        initial_balance_original, deposits_original, withdrawals_original, commissions_original, commissions_vat_original, final_balance_original,
        exchange_rate_to_mxn, initial_balance_mxn, deposits_mxn, withdrawals_mxn, commissions_mxn, commissions_vat_mxn, final_balance_mxn,
        notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(bankName, accountMasked, currency, year, month,
      initialBalance, deposits, withdrawals, commissions, commissionsVat, finalBalance,
      exchangeRate,
      roundMoneyFin(initialBalance * exchangeRate), roundMoneyFin(deposits * exchangeRate), roundMoneyFin(withdrawals * exchangeRate),
      roundMoneyFin(commissions * exchangeRate), roundMoneyFin(commissionsVat * exchangeRate), roundMoneyFin(finalBalance * exchangeRate),
      notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'bank_statement_summary', entityId: result.lastInsertRowid, entityLabel: `${bankName} ${year}-${month}` });
    res.status(201).json(db.prepare('SELECT * FROM bank_statement_summaries WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

// --- Bank Statement Movements ---

app.get('/api/financial/bank-movements', requireAuth, requireAdminOnly, (req, res) => {
  const summaryId = req.query.bank_statement_summary_id;
  const year = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;
  const classificationStatus = req.query.classification_status || '';
  const { page, limit } = parsePaginationParams(req.query);

  let where = '1=1';
  const params = [];

  if (summaryId) {
    where += ' AND m.bank_statement_summary_id = ?';
    params.push(summaryId);
  }
  if (year || month) {
    where += ' AND EXISTS (SELECT 1 FROM bank_statement_summaries s WHERE s.id = m.bank_statement_summary_id';
    if (year) { where += ' AND s.year = ?'; params.push(year); }
    if (month) { where += ' AND s.month = ?'; params.push(month); }
    where += ')';
  }
  if (classificationStatus && ['sin_clasificar', 'clasificado', 'ignorado'].includes(classificationStatus)) {
    where += ' AND m.classification_status = ?';
    params.push(classificationStatus);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM bank_statement_movements m WHERE ${where}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, total);
  const data = db.prepare(`SELECT m.* FROM bank_statement_movements m WHERE ${where} ORDER BY m.transaction_date DESC, m.id DESC LIMIT ? OFFSET ?`).all(...params, pag.limit, pag.offset);
  res.json({ data, pagination: pag, classification_types: CLASSIFICATION_TYPES });
});

app.post('/api/financial/bank-movements', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const summaryId = numberValue(req.body, 'bank_statement_summary_id', 'Estado de cuenta', { min: 1 });
    const summary = db.prepare('SELECT * FROM bank_statement_summaries WHERE id = ?').get(summaryId);
    if (!summary) throw badRequest('Estado de cuenta no encontrado.');

    const transactionDate = requiredText(req.body, 'transaction_date', 'Fecha de transaccion');
    const description = optionalText(req.body, 'description');
    const reference = optionalText(req.body, 'reference');
    const depositOriginal = Number(req.body.deposit_original || 0);
    const withdrawalOriginal = Number(req.body.withdrawal_original || 0);
    const balanceOriginal = req.body.balance_original != null ? Number(req.body.balance_original) : null;
    const notes = optionalText(req.body, 'notes');

    const rate = Number(summary.exchange_rate_to_mxn || 1);
    const result = db.prepare(
      `INSERT INTO bank_statement_movements (bank_statement_summary_id, transaction_date, description, reference,
        deposit_original, withdrawal_original, currency, exchange_rate_to_mxn, deposit_mxn, withdrawal_mxn,
        balance_original, balance_mxn, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(summaryId, transactionDate, description, reference,
      depositOriginal, withdrawalOriginal, summary.currency, rate,
      roundMoneyFin(depositOriginal * rate), roundMoneyFin(withdrawalOriginal * rate),
      balanceOriginal, balanceOriginal != null ? roundMoneyFin(balanceOriginal * rate) : null, notes);

    res.status(201).json(db.prepare('SELECT * FROM bank_statement_movements WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

app.put('/api/financial/bank-movements/:id/classify', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const mov = db.prepare('SELECT * FROM bank_statement_movements WHERE id = ?').get(req.params.id);
    if (!mov) throw badRequest('Movimiento no encontrado.');

    const classificationType = req.body.classification_type || null;
    const classificationStatus = req.body.classification_status || 'clasificado';
    if (!['sin_clasificar', 'clasificado', 'ignorado'].includes(classificationStatus)) {
      throw badRequest('Estado de clasificacion no valido.');
    }
    if (classificationStatus === 'clasificado' && (!classificationType || !CLASSIFICATION_TYPES.includes(classificationType))) {
      throw badRequest('Tipo de clasificacion requerido.');
    }

    const relatedProjectId = req.body.related_project_id || null;
    const relatedAccountPayableId = req.body.related_account_payable_id || null;
    const notes = req.body.notes !== undefined ? req.body.notes : mov.notes;

    db.prepare(
      `UPDATE bank_statement_movements SET classification_status=?, classification_type=?, related_project_id=?, related_account_payable_id=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).run(classificationStatus, classificationType, relatedProjectId, relatedAccountPayableId, notes, req.params.id);

    logAuditEvent(db, { req, action: 'classify', module: 'financial', entityType: 'bank_movement', entityId: Number(req.params.id), metadata: { classification_type: classificationType, classification_status: classificationStatus } });
    res.json(db.prepare('SELECT * FROM bank_statement_movements WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// --- Accounts Receivable (from projects) ---

app.get('/api/financial/accounts-receivable', requireAuth, requireAdminOnly, (req, res) => {
  const rateMap = getExchangeRateMap();
  const projects = db.prepare("SELECT * FROM projects WHERE closed_at IS NULL AND deleted_at IS NULL").all();
  const today = new Date();
  const data = [];
  for (const p of projects) {
    const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ?').all(p.id);
    const totalCharged = payments.reduce((sum, pay) => {
      const rate = rateMap[pay.currency || 'MXN'] || 1;
      return sum + Number(pay.amount || 0) * rate;
    }, 0);
    const invoicedMxn = Number(p.total_invoiced || 0) * (rateMap[p.total_invoiced_currency || 'MXN'] || 1);
    const pendingMxn = roundMoneyFin(invoicedMxn - totalCharged);
    if (pendingMxn > 0.01) {
      const creditDays = p.credit_days_na ? null : (p.credit_days || null);
      const invoiceDate = p.invoice_date_na ? null : (p.invoice_date || null);
      let dueDate = p.due_date || null;
      if (!dueDate && invoiceDate && creditDays) {
        const d = new Date(invoiceDate + 'T12:00:00');
        d.setDate(d.getDate() + creditDays);
        dueDate = d.toISOString().split('T')[0];
      }
      let daysOverdue = 0;
      let status_color = 'gray';
      if (dueDate) {
        const due = new Date(dueDate + 'T23:59:59');
        daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
        status_color = daysOverdue > 0 ? 'red' : 'green';
      }
      data.push({
        project_id: p.id,
        client_name: p.client_name,
        project_description: p.project_description,
        quote_number: p.quote_number,
        order_number: p.order_number,
        invoice_number: p.invoice_number || null,
        project_date: p.created_at,
        total_invoiced: p.total_invoiced,
        total_invoiced_currency: p.total_invoiced_currency || 'MXN',
        total_charged_mxn: roundMoneyFin(totalCharged),
        pending_mxn: pendingMxn,
        credit_days: creditDays,
        credit_days_na: !!p.credit_days_na,
        invoice_date: invoiceDate,
        invoice_date_na: !!p.invoice_date_na,
        due_date: dueDate,
        days_overdue: daysOverdue,
        status_color,
      });
    }
  }
  const totalMxn = roundMoneyFin(data.reduce((s, r) => s + r.pending_mxn, 0));
  const notOverdue = roundMoneyFin(data.filter((r) => r.status_color === 'green' || r.status_color === 'gray').reduce((s, r) => s + r.pending_mxn, 0));
  const overdue = roundMoneyFin(data.filter((r) => r.status_color === 'red').reduce((s, r) => s + r.pending_mxn, 0));
  const d1_30 = roundMoneyFin(data.filter((r) => r.days_overdue >= 1 && r.days_overdue <= 30).reduce((s, r) => s + r.pending_mxn, 0));
  const d31_60 = roundMoneyFin(data.filter((r) => r.days_overdue >= 31 && r.days_overdue <= 60).reduce((s, r) => s + r.pending_mxn, 0));
  const d61_90 = roundMoneyFin(data.filter((r) => r.days_overdue >= 61 && r.days_overdue <= 90).reduce((s, r) => s + r.pending_mxn, 0));
  const d90plus = roundMoneyFin(data.filter((r) => r.days_overdue > 90).reduce((s, r) => s + r.pending_mxn, 0));

  res.json({ data, summary: { total_mxn: totalMxn, not_overdue: notOverdue, overdue, d1_30, d31_60, d61_90, d90plus } });
});

// --- Financial Statement Generation ---

app.get('/api/financial/statements', requireAuth, requireAdminOnly, (req, res) => {
  const data = db.prepare("SELECT * FROM financial_statements WHERE deleted_at IS NULL ORDER BY year DESC, month DESC").all();
  res.json({ data });
});

app.post('/api/financial/statements/generate', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });

    const existing = db.prepare("SELECT * FROM financial_statements WHERE year = ? AND month = ? AND status != 'cancelado' AND deleted_at IS NULL").get(year, month);
    if (existing && existing.status === 'cerrado') {
      throw badRequest('El estado financiero de este mes esta cerrado. Reabrelo primero para actualizar.');
    }

    const settings = db.prepare('SELECT * FROM financial_settings WHERE id = 1').get();
    const rateMap = getExchangeRateMap();

    // Gather data for the month
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Project omissions
    const omissions = db.prepare('SELECT project_id FROM financial_project_omissions WHERE year = ? AND month = ? AND omit = 1').all(year, month);
    const omittedProjectIds = omissions.map((o) => o.project_id);

    const projects = db.prepare("SELECT * FROM projects WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL").all(monthStart, nextMonth);
    const projectsWithMxn = projects.map((p) => ({
      ...p,
      amount_mxn: roundMoneyFin(Number(p.total_invoiced || 0) * (rateMap[p.total_invoiced_currency || 'MXN'] || 1)),
    }));

    const projectCosts = db.prepare("SELECT * FROM project_costs WHERE cost_date >= ? AND cost_date < ?").all(monthStart, nextMonth);

    const accountsPayable = db.prepare("SELECT * FROM accounts_payable WHERE invoice_date >= ? AND invoice_date < ? AND deleted_at IS NULL AND status != 'cancelada'").all(monthStart, nextMonth);

    const bankSummaries = db.prepare('SELECT * FROM bank_statement_summaries WHERE year = ? AND month = ?').all(year, month);
    const bankSummaryIds = bankSummaries.map((s) => s.id);
    let bankMovements = [];
    if (bankSummaryIds.length > 0) {
      bankMovements = db.prepare(`SELECT * FROM bank_statement_movements WHERE bank_statement_summary_id IN (${bankSummaryIds.map(() => '?').join(',')}) AND classification_status != 'ignorado'`).all(...bankSummaryIds);
    }

    const manualPayroll = db.prepare('SELECT * FROM manual_payroll_expenses WHERE year = ? AND month = ?').all(year, month);
    const adjustments = db.prepare("SELECT * FROM financial_adjustments WHERE year = ? AND month = ? AND status = 'activo' AND deleted_at IS NULL").all(year, month);

    // Accounts receivable
    const allProjects = db.prepare("SELECT * FROM projects WHERE closed_at IS NULL AND deleted_at IS NULL").all();
    const accountsReceivable = [];
    for (const p of allProjects) {
      const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ?').all(p.id);
      const totalCharged = payments.reduce((sum, pay) => sum + Number(pay.amount || 0) * (rateMap[pay.currency || 'MXN'] || 1), 0);
      const invoicedMxn = Number(p.total_invoiced || 0) * (rateMap[p.total_invoiced_currency || 'MXN'] || 1);
      const pendingMxn = roundMoneyFin(invoicedMxn - totalCharged);
      if (pendingMxn > 0.01) accountsReceivable.push({ pending_mxn: pendingMxn });
    }

    const calcData = {
      projects: projectsWithMxn,
      projectCosts,
      accountsPayable,
      bankSummaries,
      bankMovements,
      manualPayroll,
      adjustments,
      accountsReceivable,
      omittedProjectIds,
    };

    const result = calculateFinancialStatement(calcData, settings);
    const unclassified = bankMovements.filter((m) => m.classification_status === 'sin_clasificar').length;
    result.unclassified_movements_count = unclassified;

    const audit = existing ? updatedByFields(req) : createdByFields(req);

    if (existing) {
      db.prepare(
        `UPDATE financial_statements SET
          revenue_net_mxn=?, cost_of_sales_mxn=?, gross_profit_mxn=?, operating_expenses_mxn=?,
          net_administrative_profit_mxn=?, estimated_isr_mxn=?, profit_after_isr_mxn=?,
          ivan_commission_mxn=?, real_administrative_profit_mxn=?,
          accounts_receivable_mxn=?, accounts_payable_mxn=?,
          bank_initial_balance_mxn=?, bank_deposits_mxn=?, bank_withdrawals_mxn=?, bank_final_balance_mxn=?,
          unclassified_movements_count=?,
          configuration_snapshot_json=?,
          updated_by_user_id=?, updated_by_name=?, updated_at=?
        WHERE id=?`,
      ).run(
        result.revenue_net_mxn, result.cost_of_sales_mxn, result.gross_profit_mxn, result.operating_expenses_mxn,
        result.net_administrative_profit_mxn, result.estimated_isr_mxn, result.profit_after_isr_mxn,
        result.ivan_commission_mxn, result.real_administrative_profit_mxn,
        result.accounts_receivable_mxn, result.accounts_payable_mxn,
        result.bank_initial_balance_mxn, result.bank_deposits_mxn, result.bank_withdrawals_mxn, result.bank_final_balance_mxn,
        result.unclassified_movements_count,
        JSON.stringify(settings),
        audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, existing.id,
      );
      logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'financial_statement', entityId: existing.id, entityLabel: `${year}-${month}` });
      res.json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(existing.id));
    } else {
      const ins = db.prepare(
        `INSERT INTO financial_statements (year, month, status,
          revenue_net_mxn, cost_of_sales_mxn, gross_profit_mxn, operating_expenses_mxn,
          net_administrative_profit_mxn, estimated_isr_mxn, profit_after_isr_mxn,
          ivan_commission_mxn, real_administrative_profit_mxn,
          accounts_receivable_mxn, accounts_payable_mxn,
          bank_initial_balance_mxn, bank_deposits_mxn, bank_withdrawals_mxn, bank_final_balance_mxn,
          unclassified_movements_count, configuration_snapshot_json,
          created_by_user_id, created_by_name, created_at, updated_at)
        VALUES (?, ?, 'borrador', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(year, month,
        result.revenue_net_mxn, result.cost_of_sales_mxn, result.gross_profit_mxn, result.operating_expenses_mxn,
        result.net_administrative_profit_mxn, result.estimated_isr_mxn, result.profit_after_isr_mxn,
        result.ivan_commission_mxn, result.real_administrative_profit_mxn,
        result.accounts_receivable_mxn, result.accounts_payable_mxn,
        result.bank_initial_balance_mxn, result.bank_deposits_mxn, result.bank_withdrawals_mxn, result.bank_final_balance_mxn,
        result.unclassified_movements_count, JSON.stringify(settings),
        audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'financial_statement', entityId: ins.lastInsertRowid, entityLabel: `${year}-${month}` });
      res.status(201).json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(ins.lastInsertRowid));
    }
  } catch (error) { next(error); }
});

app.post('/api/financial/statements/:id/close', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const fs = db.prepare("SELECT * FROM financial_statements WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!fs) throw badRequest('Estado financiero no encontrado.');
    if (fs.status === 'cerrado') throw badRequest('Ya esta cerrado.');
    if (fs.status === 'cancelado') throw badRequest('No se puede cerrar un estado cancelado.');

    const audit = updatedByFields(req);
    db.prepare(`UPDATE financial_statements SET status='cerrado', data_snapshot_json=?, closed_by_user_id=?, closed_by_name=?, closed_at=?, updated_at=? WHERE id=?`)
      .run(JSON.stringify({ closed_with_data: true }), audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, audit.updated_at, req.params.id);

    logAuditEvent(db, { req, action: 'close', module: 'financial', entityType: 'financial_statement', entityId: Number(req.params.id), entityLabel: `${fs.year}-${fs.month}` });
    res.json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

app.post('/api/financial/statements/:id/reopen', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const fs = db.prepare("SELECT * FROM financial_statements WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!fs) throw badRequest('Estado financiero no encontrado.');
    if (fs.status !== 'cerrado') throw badRequest('Solo se puede reabrir un estado cerrado.');

    const audit = updatedByFields(req);
    db.prepare(`UPDATE financial_statements SET status='borrador', updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?`)
      .run(audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);

    logAuditEvent(db, { req, action: 'reopen', module: 'financial', entityType: 'financial_statement', entityId: Number(req.params.id), entityLabel: `${fs.year}-${fs.month}` });
    res.json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// ===================== END FINANCIAL STATEMENTS MODULE =====================

registerKpiRoutes(app, db, { requireAuth });
registerNewModules(app, db, { requireAuth, requirePermission, badRequest, requiredText, optionalText, numberValue, enumValue, currencyValue, booleanValue, trim });
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    let message = 'El registro ya existe.';
    if (err.message.includes('users.username')) {
      message = 'El usuario ya existe.';
    } else if (err.message.includes('employees.employee_number')) {
      message = 'El numero de empleado ya existe.';
    } else if (err.message.includes('projects.quote_number')) {
      message = 'El numero de cotizacion ya existe.';
    }
    return res.status(400).json({ message });
  }

  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    console.error('[API Error]', req.method, req.originalUrl, {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      stack: err.stack,
    });
  }
  const message = statusCode === 500 ? 'Ocurrio un error inesperado.' : err.message;
  return res.status(statusCode).json({ message });
});

app.listen(PORT, () => {
  console.log(`Aplicacion de proyectos disponible en http://localhost:${PORT}`);
});

```


================================================================================
# ARCHIVO: src/sessionStore.js
================================================================================

```javascript
const { isPostgres } = require('./db/mode');
const { toPositionalParams } = require('./db/dialect');

function createSqliteSessionStore(session, database, { ttlMs }) {
  const Store = session.Store;
  const pg = isPostgres();

  const setSql = pg
    ? toPositionalParams(
        `INSERT INTO sessions (sid, sess, expires)
         VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = EXCLUDED.sess, expires = EXCLUDED.expires`,
      )
    : `INSERT INTO sessions (sid, sess, expires)
         VALUES (@sid, @sess, @expires)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`;

  return new (class AppSessionStore extends Store {
    constructor() {
      super();
      this.getStmt = database.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
      this.setStmt = database.prepare(setSql);
      this.destroyStmt = database.prepare('DELETE FROM sessions WHERE sid = ?');
      this.touchStmt = database.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
      this.cleanupStmt = database.prepare('DELETE FROM sessions WHERE expires <= ?');
      this.cleanupExpired();
    }

    get(sid, callback) {
      try {
        const row = this.getStmt.get(sid);
        if (!row) {
          return callback(null, null);
        }

        if (row.expires <= Date.now()) {
          this.destroyStmt.run(sid);
          return callback(null, null);
        }

        const sessionData = JSON.parse(row.sess);
        if (sessionData.cookie?.expires) {
          sessionData.cookie.expires = new Date(sessionData.cookie.expires);
        }

        return callback(null, sessionData);
      } catch (error) {
        return callback(error);
      }
    }

    set(sid, sessionData, callback = () => {}) {
      try {
        this.cleanupExpired();
        const expires = this.getExpiration(sessionData);
        const payload = JSON.stringify(sessionData);
        if (pg) {
          this.setStmt.run(sid, payload, expires);
        } else {
          this.setStmt.run({ sid, sess: payload, expires });
        }
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    }

    destroy(sid, callback = () => {}) {
      try {
        this.destroyStmt.run(sid);
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    }

    touch(sid, sessionData, callback = () => {}) {
      try {
        this.touchStmt.run(this.getExpiration(sessionData), sid);
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    }

    getExpiration(sessionData) {
      const cookieExpires = sessionData.cookie?.expires;
      if (cookieExpires) {
        return new Date(cookieExpires).getTime();
      }

      return Date.now() + ttlMs;
    }

    cleanupExpired() {
      this.cleanupStmt.run(Date.now());
    }
  })();
}

function createSessionStore(session, database, options) {
  return createSqliteSessionStore(session, database, options);
}

module.exports = {
  createSqliteSessionStore,
  createSessionStore,
};

```


================================================================================
# ARCHIVO: src/vacations.js
================================================================================

```javascript
'use strict';

/**
 * Calculates vacation days entitlement based on Mexico's Ley Federal del Trabajo.
 * @param {string|Date} hireDate - Employee hire date
 * @param {string|Date} referenceDate - Date to calculate against (typically today)
 * @returns {number} Days entitled
 */
function calculateVacationEntitlement(hireDate, referenceDate) {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);

  if (Number.isNaN(hire.getTime()) || Number.isNaN(ref.getTime())) {
    throw new Error('Fechas invalidas.');
  }

  const completedYears = getCompletedYears(hire, ref);

  if (completedYears < 1) {
    return 0;
  }

  if (completedYears <= 5) {
    return 10 + completedYears * 2;
  }

  return 22 + Math.floor((completedYears - 6) / 5) * 2;
}

/**
 * Calculates the number of complete years between two dates.
 */
function getCompletedYears(startDate, endDate) {
  let years = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < startDate.getDate())) {
    years -= 1;
  }

  return Math.max(0, years);
}

/**
 * Calculates business days (Monday-Friday) between two dates inclusive.
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @param {object} [options]
 * @param {string[]} [options.holidays] - Array of date strings (YYYY-MM-DD) to exclude
 * @returns {number} Business days count
 */
function calculateBusinessDays(startDate, endDate, options = {}) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Fechas invalidas.');
  }

  if (end < start) {
    throw new Error('La fecha final no puede ser menor que la fecha inicial.');
  }

  const holidays = new Set((options.holidays || []).map((d) => normalizeDate(new Date(d))));
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      if (!holidays.has(normalizeDate(current))) {
        count += 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function normalizeDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Gets the current vacation exercise year for an employee.
 * The exercise year is determined by the anniversary of the hire date.
 */
function getCurrentExerciseYear(hireDate, referenceDate) {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);
  const completedYears = getCompletedYears(hire, ref);
  if (completedYears < 1) {
    return 1;
  }
  return completedYears;
}

/**
 * Calculates the full vacation balance for an employee in a given exercise year,
 * including carry-over from previous exercises.
 *
 * @param {object} params
 * @param {string} params.hireDate - Employee hire date
 * @param {number} params.exerciseYear - The exercise year to compute
 * @param {Array} params.allRequests - All vacation_requests for this employee (all years)
 * @param {string} [params.referenceDate] - Reference date (default: today)
 * @returns {object} Balance breakdown
 */
function calculateVacationBalance({ hireDate, exerciseYear, allRequests, referenceDate }) {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);

  const entitlementDays = calculateVacationEntitlement(hireDate, refDate);

  const carriedBalanceFromPreviousExercise = computeCarriedBalance(
    hireDate, exerciseYear, allRequests, refDate,
  );

  const exerciseRequests = allRequests.filter(
    (r) => r.vacation_exercise_year === exerciseYear && r.status !== 'cancelada',
  );
  const takenDays = exerciseRequests
    .filter((r) => r.status === 'tomada')
    .reduce((sum, r) => sum + r.requested_days, 0);
  const scheduledDays = exerciseRequests
    .filter((r) => r.status === 'programada')
    .reduce((sum, r) => sum + r.requested_days, 0);

  const availableDays = entitlementDays + carriedBalanceFromPreviousExercise - takenDays - scheduledDays;
  const negativeCarryToNextExercise = availableDays < 0 ? availableDays : 0;

  return {
    entitlementDays,
    takenDays,
    scheduledDays,
    carriedBalanceFromPreviousExercise,
    availableDays,
    balanceAfterRequests: availableDays,
    negativeCarryToNextExercise,
  };
}

/**
 * Recursively computes the carried balance from previous exercise years.
 * Only negative balances carry over.
 */
function computeCarriedBalance(hireDate, exerciseYear, allRequests, referenceDate) {
  if (exerciseYear <= 1) {
    return 0;
  }

  const prevYear = exerciseYear - 1;
  const prevEntitlement = calculateEntitlementForExercise(hireDate, prevYear);

  const prevCarried = computeCarriedBalance(hireDate, prevYear, allRequests, referenceDate);

  const prevRequests = allRequests.filter(
    (r) => r.vacation_exercise_year === prevYear && r.status !== 'cancelada',
  );
  const prevUsed = prevRequests.reduce((sum, r) => sum + r.requested_days, 0);

  const prevBalance = prevEntitlement + prevCarried - prevUsed;
  return prevBalance < 0 ? prevBalance : 0;
}

/**
 * Calculates entitlement for a specific exercise year number (1-based).
 * Returns the days corresponding to that single service year.
 */
function calculateEntitlementForExercise(hireDate, exerciseYear) {
  return calculateAnnualVacationEntitlementByYear(exerciseYear);
}

/**
 * Returns vacation days entitled for a specific service year (1-based).
 * LFT table:
 *  Year 1=12, 2=14, 3=16, 4=18, 5=20,
 *  6-10=22, 11-15=24, 16-20=26, 21-25=28, 26-30=30, 31-35=32, ...
 */
function calculateAnnualVacationEntitlementByYear(serviceYear) {
  if (serviceYear < 1) return 0;
  if (serviceYear <= 5) return 10 + serviceYear * 2;
  return 22 + Math.floor((serviceYear - 6) / 5) * 2;
}

/**
 * Calculates total ACCRUED (accumulated) vacation days from hire date
 * to reference date. Sums entitlements for every completed year.
 *
 * @param {string|Date} hireDate
 * @param {string|Date} referenceDate - cutoff date (today for active, termination date for inactive)
 * @returns {number} Total accumulated days
 */
function calculateAccruedVacationDays(hireDate, referenceDate) {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);

  if (Number.isNaN(hire.getTime()) || Number.isNaN(ref.getTime())) {
    throw new Error('Fechas invalidas.');
  }

  const completedYears = getCompletedYears(hire, ref);
  let total = 0;
  for (let year = 1; year <= completedYears; year++) {
    total += calculateAnnualVacationEntitlementByYear(year);
  }
  return total;
}

/** Empleados activos del modulo Vacaciones (para selectores en otros modulos). */
function getEmpleadosActivos(db) {
  return db
    .prepare(
      `SELECT id, employee_number, full_name, hire_date, department, position, active
       FROM employees
       WHERE COALESCE(active, 0) <> 0
       ORDER BY full_name`,
    )
    .all();
}

module.exports = {
  calculateVacationEntitlement,
  calculateBusinessDays,
  getCompletedYears,
  getCurrentExerciseYear,
  calculateVacationBalance,
  calculateEntitlementForExercise,
  calculateAnnualVacationEntitlementByYear,
  calculateAccruedVacationDays,
  getEmpleadosActivos,
};

```

