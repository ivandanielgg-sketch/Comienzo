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
