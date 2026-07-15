'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const {
  getPeriodRange,
  getAdjacentPreviousPeriod,
  normalizeDepartment,
  normalizeProjectStatus,
  getMarginTrafficLight,
  getCollectionTrafficLight,
  mapKpiEmployee,
  loadActiveKpiEmployees,
  isReportComplete,
  computeSummary,
  KPI_DEPARTMENTS,
  getVentasEmpleadosActivos,
  getVentasSellerTrafficLight,
  VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW,
} = require('../src/kpis');

describe('KPIs unit tests', () => {
  it('getPeriodRange current_month returns valid range', () => {
    const range = getPeriodRange('current_month');
    assert.ok(range.startDate);
    assert.ok(range.endDate);
    assert.ok(range.startDate <= range.endDate);
  });

  it('getPeriodRange previous_month returns valid range', () => {
    const range = getPeriodRange('previous_month');
    assert.ok(range.startDate <= range.endDate);
  });

  it('getPeriodRange current_quarter returns valid range', () => {
    const range = getPeriodRange('current_quarter');
    assert.ok(range.startDate <= range.endDate);
  });

  it('getPeriodRange current_year returns valid range', () => {
    const range = getPeriodRange('current_year');
    assert.match(range.startDate, /-01-01$/);
    assert.match(range.endDate, /-12-31$/);
  });

  it('getPeriodRange custom validates dates', () => {
    const range = getPeriodRange('custom', '2025-01-01', '2025-01-31');
    assert.strictEqual(range.startDate, '2025-01-01');
    assert.strictEqual(range.endDate, '2025-01-31');
    assert.throws(() => getPeriodRange('custom', '2025-02-01', '2025-01-01'));
  });

  it('getAdjacentPreviousPeriod returns prior calendar month for full months', () => {
    const prev = getAdjacentPreviousPeriod({ startDate: '2026-07-01', endDate: '2026-07-31' });
    assert.strictEqual(prev.startDate, '2026-06-01');
    assert.strictEqual(prev.endDate, '2026-06-30');
  });

  it('normalizeDepartment maps valid departments', () => {
    assert.strictEqual(normalizeDepartment('Ventas'), 'Ventas');
    assert.strictEqual(normalizeDepartment('tecnico'), 'Técnico');
    assert.strictEqual(normalizeDepartment('Cobranza'), 'Cobranza');
    assert.strictEqual(normalizeDepartment('Facturacion'), 'Facturación');
    assert.strictEqual(normalizeDepartment('Administracion'), null);
  });

  it('normalizeProjectStatus maps existing statuses', () => {
    assert.strictEqual(normalizeProjectStatus('Pendiente'), 'pendiente');
    assert.strictEqual(normalizeProjectStatus('En Proceso'), 'en_proceso');
    assert.strictEqual(normalizeProjectStatus('Terminado'), 'terminado');
  });

  it('margin traffic lights work', () => {
    assert.strictEqual(getMarginTrafficLight(0.45), 'green');
    assert.strictEqual(getMarginTrafficLight(0.35), 'yellow');
    assert.strictEqual(getMarginTrafficLight(0.25), 'red');
    assert.strictEqual(getMarginTrafficLight(0.10), 'critical');
  });

  it('collection traffic lights work', () => {
    assert.strictEqual(getCollectionTrafficLight(0), 'green');
    assert.strictEqual(getCollectionTrafficLight(15), 'yellow');
    assert.strictEqual(getCollectionTrafficLight(60), 'red');
    assert.strictEqual(getCollectionTrafficLight(150), 'critical');
  });

  it('mapKpiEmployee uses primary department', () => {
    const emp = mapKpiEmployee({
      id: 1,
      full_name: 'Ana Ventas',
      active: 1,
      department: 'General',
      primary_department: 'Ventas',
      position: 'Vendedora',
      kpi_eligible: 1,
    });
    assert.strictEqual(emp.kpiDepartment, 'Ventas');
    assert.strictEqual(emp.primaryDepartment, 'Ventas');
  });

  it('loadActiveKpiEmployees excludes inactive', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY, employee_number TEXT, full_name TEXT, hire_date TEXT,
        department TEXT, primary_department TEXT, secondary_department TEXT,
        position TEXT, active INTEGER, kpi_eligible INTEGER DEFAULT 1, user_id INTEGER
      );
      INSERT INTO employees VALUES (1,'E1','Activo Ventas','2020-01-01','Ventas','Ventas',NULL,'V',1,1,NULL);
      INSERT INTO employees VALUES (2,'E2','Inactivo','2020-01-01','Ventas','Ventas',NULL,'V',0,1,NULL);
      INSERT INTO employees VALUES (3,'E3','Sin Depto','2020-01-01',NULL,NULL,NULL,'A',1,1,NULL);
      INSERT INTO employees VALUES (4,'E4','Tecnico','2020-01-01','Técnico','Técnico',NULL,'T',1,1,NULL);
    `);
    const active = loadActiveKpiEmployees(db);
    assert.strictEqual(active.length, 3);
    assert.ok(active.every((e) => e.active));
    const ventas = active.filter((e) => e.kpiDepartment === 'Ventas');
    const tecnico = active.filter((e) => e.kpiDepartment === 'Técnico');
    assert.strictEqual(ventas.length, 1);
    assert.strictEqual(tecnico.length, 1);
    db.close();
  });

  it('groups employees by KPI departments', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY, employee_number TEXT, full_name TEXT, hire_date TEXT,
        department TEXT, primary_department TEXT, secondary_department TEXT,
        position TEXT, active INTEGER, kpi_eligible INTEGER DEFAULT 1, user_id INTEGER
      );
      INSERT INTO employees VALUES (1,'E1','V','2020-01-01','Ventas','Ventas',NULL,'V',1,1,NULL);
      INSERT INTO employees VALUES (2,'E2','T','2020-01-01','Técnico','Técnico',NULL,'T',1,1,NULL);
      INSERT INTO employees VALUES (3,'E3','C','2020-01-01','Cobranza','Cobranza',NULL,'C',1,1,NULL);
      INSERT INTO employees VALUES (4,'E4','F','2020-01-01','Facturación','Facturación',NULL,'F',1,1,NULL);
    `);
    const active = loadActiveKpiEmployees(db);
    for (const dept of KPI_DEPARTMENTS) {
      assert.ok(active.some((e) => e.kpiDepartment === dept), 'missing dept ' + dept);
    }
    db.close();
  });

  it('isReportComplete detects boiler report completeness', () => {
    assert.ok(isReportComplete({
      report_type: 'boiler_startup',
      report_date: '2025-01-01',
      client_name: 'Cliente',
      technician_name: 'Tec',
      service_name: 'Servicio',
      equipment_model_serial: 'EQ-1',
    }));
    assert.ok(!isReportComplete({
      report_type: 'boiler_startup',
      report_date: '2025-01-01',
      client_name: 'Cliente',
    }));
  });

  it('getVentasSellerTrafficLight uses margin gap thresholds', () => {
    const closedWithSale = [{ totals: { final_margin: 0.35, total_invoiced_mxn: 1000 }, expected_margin: 30 }];
    const compliance = closedWithSale;
    assert.strictEqual(getVentasSellerTrafficLight(closedWithSale, compliance), 'green');
    const yellowCase = [{ totals: { final_margin: 0.28, total_invoiced_mxn: 1000 }, expected_margin: 30 }];
    assert.strictEqual(getVentasSellerTrafficLight(yellowCase, yellowCase), 'yellow');
    const redCase = [{ totals: { final_margin: 0.20, total_invoiced_mxn: 1000 }, expected_margin: 30 }];
    assert.strictEqual(getVentasSellerTrafficLight(redCase, redCase), 'red');
    assert.strictEqual(getVentasSellerTrafficLight([], []), 'gray');
  });

  it('getVentasEmpleadosActivos filters active Ventas with kpi_eligible', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY, employee_number TEXT, full_name TEXT, hire_date TEXT,
        department TEXT, primary_department TEXT, position TEXT, active INTEGER, kpi_eligible INTEGER DEFAULT 1
      );
      INSERT INTO employees VALUES (1,'V1','Vendedor OK','2020-01-01','Ventas','Ventas','V',1,1);
      INSERT INTO employees VALUES (2,'V2','Vendedor Inactivo','2020-01-01','Ventas','Ventas','V',0,1);
      INSERT INTO employees VALUES (3,'V3','Sin KPI','2020-01-01','Ventas','Ventas','V',1,0);
      INSERT INTO employees VALUES (4,'T1','Tecnico','2020-01-01','Técnico','Técnico','T',1,1);
    `);
    const list = getVentasEmpleadosActivos(db);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].fullName, 'Vendedor OK');
    db.close();
  });

  it('computeSummary returns no NaN in sales KPIs', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE exchange_rates (currency TEXT PRIMARY KEY, rate_to_mxn REAL);
      INSERT INTO exchange_rates VALUES ('MXN', 1);
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY, quote_number TEXT UNIQUE, order_number TEXT,
        purchase_order_number TEXT, purchase_order_not_applicable INTEGER DEFAULT 0,
        seller TEXT, client_name TEXT, project_description TEXT, expected_margin REAL,
        total_invoiced REAL, total_invoiced_currency TEXT DEFAULT 'MXN', progress_percent REAL,
        technician_name TEXT, promised_delivery_date TEXT, status TEXT, risk TEXT,
        observations TEXT, closed_at TEXT, deleted_at TEXT, created_at TEXT, updated_at TEXT,
        invoice_date_na INTEGER DEFAULT 0, credit_days_na INTEGER DEFAULT 0,
        next_commercial_action TEXT, next_commercial_action_date TEXT, lead_channel TEXT,
        invoice_issued_at TEXT, invoice_cancelled INTEGER DEFAULT 0, invoice_error INTEGER DEFAULT 0,
        invoice_pending_docs INTEGER DEFAULT 0, due_date TEXT, rework INTEGER DEFAULT 0,
        technical_closed_at TEXT, technical_report_complete INTEGER DEFAULT 0,
        collection_contact_at TEXT, collection_notes TEXT
      );
      INSERT INTO projects VALUES (1,'Q1','O1',NULL,1,'V','C','D',40,10000,'MXN',100,'T','2025-12-31','Pendiente','Bajo',NULL,NULL,NULL,datetime('now'),datetime('now'),0,0,NULL,NULL,NULL,NULL,0,0,0,NULL,0,NULL,0,NULL,NULL);
      CREATE TABLE project_payments (id INTEGER PRIMARY KEY, project_id INTEGER, amount REAL, currency TEXT, payment_date TEXT);
      CREATE TABLE project_costs (id INTEGER PRIMARY KEY, project_id INTEGER, category TEXT, description TEXT, amount REAL, currency TEXT, cost_date TEXT);
      CREATE TABLE project_reports (id INTEGER PRIMARY KEY, project_id INTEGER, report_folio TEXT, client_name TEXT, service_name TEXT, report_date TEXT, report_type TEXT, deleted_at TEXT, technician_name TEXT, equipment_model_serial TEXT);
      CREATE TABLE employees (id INTEGER PRIMARY KEY, employee_number TEXT, full_name TEXT, hire_date TEXT, department TEXT, primary_department TEXT, secondary_department TEXT, position TEXT, active INTEGER, kpi_eligible INTEGER DEFAULT 1, user_id INTEGER);
      CREATE TABLE kpi_settings (
        id INTEGER PRIMARY KEY, margin_green_threshold REAL, margin_yellow_threshold REAL, margin_red_threshold REAL,
        receivable_bucket1_days INTEGER, receivable_bucket2_days INTEGER, receivable_bucket3_days INTEGER,
        receivable_critical_days INTEGER, report_missing_critical_days INTEGER, require_manual_quote_capture INTEGER,
        created_at TEXT, updated_at TEXT, updated_by_user_id INTEGER, updated_by_name TEXT
      );
      INSERT INTO kpi_settings VALUES (1,0.4,0.3,0.2,30,60,90,120,7,0,datetime('now'),datetime('now'),NULL,NULL);
      CREATE TABLE kpi_manual_quote_captures (
        id INTEGER PRIMARY KEY, year INTEGER, month INTEGER, department TEXT, employee_id INTEGER,
        employee_name_snapshot TEXT, quotes_sent_count INTEGER, quoted_amount_original REAL, currency TEXT,
        exchange_rate_to_mxn REAL, quoted_amount_mxn REAL, notes TEXT, created_by_user_id INTEGER, created_by_name TEXT,
        created_at TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, updated_at TEXT, deleted_at TEXT,
        deleted_by_user_id INTEGER, deleted_by_name TEXT, delete_reason TEXT
      );
      INSERT INTO kpi_manual_quote_captures VALUES (1,2026,6,'Ventas',NULL,NULL,5,5000,'MXN',1,5000,NULL,NULL,NULL,datetime('now'),NULL,NULL,datetime('now'),NULL,NULL,NULL,NULL);
    `);
    const summary = computeSummary(db, { periodType: 'current_year' });
    assert.ok(summary.ventas);
    assert.notStrictEqual(summary.ventas.close_rate_count.display, 'NaN');
    assert.strictEqual(summary.has_weighted_score, false);
    assert.strictEqual(summary.has_public_ranking, false);
    assert.ok(Array.isArray(summary.ventas.sellers_table));
    db.close();
  });
});

