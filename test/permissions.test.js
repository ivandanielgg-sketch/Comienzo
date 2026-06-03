const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-permissions.db');
const PORT = 3096;

let serverProcess;
let adminCookie;
let userCookie;
let tecnicoCookie;

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

test('permissions enforcement', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-perms', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();

    const adminLogin = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = adminLogin.cookie;

    await request('POST', '/api/admin/verify', { password: 'admin123' }, adminCookie);
    await request('POST', '/api/users', { username: 'testuser', password: 'User123!', role: 'user' }, adminCookie);
    await request('POST', '/api/users', { username: 'testtecnico', password: 'Tech123!', role: 'tecnico' }, adminCookie);

    const userLogin = await request('POST', '/api/login', { username: 'testuser', password: 'User123!' });
    userCookie = userLogin.cookie;

    const tecnicoLogin = await request('POST', '/api/login', { username: 'testtecnico', password: 'Tech123!' });
    tecnicoCookie = tecnicoLogin.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('admin accesses all endpoints', async () => {
    const projects = await request('GET', '/api/projects', null, adminCookie);
    assert.equal(projects.status, 200);
    const ecovis = await request('GET', '/api/ecovis/summary', null, adminCookie);
    assert.equal(ecovis.status, 200);
    const users = await request('GET', '/api/users', null, adminCookie);
    assert.equal(users.status, 200);
    const backup = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(backup.status, 200);
    const vacations = await request('GET', '/api/employees', null, adminCookie);
    assert.equal(vacations.status, 200);
  });

  await t.test('regular user can view projects', async () => {
    const res = await request('GET', '/api/projects', null, userCookie);
    assert.equal(res.status, 200);
  });

  await t.test('regular user can create projects', async () => {
    const res = await request('POST', '/api/projects', {
      quote_number: 'PERM-001', order_number: 'PED-P1',
      purchase_order_not_applicable: true, tecnico_id: 1, vendedor_id: 2,
      client_name: 'Client', project_description: 'Test perm',
      fecha_vencimiento: '2026-09-01', promised_delivery_date: '2026-08-01',
      expected_margin: 10, total_invoiced: 1000, total_invoiced_currency: 'MXN',
      progress_percent: 0, status: 'Pendiente', risk: 'Bajo',
    }, userCookie);
    assert.equal(res.status, 201);
  });

  await t.test('tecnico only sees reports', async () => {
    const projects = await request('GET', '/api/projects', null, tecnicoCookie);
    assert.equal(projects.status, 403);

    const reports = await request('GET', '/api/reports/projects', null, tecnicoCookie);
    assert.equal(reports.status, 200);
  });

  await t.test('tecnico cannot access vacations', async () => {
    const res = await request('GET', '/api/employees', null, tecnicoCookie);
    assert.equal(res.status, 403);
  });

  await t.test('tecnico cannot access ECOVIS', async () => {
    const res = await request('GET', '/api/ecovis/summary', null, tecnicoCookie);
    assert.equal(res.status, 403);
  });

  await t.test('tecnico cannot access users', async () => {
    const res = await request('GET', '/api/users', null, tecnicoCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user cannot access vacations by default', async () => {
    const res = await request('GET', '/api/employees', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user cannot access ECOVIS by default', async () => {
    const res = await request('GET', '/api/ecovis/summary', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user cannot access backup by default', async () => {
    const res = await request('GET', '/api/admin/backup', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user cannot access users by default', async () => {
    const res = await request('GET', '/api/users', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('denied access is logged in audit', async () => {
    const logs = await request('GET', '/api/admin/audit-logs?action=access_denied', null, adminCookie);
    assert.equal(logs.status, 200);
    assert.ok(logs.body.data.length > 0, 'Should have access_denied logs');
    const denied = logs.body.data[0];
    assert.ok(denied.metadata_json, 'Should have metadata');
    const meta = JSON.parse(denied.metadata_json);
    assert.ok(meta.required_permission, 'Should record required permission');
    assert.ok(meta.endpoint, 'Should record endpoint');
  });

  await t.test('backup requires permission', async () => {
    const res = await request('GET', '/api/admin/backup', null, userCookie);
    assert.equal(res.status, 403);
    const importRes = await request('POST', '/api/admin/backup/import', {}, userCookie);
    assert.equal(importRes.status, 403);
  });

  await t.test('session returns permissions', async () => {
    const res = await request('GET', '/api/session', null, userCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.permissions);
    assert.ok(Array.isArray(res.body.permissions.projects));
    assert.ok(res.body.permissions.projects.includes('view'));
  });

  await t.test('admin can manage user permissions', async () => {
    const usersRes = await request('GET', '/api/users', null, adminCookie);
    const testUser = usersRes.body.data.find(u => u.username === 'testuser');

    const permsRes = await request('GET', `/api/users/${testUser.id}/permissions`, null, adminCookie);
    assert.equal(permsRes.status, 200);
    assert.ok(permsRes.body.permissions);

    const newPerms = { ...permsRes.body.permissions, vacations: ['view'] };
    const updateRes = await request('PUT', `/api/users/${testUser.id}/permissions`, { permissions: newPerms }, adminCookie);
    assert.equal(updateRes.status, 200);

    const userLogin = await request('POST', '/api/login', { username: 'testuser', password: 'User123!' });
    const newUserCookie = userLogin.cookie;
    const vacRes = await request('GET', '/api/employees', null, newUserCookie);
    assert.equal(vacRes.status, 200);
  });

  await t.test('login still works correctly', async () => {
    const res = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.username, 'admin');
  });

  await t.test('admin dashboard works', async () => {
    const res = await request('GET', '/api/projects', null, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.data !== undefined || Array.isArray(res.body));
  });

  await t.test('build works (server responding)', async () => {
    const res = await request('GET', '/api/session', null, adminCookie);
    assert.equal(res.status, 200);
  });
});
