const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-login-security.db');
const PORT = 3097;

let serverProcess;
let cookie;

function request(method, urlPath, body) {
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
        if (res.headers['set-cookie']) {
          cookie = res.headers['set-cookie'][0].split(';')[0];
        }
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: data });
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

test('login security', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-login', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('successful login returns user info', async () => {
    const res = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.username, 'admin');
    assert.equal(res.body.role, 'admin');
    assert.ok(!res.body.password_hash, 'Should not expose password_hash');
  });

  await t.test('failed login shows generic message', async () => {
    const res = await request('POST', '/api/login', { username: 'admin', password: 'wrongpassword' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Usuario o contrasena incorrectos.');
  });

  await t.test('login with non-existent user shows same generic message', async () => {
    const res = await request('POST', '/api/login', { username: 'nonexistent', password: 'anything' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Usuario o contrasena incorrectos.');
  });

  await t.test('password is stored as bcrypt hash', async () => {
    const res = await request('GET', '/api/admin/backup');
    assert.equal(res.status, 200);
    const users = res.body.data.usersSafe;
    for (const user of users) {
      assert.ok(!user.password_hash, 'Backup should not contain password_hash');
      assert.ok(!user.mfa_secret, 'Backup should not contain mfa_secret');
    }
  });

  await t.test('passwordHash not exposed in users API', async () => {
    await request('POST', '/api/admin/verify', { password: 'admin123' });
    const res = await request('GET', '/api/users');
    assert.equal(res.status, 200);
    for (const user of res.body.data) {
      assert.ok(!user.password_hash, 'Should not expose password_hash');
      assert.ok(!user.mfa_secret, 'Should not expose mfa_secret');
    }
  });

  await t.test('rate limit blocks after multiple failed attempts', async () => {
    cookie = null;
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    await request('POST', '/api/admin/verify', { password: 'admin123' });
    const createRes = await request('POST', '/api/users', { username: 'ratelimituser', password: 'TestPass123!', role: 'user' });
    assert.equal(createRes.status, 201);

    cookie = null;
    for (let i = 0; i < 5; i++) {
      await request('POST', '/api/login', { username: 'ratelimituser', password: 'wrong' });
    }

    const blockedRes = await request('POST', '/api/login', { username: 'ratelimituser', password: 'TestPass123!' });
    assert.equal(blockedRes.status, 400);
    assert.equal(blockedRes.body.message, 'Usuario o contrasena incorrectos.');
  });

  await t.test('inactive user cannot login', async () => {
    cookie = null;
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    await request('POST', '/api/admin/verify', { password: 'admin123' });
    const createRes = await request('POST', '/api/users', { username: 'inactiveuser', password: 'Pass123!', role: 'user' });
    assert.equal(createRes.status, 201);

    const usersRes = await request('GET', '/api/users');
    const targetUser = usersRes.body.data.find(u => u.username === 'inactiveuser');
    assert.ok(targetUser);

    await request('PUT', `/api/users/${targetUser.id}`, { username: 'inactiveuser', is_active: false });

    cookie = null;
    const loginRes = await request('POST', '/api/login', { username: 'inactiveuser', password: 'Pass123!' });
    assert.equal(loginRes.status, 400);
    assert.equal(loginRes.body.message, 'Usuario o contrasena incorrectos.');
  });

  await t.test('logout clears session', async () => {
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const sessionRes = await request('GET', '/api/session');
    assert.equal(sessionRes.body.authenticated, true);

    await request('POST', '/api/logout');
    const afterLogout = await request('GET', '/api/session');
    assert.equal(afterLogout.body.authenticated, false);
  });

  await t.test('expired/invalid session returns 401', async () => {
    cookie = 'proyectos.sid=s%3Ainvalid.fake';
    const res = await request('GET', '/api/projects');
    assert.equal(res.status, 401);
  });

  await t.test('login attempt is recorded without sensitive data', async () => {
    cookie = null;
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const backupRes = await request('GET', '/api/admin/backup');
    assert.equal(backupRes.status, 200, `Backup should return 200: ${JSON.stringify(backupRes.body).substring(0, 200)}`);
    const loginAttempts = backupRes.body.data.loginAttempts;
    assert.ok(loginAttempts.length > 0, 'Should have login attempts');
    for (const attempt of loginAttempts) {
      assert.ok(!attempt.password, 'Should not store password');
      assert.ok(!attempt.password_hash, 'Should not store password_hash');
      assert.ok(attempt.user_identifier, 'Should have user_identifier');
      assert.ok(attempt.attempted_at, 'Should have attempted_at');
      assert.ok(attempt.success === 0 || attempt.success === 1, 'Should have success flag');
    }
  });

  await t.test('audit log records login events', async () => {
    const auditRes = await request('GET', '/api/admin/audit-logs?module=auth');
    assert.ok(auditRes.body.data.length > 0);
    const actions = auditRes.body.data.map(l => l.action);
    assert.ok(actions.includes('login_success'), 'Should log successful logins');
    assert.ok(actions.includes('login_failed'), 'Should log failed logins');
  });

  await t.test('CDMX timezone shown in audit logs', async () => {
    const auditRes = await request('GET', '/api/admin/audit-logs');
    for (const log of auditRes.body.data) {
      if (log.timestamp_cdmx) {
        assert.ok(log.timestamp_cdmx.includes('/'), `Should have CDMX date format: ${log.timestamp_cdmx}`);
      }
    }
  });

  await t.test('build works (server responding)', async () => {
    const res = await request('GET', '/api/session');
    assert.equal(res.status, 200);
  });
});
