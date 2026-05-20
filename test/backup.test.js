const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbPath = path.join(os.tmpdir(), `revramb-backup-test-${process.pid}.db`);
process.env.DB_PATH = dbPath;

const { getDb } = require('../src/db');
const {
  BACKUP_SCHEMA_VERSION,
  createBackupPayload,
  analyzeBackup,
  importBackup,
  backupFileName,
  checksum,
} = require('../src/backup');

function insertProject(db, quoteNumber) {
  db.prepare(
    `INSERT INTO projects (
      quote_number, order_number, purchase_order_number, purchase_order_not_applicable,
      seller, client_name, project_description, expected_margin, total_invoiced,
      total_invoiced_currency, progress_percent, technician_name, promised_delivery_date,
      status, risk, observations
    ) VALUES (?, ?, ?, 0, ?, ?, ?, 20, 1000, 'MXN', 10, ?, '2026-01-01', 'Pendiente', 'Bajo', ?)`,
  ).run(quoteNumber, `PED-${quoteNumber}`, `OC-${quoteNumber}`, 'Tester', 'Cliente Backup', 'Proyecto Backup', 'Tecnico', 'Seed');
}

test('backup JSON includes metadata, operational data, and no password hashes', () => {
  const db = getDb();
  insertProject(db, 'BACKUP-QT-001');

  const backup = createBackupPayload(db, { exportedBy: 'admin', environment: 'test' });

  assert.equal(backup.backupMetadata.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(backup.backupMetadata.appName, 'REVRAM Dashboard');
  assert.equal(backup.data.projects.length, 1);
  assert.equal(backup.backupMetadata.recordCounts.projects, 1);
  assert.doesNotMatch(JSON.stringify(backup), /password_hash|admin123|SESSION_SECRET/i);
  assert.match(backupFileName(new Date('2026-01-02T03:04:00Z')), /^REVRAM_BACKUP_2026-01-02_03-04\.json$/);
});

test('preview detects duplicates without modifying data and import only adds missing records', () => {
  const db = getDb();
  const beforeCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  const backup = createBackupPayload(db, { exportedBy: 'admin', environment: 'test' });

  const duplicatePreview = analyzeBackup(db, backup);
  assert.equal(duplicatePreview.summary.projects.duplicates, 1);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM projects').get().count, beforeCount);

  const importBackupPayload = JSON.parse(JSON.stringify(backup));
  importBackupPayload.data.projects[0].quote_number = 'BACKUP-QT-002';
  importBackupPayload.data.projects[0].order_number = 'PED-BACKUP-QT-002';
  importBackupPayload.data.projects[0].purchase_order_number = 'OC-BACKUP-QT-002';
  importBackupPayload.data.projects[0].backupId = 'project:backup-qt-002';
  importBackupPayload.backupMetadata.checksum = checksum(importBackupPayload.data);

  const result = importBackup(db, importBackupPayload, { importedBy: 'admin', fileName: 'backup.json' });

  assert.equal(result.summary.projects.added, 1);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM projects').get().count, beforeCount + 1);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM backup_import_logs').get().count, 1);
});

test.after(() => {
  try {
    fs.unlinkSync(dbPath);
    fs.unlinkSync(`${dbPath}-shm`);
    fs.unlinkSync(`${dbPath}-wal`);
  } catch (_) {
    // Ignore cleanup races from SQLite sidecar files.
  }
});
