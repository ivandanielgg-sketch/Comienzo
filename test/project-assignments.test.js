const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db');
const { migrateProjectEmployeeAssignments } = require('../src/db/projectAssignmentsMigration');

test('migration adds project assignment columns and backfills fecha_vencimiento', () => {
  const db = getDb();
  migrateProjectEmployeeAssignments(db);

  const columns = db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
  assert.ok(columns.includes('fecha_vencimiento'));
  assert.ok(columns.includes('tecnico_id'));
  assert.ok(columns.includes('vendedor_id'));

  const suffix = String(Date.now());
  const techName = `Tecnico Migracion ${suffix}`;
  const vendName = `Vendedor Migracion ${suffix}`;
  const tech = db.prepare(
    'INSERT INTO employees (employee_number, full_name, hire_date, active) VALUES (?, ?, ?, 1)',
  ).run(`T-${suffix}`, techName, '2020-01-01');
  const vend = db.prepare(
    'INSERT INTO employees (employee_number, full_name, hire_date, active) VALUES (?, ?, ?, 1)',
  ).run(`V-${suffix}`, vendName, '2020-01-01');
  const projectInsert = db.prepare(`
    INSERT INTO projects (
      quote_number, order_number, purchase_order_not_applicable,
      seller, client_name, project_description, expected_margin,
      total_invoiced, progress_percent, technician_name, promised_delivery_date,
      status, risk, created_at, updated_at
    ) VALUES (
      ?, 'PED-MIG', 1,
      ?, 'Cliente Mig', 'Proyecto', 10,
      1000, 0, ?, '2026-12-01',
      'Pendiente', 'Bajo', '2026-01-15 10:00:00', '2026-01-15 10:00:00'
    )
  `).run(`MIG-${suffix}`, vendName, techName);
  const projectId = projectInsert.lastInsertRowid;

  migrateProjectEmployeeAssignments(db);

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  assert.ok(row, 'project row should exist');
  assert.ok(row.fecha_vencimiento);
  assert.equal(row.tecnico_id, tech.lastInsertRowid);
  assert.equal(row.vendedor_id, vend.lastInsertRowid);
});
