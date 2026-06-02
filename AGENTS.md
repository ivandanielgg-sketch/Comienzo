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
- **Database drivers (Fase 2):** default is SQLite (`better-sqlite3`) when `DATABASE_URL` is unset. With `DATABASE_URL`, the app uses PostgreSQL through `src/db/betterSqlite3Adapter.js` (API compatible with better-sqlite3). Legacy SQLite code lives in `src/db/sqliteDriver.js` (not removed).
- **Production safety:** on Render/production, PostgreSQL is used only if both `DATABASE_URL` and `USE_POSTGRES=true` are set. Otherwise SQLite file (`DB_PATH`) is always used — avoids accidental switch away from `/var/data/app.db`.
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
