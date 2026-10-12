'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');
const { buildProjectTotals, roundMoney } = require('../src/calculations');
const {
  CSV_HEADERS,
  analyzeClosedProject,
  appendCreatedPeriodSql,
  buildClosedProjectsAnalysis,
  buildClosedProjectsCsv,
  buildCreationPeriods,
  closedCreationPeriodsSql,
  closedListStateSurvivesOpenAndReturn,
  matchesCreatedPeriod,
  parseCreatedMonth,
  parseCreatedYear,
  reconcileClosedPeriod,
} = require('../src/closedProjectsAnalysis');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
const calculationsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculations.js'), 'utf8');

function project(overrides = {}) {
  return {
    id: 1,
    project_description: 'Proyecto',
    client_name: 'Cliente',
    status: 'Terminado',
    created_at: '2022-03-15T18:00:00.000Z',
    closed_at: '2022-08-01T12:00:00.000Z',
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    invoiced_amount_mxn: null,
    observations: 'SECRETO-INTERNO',
    ...overrides,
  };
}

test('year filter uses the stored creation date and ignores other years', () => {
  const rows = [
    project({ id: 1, created_at: '2022-03-15T18:00:00.000Z' }),
    project({ id: 2, created_at: '2021-11-02T00:00:00.000Z' }),
    project({ id: 3, created_at: '2022-12-01 10:00:00' }),
  ];
  const analysis = buildClosedProjectsAnalysis(rows, { year: 2022, month: null });
  assert.deepEqual(analysis.projects.map((item) => item.id), [1, 3]);
  assert.equal(analysis.total.project_count, 2);
  assert.equal(matchesCreatedPeriod('2022-03-15T18:00:00.000Z', 2022, null), true);
  assert.equal(matchesCreatedPeriod('2021-03-15T18:00:00.000Z', 2022, null), false);
  assert.equal(parseCreatedYear(''), null);
  assert.equal(parseCreatedYear('todos'), null);
  assert.throws(() => parseCreatedYear('1999.5'), (err) => err.statusCode === 400);
});

test('month filter depends on the selected year and can span years', () => {
  const rows = [
    project({ id: 1, created_at: '2022-03-15T18:00:00.000Z' }),
    project({ id: 2, created_at: '2021-03-02T00:00:00.000Z' }),
    project({ id: 3, created_at: '2022-04-01T00:00:00.000Z' }),
  ];
  const marchAllYears = buildClosedProjectsAnalysis(rows, { year: null, month: 3 });
  assert.deepEqual(marchAllYears.projects.map((item) => item.id), [1, 2]);
  const march2022 = buildClosedProjectsAnalysis(rows, { year: 2022, month: 3 });
  assert.deepEqual(march2022.projects.map((item) => item.id), [1]);
  assert.equal(parseCreatedMonth('03'), 3);
  assert.throws(() => parseCreatedMonth('13'), (err) => err.statusCode === 400);

  const periods = buildCreationPeriods([
    { year: 2022, month: 3 },
    { year: 2022, month: 6 },
    { year: 2021, month: 1 },
  ]);
  const kept = reconcileClosedPeriod({ year: '2022', month: '3', group: 'month' }, periods);
  assert.deepEqual(kept.availableMonths, [3, 6]);
  assert.equal(kept.month, '3');
  const cleared = reconcileClosedPeriod({ year: '2022', month: '1', group: 'year' }, periods);
  assert.equal(cleared.month, '');
  const allYears = reconcileClosedPeriod({ year: '', month: '1' }, periods);
  assert.deepEqual(allYears.availableMonths, [1, 3, 6]);
  assert.equal(allYears.month, '1');
});

