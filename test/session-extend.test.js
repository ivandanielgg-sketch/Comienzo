'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-session-extend.db');
const PORT = 3101;
const SESSION_TTL_MS = 4000;

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
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('session expiry metadata, extend and absolute expiration', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      try { fs.unlinkSync(f); } catch {}
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_PATH,
        SESSION_SECRET: 'test-session-extend',
        ADMIN_PASSWORD: 'admin123',
        SESSION_TTL_MS: String(SESSION_TTL_MS),
      },
      stdio: 'pipe',
    });
    await waitForServer();
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('login and session expose expires_at without rolling on GET', async () => {
    cookie = null;
    const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.equal(login.status, 200);
    assert.ok(login.body.expires_at);
    assert.ok(login.body.expires_in_ms <= SESSION_TTL_MS);
    assert.ok(login.body.expires_in_ms > SESSION_TTL_MS - 1500);

    const first = await request('GET', '/api/session');
    assert.equal(first.body.authenticated, true);
    assert.ok(first.body.expires_at);
    await sleep(800);
    const second = await request('GET', '/api/session');
    const firstMs = Date.parse(first.body.expires_at);
    const secondMs = Date.parse(second.body.expires_at);
    assert.ok(Math.abs(firstMs - secondMs) < 50, 'GET /api/session must not silently extend absolute expiry');
    assert.ok(second.body.expires_in_ms < first.body.expires_in_ms);
  });

  await t.test('POST /api/session/extend renews another TTL window', async () => {
    const before = await request('GET', '/api/session');
    await sleep(500);
    const extended = await request('POST', '/api/session/extend', {});
    assert.equal(extended.status, 200);
    assert.equal(extended.body.ok, true);
    assert.ok(extended.body.expires_in_ms > SESSION_TTL_MS - 1500);
    assert.ok(Date.parse(extended.body.expires_at) > Date.parse(before.body.expires_at));
  });

  await t.test('extend requires auth', async () => {
    const previous = cookie;
    cookie = null;
    const res = await request('POST', '/api/session/extend', {});
    assert.equal(res.status, 401);
    cookie = previous;
  });

  await t.test('session expires without extend and blocks authenticated routes', async () => {
    cookie = null;
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    await sleep(SESSION_TTL_MS + 700);
    const session = await request('GET', '/api/session');
    assert.equal(session.body.authenticated, false);
    const projects = await request('GET', '/api/projects');
    assert.equal(projects.status, 401);
  });
});
