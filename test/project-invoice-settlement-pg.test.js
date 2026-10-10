'use strict';

/**
 * Concurrencia real en PostgreSQL para liquidación de factura (Etapa 3).
 *
 * Requiere una base de pruebas dedicada (nunca producción):
 *   TEST_DATABASE_URL=postgresql://settle_test:settle_test@127.0.0.1:5432/settle_test
 *   DATABASE_SSL=false
 *
 * Si no hay URL de prueba, los casos se omiten con mensaje claro.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const PORT = 3096;
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
    quote_number: `PGSET-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: '762',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente PG',
    project_description: 'Liquidacion PG',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    invoice_number: 'PG-FAC',
    invoice_date: '2026-01-15',
    credit_days: 30,
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

test('PostgreSQL settlement concurrency', async (t) => {
  if (!PG_AVAILABLE) {
    t.skip('Sin TEST_DATABASE_URL: no se ejecutan pruebas PG destructivas. Use una BD local dedicada (nunca producción).');
    return;
  }

  await t.before(async () => {
    await resetTestDatabase();
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: require('node:path').join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        DATABASE_SSL: process.env.DATABASE_SSL || 'false',
        PG_SKIP_SCHEMA: '',
        SESSION_SECRET: 'test-invoice-settlement-pg',
        ADMIN_PASSWORD: 'admin123',
        NODE_ENV: 'development',
      },
      stdio: 'pipe',
    });
    let stderr = '';
    serverProcess.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    serverProcess.stdout.on('data', () => {});
    try {
      await waitForServer();
    } catch (error) {
      throw new Error(`${error.message}. stderr=${stderr.slice(-2000)}`);
    }
    const adminLogin = await request('POST', '/api/login', {
      username: 'admin',
      password: 'admin123',
    });
    adminCookie = adminLogin.cookie;
    assert.ok(adminCookie, 'admin cookie');
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
  });

  await t.test('two simultaneous settlements: only one residual payment', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PG-CONC-1',
      total_invoiced: 1500,
    }), adminCookie);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    assert.equal(preview.status, 200);
    const payload = {
      invoice_paid_at: '2026-04-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
    };

    const [a, b] = await Promise.all([
      request('POST', `/api/projects/${created.body.id}/settle-invoice`, payload, adminCookie),
      request('POST', `/api/projects/${created.body.id}/settle-invoice`, payload, adminCookie),
    ]);

    const ok = [a, b].filter((r) => r.status === 200);
    const stale = [a, b].filter((r) => r.status === 409);
    assert.ok(ok.length >= 1, `expected success, got ${a.status}/${b.status}`);
    assert.ok(ok.length + stale.length === 2 || ok.length === 2, 'responses should be 200 and/or 409');

    const project = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    assert.equal(project.body.invoice_payment_status, 'Pagada');
    const settlementPayments = (project.body.payments || []).filter((p) =>
      String(p.notes || '').toLowerCase().includes('liquidacion'));
    assert.equal(settlementPayments.length, 1);
    assert.ok(Math.abs(project.body.pending_collection) <= 0.01);
  });

  await t.test('settlement concurrent with manual payment serializes via FOR UPDATE', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'PG-RACE-1',
      total_invoiced: 2000,
    }), adminCookie);
    assert.equal(created.status, 201);

    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    const settlePayload = {
      invoice_paid_at: '2026-04-02',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
    };

    const [settleRes, payRes] = await Promise.all([
      request('POST', `/api/projects/${created.body.id}/settle-invoice`, settlePayload, adminCookie),
      request('POST', `/api/projects/${created.body.id}/payments`, {
        amount: 250,
        currency: 'MXN',
        payment_date: '2026-04-02',
        notes: 'manual concurrent',
      }, adminCookie),
    ]);

    assert.ok([200, 409].includes(settleRes.status), `settle status ${settleRes.status}`);
    assert.ok([201, 409].includes(payRes.status), `pay status ${payRes.status}`);

    const project = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    const settlementPayments = (project.body.payments || []).filter((p) =>
      String(p.notes || '').toLowerCase().includes('liquidacion'));
    assert.ok(settlementPayments.length <= 1);
    assert.ok(Number(project.body.pending_collection) >= -0.01);

    // Resultados válidos bajo serialización:
    // - settle gana → Pagada + 1 liquidación; pago manual 409 OVERPAY o no aplica
    // - pago manual gana → settle 409 STALE; luego se puede liquidar el residual
    if (settleRes.status === 200) {
      assert.equal(project.body.invoice_payment_status, 'Pagada');
      assert.equal(settlementPayments.length, 1);
    } else {
      assert.equal(settleRes.body.code, 'SETTLEMENT_STALE');
      assert.equal(payRes.status, 201);
    }
  });
});
