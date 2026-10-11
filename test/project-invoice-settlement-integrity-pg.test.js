'use strict';

/**
 * Integridad financiera Etapa 3 en PostgreSQL (BD dedicada, nunca producción).
 * TEST_DATABASE_URL=postgresql://settle_test:settle_test@127.0.0.1:5432/settle_test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');

const PORT = 3092;
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
    quote_number: `PGINT-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: '762',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente PG Integridad',
    project_description: 'Integridad PG',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    invoice_number: 'PG-FAC-INT',
    invoice_date: '2026-01-15',
    credit_days: 0,
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

test('PostgreSQL Stage 3 integrity scenarios', async (t) => {
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
        SESSION_SECRET: 'test-invoice-settlement-integrity-pg',
        ADMIN_PASSWORD: 'admin123',
        NODE_ENV: 'development',
      },
      stdio: 'pipe',
    });
    await waitForServer();
    const adminLogin = await request('POST', '/api/login', {
      username: 'admin',
      password: 'admin123',
    });
    adminCookie = adminLogin.cookie;
    assert.ok(adminCookie);
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
  });

  await t.test('delete payment after settle reopens to Pendiente', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PG-INT-DEL',
      total_invoiced: 1000,
    }), adminCookie);
    assert.equal(created.status, 201);
    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    const settled = await request('POST', `/api/projects/${created.body.id}/settle-invoice`, {
      invoice_paid_at: '2026-03-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
    }, adminCookie);
    assert.equal(settled.status, 200);
    const deleted = await request('DELETE', `/api/projects/${created.body.id}/payments/${settled.body.payments[0].id}`, {
      password: 'admin123',
    }, adminCookie);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.invoice_payment_status_stored || deleted.body.invoice_payment_status, 'Pendiente');
    assert.ok(deleted.body.pending_collection > 0.01);
  });

  await t.test('invoice amount increase on Pagada requires status review', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PG-INT-INV',
      total_invoiced: 500,
    }), adminCookie);
    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    await request('POST', `/api/projects/${created.body.id}/settle-invoice`, {
      invoice_paid_at: '2026-03-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
    }, adminCookie);
    const blocked = await request('PUT', `/api/projects/${created.body.id}`, baseProjectPayload({
      quote_number: 'PG-INT-INV',
      total_invoiced: 800,
      invoice_payment_status: 'Pagada',
      invoice_paid_at: '2026-03-01',
    }), adminCookie);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'INVOICE_AMOUNT_REQUIRES_STATUS_REVIEW');
  });

  await t.test('exchange rate change after settle keeps Pagada and pending 0 (snapshots)', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PG-INT-FX',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }), adminCookie);
    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    await request('POST', `/api/projects/${created.body.id}/settle-invoice`, {
      invoice_paid_at: '2026-03-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
      confirm_mxn_matches_real_payment: true,
    }, adminCookie);
    const rates = await request('PUT', '/api/exchange-rates', { USD: 20, EUR: 19 }, adminCookie);
    assert.equal(rates.status, 200);
    const after = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    assert.equal(after.body.invoice_payment_status, 'Pagada');
    assert.equal(after.body.pending_collection, 0);
    assert.equal(after.body.total_invoiced_mxn, 1700);
    assert.equal(after.body.total_charged, 1700);
  });
});