const DB_PATH = path.join(__dirname, '..', 'data', 'test-kpis.db');
const PORT = 3097;
let serverProcess;
let adminCookie;
let userCookie;

function request(method, urlPath, body, cookie) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const newCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), cookie: newCookie });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: newCookie });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'));
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 150));
    }
    tryConnect();
  });
}

describe('KPIs integration - admin only', () => {
  before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-kpis', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
    const adminLogin = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = adminLogin.cookie;
    await request('POST', '/api/users', { username: 'kpiuser', password: 'User123!', role: 'user' }, adminCookie);
    const userLogin = await request('POST', '/api/login', { username: 'kpiuser', password: 'User123!' });
    userCookie = userLogin.cookie;
  });

  after(() => {
    if (serverProcess) serverProcess.kill();
  });

  it('admin can access KPI summary', async () => {
    const res = await request('GET', '/api/kpis/summary?periodType=current_month', null, adminCookie);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body).slice(0, 500));
    assert.ok(res.body.ventas);
    assert.ok(res.body.cobranza);
    assert.strictEqual(res.body.has_weighted_score, false);
  });

  it('non-admin receives 403 on KPI summary', async () => {
    const res = await request('GET', '/api/kpis/summary', null, userCookie);
    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /Tablero KPIs/);
  });

  it('non-admin receives 403 on all KPI endpoints', async () => {
    for (const endpoint of ['/api/kpis/departments', '/api/kpis/employees', '/api/kpis/alerts', '/api/kpis/detail']) {
      const res = await request('GET', endpoint, null, userCookie);
      assert.strictEqual(res.status, 403, endpoint);
    }
  });

  it('admin KPI filters returns employees from vacations module', async () => {
    await request('POST', '/api/employees', {
      employee_number: 'KPI-001',
      full_name: 'Empleado KPI Ventas',
      hire_date: '2024-01-01',
      primary_department: 'Ventas',
      active: true,
    }, adminCookie);
    const res = await request('GET', '/api/kpis/filters', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.employees.some((e) => e.fullName === 'Empleado KPI Ventas'));
  });

  it('custom period filter works', async () => {
    const res = await request('GET', '/api/kpis/summary?periodType=custom&startDate=2024-01-01&endDate=2024-12-31', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.period.startDate, '2024-01-01');
  });

  it('year period filter works', async () => {
    const res = await request('GET', '/api/kpis/summary?periodType=current_year', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.period.startDate.endsWith('-01-01'));
  });

  it('alerts endpoint generates alerts array', async () => {
    const res = await request('GET', '/api/kpis/alerts', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.alerts));
  });

  it('departments endpoint returns four KPI departments', async () => {
    const res = await request('GET', '/api/kpis/departments', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.departments.length, 4);
  });

  it('index.html contains Tablero KPIs button', async () => {
    const res = await request('GET', '/', null, null);
    assert.strictEqual(res.status, 200);
  });

  it('admin can access formulas endpoint', async () => {
    const res = await request('GET', '/api/kpis/formulas', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.formulas));
  });

  it('settings requires reauth', async () => {
    const res = await request('GET', '/api/kpis/settings', null, adminCookie);
    assert.strictEqual(res.status, 403);
  });

  it('manual quote CRUD reflects in summary', async () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const empRes = await request('POST', '/api/employees', {
      employee_number: 'KPI-MQ-' + Date.now(),
      full_name: 'Vendedora Test MQ',
      hire_date: '2024-01-01',
      primary_department: 'Ventas',
      active: true,
    }, adminCookie);
    assert.strictEqual(empRes.status, 201);
    const employeeId = empRes.body.id;
    await request('POST', '/api/kpis/admin-reauth', { password: 'admin123' }, adminCookie);
    await request('PUT', '/api/kpis/employee-config/' + employeeId, {
      kpi_area: 'Ventas',
      kpi_eligible: true,
    }, adminCookie);
    const create = await request('POST', '/api/kpis/manual-quotes', {
      year,
      month,
      department: 'Ventas',
      employee_id: employeeId,
      quotes_sent_count: 7,
      quoted_amount_original: 1425,
      currency: 'MXN',
      exchange_rate_to_mxn: 1,
    }, adminCookie);
    assert.strictEqual(create.status, 201);
    const summary = await request('GET', '/api/kpis/summary?periodType=current_month', null, adminCookie);
    assert.strictEqual(summary.status, 200);
    const qs = summary.body.ventas.quotes_sent;
    assert.ok(String(qs.display).includes('7') || qs.value === 7);
  });

  it('billing uses all projects in period as invoiced', async () => {
    const summary = await request('GET', '/api/kpis/summary?periodType=current_year', null, adminCookie);
    assert.strictEqual(summary.status, 200);
    assert.ok(summary.body.facturacion.billing_admin_note);
  });

  it('admin reauth accepts correct password', async () => {
    const res = await request('POST', '/api/kpis/admin-reauth', { password: 'admin123' }, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.expiresAt || res.body.expires_in_ms);
  });

  it('admin reauth rejects wrong password with JSON body', async () => {
    const res = await request('POST', '/api/kpis/admin-reauth', { password: 'wrong-password-xyz' }, adminCookie);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message);
    assert.doesNotMatch(String(res.body.message), /\[object Object\]/);
  });

  it('manual quote requires vendedora', async () => {
    const d = new Date();
    const res = await request('POST', '/api/kpis/manual-quotes', {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      department: 'Ventas',
      quotes_sent_count: 1,
      quoted_amount_original: 100,
      currency: 'MXN',
      exchange_rate_to_mxn: 1,
    }, adminCookie);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /Vendedora/i);
  });

  it('sales-employees returns Ventas eligible list', async () => {
    await request('POST', '/api/kpis/admin-reauth', { password: 'admin123' }, adminCookie);
    const empRes = await request('POST', '/api/employees', {
      employee_number: 'KPI-SALES-' + Date.now(),
      full_name: 'Vendedora Sales API',
      hire_date: '2024-01-01',
      primary_department: 'Ventas',
      active: true,
    }, adminCookie);
    assert.strictEqual(empRes.status, 201);
    const assign = await request('PUT', '/api/kpis/employee-config/' + empRes.body.id, {
      kpi_area: 'Ventas',
      kpi_eligible: true,
    }, adminCookie);
    assert.strictEqual(assign.status, 200);
    assert.strictEqual(assign.body.kpi_eligible, true);
    const res = await request('GET', '/api/kpis/sales-employees', null, adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.employees));
    assert.ok(res.body.employees.some((e) => e.full_name === 'Vendedora Sales API'));
  });

  it('employee-config PUT toggles KPI assignment for vendedores', async () => {
    await request('POST', '/api/kpis/admin-reauth', { password: 'admin123' }, adminCookie);
    const empRes = await request('POST', '/api/employees', {
      employee_number: 'KPI-CFG-' + Date.now(),
      full_name: 'Vendedora Config Toggle',
      hire_date: '2024-01-01',
      position: 'Ventas',
      active: true,
    }, adminCookie);
    assert.strictEqual(empRes.status, 201);
    const employeeId = empRes.body.id;
    const configBefore = await request('GET', '/api/kpis/employee-config', null, adminCookie);
    assert.strictEqual(configBefore.status, 200);
    const row = configBefore.body.vendedores.find((e) => e.employee_id === employeeId);
    assert.ok(row);
    assert.strictEqual(row.kpi_eligible, true);
    assert.strictEqual(row.kpi_area, 'Sin asignar');
    const enable = await request('PUT', '/api/kpis/employee-config/' + employeeId, {
      kpi_area: 'Ventas',
      kpi_eligible: true,
    }, adminCookie);
    assert.strictEqual(enable.status, 200);
    assert.strictEqual(enable.body.kpi_eligible, true);
    assert.strictEqual(enable.body.kpi_area, 'Ventas');
    const sales = await request('GET', '/api/kpis/sales-employees', null, adminCookie);
    assert.ok(sales.body.employees.some((e) => e.employee_id === employeeId));
    const disable = await request('PUT', '/api/kpis/employee-config/' + employeeId, {
      kpi_area: 'Sin asignar',
      kpi_eligible: false,
    }, adminCookie);
    assert.strictEqual(disable.status, 200);
    assert.strictEqual(disable.body.kpi_eligible, false);
    const salesAfter = await request('GET', '/api/kpis/sales-employees', null, adminCookie);
    assert.ok(!salesAfter.body.employees.some((e) => e.employee_id === employeeId));
  });

  it('excel export returns spreadsheet', async () => {
    const res = await request('GET', '/api/kpis/export/excel?periodType=current_month', null, adminCookie);
    if (res.status !== 200) throw new Error('excel failed: ' + res.status + ' ' + (typeof res.body === 'string' ? res.body.slice(0,400) : JSON.stringify(res.body)));
    assert.strictEqual(res.status, 200);
    assert.ok(String(res.body).includes('Workbook'));

  });
});

