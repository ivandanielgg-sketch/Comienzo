'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-duplicate-quote.db');
const PORT = 3103;

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
    quote_number: `DQ-${Date.now()}`,
    order_number: 'PED-1',
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: 'Cliente Dup',
    project_description: 'Proyecto duplicado',
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

test('duplicate project quote_number returns 400 and keeps session usable', async (t) => {
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
        SESSION_SECRET: 'test-duplicate-quote',
        ADMIN_PASSWORD: 'admin123',
      },
      stdio: 'pipe',
    });
    await waitForServer();

    const adminLogin = await request('POST', '/api/login', {
      username: 'admin',
      password: 'admin123',
    });
    assert.equal(adminLogin.status, 200);
    adminCookie = adminLogin.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('POST duplicate quote_number returns friendly 400', async () => {
    const first = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: '5588',
      order_number: 'ORD-A',
    }), adminCookie);
    assert.equal(first.status, 201);

    const dup = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: '5588',
      order_number: 'ORD-B',
    }), adminCookie);
    assert.equal(dup.status, 400);
    assert.equal(dup.body.message, 'El numero de cotizacion ya existe.');
  });

  await t.test('PUT duplicate quote_number returns friendly 400', async () => {
    const a = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: '5778',
      order_number: 'ORD-C',
    }), adminCookie);
    assert.equal(a.status, 201);

    const b = await request('POST', '/api/projects', baseProjectPayload({
      quote_number: '5779',
      order_number: 'ORD-D',
    }), adminCookie);
    assert.equal(b.status, 201);

    const conflict = await request('PUT', `/api/projects/${b.body.id}`, baseProjectPayload({
      quote_number: '5778',
      order_number: 'ORD-D',
    }), adminCookie);
    assert.equal(conflict.status, 400);
    assert.equal(conflict.body.message, 'El numero de cotizacion ya existe.');
  });

  await t.test('session and project list still work after duplicate errors', async () => {
    const session = await request('GET', '/api/session', null, adminCookie);
    assert.equal(session.status, 200);
    assert.equal(session.body.authenticated, true);

    const list = await request('GET', '/api/projects?limit=20', null, adminCookie);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.data) || Array.isArray(list.body.items) || Array.isArray(list.body));
  });
});
