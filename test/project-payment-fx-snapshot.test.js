'use strict';

/**
 * Snapshots FX de proyectos (Etapa 3 corrección definitiva).
 * SQLite throwaway — nunca producción.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const {
  buildProjectTotals,
  capturePaymentFxSnapshot,
  resolveInvoicedAmountMxn,
} = require('../src/calculations');
const { migrateProjectPaymentFx } = require('../src/db/projectPaymentFxMigration');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-project-payment-fx-snapshot.db');
const PORT = 3091;

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
    quote_number: `FX-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    order_number: '762',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente FX',
    project_description: 'Snapshot FX',
    fecha_vencimiento: '2026-12-01',
    promised_delivery_date: '2026-11-01',
    expected_margin: 10,
    total_invoiced: 100,
    total_invoiced_currency: 'USD',
    progress_percent: 0,
    status: 'Pendiente',
    risk: 'Bajo',
    invoice_number: 'FAC-FX',
    invoice_date: '2026-01-15',
    credit_days: 0,
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

async function settle(projectId, cookie, { confirmMxn = true } = {}) {
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
  return settled.body;
}

test('calculations use payment/invoice FX snapshots', async (t) => {
  await t.test('capturePaymentFxSnapshot', () => {
    assert.deepEqual(capturePaymentFxSnapshot(100, 'USD', { USD: 17 }), {
      exchange_rate_to_mxn: 17,
      amount_mxn: 1700,
    });
    assert.deepEqual(capturePaymentFxSnapshot(50, 'MXN', { USD: 20 }), {
      exchange_rate_to_mxn: 1,
      amount_mxn: 50,
    });
  });

  await t.test('buildProjectTotals prefers historical amount_mxn and invoiced snapshot', () => {
    const totals = buildProjectTotals(
      {
        total_invoiced: 100,
        total_invoiced_currency: 'USD',
        invoiced_amount_mxn: 1700,
        invoiced_exchange_rate_to_mxn: 17,
      },
      [{ amount: 1700, currency: 'MXN', amount_mxn: 1700, exchange_rate_to_mxn: 1 }],
      [],
      { USD: 20, MXN: 1 },
    );
    assert.equal(totals.total_invoiced_mxn, 1700);
    assert.equal(totals.total_charged, 1700);
    assert.equal(totals.pending_collection, 0);
  });

  await t.test('resolveInvoicedAmountMxn falls back to live when no snapshot', () => {
    assert.equal(
      resolveInvoicedAmountMxn({ total_invoiced: 100, total_invoiced_currency: 'USD' }, { USD: 20 }),
      2000,
    );
  });
});

test('sqlite FX migration is idempotent and does not backfill', async (t) => {
  const Database = require('better-sqlite3');
  const tmp = path.join(__dirname, '..', 'data', 'test-fx-migration-idempotent.db');
  for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  const db = new Database(tmp);
  db.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY, total_invoiced REAL);
    CREATE TABLE project_payments (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,
      amount REAL,
      currency TEXT
    );
    INSERT INTO project_payments (id, project_id, amount, currency) VALUES (1, 1, 100, 'USD');
  `);
  migrateProjectPaymentFx(db, { postgres: false });
  migrateProjectPaymentFx(db, { postgres: false });
  const cols = db.prepare('PRAGMA table_info(project_payments)').all().map((c) => c.name);
  assert.ok(cols.includes('exchange_rate_to_mxn'));
  assert.ok(cols.includes('amount_mxn'));
  const row = db.prepare('SELECT exchange_rate_to_mxn, amount_mxn FROM project_payments WHERE id = 1').get();
  assert.equal(row.exchange_rate_to_mxn, null);
  assert.equal(row.amount_mxn, null);
  db.close();
  fs.unlinkSync(tmp);
});

test('project payment FX snapshots API (SQLite)', async (t) => {
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
        SESSION_SECRET: 'test-fx-snapshot',
        ADMIN_PASSWORD: 'admin123',
      },
      stdio: 'pipe',
    });
    await waitForServer();
    const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = login.cookie;
    assert.ok(adminCookie);
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  await t.test('USD settle @17 then FX→20 keeps Pagada and pending 0', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'FX-USD-LOCK',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }), adminCookie);
    assert.equal(created.status, 201);

    const settled = await settle(created.body.id, adminCookie);
    assert.equal(settled.invoice_payment_status, 'Pagada');
    assert.ok(Math.abs(settled.pending_collection) <= 0.01);
    assert.equal(settled.invoiced_amount_mxn_historical, 1700);
    assert.equal(settled.invoiced_exchange_rate_to_mxn, 17);
    assert.equal(settled.payments[0].amount, 1700);
    assert.equal(settled.payments[0].currency, 'MXN');
    assert.equal(settled.payments[0].amount_mxn, 1700);
    assert.equal(settled.payments[0].exchange_rate_to_mxn, 1);
    assert.equal(settled.payments[0].amount_mxn_is_historical, true);
    const paidAt = settled.invoice_paid_at;

    const rates = await request('PUT', '/api/exchange-rates', { USD: 20, EUR: 19 }, adminCookie);
    assert.equal(rates.status, 200);

    const after = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    assert.equal(after.body.invoice_payment_status, 'Pagada');
    assert.equal(after.body.pending_collection, 0);
    assert.equal(after.body.total_invoiced_mxn, 1700);
    assert.equal(after.body.total_charged, 1700);
    assert.equal(after.body.payments[0].amount, 1700);
    assert.equal(after.body.payments[0].exchange_rate_to_mxn, 1);
    assert.equal(after.body.invoice_paid_at, paidAt);

    const listed = await request('GET', '/api/projects?search=FX-USD-LOCK', null, adminCookie);
    const row = (listed.body.data || []).find((p) => p.id === created.body.id);
    assert.ok(row);
    assert.equal(row.pending_collection, 0);
    assert.equal(row.invoice_payment_status, 'Pagada');
  });

  await t.test('partial payments keep individual FX rates', async () => {
    await request('PUT', '/api/exchange-rates', { USD: 17, EUR: 19 }, adminCookie);
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'FX-PARTIAL',
      total_invoiced: 200,
      total_invoiced_currency: 'USD',
    }), adminCookie);

    const p1 = await request('POST', `/api/projects/${created.body.id}/payments`, {
      amount: 50,
      currency: 'USD',
      payment_date: '2026-02-01',
      notes: 'parcial 1',
    }, adminCookie);
    assert.equal(p1.status, 201);
    const pay1 = p1.body.payments.find((p) => p.notes === 'parcial 1');
    assert.equal(pay1.exchange_rate_to_mxn, 17);
    assert.equal(pay1.amount_mxn, 850);

    await request('PUT', '/api/exchange-rates', { USD: 18, EUR: 19 }, adminCookie);
    const p2 = await request('POST', `/api/projects/${created.body.id}/payments`, {
      amount: 50,
      currency: 'USD',
      payment_date: '2026-02-15',
      notes: 'parcial 2',
    }, adminCookie);
    const pay2 = p2.body.payments.find((p) => p.notes === 'parcial 2');
    assert.equal(pay2.exchange_rate_to_mxn, 18);
    assert.equal(pay2.amount_mxn, 900);

    // Históricos individuales intactos tras otro cambio de TC
    await request('PUT', '/api/exchange-rates', { USD: 20, EUR: 19 }, adminCookie);
    const detail = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    const again1 = detail.body.payments.find((p) => p.notes === 'parcial 1');
    const again2 = detail.body.payments.find((p) => p.notes === 'parcial 2');
    assert.equal(again1.exchange_rate_to_mxn, 17);
    assert.equal(again1.amount_mxn, 850);
    assert.equal(again2.exchange_rate_to_mxn, 18);
    assert.equal(again2.amount_mxn, 900);
  });

  await t.test('delete payment after settle reopens without clearing invoice snapshot', async () => {
    await request('PUT', '/api/exchange-rates', { USD: 17, EUR: 19 }, adminCookie);
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'FX-DEL',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }), adminCookie);
    const settled = await settle(created.body.id, adminCookie);
    assert.equal(settled.invoiced_amount_mxn_historical, 1700);

    const deleted = await request('DELETE', `/api/projects/${created.body.id}/payments/${settled.payments[0].id}`, {
      password: 'admin123',
    }, adminCookie);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.invoice_payment_status_stored || deleted.body.invoice_payment_status, 'Pendiente');
    assert.equal(deleted.body.invoiced_amount_mxn_historical, 1700);
    assert.equal(deleted.body.invoiced_exchange_rate_to_mxn, 17);
    assert.equal(deleted.body.pending_collection, 1700);

    // Re-settle preserves original invoice snapshot even if live FX changed
    await request('PUT', '/api/exchange-rates', { USD: 20, EUR: 19 }, adminCookie);
    const resettled = await settle(created.body.id, adminCookie);
    assert.equal(resettled.invoice_payment_status, 'Pagada');
    assert.equal(resettled.invoiced_amount_mxn_historical, 1700);
    assert.equal(resettled.pending_collection, 0);
    assert.equal(resettled.payments[0].amount_mxn, 1700);
  });

  await t.test('invoice amount change clears snapshot and requires status review', async () => {
    await request('PUT', '/api/exchange-rates', { USD: 17, EUR: 19 }, adminCookie);
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'FX-INV-CHG',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }), adminCookie);
    await settle(created.body.id, adminCookie);

    const blocked = await request('PUT', `/api/projects/${created.body.id}`, baseProjectPayload({
      quote_number: 'FX-INV-CHG',
      total_invoiced: 120,
      total_invoiced_currency: 'USD',
      invoice_payment_status: 'Pagada',
      invoice_paid_at: '2026-03-01',
    }), adminCookie);
    assert.equal(blocked.status, 409);

    const reviewed = await request('PUT', `/api/projects/${created.body.id}`, baseProjectPayload({
      quote_number: 'FX-INV-CHG',
      total_invoiced: 120,
      total_invoiced_currency: 'USD',
      invoice_payment_status: 'Pendiente',
    }), adminCookie);
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.invoiced_amount_mxn_historical, null);
    assert.equal(reviewed.body.invoiced_exchange_rate_to_mxn, null);
  });

  await t.test('historical payments without snapshots remain queryable as non-historical', async () => {
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'FX-LEGACY',
      total_invoiced: 1000,
      total_invoiced_currency: 'MXN',
    }), adminCookie);
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    db.prepare(
      `INSERT INTO project_payments (project_id, amount, currency, payment_date, notes, created_at, exchange_rate_to_mxn, amount_mxn)
       VALUES (?, 400, 'MXN', '2025-01-01', 'legacy', datetime('now'), NULL, NULL)`,
    ).run(created.body.id);
    db.close();

    const detail = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    const legacy = detail.body.payments.find((p) => p.notes === 'legacy');
    assert.ok(legacy);
    assert.equal(legacy.amount_mxn_is_historical, false);
    assert.equal(legacy.exchange_rate_to_mxn, null);
    assert.equal(legacy.amount_mxn, 400); // estimación operativa viva, no marcada histórica
    assert.equal(detail.body.pending_collection, 600);
  });

  await t.test('concurrent double settle still single residual with FX columns', async () => {
    await request('PUT', '/api/exchange-rates', { USD: 17, EUR: 19 }, adminCookie);
    const created = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: 'FX-CONC',
      total_invoiced: 100,
      total_invoiced_currency: 'USD',
    }), adminCookie);
    const preview = await request('GET', `/api/projects/${created.body.id}/settlement-preview`, null, adminCookie);
    const payload = {
      invoice_paid_at: '2026-03-01',
      expected_pending_mxn: preview.body.pending_collection_mxn,
      confirm: true,
      confirm_mxn_matches_real_payment: true,
    };
    const [a, b] = await Promise.all([
      request('POST', `/api/projects/${created.body.id}/settle-invoice`, payload, adminCookie),
      request('POST', `/api/projects/${created.body.id}/settle-invoice`, payload, adminCookie),
    ]);
    assert.ok([a, b].some((r) => r.status === 200));
    const project = await request('GET', `/api/projects/${created.body.id}`, null, adminCookie);
    const settlements = (project.body.payments || []).filter((p) =>
      String(p.notes || '').toLowerCase().includes('liquidacion'));
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].amount_mxn_is_historical, true);
    assert.equal(project.body.pending_collection, 0);
  });
});
