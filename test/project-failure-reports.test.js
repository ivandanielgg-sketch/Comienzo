const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db');
const { migrateProjectFailureReports } = require('../src/db/projectFailureReportsMigration');
const { createFailureReportValidators } = require('../src/projectFailureReports');

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function enumValue(body, field, label, validValues) {
  const value = body[field];
  if (!validValues.includes(value)) {
    throw badRequest(`${label} no es valido.`);
  }
  return value;
}

function requiredText(body, field, label) {
  const value = typeof body[field] === 'string' ? body[field].trim() : '';
  if (!value) {
    throw badRequest(`${label} es obligatorio.`);
  }
  return value;
}

function getActiveEmployeeOrFail(employeeId, label, db) {
  const id = Number(employeeId);
  if (!Number.isFinite(id) || id < 1) {
    throw badRequest(`Seleccione un ${label} activo.`);
  }
  const employee = db.prepare(
    'SELECT id, full_name FROM employees WHERE id = ? AND active = 1',
  ).get(id);
  if (!employee) {
    throw badRequest(`${label} no encontrado o inactivo.`);
  }
  return employee;
}

test('migration creates project_failure_reports table', () => {
  const db = getDb();
  migrateProjectFailureReports(db);

  const table = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='project_failure_reports'",
  ).get();
  assert.ok(table, 'table should exist');
});

test('normalizeFailureReport validates cause and responsibles', () => {
  const db = getDb();
  migrateProjectFailureReports(db);
  const { normalizeFailureReport } = createFailureReportValidators({
    badRequest,
    enumValue,
    requiredText,
    getActiveEmployeeOrFail: (id, label) => getActiveEmployeeOrFail(id, label, db),
  });

  const suffix = String(Date.now());
  const failureEmp = db.prepare(
    'INSERT INTO employees (employee_number, full_name, hire_date, active) VALUES (?, ?, ?, 1)',
  ).run(`FR-${suffix}`, `Falla ${suffix}`, '2020-01-01');
  const solutionEmp = db.prepare(
    'INSERT INTO employees (employee_number, full_name, hire_date, active) VALUES (?, ?, ?, 1)',
  ).run(`FS-${suffix}`, `Solucion ${suffix}`, '2020-01-01');

  const interna = normalizeFailureReport({
    cause: 'interna',
    problem_description: 'Fuga en quemador',
    failure_responsible_employee_id: failureEmp.lastInsertRowid,
    solution_responsible_employee_id: solutionEmp.lastInsertRowid,
  });
  assert.equal(interna.cause, 'interna');
  assert.equal(interna.failure_responsible_employee_id, failureEmp.lastInsertRowid);
  assert.equal(interna.solution_responsible_employee_id, solutionEmp.lastInsertRowid);

  const externa = normalizeFailureReport({
    cause: 'externa',
    problem_description: 'Cliente no entrego acceso',
    solution_responsible_employee_id: solutionEmp.lastInsertRowid,
  });
  assert.equal(externa.cause, 'externa');
  assert.equal(externa.failure_responsible_employee_id, null);

  assert.throws(
    () => normalizeFailureReport({
      cause: 'externa',
      problem_description: 'x',
      failure_responsible_employee_id: failureEmp.lastInsertRowid,
      solution_responsible_employee_id: solutionEmp.lastInsertRowid,
    }),
    /responsable interno/i,
  );

  assert.throws(
    () => normalizeFailureReport({
      cause: 'interna',
      problem_description: 'x',
      solution_responsible_employee_id: solutionEmp.lastInsertRowid,
    }),
    /responsable de la falla/i,
  );
});
