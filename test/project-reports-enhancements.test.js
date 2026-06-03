const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db');

test('schema includes executed_by and archive columns on reports tables', () => {
  const db = getDb();

  const reportCols = db.prepare('PRAGMA table_info(project_reports)').all().map((c) => c.name);
  assert.ok(reportCols.includes('executed_by_employee_id'));
  assert.ok(reportCols.includes('archived_at'));
  assert.ok(reportCols.includes('archived_by_name'));

  const failureCols = db.prepare('PRAGMA table_info(project_failure_reports)').all().map((c) => c.name);
  assert.ok(failureCols.includes('archived_at'));
});
