const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-backup-security.db');
const PORT = 3095;

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

test('backup security and coverage', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-backup-sec', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
    const adminLogin = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = adminLogin.cookie;
    await request('POST', '/api/admin/verify', { password: 'admin123' }, adminCookie);
    await request('POST', '/api/users', { username: 'backupuser', password: 'User123!', role: 'user' }, adminCookie);
    const userLogin = await request('POST', '/api/login', { username: 'backupuser', password: 'User123!' });
    userCookie = userLogin.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('backup includes usersSafe without passwordHash', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.usersSafe);
    assert.ok(res.body.data.usersSafe.length > 0);
    for (const user of res.body.data.usersSafe) {
      assert.ok(!user.password_hash, 'Should not include password_hash');
      assert.ok(!user.mfa_secret, 'Should not include mfa_secret');
      assert.ok(!user.locked_until, 'Should not include locked_until');
      assert.ok(!user.failed_login_attempts, 'Should not include failed_login_attempts');
      assert.ok(user.username, 'Should include username');
      assert.ok(user.role, 'Should include role');
      assert.ok(user.is_active !== undefined, 'Should include is_active');
    }
  });

  await t.test('backup includes userPermissions', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(res.body.data.userPermissions !== undefined, 'Should include userPermissions');
    assert.ok(res.body.backupMetadata.includedEntities.includes('userPermissions'));
  });

  await t.test('backup includes auditLogs without secrets', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(res.body.data.auditLogs, 'Should include auditLogs');
    for (const log of res.body.data.auditLogs) {
      assert.ok(!log.before_json, 'Should not include before_json in backup');
      assert.ok(!log.after_json, 'Should not include after_json in backup');
      if (log.metadata_json) {
        assert.ok(!log.metadata_json.includes('password'), 'Should not include password in metadata');
      }
    }
  });

  await t.test('backup includes loginAttempts without sensitive data', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(res.body.data.loginAttempts !== undefined);
    for (const attempt of res.body.data.loginAttempts) {
      assert.ok(!attempt.password, 'Should not include password');
      assert.ok(!attempt.user_agent, 'Should not include user_agent in backup');
    }
  });

  await t.test('backup does not include any secrets', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    const jsonStr = JSON.stringify(res.body.data);
    assert.ok(!jsonStr.includes('password_hash'), 'Should not contain password_hash anywhere');
    assert.ok(!jsonStr.includes('mfa_secret'), 'Should not contain mfa_secret anywhere');
  });

  await t.test('backup coverageManifest is complete', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    const manifest = res.body.coverageManifest;
    assert.ok(manifest.entitiesIncluded.includes('usersSafe'));
    assert.ok(manifest.entitiesIncluded.includes('userPermissions'));
    assert.ok(manifest.entitiesIncluded.includes('auditLogs'));
    assert.ok(manifest.entitiesIncluded.includes('loginAttempts'));
    assert.ok(manifest.entitiesIncluded.includes('backupImportLogs'));
    const excludedKeys = manifest.entitiesExcluded.map(e => e.entity);
    assert.ok(excludedKeys.includes('passwordHashes'));
    assert.ok(excludedKeys.includes('mfaSecrets'));
    assert.ok(excludedKeys.includes('sessions'));
  });

  await t.test('preview shows user/permission data', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const previewRes = await request('POST', '/api/admin/backup/preview', backupRes.body, adminCookie);
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.body.preview);
    assert.ok('usersSafe' in previewRes.body.preview);
    assert.ok('userPermissions' in previewRes.body.preview);
  });

  await t.test('import does not overwrite existing users', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const backup = backupRes.body;
    backup.data.usersSafe[0].role = 'MODIFIED_ROLE';
    const importRes = await request('POST', '/api/admin/backup/import', backup, adminCookie);
    assert.equal(importRes.status, 200);
    const sessionRes = await request('GET', '/api/session', null, adminCookie);
    assert.equal(sessionRes.body.user.role, 'admin');
  });

  await t.test('import does not leave system without admin', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const importRes = await request('POST', '/api/admin/backup/import', backupRes.body, adminCookie);
    assert.equal(importRes.status, 200);
    assert.ok(importRes.body.importLog.validation);
    assert.ok(importRes.body.importLog.validation.valid, 'Post-import validation should pass');
  });

  await t.test('import detects conflicts', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const backup = backupRes.body;
    if (backup.data.usersSafe.length > 0) {
      backup.data.usersSafe[0].is_active = 0;
    }
    const importRes = await request('POST', '/api/admin/backup/import', backup, adminCookie);
    assert.equal(importRes.status, 200);
    const hasUserConflicts = importRes.body.importLog.conflicts.some(c => c.entity === 'usersSafe');
    assert.ok(hasUserConflicts, 'Should detect user data conflicts');
  });

  await t.test('import respects relationships', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const backup = backupRes.body;
    backup.data.projectPayments = backup.data.projectPayments || [];
    backup.data.projectPayments.push({ id: 9999, project_id: 99999, amount: 100, currency: 'MXN', payment_date: '2026-01-01' });
    const importRes = await request('POST', '/api/admin/backup/import', backup, adminCookie);
    assert.equal(importRes.status, 200);
    const paymentConflicts = importRes.body.importLog.conflicts.find(c => c.entity === 'projectPayments');
    assert.ok(paymentConflicts, 'Should detect orphan payment conflict');
  });

  await t.test('BackupImportLog is persisted', async () => {
    const logsRes = await request('GET', '/api/admin/backup/logs', null, adminCookie);
    assert.equal(logsRes.status, 200);
    assert.ok(logsRes.body.data.length > 0, 'Should have import logs');
    const latestLog = logsRes.body.data[0];
    assert.ok(latestLog.imported_at);
    assert.ok(latestLog.imported_by);
    assert.ok(latestLog.status);
    assert.ok(latestLog.summary_json);
  });

  await t.test('user without permission cannot create backup', async () => {
    const res = await request('GET', '/api/admin/backup', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user without permission cannot import backup', async () => {
    const res = await request('POST', '/api/admin/backup/import', {}, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('schema version is 3.0.0', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(res.body.backupMetadata.schemaVersion, '3.0.0');
  });

  await t.test('build works', async () => {
    const res = await request('GET', '/api/session', null, adminCookie);
    assert.equal(res.status, 200);
  });
});