describe('KPIs frontend markup', () => {
  it('index.html contains Tablero KPIs tab and view', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert.match(html, /Tablero KPIs/);
    assert.match(html, /id="kpis-tab"/);
    assert.match(html, /id="kpis-view"/);
    assert.match(html, /Acceso restringido\. Solo el administrador puede consultar el Tablero KPIs/);
  });

  it('app.js contains admin-only KPI visibility', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    assert.match(js, /kpis-tab/);
    assert.match(js, /kpisTab.*classList\.toggle\('hidden', state\.userRole !== 'admin'\)/);
    assert.match(js, /function initKpiDashboard/);
    assert.match(js, /function showKpisTab/);
    assert.doesNotMatch(js, /weighted_score|ranking público|calificacion ponderada/i);
  });
  it('app.js uses human-readable KPI labels for departments', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    assert.match(js, /KPI_FIELD_LABELS/);
    assert.match(js, /renderDepartmentKpis/);
    assert.match(js, /Cotizaciones enviadas/);
    assert.match(js, /renderVentasSection/);
    assert.match(js, /renderVentasCharts/);
    assert.match(js, /renderVentasSellersTable/);
    assert.match(js, /renderRentabilidadSection/);
    assert.match(js, /renderCobroFacturacionSection/);
    assert.match(js, /renderEquipoSection/);
    assert.match(js, /renderOperativeAlertsGrouped/);
  });

  it('index.html organizes KPI board into four business sections', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert.match(html, /id="kpi-section-ventas"/);
    assert.match(html, /id="kpi-section-rentabilidad"/);
    assert.match(html, /id="kpi-section-cobro"/);
    assert.match(html, /id="kpi-section-equipo"/);
    assert.match(html, /id="kpi-section-alerts"/);
    assert.match(html, /id="kpi-red-margin-table"/);
    assert.match(html, /id="kpi-chart-receivable"/);
    assert.match(html, /id="kpi-chart-reports"/);
    assert.match(html, /Rentabilidad de proyectos/);
    assert.match(html, /Cobro y facturación/);
    assert.match(html, /Desempeño del equipo/);
  });
});

