const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const {
  buildAgingReport,
  buildAgingBucketDefs,
  assignAgingBucket,
} = require('../src/agingReport');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-aging-report.db');
const PORT = 3097;

let serverProcess;
let adminCookie;

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
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), cookie: newCookie, raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: newCookie, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function waitForServer(timeoutMs = 12000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'));
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 100));
    }
    tryConnect();
  });
}

function baseProjectPayload(overrides = {}) {
  return {
    quote_number: `AG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: 'AG-ORD',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente Aging',
    project_description: 'Proyecto aging',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 10000,
    total_invoiced_currency: 'MXN',
    progress_percent: 100,
    status: 'Terminado',
    risk: 'Bajo',
    invoice_number: 'F-1',
    invoice_date: '2026-07-20',
    credit_days: 15,
    ...overrides,
  };
}

test('aging report unit helpers use kpiSettings buckets', () => {
  const defs = buildAgingBucketDefs({
    receivable_bucket1_days: 10,
    receivable_bucket2_days: 20,
    receivable_bucket3_days: 40,
  });
  assert.equal(defs.find((d) => d.key === 'b1').label, '1–10');
  assert.equal(defs.find((d) => d.key === 'b2').label, '11–20');
  assert.equal(defs.find((d) => d.key === 'b3').label, '21–40');
  assert.equal(defs.find((d) => d.key === 'b3plus').label, '+40');

  assert.equal(
    assignAgingBucket({ invoice_date: null, due_date: null }, '2026-08-03', defs),
    'no_invoice_date',
  );
  assert.equal(
    assignAgingBucket({ invoice_date: '2026-07-01', due_date: '2026-08-10' }, '2026-08-03', defs),
    'current',
  );
  assert.equal(
    assignAgingBucket({ invoice_date: '2026-07-01', due_date: '2026-07-20' }, '2026-08-03', defs),
    'b2',
  );

  const report = buildAgingReport([
    {
      id: 1,
      client_name: 'A',
      pending_collection: 500,
      invoice_date: null,
      due_date: null,
    },
    {
      id: 2,
      client_name: 'B',
      pending_collection: 200,
      invoice_date: '2026-07-20',
      due_date: '2026-08-04',
    },
  ], {
    receivable_bucket1_days: 30,
    receivable_bucket2_days: 60,
    receivable_bucket3_days: 90,
  }, '2026-08-03');

  assert.equal(report.summary.buckets.no_invoice_date.amount, 500);
  assert.equal(report.summary.buckets.current.amount, 200);
  assert.equal(report.clients[0].client_name, 'A');
});

test('aging report API endpoint', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_PATH,
        SESSION_SECRET: 'test-aging',
        ADMIN_PASSWORD: 'admin123',
      },
      stdio: 'pipe',
    });
    await waitForServer();
    const adminLogin = await request('POST', '/api/login', {
      username: 'admin',
      password: 'admin123',
    });
    adminCookie = adminLogin.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('groups pending projects and exposes no-invoice-date bucket', async () => {
    const withDate = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'AG-WITH-DATE',
      client_name: 'Cliente Fecha',
      invoice_number: '100',
      invoice_date: '2026-07-20',
      credit_days: 15,
      total_invoiced: 1000,
    }), adminCookie);
    assert.equal(withDate.status, 201);
    assert.equal(withDate.body.due_date, '2026-08-04');

    const noDate = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'AG-NO-DATE',
      client_name: 'Cliente Sin Fecha',
      status: 'En Proceso',
      invoice_number: '',
      invoice_date: '',
      credit_days: '',
      total_invoiced: 5400,
      progress_percent: 50,
    }), adminCookie);
    assert.equal(noDate.status, 201);

    // Force missing invoice/due dates while keeping balance (historical capture case)
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    db.prepare(
      `UPDATE projects
       SET invoice_number = NULL, invoice_date = NULL, invoice_date_na = 0,
           credit_days = NULL, credit_days_na = 0, due_date = NULL
       WHERE id = ?`,
    ).run(noDate.body.id);
    db.close();

    const report = await request('GET', '/api/financial/aging-report?as_of=2026-08-03', null, adminCookie);
    assert.equal(report.status, 200);
    assert.ok(report.body.buckets.some((b) => b.key === 'no_invoice_date'));
    assert.ok(report.body.summary.buckets.no_invoice_date.amount >= 5400);
    assert.ok(report.body.summary.buckets.current.amount >= 1000);

    const csv = await request('GET', '/api/financial/aging-report?format=csv&as_of=2026-08-03', null, adminCookie);
    assert.equal(csv.status, 200);
    assert.ok(String(csv.raw || csv.body).includes('Sin fecha de factura'));
  });

  await t.test('bucket labels follow live kpi settings', async () => {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    db.prepare(`
      UPDATE kpi_settings
      SET receivable_bucket1_days = 7,
          receivable_bucket2_days = 14,
          receivable_bucket3_days = 21
      WHERE id = 1
    `).run();
    db.close();

    const report = await request('GET', '/api/financial/aging-report?as_of=2026-08-03', null, adminCookie);
    assert.equal(report.status, 200);
    const labels = report.body.buckets.map((b) => b.label);
    assert.ok(labels.includes('1–7'));
    assert.ok(labels.includes('8–14'));
    assert.ok(labels.includes('15–21'));
    assert.ok(labels.includes('+21'));
  });
});
