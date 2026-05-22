const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-ecovis-po.db');
const PORT = 3094;

let serverProcess;
let adminCookie;
let userCookie;

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

function waitForServer(timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'));
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        let d = '';
        res.on('data', (c) => { d += c; });
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 100));
    }
    tryConnect();
  });
}

test('ECOVIS purchase orders', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-ecovis-po', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
    const adminLogin = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = adminLogin.cookie;
    await request('POST', '/api/admin/verify', { password: 'admin123' }, adminCookie);
    await request('POST', '/api/users', { username: 'viewuser', password: 'View123!', role: 'user' }, adminCookie);
    const userLogin = await request('POST', '/api/login', { username: 'viewuser', password: 'View123!' });
    userCookie = userLogin.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  let poId;
  let paymentId;

  await t.test('create ECOVIS purchase order', async () => {
    const res = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: 'OC-ECOVIS-001',
      order_date: '2026-06-01',
      total_amount: 100000,
      currency: 'MXN',
      project_name: 'Proyecto Caldera ECOVIS',
      notes: 'OC de prueba',
    }, adminCookie);
    assert.equal(res.status, 201);
    assert.equal(res.body.purchase_order_number, 'OC-ECOVIS-001');
    assert.equal(res.body.total_amount, 100000);
    assert.equal(res.body.status, 'pendiente');
    poId = res.body.id;
  });

  await t.test('cannot create duplicate active PO', async () => {
    const res = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: 'OC-ECOVIS-001',
      order_date: '2026-06-01',
      total_amount: 50000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('Ya existe'));
  });

  await t.test('register ECOVIS payment', async () => {
    const res = await request('POST', '/api/ecovis/payments', {
      payment_date: '2026-06-15',
      amount: 150000,
      currency: 'MXN',
      payment_method: 'Transferencia',
      bank_reference: 'REF-001',
      source_description: 'Pago ECOVIS junio',
    }, adminCookie);
    assert.equal(res.status, 201);
    paymentId = res.body.id;
  });

  await t.test('allocate payment to PO', async () => {
    const res = await request('POST', `/api/ecovis/purchase-orders/${poId}/allocate`, {
      payment_id: paymentId,
      amount: 80000,
      notes: 'Abono parcial a OC-001',
    }, adminCookie);
    assert.equal(res.status, 201);
    assert.equal(res.body.allocation_type, 'orden_compra');
    assert.equal(res.body.amount, 80000);
    assert.equal(res.body.ecovis_purchase_order_id, poId);
  });

  await t.test('PO balance is correctly calculated (partial)', async () => {
    const res = await request('GET', `/api/ecovis/purchase-orders/${poId}`, null, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.total_amount, 100000);
    assert.equal(res.body.total_applied_payments, 80000);
    assert.equal(res.body.pending_balance, 20000);
    assert.equal(res.body.status, 'parcialmente_pagada');
  });

  await t.test('split payment between PO and saldo_a_favor', async () => {
    const res = await request('POST', `/api/ecovis/payments/${paymentId}/allocations`, {
      allocation_type: 'saldo_a_favor',
      amount: 20000,
      notes: 'Excedente a saldo a favor',
    }, adminCookie);
    assert.equal(res.status, 201);
  });

  await t.test('payment shows correct unallocated amount', async () => {
    const payments = await request('GET', '/api/ecovis/payments', null, adminCookie);
    const payment = payments.body.data.find(p => p.id === paymentId);
    assert.ok(payment);
    assert.equal(payment.amount, 150000);
    assert.equal(payment.unallocated_amount, 50000);
  });

  await t.test('leave payment partially unassigned', async () => {
    const payments = await request('GET', '/api/ecovis/payments', null, adminCookie);
    const payment = payments.body.data.find(p => p.id === paymentId);
    assert.ok(payment.unallocated_amount > 0, 'Should have unallocated amount');
  });

  await t.test('assign remaining to PO completes it', async () => {
    const res = await request('POST', `/api/ecovis/purchase-orders/${poId}/allocate`, {
      payment_id: paymentId,
      amount: 20000,
      notes: 'Pago final OC-001',
    }, adminCookie);
    assert.equal(res.status, 201);

    const poRes = await request('GET', `/api/ecovis/purchase-orders/${poId}`, null, adminCookie);
    assert.equal(poRes.body.status, 'pagada');
    assert.equal(poRes.body.pending_balance, 0);
  });

  await t.test('PO detail shows applied payments', async () => {
    const res = await request('GET', `/api/ecovis/purchase-orders/${poId}`, null, adminCookie);
    assert.ok(res.body.allocations);
    assert.equal(res.body.allocations.length, 2);
    const totalApplied = res.body.allocations.reduce((s, a) => s + a.amount, 0);
    assert.equal(totalApplied, 100000);
  });

  await t.test('cannot allocate to cancelled PO', async () => {
    const po2 = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: 'OC-ECOVIS-002',
      order_date: '2026-06-01',
      total_amount: 50000,
      currency: 'MXN',
    }, adminCookie);
    await request('POST', `/api/ecovis/purchase-orders/${po2.body.id}/cancel`, { reason: 'Cancelada por prueba' }, adminCookie);

    const res = await request('POST', `/api/ecovis/purchase-orders/${po2.body.id}/allocate`, {
      payment_id: paymentId,
      amount: 10000,
    }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('cancelada'));
  });

  await t.test('cannot exceed payment available amount', async () => {
    const po3 = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: 'OC-ECOVIS-003',
      order_date: '2026-07-01',
      total_amount: 200000,
      currency: 'MXN',
    }, adminCookie);

    const res = await request('POST', `/api/ecovis/purchase-orders/${po3.body.id}/allocate`, {
      payment_id: paymentId,
      amount: 999999,
    }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('excede'));
  });

  await t.test('ECOVIS project can be linked to PO', async () => {
    const projRes = await request('POST', '/api/ecovis/projects', {
      project_name: 'Proyecto OC Test',
      project_date: '2026-07-01',
      total_amount: 30000,
      currency: 'MXN',
      ecovis_purchase_order_id: poId,
    }, adminCookie);
    assert.equal(projRes.status, 201);
  });

  await t.test('PO list endpoint works with pagination', async () => {
    const res = await request('GET', '/api/ecovis/purchase-orders', null, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.data);
    assert.ok(res.body.pagination);
    assert.ok(res.body.data.length >= 2);
  });

  await t.test('payment list shows allocation status', async () => {
    const res = await request('GET', '/api/ecovis/payments', null, adminCookie);
    assert.equal(res.status, 200);
    const payment = res.body.data.find(p => p.id === paymentId);
    assert.ok(payment);
    assert.ok(payment.unallocated_amount !== undefined);
  });

  await t.test('user without permission gets 403', async () => {
    const res = await request('POST', '/api/ecovis/purchase-orders', {
      purchase_order_number: 'OC-HACK',
      order_date: '2026-01-01',
      total_amount: 1000,
      currency: 'MXN',
    }, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('audit log records PO creation', async () => {
    const logs = await request('GET', '/api/admin/audit-logs?module=ecovis', null, adminCookie);
    const poLogs = logs.body.data.filter(l => l.entity_type === 'ecovis_purchase_order' && l.action === 'create');
    assert.ok(poLogs.length > 0, 'Should have audit log for PO creation');
    assert.ok(poLogs.some(l => l.entity_label === 'OC-ECOVIS-001'), 'Should have log for OC-001');
  });

  await t.test('dates shown in CDMX timezone', async () => {
    const res = await request('GET', `/api/ecovis/purchase-orders/${poId}`, null, adminCookie);
    assert.ok(res.body.created_at_cdmx);
    assert.ok(res.body.created_at_cdmx.includes('/'));
  });

  await t.test('backup includes ecovisPurchaseOrders', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(res.body.data.ecovisPurchaseOrders);
    assert.ok(res.body.data.ecovisPurchaseOrders.length >= 2);
    assert.ok(res.body.backupMetadata.includedEntities.includes('ecovisPurchaseOrders'));
  });

  await t.test('import does not create duplicate POs', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const importRes = await request('POST', '/api/admin/backup/import', backupRes.body, adminCookie);
    assert.equal(importRes.status, 200);
    const poSummary = importRes.body.importLog.summary.ecovisPurchaseOrders;
    assert.equal(poSummary.added, 0, 'Should not add duplicate POs');
  });

  await t.test('build works', async () => {
    const res = await request('GET', '/api/session', null, adminCookie);
    assert.equal(res.status, 200);
  });
});
