const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-project-restore.db');
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

function waitForServer(timeoutMs = 8000) {
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

test('project close and restore keeps the same record and related data', async (t) => {
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
        SESSION_SECRET: 'test-restore',
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

  await t.test('rejects invalid restore id', async () => {
    const res = await request('POST', '/api/closed-projects/abc/restore', {}, adminCookie);
    assert.equal(res.status, 400);
  });

  await t.test('rejects restore of an active project', async () => {
    const created = await request('POST', '/api/projects', {
      quote_number: 'REST-ACTIVE',
      order_number: 'PED-ACTIVE',
      purchase_order_not_applicable: true,
      tecnico_id: 1,
      vendedor_id: 2,
      client_name: 'Cliente Activo',
      project_description: 'Activo',
      fecha_vencimiento: '2026-09-01',
      promised_delivery_date: '2026-08-01',
      expected_margin: 10,
      total_invoiced: 1000,
      total_invoiced_currency: 'MXN',
      progress_percent: 0,
      status: 'Pendiente',
      risk: 'Bajo',
    }, adminCookie);
    assert.equal(created.status, 201);

    const res = await request('POST', `/api/closed-projects/${created.body.id}/restore`, {}, adminCookie);
    assert.equal(res.status, 400);
  });

  await t.test('close then restore keeps id, payments and costs', async () => {
    const created = await request('POST', '/api/projects', {
      quote_number: 'REST-001',
      order_number: '762',
      purchase_order_not_applicable: true,
      tecnico_id: 1,
      vendedor_id: 2,
      client_name: 'Ergon Salina Cruz',
      project_description: 'Proyecto restore test',
      fecha_vencimiento: '2026-09-01',
      promised_delivery_date: '2026-08-01',
      expected_margin: 10,
      total_invoiced: 1000,
      total_invoiced_currency: 'MXN',
      progress_percent: 0,
      status: 'Pendiente',
      risk: 'Bajo',
    }, adminCookie);
    assert.equal(created.status, 201);
    const projectId = created.body.id;

    const payment = await request('POST', `/api/projects/${projectId}/payments`, {
      amount: 250,
      currency: 'MXN',
      payment_date: '2026-07-01',
      notes: 'pago restore',
    }, adminCookie);
    assert.equal(payment.status, 201);

    const cost = await request('POST', `/api/projects/${projectId}/costs`, {
      category: 'Compra',
      description: 'costo restore',
      amount: 80,
      currency: 'MXN',
      cost_date: '2026-07-02',
    }, adminCookie);
    assert.equal(cost.status, 201);

    const closed = await request('DELETE', `/api/projects/${projectId}`, {
      password: 'admin123',
    }, adminCookie);
    assert.equal(closed.status, 204);

    const closedList = await request('GET', '/api/closed-projects?limit=100', null, adminCookie);
    assert.equal(closedList.status, 200);
    const closedProject = closedList.body.data.find((p) => p.id === projectId);
    assert.ok(closedProject);
    assert.ok(closedProject.closed_at);
    assert.equal(closedProject.payments.length, 1);
    assert.equal(closedProject.costs.length, 1);

    const activeBefore = await request('GET', '/api/projects?limit=100', null, adminCookie);
    assert.ok(!activeBefore.body.data.some((p) => p.id === projectId));

    const restored = await request('POST', `/api/closed-projects/${projectId}/restore`, {}, adminCookie);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.id, projectId);
    assert.equal(restored.body.closed_at, null);
    assert.equal(restored.body.order_number, '762');
    assert.equal(restored.body.client_name, 'Ergon Salina Cruz');
    assert.equal(restored.body.payments.length, 1);
    assert.equal(restored.body.costs.length, 1);
    assert.equal(Number(restored.body.payments[0].amount), 250);
    assert.equal(Number(restored.body.costs[0].amount), 80);

    const activeAfter = await request('GET', '/api/projects?limit=100', null, adminCookie);
    assert.ok(activeAfter.body.data.some((p) => p.id === projectId));

    const closedAfter = await request('GET', '/api/closed-projects?limit=100', null, adminCookie);
    assert.ok(!closedAfter.body.data.some((p) => p.id === projectId));
  });
});
