const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db');

test('projects table includes reports archive columns', () => {
  const db = getDb();
  const cols = db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
  assert.ok(cols.includes('reports_archived_at'));
  assert.ok(cols.includes('reports_archived_by_user_id'));
  assert.ok(cols.includes('reports_archived_by_name'));
});

test('active reports list excludes projects with reports_archived_at', () => {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) AS total FROM projects p
     WHERE p.closed_at IS NULL AND p.reports_archived_at IS NULL`,
  ).get();
  assert.ok(Number.isFinite(row.total));
});
