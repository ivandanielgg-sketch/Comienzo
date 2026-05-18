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
- The frontend is vanilla HTML/CSS/JS served statically from `public/`—no build step required.
- The test suite uses Node's built-in test runner (`node --test`); there is no lint command configured in `package.json`.
- The API field names use snake_case (e.g. `quote_number`, `client_name`, `purchase_order_not_applicable`).
- To create a project without a purchase order, set `purchase_order_not_applicable: true`.