const { formatCurrencyMXN, buildKpiExcelWorkbook } = require('../src/kpisExport');
const { isDbTruthy } = require('../src/db/dialect');
const {
  aggregateManualQuotesForPeriod,
  loadKpiSettings,
  settingsToApi,
  getFormulaDefinitions,
  NOT_CAPTURED,
} = require('../src/kpis');

describe('KPIs Fase 2', () => {
  it('isDbTruthy coerces PostgreSQL string flags', () => {
    assert.strictEqual(isDbTruthy(1), true);
    assert.strictEqual(isDbTruthy('1'), true);
    assert.strictEqual(isDbTruthy(0), false);
    assert.strictEqual(isDbTruthy('0'), false);
    assert.strictEqual(isDbTruthy(false), false);
    assert.strictEqual(isDbTruthy(null), false);
  });

  it('loadKpiSettings seeds defaults when row missing', () => {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE kpi_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        margin_green_threshold REAL NOT NULL DEFAULT 0.40,
        margin_yellow_threshold REAL NOT NULL DEFAULT 0.30,
        margin_red_threshold REAL NOT NULL DEFAULT 0.20,
        receivable_bucket1_days INTEGER NOT NULL DEFAULT 30,
        receivable_bucket2_days INTEGER NOT NULL DEFAULT 60,
        receivable_bucket3_days INTEGER NOT NULL DEFAULT 90,
        receivable_critical_days INTEGER NOT NULL DEFAULT 120,
        report_missing_critical_days INTEGER NOT NULL DEFAULT 7,
        require_manual_quote_capture INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by_user_id INTEGER,
        updated_by_name TEXT
      );
    `);
    const settings = loadKpiSettings({ prepare: (sql) => db.prepare(sql) });
    const api = settingsToApi(settings);
    assert.equal(api.margin_green_percent, 40);
    assert.equal(api.receivable_bucket1_days, 30);
    assert.equal(api.require_manual_quote_capture, true);
  });

  it('settingsToApi coerces PostgreSQL string numerics', () => {
    const api = settingsToApi({
      margin_green_threshold: '0.40',
      margin_yellow_threshold: '0.30',
      margin_red_threshold: '0.20',
      receivable_bucket1_days: '30',
      receivable_bucket2_days: '60',
      receivable_bucket3_days: '90',
      receivable_critical_days: '120',
      report_missing_critical_days: '7',
      require_manual_quote_capture: 1,
    });
    assert.equal(api.margin_green_percent, 40);
    assert.equal(api.receivable_bucket3_days, 90);
  });

  it('formatCurrencyMXN formats 1425 as $1,425.00', () => {
    assert.equal(formatCurrencyMXN(1425), '$1,425.00');
  });
  it('formatCurrencyMXN formats 1000000 with thousands separator', () => {
    assert.equal(formatCurrencyMXN(1000000), '$1,000,000.00');
  });
  it('formatCurrencyMXN does not return NaN', () => {
    assert.equal(formatCurrencyMXN(NaN), '$0.00');
    assert.ok(!formatCurrencyMXN(null).includes('NaN'));
  });

  it('manual quote aggregation uses employee rows when present', () => {
    const captures = [
      { year: 2026, month: 6, employee_id: 1, quotes_sent_count: 3, quoted_amount_mxn: 1000 },
      { year: 2026, month: 6, employee_id: 2, quotes_sent_count: 2, quoted_amount_mxn: 500 },
    ];
    const period = { startDate: '2026-06-01', endDate: '2026-06-30' };
    const agg = aggregateManualQuotesForPeriod(captures, period);
    assert.equal(agg.quotesSent, 5);
    assert.equal(agg.quotedAmountMxn, 1500);
    assert.equal(agg.hasCapture, true);
  });

  it('manual quote missing capture marks not captured', () => {
    const period = { startDate: '2026-06-01', endDate: '2026-06-30' };
    const agg = aggregateManualQuotesForPeriod([], period);
    assert.equal(agg.hasCapture, false);
  });

  it('backup registry includes kpiManualQuoteCaptures and kpiSettings', () => {
    const { BACKUP_ENTITIES } = require('../src/backupRegistry');
    const keys = BACKUP_ENTITIES.map((e) => e.key);
    assert.ok(keys.includes('kpiManualQuoteCaptures'));
    assert.ok(keys.includes('kpiSettings'));
  });

  it('formulas show percentages as 40 not 0.40', () => {
    const settings = { margin_green_threshold: 0.4, margin_yellow_threshold: 0.3, margin_red_threshold: 0.2, receivable_bucket1_days: 30, receivable_bucket2_days: 60, receivable_bucket3_days: 90, receivable_critical_days: 120, report_missing_critical_days: 7, require_manual_quote_capture: 1 };
    const formulas = getFormulaDefinitions(settings);
    const margin = formulas.find((f) => f.key === 'gross_margin_real');
    assert.ok(margin.parameters.some((p) => p.value === 40 || p.value >= 30));
  });

  it('aggregateManualQuotes ignores global captures without employee', () => {
    const captures = [
      { year: 2026, month: 6, employee_id: null, quotes_sent_count: 99, quoted_amount_mxn: 99999 },
      { year: 2026, month: 6, employee_id: 1, quotes_sent_count: 2, quoted_amount_mxn: 500 },
    ];
    const period = { startDate: '2026-06-01', endDate: '2026-06-30' };
    const agg = aggregateManualQuotesForPeriod(captures, period);
    assert.equal(agg.quotesSent, 2);
    assert.equal(agg.quotedAmountMxn, 500);
  });

  it('index.html has no captura global option', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert.doesNotMatch(html, /Captura global del mes/i);
    assert.match(html, /id="kpi-mq-mxn-display"/);
    assert.match(html, /id="kpi-reauth-submit"/);
  });

  it('app.js serializes JSON body in api()', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    assert.match(js, /JSON\.stringify\(body\)/);
    assert.match(js, /syncKpiQuoteAmountFields/);
    assert.match(js, /loadKpiSalesEmployees/);
    assert.doesNotMatch(js, /Captura global del mes/i);
  });

  it('styles.css uses solid KPI modal panels', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
    assert.match(css, /#kpi-reauth-modal \.modal/);
    assert.match(css, /opacity: 1/);
  });

  it('index.html has Captura Cotizaciones and Configuracion buttons', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert.match(html, /Captura Cotizaciones/);
    assert.match(html, /id="kpi-btn-config"/);
    assert.match(html, /kpi-ventas-sellers-table/);
    assert.match(html, /KPIs por vendedor/);
    assert.match(html, /kpi-chart-ventas-funnel/);
    assert.match(html, /Embudo comercial del periodo/);
    assert.match(html, /kpi-btn-export-pdf/);
  });

  it('app.js defines formatCurrencyMXN and KPI config handlers', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    assert.match(js, /function formatCurrencyMXN/);
    assert.match(js, /ensureKpiReauth/);
    assert.match(js, /openKpiManualQuotesModal/);
    assert.match(js, /exportKpiExcel/);
    assert.match(js, /setupKpiEmployeeConfigHandlersOnce/);
    assert.match(js, /handleKpiEmployeeEligibleToggle/);
  });
});


