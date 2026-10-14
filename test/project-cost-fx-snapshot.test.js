'use strict';

/**
 * Etapa 6.2 — snapshots historicos de costos.
 * SQLite desechable. No toca produccion ni rellena costos antiguos.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const {
  buildProjectTotals,
  captureCostFxSnapshot,
  resolveCostSnapshot,
} = require('../src/calculations');
const { analyzeClosedProject } = require('../src/closedProjectsAnalysis');
const {
  migrateProjectCostFx,
  assertProjectCostFxColumns,
} = require('../src/db/projectCostFxMigration');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-project-cost-fx-snapshot.db');
const PORT = 3094;

let serverProcess;
let adminCookie;
let serverLogs = '';

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
        const newCookie = res.headers['set-cookie']
          ? res.headers['set-cookie'][0].split(';')[0]
          : null;
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

function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server start timeout\n${serverLogs}`));
      }
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 100));
    }
    tryConnect();
  });
}

function openDb() {
  return require('better-sqlite3')(DB_PATH);
}

function costBody(overrides = {}) {
  return {
    category: 'Materiales',
    description: 'Material de prueba',
    amount: 50,
    currency: 'MXN',
    cost_date: '2024-05-01',
    ...overrides,
  };
}

function projectBody(overrides = {}) {
  return {
    quote_number: `CFX-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: '770',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente costos',
    project_description: 'Snapshot de costos',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    invoice_number: 'FAC-CFX',
    invoice_date: '2026-01-15',
    credit_days: 0,
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

async function setRates(usd, eur) {
  const res = await request('PUT', '/api/exchange-rates', { USD: usd, EUR: eur }, adminCookie);
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

async function createProject(overrides) {
  const res = await request('POST', '/api/projects', projectBody(overrides), adminCookie);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function addCost(projectId, overrides) {
  const res = await request('POST', `/api/projects/${projectId}/costs`, costBody(overrides), adminCookie);
  return res;
}

function storedCost(projectId, description) {
  const db = openDb();
  const row = db.prepare(
    'SELECT * FROM project_costs WHERE project_id = ? AND description = ?',
  ).get(projectId, description);
  db.close();
  return row;
}

test('capture and edit policy do not invent a rate of 1', () => {
  assert.deepEqual(captureCostFxSnapshot(80, 'MXN', {}), {
    exchange_rate_to_mxn: 1,
    amount_mxn: 80,
  });
  assert.deepEqual(captureCostFxSnapshot(10, 'USD', { USD: 17.5 }), {
    exchange_rate_to_mxn: 17.5,
    amount_mxn: 175,
  });
  assert.deepEqual(captureCostFxSnapshot(4, 'EUR', { EUR: 21.25 }), {
    exchange_rate_to_mxn: 21.25,
    amount_mxn: 85,
  });
  assert.deepEqual(captureCostFxSnapshot(3, 'USD', { USD: 1 }), {
    exchange_rate_to_mxn: 1,
    amount_mxn: 3,
  });
  assert.throws(
    () => captureCostFxSnapshot(10, 'USD', { EUR: 19 }),
    (error) => error.code === 'MISSING_EXCHANGE_RATE' && error.statusCode === 400,
  );
  assert.throws(
    () => captureCostFxSnapshot(10, 'EUR', { EUR: 0 }),
    (error) => error.code === 'MISSING_EXCHANGE_RATE',
  );

  const legacy = { amount: 10, currency: 'USD', exchange_rate_to_mxn: null, amount_mxn: null };
  assert.deepEqual(
    resolveCostSnapshot(legacy, { amount: 10, currency: 'USD', description: 'nota' }, { USD: 20 }),
    { exchange_rate_to_mxn: null, amount_mxn: null },
  );
  assert.deepEqual(
    resolveCostSnapshot(
      { amount: 10, currency: 'USD', exchange_rate_to_mxn: 17, amount_mxn: 170 },
      { amount: 12, currency: 'USD' },
      { USD: 20 },
    ),
    { exchange_rate_to_mxn: 20, amount_mxn: 240 },
  );
  assert.deepEqual(
    resolveCostSnapshot(
      { amount: 10, currency: 'USD', exchange_rate_to_mxn: 17, amount_mxn: 170 },
      { amount: 10, currency: 'MXN' },
      { USD: 20 },
    ),
    { exchange_rate_to_mxn: 1, amount_mxn: 10 },
  );

  const snap = buildProjectTotals(
    { total_invoiced: 1000, total_invoiced_currency: 'MXN', invoiced_amount_mxn: 1000 },
    [],
    [{ amount: 10, currency: 'USD', amount_mxn: 170, exchange_rate_to_mxn: 17 }],
    { USD: 25 },
  );
  assert.equal(snap.spent, 170);
  const live = buildProjectTotals(
    { total_invoiced: 1000, total_invoiced_currency: 'MXN' },
    [],
    [{ amount: 10, currency: 'USD', amount_mxn: null }],
    { USD: 25 },
  );
  assert.equal(live.spent, 250);

  const closedNew = analyzeClosedProject(
    { total_invoiced: 1000, total_invoiced_currency: 'MXN', invoiced_amount_mxn: 1000 },
    [],
    [{ amount: 10, currency: 'USD', amount_mxn: 170 }],
  );
  assert.equal(closedNew.costs.complete, true);
  assert.equal(closedNew.costs.amount_mxn, 170);
  const closedOld = analyzeClosedProject(
    { total_invoiced: 1000, total_invoiced_currency: 'MXN', invoiced_amount_mxn: 1000 },
    [],
    [{ amount: 10, currency: 'USD', amount_mxn: null }],
  );
  assert.equal(closedOld.costs.complete, false);
  assert.equal(closedOld.costs.amount_mxn, null);
  assert.equal(closedOld.costs.reason, 'sin_snapshot_fx');
  assert.equal(closedOld.profit.amount_mxn, null);
});

test('sqlite cost FX migration is idempotent, nullable, and fails loud', () => {
  const Database = require('better-sqlite3');
  const tmp = path.join(__dirname, '..', 'data', 'test-cost-fx-migration.db');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  for (const file of [tmp, `${tmp}-wal`, `${tmp}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const db = new Database(tmp);
  db.exec(`
    CREATE TABLE project_costs (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,
      amount REAL,
      currency TEXT,
      cost_date TEXT
    );
    INSERT INTO project_costs (id, project_id, amount, currency, cost_date)
    VALUES (1, 1, 40, 'USD', '2022-01-01');
  `);
  migrateProjectCostFx(db, { postgres: false });
  migrateProjectCostFx(db, { postgres: false });
  const columns = db.prepare('PRAGMA table_info(project_costs)').all();
  for (const name of ['exchange_rate_to_mxn', 'amount_mxn']) {
    const column = columns.find((item) => item.name === name);
    assert.ok(column, name);
    assert.equal(column.notnull, 0);
    assert.equal(column.dflt_value, null);
  }
  const row = db.prepare('SELECT amount, currency, cost_date, exchange_rate_to_mxn, amount_mxn FROM project_costs WHERE id = 1').get();
  assert.equal(row.amount, 40);
  assert.equal(row.currency, 'USD');
  assert.equal(row.cost_date, '2022-01-01');
  assert.equal(row.exchange_rate_to_mxn, null);
  assert.equal(row.amount_mxn, null);
  db.close();
  fs.unlinkSync(tmp);

  const bare = new Database(':memory:');
  bare.exec('CREATE TABLE project_costs (id INTEGER PRIMARY KEY, amount REAL)');
  assert.throws(
    () => assertProjectCostFxColumns(bare, { postgres: false }),
    /project_costs\.exchange_rate_to_mxn/,
  );
  bare.close();

  assert.throws(
    () => migrateProjectCostFx({
      exec() {
        throw new Error('alter failed');
      },
    }, { postgres: true }),
    /alter failed/,
  );
});

test('project cost FX snapshots API (SQLite)', async (t) => {
  await t.before(async () => {
    for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    serverLogs = '';
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_PATH,
        SESSION_SECRET: 'test-cost-fx-snapshot',
        ADMIN_PASSWORD: 'admin123',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProcess.stdout.on('data', (chunk) => { serverLogs += chunk.toString(); });
    serverProcess.stderr.on('data', (chunk) => { serverLogs += chunk.toString(); });
    await waitForServer();
    const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = login.cookie;
    assert.ok(adminCookie);
    await setRates(17, 19);
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      try { fs.unlinkSync(file); } catch { /* already removed */ }
    }
  });

  await t.test('A B C new MXN USD and EUR costs capture the rate in force', async () => {
    const project = await createProject();
    const mxn = await addCost(project.id, { description: 'MXN nuevo', amount: 125.5, currency: 'MXN' });
    assert.equal(mxn.status, 201);
    const usd = await addCost(project.id, { description: 'USD nuevo', amount: 10, currency: 'USD', cost_date: '2023-01-15' });
    assert.equal(usd.status, 201);
    const eur = await addCost(project.id, { description: 'EUR nuevo', amount: 4, currency: 'EUR', cost_date: '2025-08-01' });
    assert.equal(eur.status, 201);

    const mxnRow = storedCost(project.id, 'MXN nuevo');
    const usdRow = storedCost(project.id, 'USD nuevo');
    const eurRow = storedCost(project.id, 'EUR nuevo');
    assert.equal(mxnRow.exchange_rate_to_mxn, 1);
    assert.equal(mxnRow.amount_mxn, 125.5);
    assert.equal(mxnRow.cost_date, '2024-05-01');
    assert.equal(usdRow.exchange_rate_to_mxn, 17);
    assert.equal(usdRow.amount_mxn, 170);
    assert.equal(usdRow.cost_date, '2023-01-15');
    assert.equal(eurRow.exchange_rate_to_mxn, 19);
    assert.equal(eurRow.amount_mxn, 76);
    assert.equal(eurRow.cost_date, '2025-08-01');
    assert.equal(project.total_invoiced, 1000);
  });

  await t.test('D later exchange rate change keeps snapshotted cost MXN', async () => {
    const project = await createProject();
    const created = await addCost(project.id, { description: 'USD fijo', amount: 10, currency: 'USD' });
    assert.equal(created.body.spent, 170);
    await setRates(20, 22);
    const again = await request('GET', `/api/projects/${project.id}`, null, adminCookie);
    assert.equal(again.status, 200);
    assert.equal(again.body.spent, 170);
    const cost = again.body.costs.find((item) => item.description === 'USD fijo');
    assert.equal(cost.amount_mxn, 170);
    assert.equal(cost.amount_mxn_is_historical, true);
    assert.equal(cost.exchange_rate_to_mxn, 17);
    await setRates(17, 19);
  });

  await t.test('E legacy cost without snapshot stays unknown', async () => {
    const project = await createProject();
    const db = openDb();
    db.prepare(
      `INSERT INTO project_costs (
         project_id, category, description, amount, currency, cost_date, exchange_rate_to_mxn, amount_mxn
       ) VALUES (?, 'Otros', 'Antiguo', 10, 'USD', '2020-01-01', NULL, NULL)`,
    ).run(project.id);
    db.close();
    await setRates(20, 22);
    const viewed = await request('GET', `/api/projects/${project.id}`, null, adminCookie);
    const cost = viewed.body.costs.find((item) => item.description === 'Antiguo');
    assert.equal(cost.amount_mxn_is_historical, false);
    assert.equal(cost.amount_mxn, 200);
    const row = storedCost(project.id, 'Antiguo');
    assert.equal(row.amount_mxn, null);
    assert.equal(row.exchange_rate_to_mxn, null);
    assert.equal(row.amount, 10);
    await setRates(17, 19);
  });

  await t.test('F missing USD rate rejects the cost', async () => {
    const project = await createProject();
    const db = openDb();
    db.prepare("DELETE FROM exchange_rates WHERE currency = 'USD'").run();
    db.close();
    const rejected = await addCost(project.id, { description: 'Sin tasa', amount: 10, currency: 'USD' });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.message, /USD/);
    assert.equal(storedCost(project.id, 'Sin tasa'), undefined);
    await setRates(17, 19);
    const restored = await addCost(project.id, { description: 'Con tasa', amount: 10, currency: 'USD' });
    assert.equal(restored.status, 201);
    assert.equal(storedCost(project.id, 'Con tasa').amount_mxn, 170);
  });

  await t.test('G H I edits preserve or replace the snapshot coherently', async () => {
    const project = await createProject();
    await addCost(project.id, { description: 'Editable', amount: 10, currency: 'USD', cost_date: '2024-02-02' });
    const before = storedCost(project.id, 'Editable');
    await setRates(20, 22);

    const described = await request('PUT', `/api/projects/${project.id}/costs/${before.id}`, costBody({
      description: 'Solo texto',
      category: 'Compra',
      amount: 10,
      currency: 'USD',
      cost_date: '2021-07-07',
    }), adminCookie);
    assert.equal(described.status, 200, JSON.stringify(described.body));
    const afterText = storedCost(project.id, 'Solo texto');
    assert.equal(afterText.exchange_rate_to_mxn, 17);
    assert.equal(afterText.amount_mxn, 170);
    assert.equal(afterText.cost_date, '2021-07-07');
    assert.equal(afterText.category, 'Compra');
    assert.equal(afterText.amount, 10);

    const repriced = await request('PUT', `/api/projects/${project.id}/costs/${before.id}`, costBody({
      description: 'Solo texto',
      category: 'Compra',
      amount: 12,
      currency: 'USD',
      cost_date: '2021-07-07',
    }), adminCookie);
    assert.equal(repriced.status, 200);
    const afterAmount = storedCost(project.id, 'Solo texto');
    assert.equal(afterAmount.amount, 12);
    assert.equal(afterAmount.exchange_rate_to_mxn, 20);
    assert.equal(afterAmount.amount_mxn, 240);

    const currency = await request('PUT', `/api/projects/${project.id}/costs/${before.id}`, costBody({
      description: 'Solo texto',
      category: 'Compra',
      amount: 12,
      currency: 'MXN',
      cost_date: '2021-07-07',
    }), adminCookie);
    assert.equal(currency.status, 200);
    const afterCurrency = storedCost(project.id, 'Solo texto');
    assert.equal(afterCurrency.currency, 'MXN');
    assert.equal(afterCurrency.exchange_rate_to_mxn, 1);
    assert.equal(afterCurrency.amount_mxn, 12);

    const db = openDb();
    db.prepare("DELETE FROM exchange_rates WHERE currency = 'EUR'").run();
    db.close();
    const blocked = await request('PUT', `/api/projects/${project.id}/costs/${before.id}`, costBody({
      description: 'Solo texto',
      category: 'Compra',
      amount: 12,
      currency: 'EUR',
      cost_date: '2021-07-07',
    }), adminCookie);
    assert.equal(blocked.status, 400);
    const unchanged = storedCost(project.id, 'Solo texto');
    assert.equal(unchanged.currency, 'MXN');
    assert.equal(unchanged.amount_mxn, 12);
    await setRates(17, 19);
  });

  await t.test('J closed project keeps a new cost snapshot', async () => {
    const project = await createProject({ quote_number: `CFX-J-${Date.now()}` });
    await addCost(project.id, { description: 'Costo cerrado', amount: 8, currency: 'USD' });
    const closed = await request('DELETE', `/api/projects/${project.id}`, {
      password: 'admin123',
      confirm_pending_balance: true,
    }, adminCookie);
    assert.equal(closed.status, 204, JSON.stringify(closed.body));
    await setRates(25, 30);
    const analysis = await request(
      'GET',
      `/api/closed-projects/analysis?search=${encodeURIComponent(project.quote_number)}`,
      null,
      adminCookie,
    );
    assert.equal(analysis.status, 200);
    assert.equal(analysis.body.total.costs.complete, true);
    assert.equal(analysis.body.total.costs.amount_mxn, 136);
    await setRates(17, 19);
  });

  await t.test('K closed project with a legacy foreign cost stays incomplete', async () => {
    const project = await createProject({ quote_number: `CFX-K-${Date.now()}` });
    const db = openDb();
    db.prepare(
      `INSERT INTO project_costs (
         project_id, category, description, amount, currency, cost_date
       ) VALUES (?, 'Otros', 'Viejo cerrado', 5, 'EUR', '2019-01-01')`,
    ).run(project.id);
    db.close();
    const closed = await request('DELETE', `/api/projects/${project.id}`, {
      password: 'admin123',
      confirm_pending_balance: true,
    }, adminCookie);
    assert.equal(closed.status, 204, JSON.stringify(closed.body));
    const analysis = await request(
      'GET',
      `/api/closed-projects/analysis?search=${encodeURIComponent(project.quote_number)}`,
      null,
      adminCookie,
    );
    assert.equal(analysis.body.total.costs.complete, false);
    assert.equal(analysis.body.total.costs.amount_mxn, null);
    assert.notEqual(analysis.body.total.costs.amount_mxn, 0);
    assert.equal(analysis.body.total.profit.complete, false);
  });

  await t.test('L backup export and import keep cost, payment and invoice snapshots', async () => {
    await setRates(17, 19);
    const project = await createProject({
      quote_number: `CFX-L-${Date.now()}`,
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    });
    const payment = await request('POST', `/api/projects/${project.id}/payments`, {
      amount: 40,
      currency: 'USD',
      payment_date: '2026-02-01',
      notes: 'Abono',
    }, adminCookie);
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
    const preview = await request('GET', `/api/projects/${project.id}/settlement-preview`, null, adminCookie);
    const settled = await request('POST', `/api/projects/${project.id}/settle-invoice`, {
      invoice_paid_at: '2026-03-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
      confirm_mxn_matches_real_payment: true,
    }, adminCookie);
    assert.equal(settled.status, 200, JSON.stringify(settled.body));
    await addCost(project.id, { description: 'Costo exportado', amount: 10, currency: 'USD' });

    const exported = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(exported.status, 200);
    const exportedCost = exported.body.data.projectCosts.find((row) => row.description === 'Costo exportado');
    const exportedPayment = exported.body.data.projectPayments.find((row) => row.notes === 'Abono' && row.project_id === project.id);
    const exportedProject = exported.body.data.projects.find((row) => row.id === project.id);
    assert.equal(exportedCost.amount_mxn, 170);
    assert.equal(exportedCost.exchange_rate_to_mxn, 17);
    assert.equal(exportedPayment.amount_mxn, 680);
    assert.equal(exportedPayment.exchange_rate_to_mxn, 17);
    assert.equal(exportedProject.invoiced_amount_mxn, settled.body.invoiced_amount_mxn_historical);
    assert.ok(exportedProject.invoiced_exchange_rate_to_mxn);

    await setRates(25, 30);
    const backup = exported.body;
    backup.data.projectCosts.push({
      project_id: project.id,
      category: 'Compra',
      description: 'Costo importado',
      amount: 10,
      currency: 'EUR',
      exchange_rate_to_mxn: 18,
      amount_mxn: 180,
      cost_date: '2019-02-02',
    });
    backup.data.projectCosts.push({
      project_id: project.id,
      category: 'Otros',
      description: 'Costo legado importado',
      amount: 8,
      currency: 'USD',
      cost_date: '2018-01-01',
    });
    backup.data.projectPayments.push({
      project_id: project.id,
      amount: 5,
      currency: 'USD',
      exchange_rate_to_mxn: 16,
      amount_mxn: 80,
      payment_date: '2019-03-03',
      notes: 'Pago importado',
    });
    backup.data.closedProjects.push({
      quote_number: `CFX-IMPORT-${Date.now()}`,
      order_number: '1',
      purchase_order_not_applicable: 1,
      seller: 'Vendedor General',
      client_name: 'Importado',
      project_description: 'Proyecto importado',
      expected_margin: 10,
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
      progress_percent: 0,
      technician_name: 'Tecnico General',
      promised_delivery_date: '2020-01-01',
      status: 'Terminado',
      risk: 'Bajo',
      closed_at: '2020-06-01T00:00:00.000Z',
      invoiced_exchange_rate_to_mxn: 15,
      invoiced_amount_mxn: 1500,
    });
    const importedQuote = backup.data.closedProjects.at(-1).quote_number;
    const imported = await request('POST', '/api/admin/backup/import', backup, adminCookie);
    assert.equal(imported.status, 200, JSON.stringify(imported.body).slice(0, 500));
    assert.ok(imported.body.importLog.summary.projectCosts.added >= 2);
    assert.equal(imported.body.importLog.summary.projectPayments.added, 1);

    const viewed = await request('GET', `/api/projects/${project.id}`, null, adminCookie);
    const importedCost = viewed.body.costs.find((item) => item.description === 'Costo importado');
    const legacyCost = viewed.body.costs.find((item) => item.description === 'Costo legado importado');
    const importedPayment = viewed.body.payments.find((item) => item.notes === 'Pago importado');
    assert.equal(importedCost.amount_mxn, 180);
    assert.equal(importedCost.exchange_rate_to_mxn, 18);
    assert.equal(importedCost.amount_mxn_is_historical, true);
    assert.equal(legacyCost.amount_mxn_is_historical, false);
    assert.equal(storedCost(project.id, 'Costo legado importado').amount_mxn, null);
    assert.equal(importedPayment.amount_mxn, 80);
    assert.equal(importedPayment.exchange_rate_to_mxn, 16);

    const analysis = await request(
      'GET',
      `/api/closed-projects/analysis?search=${encodeURIComponent(importedQuote)}`,
      null,
      adminCookie,
    );
    assert.equal(analysis.body.total.invoiced.amount_mxn, 1500);
    assert.equal(analysis.body.total.invoiced.complete, true);
    await setRates(17, 19);
  });

  await t.test('O existing payment and invoice snapshots stay untouched', async () => {
    await setRates(17, 19);
    const project = await createProject({
      quote_number: `CFX-O-${Date.now()}`,
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    });
    const paid = await request('POST', `/api/projects/${project.id}/payments`, {
      amount: 100,
      currency: 'USD',
      payment_date: '2026-04-01',
      notes: 'Pago completo',
    }, adminCookie);
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    const preview = await request('GET', `/api/projects/${project.id}/settlement-preview`, null, adminCookie);
    const settled = await request('POST', `/api/projects/${project.id}/settle-invoice`, {
      invoice_paid_at: '2026-04-02',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
      confirm_mxn_matches_real_payment: true,
    }, adminCookie);
    assert.equal(settled.status, 200, JSON.stringify(settled.body));
    const beforeInvoice = settled.body.invoiced_amount_mxn_historical;
    const beforePayment = settled.body.payments.find((item) => item.notes === 'Pago completo');
    await addCost(project.id, { description: 'Costo aparte', amount: 2, currency: 'EUR' });
    await setRates(24, 28);
    const after = await request('GET', `/api/projects/${project.id}`, null, adminCookie);
    assert.equal(after.body.invoiced_amount_mxn_historical, beforeInvoice);
    assert.equal(after.body.invoice_payment_status, 'Pagada');
    const payment = after.body.payments.find((item) => item.id === beforePayment.id);
    assert.equal(payment.amount_mxn, beforePayment.amount_mxn);
    assert.equal(payment.exchange_rate_to_mxn, beforePayment.exchange_rate_to_mxn);
    assert.equal(payment.amount, 100);
    assert.equal(payment.currency, 'USD');
    const cost = after.body.costs.find((item) => item.description === 'Costo aparte');
    assert.equal(cost.amount_mxn, 38);
    assert.equal(after.body.pending_collection, settled.body.pending_collection);
    await setRates(17, 19);
  });
});
