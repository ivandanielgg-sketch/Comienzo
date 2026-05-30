const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { normalizePurchaseOrderNumber } = require('../src/ecovis');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-ecovis-integrity.db');
const PORT = 3095;

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
        const newCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), cookie: newCookie || cookie });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: newCookie || cookie });
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
        res.resume();
        resolve();
      });
      req.on('error', () => setTimeout(tryConnect, 100));
    }
    tryConnect();
  });
}

test('ECOVIS integrity fixes', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-ecovis-int', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
    const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = login.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('normalizePurchaseOrderNumber collapses case and spaces', () => {
    assert.equal(normalizePurchaseOrderNumber(' ecovis-001 '), 'ECOVIS-001');
    assert.equal(normalizePurchaseOrderNumber('ECOVIS-001'), 'ECOVIS-001');
  });

  let projectId;
  let paymentId;

  await t.test('create project and payment', async () => {
    const proj = await request('POST', '/api/ecovis/projects', {
      project_name: 'Integrity Proj',
      project_date: '2026-06-01',
      total_amount: 100000,
      currency: 'MXN',
      purchase_order_not_applicable: true,
    }, adminCookie);
    assert.equal(proj.status, 201);
    projectId = proj.body.id;

    const pay = await request('POST', '/api/ecovis/payments', {
      payment_date: '2026-06-02',
      amount: 50000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(pay.status, 201);
    paymentId = pay.body.id;
    assert.equal(pay.body.unallocated_amount, 50000);
  });

  await t.test('edit payment amount without allocations succeeds', async () => {
    const res = await request('PUT', `/api/ecovis/payments/${paymentId}`, {
      payment_date: '2026-06-02',
      amount: 55000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.amount, 55000);
    assert.equal(res.body.amount_mxn, 55000);
  });

  await t.test('allocate payment to project', async () => {
    const res = await request('POST', `/api/ecovis/payments/${paymentId}/allocations`, {
      allocation_type: 'proyecto',
      ecovis_project_id: projectId,
      amount: 40000,
    }, adminCookie);
    assert.equal(res.status, 201);
  });

  await t.test('blocked direct amount edit on payment with allocations', async () => {
    const res = await request('PUT', `/api/ecovis/payments/${paymentId}`, {
      payment_date: '2026-06-02',
      amount: 60000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(String(res.body.message || '').includes('ajuste controlado'));
  });

  await t.test('blocked direct amount edit on project with allocations', async () => {
    const res = await request('PUT', `/api/ecovis/projects/${projectId}`, {
      project_name: 'Integrity Proj',
      project_date: '2026-06-01',
      total_amount: 80000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(res.status, 400);
  });

  await t.test('amount adjustment updates project total', async () => {
    const res = await request('POST', '/api/ecovis/amount-adjustments', {
      entity_type: 'project',
      entity_id: projectId,
      new_amount_original: 120000,
      new_currency: 'MXN',
      reason: 'Correccion contractual',
    }, adminCookie);
    assert.equal(res.status, 201);
    assert.equal(res.body.adjustment.difference_mxn, 20000);

    const proj = await request('GET', `/api/ecovis/projects?limit=9999`, null, adminCookie);
    const updated = proj.body.data.find((p) => p.id === projectId);
    assert.equal(updated.total_amount, 120000);
  });

  await t.test('for_allocation filters exclude fully paid projects', async () => {
    const fullPay = await request('POST', '/api/ecovis/payments', {
      payment_date: '2026-06-10',
      amount: 80000,
      currency: 'MXN',
    }, adminCookie);
    await request('POST', `/api/ecovis/payments/${fullPay.body.id}/allocations`, {
      allocation_type: 'proyecto',
      ecovis_project_id: projectId,
      amount: 80000,
    }, adminCookie);

    const list = await request('GET', '/api/ecovis/projects?limit=9999&for_allocation=1', null, adminCookie);
    const found = list.body.data.find((p) => p.id === projectId);
    assert.equal(found, undefined);
  });

  await t.test('duplicate PO blocked with normalized number', async () => {
    const first = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: 'ECOVIS-001',
      order_date: '2026-06-01',
      total_amount: 5000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(first.status, 201);

    const dup = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: ' ecovis-001 ',
      order_date: '2026-06-02',
      total_amount: 5000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(dup.status, 400);
    assert.ok(String(dup.body.message || '').includes('orden de compra activa'));
  });

  await t.test('for_allocation payments exclude fully allocated', async () => {
    const list = await request('GET', '/api/ecovis/payments?limit=9999&for_allocation=1', null, adminCookie);
    const fullyAllocated = list.body.data.find((p) => p.id === paymentId);
    assert.equal(fullyAllocated, undefined);
  });
});
