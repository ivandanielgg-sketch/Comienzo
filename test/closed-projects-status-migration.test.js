const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const {
  CLOSED_EN_PROCESO_IDS,
  migrateClosedProjectsStatus,
} = require('../src/db/closedProjectsStatusMigration');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-closed-status-migration.db');

function cleanup() {
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    try { fs.unlinkSync(f); } catch {}
  }
}

function createFixtureDb() {
  cleanup();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      quote_number TEXT,
      status TEXT,
      closed_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT,
      module TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      entity_label TEXT,
      timestamp_utc TEXT,
      ip_address TEXT,
      user_agent TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT
    );
  `);

  const insert = db.prepare(
    'INSERT INTO projects (id, quote_number, status, closed_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const id of CLOSED_EN_PROCESO_IDS) {
    insert.run(id, `Q-${id}`, 'En Proceso', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
  }
  // Already corrected — must not be touched
  insert.run(999, 'Q-999', 'Terminado', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
  // Same id pattern but open — must not be touched (not in list anyway)
  insert.run(1000, 'Q-1000', 'En Proceso', null, '2025-01-01T00:00:00.000Z');
  return db;
}

test('closed projects status migration is guarded and idempotent', () => {
  const db = createFixtureDb();
  try {
    const first = migrateClosedProjectsStatus(db);
    assert.equal(first.updated, CLOSED_EN_PROCESO_IDS.length);
    assert.deepEqual(first.ids.sort((a, b) => a - b), [...CLOSED_EN_PROCESO_IDS].sort((a, b) => a - b));

    for (const id of CLOSED_EN_PROCESO_IDS) {
      const row = db.prepare('SELECT status, closed_at FROM projects WHERE id = ?').get(id);
      assert.equal(row.status, 'Terminado');
      assert.ok(row.closed_at);
    }

    const audits = db.prepare(
      "SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'status_migration' AND module = 'projects'",
    ).get();
    assert.equal(audits.c, CLOSED_EN_PROCESO_IDS.length);

    // Simulate one id already fixed by another path before second run
    db.prepare("UPDATE projects SET status = 'Terminado' WHERE id = 7").run();

    const second = migrateClosedProjectsStatus(db);
    assert.equal(second.updated, 0);
    assert.deepEqual(second.ids, []);

    const auditsAfter = db.prepare(
      "SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'status_migration' AND module = 'projects'",
    ).get();
    assert.equal(auditsAfter.c, CLOSED_EN_PROCESO_IDS.length);

    const untouchedOpen = db.prepare('SELECT status, closed_at FROM projects WHERE id = 1000').get();
    assert.equal(untouchedOpen.status, 'En Proceso');
    assert.equal(untouchedOpen.closed_at, null);
  } finally {
    db.close();
    cleanup();
  }
});

test('migration skips ids that no longer match double guard', () => {
  const db = createFixtureDb();
  try {
    db.prepare("UPDATE projects SET status = 'Terminado' WHERE id = 8").run();
    db.prepare('UPDATE projects SET closed_at = NULL WHERE id = 35').run();

    const result = migrateClosedProjectsStatus(db);
    assert.ok(!result.ids.includes(8));
    assert.ok(!result.ids.includes(35));
    assert.equal(result.updated, CLOSED_EN_PROCESO_IDS.length - 2);

    assert.equal(db.prepare('SELECT status FROM projects WHERE id = 8').get().status, 'Terminado');
    assert.equal(db.prepare('SELECT status FROM projects WHERE id = 35').get().status, 'En Proceso');
  } finally {
    db.close();
    cleanup();
  }
});
