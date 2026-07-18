const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { getDb } = require('../src/db');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-project-invoice-payment.db');
const PORT = 3098;

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

function waitForServer(timeoutMs = 10000) {
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
    quote_number: `INV-${Date.now()}`,
    order_number: '762',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente Cobranza',
    project_description: 'Proyecto con factura',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    ...overrides,
  };
}

test('invoice_payment_status column exists after migration', () => {
  const db = getDb();
  const columns = db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
  assert.ok(columns.includes('invoice_payment_status'));
  assert.ok(columns.includes('invoice_number'));
  assert.ok(columns.includes('invoice_date'));
  assert.ok(columns.includes('due_date'));
  assert.ok(columns.includes('invoice_paid_at'));
});

test('project invoice payment fields via API', async (t) => {
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
        SESSION_SECRET: 'test-invoice-payment',
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

  await t.test('creates project without invoice fields unchanged', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-NONE',
      order_number: 'NO-INV',
    }), adminCookie);
    assert.equal(created.status, 201);
    assert.equal(created.body.invoice_number, null);
    assert.equal(created.body.invoice_payment_status, null);
    assert.equal(created.body.invoice_paid_at, null);
  });

  await t.test('saves invoice fields and computes Vencida', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-2250',
      order_number: '762',
      invoice_number: '2250',
      invoice_date: '2026-01-01',
      due_date: '2020-01-01',
      invoice_payment_status: 'Pendiente',
    }), adminCookie);
    assert.equal(created.status, 201);
    assert.equal(created.body.invoice_number, '2250');
    assert.equal(created.body.invoice_date, '2026-01-01');
    assert.equal(created.body.due_date, '2020-01-01');
    assert.equal(created.body.invoice_payment_status_stored, 'Pendiente');
    assert.equal(created.body.invoice_payment_status, 'Vencida');
    assert.equal(created.body.fecha_vencimiento, '2026-12-01');
  });

  await t.test('requires payment date when status is Pagada', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-PAID-FAIL',
      invoice_number: '2251',
      invoice_payment_status: 'Pagada',
    }), adminCookie);
    assert.equal(created.status, 400);
  });

  await t.test('marks invoice as Pagada with payment date', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-PAID-OK',
      invoice_number: '2252',
      invoice_date: '2026-02-01',
      due_date: '2026-03-01',
      invoice_payment_status: 'Pendiente',
    }), adminCookie);
    assert.equal(created.status, 201);

    const updated = await request('PUT', `/api/projects/${created.body.id}`, {
      ...baseProjectPayload({
        quote_number: 'INV-PAID-OK',
        invoice_number: '2252',
        invoice_date: '2026-02-01',
        due_date: '2026-03-01',
        invoice_payment_status: 'Pagada',
        invoice_paid_at: '2026-02-15',
      }),
    }, adminCookie);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.invoice_payment_status, 'Pagada');
    assert.equal(updated.body.invoice_paid_at, '2026-02-15');
  });

  await t.test('rejects invalid invoice payment status and long invoice number', async () => {
    const badStatus = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-BAD-STATUS',
      invoice_payment_status: 'Parcial',
    }), adminCookie);
    assert.equal(badStatus.status, 400);

    const tooLong = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-LONG',
      invoice_number: 'X'.repeat(51),
    }), adminCookie);
    assert.equal(tooLong.status, 400);
  });

  await t.test('search finds project by invoice number', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INV-SEARCH',
      order_number: 'PED-SEARCH',
      invoice_number: '998877',
      invoice_payment_status: 'Pendiente',
      due_date: '2099-01-01',
    }), adminCookie);
    assert.equal(created.status, 201);

    const listed = await request('GET', '/api/projects?search=998877', null, adminCookie);
    assert.equal(listed.status, 200);
    const match = (listed.body.data || []).find((p) => p.id === created.body.id);
    assert.ok(match, 'project should appear when searching by invoice number');
    assert.equal(match.invoice_number, '998877');
  });
});
