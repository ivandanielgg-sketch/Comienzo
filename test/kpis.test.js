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
  normalizeDepartment,
  normalizeProjectStatus,
  getMarginTrafficLight,
  getCollectionTrafficLight,
  mapKpiEmployee,
  loadActiveKpiEmployees,
  isReportComplete,
  computeSummary,
  KPI_DEPARTMENTS,
  UNAVAILABLE,
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
    `);
    const summary = computeSummary(db, { periodType: 'current_year' });
    assert.ok(summary.ventas);
    assert.notStrictEqual(summary.ventas.close_rate.display, 'NaN');
    assert.strictEqual(summary.has_weighted_score, false);
    assert.strictEqual(summary.has_public_ranking, false);
    assert.ok(summary.ventas.leads_by_channel.display === UNAVAILABLE || typeof summary.ventas.leads_by_channel.value === 'object');
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
    assert.strictEqual(res.status, 200);
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
  });
  it('app.js uses human-readable KPI labels for departments', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    assert.match(js, /KPI_FIELD_LABELS/);
    assert.match(js, /renderDepartmentKpis/);
    assert.match(js, /Cotizaciones enviadas/);
    assert.match(js, /getKpiFieldLabel/);
  });

});
