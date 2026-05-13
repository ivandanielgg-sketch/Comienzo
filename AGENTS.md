# AGENTS.md

## Cursor Cloud specific instructions

This is a Node.js/Express project management web app ("Control de Proyectos") with an embedded SQLite database (`better-sqlite3`). No external services or containers are required.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Run tests | `npm test` |
| Start server | `npm start` (default port 3000) |

### Key notes

- The SQLite database file is created automatically at `data/app.db` on first server start. No migrations or seed commands needed — `src/db.js` handles schema creation and admin user seeding.
- Default login credentials: `admin` / `admin123` (configurable via `.env`).
- `better-sqlite3` compiles a native C addon during `npm install`; build tools (`gcc`, `make`, `python3`) must be available.
- The app has no lint configuration (no ESLint/Prettier). The only automated checks are unit tests via Node.js built-in test runner (`node --test`).
- The `main` branch is nearly empty. Application code currently lives on the `cursor/proyectos-web-6633` branch.
- Sessions are stored in-memory (default `express-session` MemoryStore), so restarting the server invalidates all sessions.