test('sqlite creation-date filter matches the calendar prefix and excludes open projects', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    created_at TEXT,
    closed_at TEXT
  )`);
  const insert = db.prepare('INSERT INTO projects (id, created_at, closed_at) VALUES (?, ?, ?)');
  insert.run(1, '2022-03-15T18:00:00.000Z', '2022-08-01T00:00:00.000Z');
  insert.run(2, '2021-03-02T00:00:00.000Z', '2021-04-01T00:00:00.000Z');
  insert.run(3, '2022-03-20T00:00:00.000Z', null);
  insert.run(4, '2022-11-02T00:00:00.000Z', '2022-12-01T00:00:00.000Z');

  const march2022 = appendCreatedPeriodSql('closed_at IS NOT NULL', [], {
    created_year: '2022',
    created_month: '3',
  });
  const ids = db.prepare(`SELECT p.id FROM projects p WHERE ${march2022.whereClause} ORDER BY p.id`).all(...march2022.params);
  assert.deepEqual(ids.map((row) => row.id), [1]);

  const periods = buildCreationPeriods(db.prepare(closedCreationPeriodsSql()).all());
  assert.deepEqual(periods.years, [2022, 2021]);
  assert.deepEqual(periods.monthsByYear['2022'], [3, 11]);
  assert.deepEqual(periods.months, [3, 11]);
  db.close();
});

test('chronological grouping counts projects by creation year and month', () => {
  const rows = [
    project({ id: 3, created_at: '2022-06-01T00:00:00.000Z', total_invoiced: 100 }),
    project({ id: 1, created_at: '2021-01-10T00:00:00.000Z', total_invoiced: 50 }),
    project({ id: 2, created_at: '2022-03-15T18:00:00.000Z', total_invoiced: 200 }),
  ];
  const analysis = buildClosedProjectsAnalysis(rows);
  assert.deepEqual(analysis.groups.map((group) => group.year), [2021, 2022]);
  assert.equal(analysis.groups[0].project_count, 1);
  assert.equal(analysis.groups[1].project_count, 2);
  assert.deepEqual(analysis.groups[1].months.map((month) => month.month), [3, 6]);
  assert.equal(analysis.groups[1].months[0].label, 'Marzo 2022');
  assert.equal(analysis.groups[1].months[0].project_count, 1);
  assert.equal(analysis.groups[1].months[1].project_count, 1);
});

test('group totals and grand total reuse invoiced minus costs and do not treat gaps as zero', () => {
  const completeA = project({
    id: 1,
    created_at: '2022-03-01T00:00:00.000Z',
    total_invoiced: 1000,
    payments: [{ amount: 400, currency: 'MXN' }],
    costs: [{ amount: 250, currency: 'MXN' }],
  });
  const completeB = project({
    id: 2,
    created_at: '2022-03-20T00:00:00.000Z',
    total_invoiced: 500,
    payments: [{ amount: 500, currency: 'MXN' }],
    costs: [{ amount: 100, currency: 'MXN' }],
  });
  const reliable = buildClosedProjectsAnalysis([completeA, completeB], { year: 2022, month: 3 });
  assert.equal(reliable.total.project_count, 2);
  assert.equal(reliable.total.invoiced.amount_mxn, 1500);
  assert.equal(reliable.total.charged.amount_mxn, 900);
  assert.equal(reliable.total.pending.amount_mxn, 600);
  assert.equal(reliable.total.costs.amount_mxn, 350);
  assert.equal(reliable.total.profit.amount_mxn, 1150);
  assert.equal(reliable.groups[0].months[0].invoiced.amount_mxn, 1500);
  assert.equal(reliable.groups[0].profit.amount_mxn, 1150);

  const incomplete = project({
    id: 3,
    created_at: '2022-03-25T00:00:00.000Z',
    total_invoiced: 100,
    total_invoiced_currency: 'USD',
    invoiced_amount_mxn: null,
    payments: [],
    costs: [],
  });
  const mixed = buildClosedProjectsAnalysis([completeA, incomplete]);
  assert.equal(mixed.total.project_count, 2);
  assert.equal(mixed.total.invoiced.complete, false);
  assert.equal(mixed.total.invoiced.amount_mxn, null);
  assert.notEqual(mixed.total.invoiced.amount_mxn, 1000);
  assert.equal(mixed.total.charged.amount_mxn, 400);
  assert.equal(mixed.total.pending.complete, false);
  assert.equal(mixed.groups[0].invoiced.incomplete_count, 1);
});

test('historical snapshots are kept and a live exchange rate is not applied to unknown foreign amounts', () => {
  const liveRates = { MXN: 1, USD: 25, EUR: 30 };
  const mxnProject = project({ total_invoiced: 1000 });
  const mxnPayments = [{ amount: 400, currency: 'MXN', amount_mxn: null }];
  const mxnCosts = [{ amount: 250, currency: 'MXN' }];
  const mxnTotals = buildProjectTotals(mxnProject, mxnPayments, mxnCosts, liveRates);
  const mxnAnalysis = analyzeClosedProject(mxnProject, mxnPayments, mxnCosts);
  assert.equal(mxnAnalysis.invoiced.amount_mxn, mxnTotals.total_invoiced_mxn);
  assert.equal(mxnAnalysis.charged.amount_mxn, mxnTotals.total_charged);
  assert.equal(mxnAnalysis.costs.amount_mxn, mxnTotals.spent);
  assert.equal(mxnAnalysis.pending.amount_mxn, mxnTotals.pending_collection);
  assert.equal(mxnAnalysis.profit.amount_mxn, roundMoney(mxnTotals.total_invoiced_mxn - mxnTotals.spent));

  const usdProject = project({
    id: 9,
    total_invoiced: 100,
    total_invoiced_currency: 'USD',
    invoiced_amount_mxn: 1700,
    client_name: 'Cliente USD',
  });
  const usdPayments = [{ amount: 40, currency: 'USD', amount_mxn: 680, notes: 'NOTA-PRIVADA' }];
  const eurCost = [{ amount: 10, currency: 'EUR' }];
  const liveTotals = buildProjectTotals(usdProject, usdPayments, eurCost, liveRates);
  assert.equal(liveTotals.spent, 300);
  const usdAnalysis = analyzeClosedProject(usdProject, usdPayments, eurCost);
  assert.equal(usdAnalysis.invoiced.amount_mxn, 1700);
  assert.equal(usdAnalysis.charged.amount_mxn, 680);
  assert.notEqual(usdAnalysis.invoiced.amount_mxn, 2500);
  assert.notEqual(usdAnalysis.charged.amount_mxn, 1000);
  assert.equal(usdAnalysis.costs.complete, false);
  assert.equal(usdAnalysis.costs.amount_mxn, null);
  assert.equal(usdAnalysis.costs.reason, 'sin_snapshot_fx');
  assert.equal(usdAnalysis.profit.complete, false);
  assert.equal(usdAnalysis.profit.amount_mxn, null);

  const partialCosts = analyzeClosedProject(usdProject, [], [
    { amount: 80, currency: 'MXN' },
    { amount: 10, currency: 'USD' },
  ]);
  assert.equal(partialCosts.costs.complete, false);
  assert.equal(partialCosts.costs.amount_mxn, null);
});

test('csv export lists the requested columns and omits confidential notes', () => {
  const analyzed = analyzeClosedProject(
    project({
      id: 7,
      project_description: 'Caldera, norte',
      client_name: 'Cliente "ACME"',
      observations: 'SECRETO-INTERNO',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }),
    [{ amount: 10, currency: 'USD', notes: 'NOTA-PRIVADA' }],
    [{ amount: 5, currency: 'EUR', description: 'dato interno' }],
  );
  const csv = buildClosedProjectsCsv([analyzed]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /\r\n/);
  const header = csv.slice(1).split('\r\n')[0];
  assert.equal(header, CSV_HEADERS.join(','));
  assert.match(csv, /Caldera, norte/);
  assert.match(csv, /Cliente ""ACME""/);
  assert.match(csv, /incompleto/);
  assert.equal(csv.includes('SECRETO-INTERNO'), false);
  assert.equal(csv.includes('NOTA-PRIVADA'), false);
  assert.equal(csv.includes('dato interno'), false);
  assert.match(csv, /2022-03-15/);
  assert.match(csv, /2022-08-01/);
  assert.match(csv, /Terminado/);
  const formula = buildClosedProjectsCsv([analyzeClosedProject(project({
    project_description: '=1+1',
    client_name: 'Cliente',
  }))]);
  assert.match(formula, /'=1\+1/);
  assert.equal(formula.includes(',=1+1,'), false);
});

test('opening a closed project and returning keeps year, month, grouping, sort and search', () => {
  const before = {
    year: '2022',
    month: '3',
    group: 'month',
    search: 'acme',
    sortBy: 'client_name',
    sortOrder: 'desc',
    page: 2,
  };
  assert.deepEqual(closedListStateSurvivesOpenAndReturn(before), before);
  assert.match(indexHtml, /id="closed-filter-year"/);
  assert.match(indexHtml, /Todos los años/);
  assert.match(indexHtml, /id="closed-filter-month"/);
  assert.match(indexHtml, /Todos los meses/);
  assert.match(indexHtml, /id="closed-filter-group"/);
  assert.match(indexHtml, /id="closed-projects-export-csv-btn"/);
  assert.match(indexHtml, /id="closed-detail-back"/);
  assert.match(appJs, /function persistClosedListState/);
  assert.match(appJs, /function restoreClosedListState/);
  assert.match(appJs, /function returnToClosedList/);
  assert.match(appJs, /created_year/);
  assert.match(appJs, /created_month/);
  assert.match(appJs, /function selectClosedProject\(projectId\) \{\s*persistClosedListState\(\);/);
  assert.match(appJs, /function returnToClosedList\(\) \{\s*clearClosedSelection\(\);\s*persistClosedListState\(\);/);
  assert.match(appJs, /Sin TC histórico/);
  assert.match(appJs, /function renderClosedMxnCell/);
  assert.doesNotMatch(appJs, /function returnToClosedList\(\) \{[^}]*closedCreatedYear = ''/);
  assert.match(serverJs, /\/api\/closed-projects\/analysis/);
  assert.match(serverJs, /\/api\/closed-projects\/export\.csv/);
  assert.match(serverJs, /appendCreatedPeriodSql/);
  assert.equal(calculationsJs.includes('function buildProjectTotals'), true);
});

const DB_PATH = path.join(__dirname, '..', 'data', 'test-closed-projects-analysis.db');
const PORT = 3115;

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
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const newCookie = res.headers['set-cookie']
          ? res.headers['set-cookie'][0].split(';')[0]
          : null;
        let parsed = raw;
        try { parsed = JSON.parse(raw || '{}'); } catch { /* csv */ }
        resolve({ status: res.statusCode, body: parsed, raw, cookie: newCookie, headers: res.headers });
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
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'));
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 200));
    }
    tryConnect();
  });
}

test('closed projects analysis API filters, totals, currencies and csv', async (t) => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const serverProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH,
      DATABASE_URL: '',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  serverProcess.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  t.after(() => {
    if (!serverProcess.killed) serverProcess.kill('SIGTERM');
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });
  try {
    await waitForServer();
  } catch (err) {
    throw new Error(`Server failed to start: ${err.message}\n${stderr}`);
  }

  const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const cookie = login.cookie;
  await request('PUT', '/api/exchange-rates', { USD: 17, EUR: 19 }, cookie);

  const employees = await request('GET', '/api/projects/assignable-employees', null, cookie);
  assert.equal(employees.status, 200);
  const tecnico = employees.body.data[0];
  const vendedor = employees.body.data[1] || tecnico;

  async function createClosed(payload, createdAt) {
    const created = await request('POST', '/api/projects', {
      purchase_order_not_applicable: true,
      tecnico_id: tecnico.id,
      vendedor_id: vendedor.id,
      expected_margin: 20,
      progress_percent: 10,
      fecha_vencimiento: '2026-12-31',
      promised_delivery_date: '2026-06-01',
      status: 'En Proceso',
      risk: 'Bajo',
      observations: 'SECRETO-INTERNO',
      ...payload,
    }, cookie);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id;
    if (payload.payment) {
      const payment = await request('POST', `/api/projects/${id}/payments`, {
        notes: 'NOTA-PRIVADA',
        payment_date: '2022-04-01',
        ...payload.payment,
      }, cookie);
      assert.equal(payment.status, 201, JSON.stringify(payment.body));
    }
    if (payload.cost) {
      const cost = await request('POST', `/api/projects/${id}/costs`, {
        category: 'Viaticos',
        description: 'dato interno',
        cost_date: '2022-04-02',
        ...payload.cost,
      }, cookie);
      assert.equal(cost.status, 201, JSON.stringify(cost.body));
    }
    const closed = await request('DELETE', `/api/projects/${id}`, {
      password: 'admin123',
      confirm_pending_balance: true,
    }, cookie);
    assert.equal(closed.status, 204, JSON.stringify(closed.body));
    const db = new Database(DB_PATH);
    db.prepare('UPDATE projects SET created_at = ? WHERE id = ?').run(createdAt, id);
    if (payload.invoiceSnapshot != null) {
      db.prepare('UPDATE projects SET invoiced_amount_mxn = ?, invoiced_exchange_rate_to_mxn = ? WHERE id = ?')
        .run(payload.invoiceSnapshot, 17, id);
    }
    db.close();
    return id;
  }

  const mxnId = await createClosed({
    quote_number: 'COT-C5-MXN',
    order_number: 'PED-C5-MXN',
    client_name: 'Cliente MXN',
    project_description: 'Proyecto MXN',
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    payment: { amount: 400, currency: 'MXN' },
    cost: { amount: 250, currency: 'MXN' },
  }, '2021-01-10T15:00:00.000Z');

  const usdId = await createClosed({
    quote_number: 'COT-C5-USD',
    order_number: 'PED-C5-USD',
    client_name: 'Cliente USD',
    project_description: 'Proyecto USD',
    total_invoiced: 100,
    total_invoiced_currency: 'USD',
    payment: { amount: 40, currency: 'USD' },
    cost: { amount: 10, currency: 'USD' },
    invoiceSnapshot: 1700,
  }, '2022-03-15T18:00:00.000Z');

  const open = await request('POST', '/api/projects', {
    quote_number: 'COT-C5-OPEN',
    order_number: 'PED-C5-OPEN',
    purchase_order_not_applicable: true,
    tecnico_id: tecnico.id,
    vendedor_id: vendedor.id,
    client_name: 'Cliente Abierto',
    project_description: 'Sigue abierto',
    expected_margin: 10,
    total_invoiced: 50,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    fecha_vencimiento: '2026-12-31',
    promised_delivery_date: '2026-06-01',
    status: 'Pendiente',
    risk: 'Bajo',
  }, cookie);
  assert.equal(open.status, 201, JSON.stringify(open.body));

  await request('PUT', '/api/exchange-rates', { USD: 25, EUR: 30 }, cookie);

  const unauth = await request('GET', '/api/closed-projects/analysis?created_year=2022');
  assert.equal(unauth.status, 401);

  const invalid = await request('GET', '/api/closed-projects/analysis?created_year=no', null, cookie);
  assert.equal(invalid.status, 400);

  const year2022 = await request('GET', '/api/closed-projects/analysis?created_year=2022&created_month=3', null, cookie);
  assert.equal(year2022.status, 200, JSON.stringify(year2022.body));
  assert.equal(year2022.body.total.project_count, 1);
  assert.equal(year2022.body.total.invoiced.amount_mxn, 1700);
  assert.equal(year2022.body.total.charged.amount_mxn, 680);
  assert.equal(year2022.body.total.costs.complete, false);
  assert.equal(year2022.body.total.costs.amount_mxn, null);
  assert.equal(year2022.body.total.profit.complete, false);
  assert.equal(year2022.body.groups[0].year, 2022);
  assert.equal(year2022.body.groups[0].months[0].month, 3);
  assert.equal(year2022.body.groups[0].project_count, 1);

  const year2021 = await request('GET', '/api/closed-projects/analysis?created_year=2021', null, cookie);
  assert.equal(year2021.body.total.project_count, 1);
  assert.equal(year2021.body.total.invoiced.amount_mxn, 1000);
  assert.equal(year2021.body.total.charged.amount_mxn, 400);
  assert.equal(year2021.body.total.pending.amount_mxn, 600);
  assert.equal(year2021.body.total.costs.amount_mxn, 250);
  assert.equal(year2021.body.total.profit.amount_mxn, 750);

  const listed = await request('GET', '/api/closed-projects?created_year=2022&search=USD', null, cookie);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  assert.equal(listed.body.data[0].id, usdId);
  assert.equal(listed.body.data.some((row) => row.id === open.body.id), false);

  const periods = await request('GET', '/api/closed-projects/creation-periods', null, cookie);
  assert.equal(periods.status, 200);
  assert.ok(periods.body.years.includes(2022));
  assert.ok(periods.body.years.includes(2021));
  assert.deepEqual(periods.body.monthsByYear['2022'], [3]);

  const csv = await request('GET', '/api/closed-projects/export.csv?created_year=2022&created_month=3&sortBy=client_name&sortOrder=asc', null, cookie);
  assert.equal(csv.status, 200);
  assert.match(String(csv.headers['content-type']), /text\/csv/);
  assert.match(csv.raw, /Proyecto USD/);
  assert.match(csv.raw, /Cliente USD/);
  assert.match(csv.raw, /1700/);
  assert.match(csv.raw, /680/);
  assert.match(csv.raw, /incompleto/);
  assert.equal(csv.raw.includes('SECRETO-INTERNO'), false);
  assert.equal(csv.raw.includes('NOTA-PRIVADA'), false);
  assert.equal(csv.raw.includes('Sigue abierto'), false);
  assert.equal(csv.raw.includes(String(mxnId)) && csv.raw.includes('Proyecto MXN'), false);
});
