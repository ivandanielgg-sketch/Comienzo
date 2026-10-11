'use strict';

/**
 * Validación final Etapa 3 — integridad financiera post-liquidación.
 * Usa SQLite throwaway (nunca producción).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-project-invoice-settlement-integrity.db');
const PORT = 3094;

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

function waitForServer(timeoutMs = 15000) {
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
    quote_number: `INT-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: '762',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente Integridad',
    project_description: 'Validacion final etapa 3',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 1000,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    invoice_number: 'FAC-INT',
    invoice_date: '2026-01-15',
    credit_days: 0,
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

async function settleProject(projectId, cookie, { confirmMxn = false } = {}) {
  const preview = await request('GET', `/api/projects/${projectId}/settlement-preview`, null, cookie);
  assert.equal(preview.status, 200);
  const body = {
    invoice_paid_at: '2026-03-01',
    expected_pending_mxn: preview.body.pending_collection_mxn,
    confirm: true,
  };
  if (confirmMxn) body.confirm_mxn_matches_real_payment = true;
  const settled = await request('POST', `/api/projects/${projectId}/settle-invoice`, body, cookie);
  assert.equal(settled.status, 200, JSON.stringify(settled.body));
  assert.equal(settled.body.invoice_payment_status, 'Pagada');
  return settled.body;
}

test('Stage 3 financial integrity validation', async (t) => {
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
        SESSION_SECRET: 'test-invoice-settlement-integrity',
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
    assert.ok(adminCookie);
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  await t.test('1) deleting a payment after settle reopens status to Pendiente', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INT-DEL-1',
      total_invoiced: 1000,
    }), adminCookie);
    assert.equal(created.status, 201);
    const settled = await settleProject(created.body.id, adminCookie);
    assert.ok(settled.payments.length >= 1);
    const paymentId = settled.payments[0].id;

    const denied = await request('DELETE', `/api/projects/${created.body.id}/payments/${paymentId}`, {
      password: 'wrong',
    }, adminCookie);
    assert.equal(denied.status, 403);

    const deleted = await request('DELETE', `/api/projects/${created.body.id}/payments/${paymentId}`, {
      password: 'admin123',
    }, adminCookie);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.invoice_payment_status_stored || deleted.body.invoice_payment_status, 'Pendiente');
    assert.equal(deleted.body.invoice_paid_at, null);
    assert.ok(deleted.body.pending_collection > 0.01);
    assert.equal((deleted.body.payments || []).length, 0);
  });

  await t.test('2) increasing invoiced amount on Pagada requires status review', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INT-INV-1',
      total_invoiced: 500,
    }), adminCookie);
    await settleProject(created.body.id, adminCookie);

    const blocked = await request('PUT', `/api/projects/${created.body.id}`, baseProjectPayload({
      quote_number: 'INT-INV-1',
      total_invoiced: 800,
      invoice_payment_status: 'Pagada',
      invoice_paid_at: '2026-03-01',
    }), adminCookie);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'INVOICE_AMOUNT_REQUIRES_STATUS_REVIEW');
    assert.ok(blocked.body.pending_collection_mxn > 0.01);

    const still = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    assert.equal(still.body.total_invoiced, 500);
    assert.equal(still.body.invoice_payment_status, 'Pagada');

    const reviewed = await request('PUT', `/api/projects/${created.body.id}`, baseProjectPayload({
      quote_number: 'INT-INV-1',
      total_invoiced: 800,
      invoice_payment_status: 'Pendiente',
    }), adminCookie);
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.total_invoiced, 800);
    assert.equal(reviewed.body.invoice_payment_status_stored || reviewed.body.invoice_payment_status, 'Pendiente');
    assert.ok(reviewed.body.pending_collection > 0.01);
  });

  await t.test('3) changing exchange_rates can reopen material pending on settled FX project (document only)', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'INT-FX-1',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }), adminCookie);
    const settled = await settleProject(created.body.id, adminCookie, { confirmMxn: true });
    assert.ok(Math.abs(settled.pending_collection) <= 0.01);
    assert.equal(settled.payments[0].currency, 'MXN');

    const rates = await request('PUT', '/api/exchange-rates', { USD: 20, EUR: 19 }, adminCookie);
    assert.equal(rates.status, 200);

    const after = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    // Documented behavior (no FX logic change in Stage 3):
    // live rates recalculate invoiced MXN; residual was locked as MXN cash amount.
    assert.equal(after.body.invoice_payment_status, 'Pagada');
    assert.equal(after.body.total_invoiced_mxn, 2000);
    assert.equal(after.body.total_charged, 1700);
    assert.equal(after.body.pending_collection, 300);
  });
});
