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
- If changing the DB schema (`src/db.js`), delete `data/app.db` and restart the server to recreate it from scratch. There is no separate migration system.
- The Reports module (`project_reports` table) stores `safety_tests`, `emissions_low_fire`, and `emissions_high_fire` as JSON strings. Parse/stringify when reading/writing.
- The print view for reports is at `/report-print.html?id=<reportId>` — it uses `@media print` CSS for letter-size output.
- The ECOVIS module (`src/ecovis.js`) provides pure calculation functions; all ECOVIS endpoints in `src/server.js` require both `requireAuth` and `requireAdmin` middleware.
- The `ecovis_payment_allocations` table uses `payment_id` (not `ecovis_payment_id`) as the foreign key to `ecovis_payments`.
- ECOVIS project status values are `pendiente`, `parcialmente_pagado`, `pagado`, `cancelado` (note: `parcialmente_pagado`, not `parcial`).
- The `ecovis_movements.description` column is `NOT NULL`; always provide a description when inserting movements.
- Integration tests (e.g. `attendance.test.js`, `ecovis-currency.test.js`, `financial-integration.test.js`) require the server running on port 3000 (`npm start`) before executing `npm test`. Without the server, those tests fail with `ECONNREFUSED` but unit tests still pass.
- There is one pre-existing test failure (`backup import preview handles attendance entities` — 413 payload too large); this is not caused by environment setup.
