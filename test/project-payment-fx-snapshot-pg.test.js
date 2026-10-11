'use strict';

/**
 * Snapshots FX en PostgreSQL (BD dedicada, nunca producción).
 * TEST_DATABASE_URL=postgresql://settle_test:settle_test@127.0.0.1:5432/settle_test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');
const PORT = 3090;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
  || process.env.SETTLE_TEST_DATABASE_URL
  || '';
const PG_AVAILABLE = Boolean(String(TEST_DATABASE_URL).trim());

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

function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'));
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 150));
    }
    tryConnect();
  });
}

async function resetTestDatabase() {
  const client = new Client({
    connectionString: TEST_DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
  } finally {
    await client.end();
  }
}

function baseProjectPayload(overrides = {}) {
  return {
    quote_number: `PGFX-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: '762',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente PG FX',
    project_description: 'FX PG',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 100,
    total_invoiced_currency: 'USD',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    invoice_number: 'PG-FX',
    invoice_date: '2026-01-15',
    credit_days: 0,
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

test('PostgreSQL project FX snapshots', async (t) => {
  if (!PG_AVAILABLE) {
    t.skip('Sin TEST_DATABASE_URL: omitido. Use BD local dedicada (nunca producción).');
    return;
  }

  await t.before(async () => {
    await resetTestDatabase();
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        DATABASE_SSL: process.env.DATABASE_SSL || 'false',
        SESSION_SECRET: 'test-fx-snapshot-pg',
        ADMIN_PASSWORD: 'admin123',
        NODE_ENV: 'development',
      },
      stdio: 'pipe',
    });
    await waitForServer();
    const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = login.cookie;
    assert.ok(adminCookie);

    // Idempotencia: reaplicar ALTER IF NOT EXISTS no debe fallar ni backfillar.
    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query('ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS exchange_rate_to_mxn DOUBLE PRECISION');
      await client.query('ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS amount_mxn DOUBLE PRECISION');
      await client.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_exchange_rate_to_mxn DOUBLE PRECISION');
      await client.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_amount_mxn DOUBLE PRECISION');
    } finally {
      await client.end();
    }
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
  });

  await t.test('USD settle then FX change keeps pending 0', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PGFX-LOCK',
    }), adminCookie);
    assert.equal(created.status, 201);
    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    const settled = await request('POST', `/api/projects/${created.body.id}/settle-invoice`, {
      invoice_paid_at: '2026-03-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
      confirm_mxn_matches_real_payment: true,
    }, adminCookie);
    assert.equal(settled.status, 200);
    assert.equal(settled.body.invoiced_amount_mxn_historical, 1700);

    await request('PUT', '/api/exchange-rates', { USD: 20, EUR: 19 }, adminCookie);
    const after = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    assert.equal(after.body.invoice_payment_status, 'Pagada');
    assert.equal(after.body.pending_collection, 0);
    assert.equal(after.body.total_charged, 1700);
    assert.equal(after.body.total_invoiced_mxn, 1700);

    const listed = await request('GET', '/api/projects?search=PGFX-LOCK', null, adminCookie);
    const row = (listed.body.data || []).find((p) => p.id === created.body.id);
    assert.ok(row);
    assert.equal(row.pending_collection, 0);
  });

  await t.test('concurrent settle + manual payment under FOR UPDATE', async () => {
    await request('PUT', '/api/exchange-rates', { USD: 17, EUR: 19 }, adminCookie);
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PGFX-RACE',
      total_invoiced: 100,
      total_invoiced_currency: 'MXN',
    }), adminCookie);
    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    const [settleRes, payRes] = await Promise.all([
      request('POST', `/api/projects/${created.body.id}/settle-invoice`, {
        invoice_paid_at: '2026-03-02',
        expected_pending_mxn: preview.body.pending_collection_mxn,
        confirm: true,
      }, adminCookie),
      request('POST', `/api/projects/${created.body.id}/payments`, {
        amount: 10,
        currency: 'MXN',
        payment_date: '2026-03-02',
        notes: 'race',
      }, adminCookie),
    ]);
    assert.ok([200, 409].includes(settleRes.status));
    assert.ok([201, 409].includes(payRes.status));
    const project = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    const settlements = (project.body.payments || []).filter((p) =>
      String(p.notes || '').toLowerCase().includes('liquidacion'));
    assert.ok(settlements.length <= 1);
    assert.ok(Number(project.body.pending_collection) >= -0.01);
  });

  await t.test('legacy NULL amount_mxn remains non-historical', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PGFX-LEGACY',
      total_invoiced: 500,
      total_invoiced_currency: 'MXN',
    }), adminCookie);
    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query(
        `INSERT INTO project_payments (project_id, amount, currency, payment_date, notes, created_at, exchange_rate_to_mxn, amount_mxn)
         VALUES ($1, 100, 'MXN', '2025-01-01', 'legacy-pg', CURRENT_TIMESTAMP, NULL, NULL)`,
        [created.body.id],
      );
    } finally {
      await client.end();
    }
    const detail = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    const legacy = detail.body.payments.find((p) => p.notes === 'legacy-pg');
    assert.ok(legacy);
    assert.equal(legacy.amount_mxn_is_historical, false);
    assert.equal(legacy.exchange_rate_to_mxn, null);
  });
});
