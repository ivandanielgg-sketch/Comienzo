const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-backup.db');
const PORT = 3099;

let serverProcess;
let cookie;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      headers: {
        'Content-Type': 'application/json',
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
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
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

test('backup module', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  await t.test('GET /api/admin/backup returns valid backup structure', async () => {
    const res = await request('GET', '/api/admin/backup');
    assert.equal(res.status, 200);
    assert.ok(res.body.backupMetadata);
    assert.ok(res.body.coverageManifest);
    assert.ok(res.body.data);
    assert.equal(res.body.backupMetadata.schemaVersion, '3.0.0');
    assert.equal(res.body.backupMetadata.appName, 'REVRAM Dashboard');
    assert.ok(res.body.backupMetadata.exportedAt);
    assert.ok(res.body.backupMetadata.recordCounts);
    assert.ok(Array.isArray(res.body.backupMetadata.includedEntities));
    assert.equal(res.body.coverageManifest.coverageStatus, 'complete');
  });

  await t.test('backup does not include password hashes', async () => {
    const res = await request('GET', '/api/admin/backup');
    const usersData = res.body.data.usersSafe;
    assert.ok(Array.isArray(usersData));
    for (const user of usersData) {
      assert.equal(user.password_hash, undefined);
      assert.equal(user.password, undefined);
    }
  });

  await t.test('backup includes all registered entities', async () => {
    const res = await request('GET', '/api/admin/backup');
    const expectedEntities = [
      'projects', 'closedProjects', 'projectPayments', 'projectCosts',
      'projectReports', 'reportsArchive', 'employees', 'vacationRequests',
      'settings', 'ecovisProjects', 'ecovisPayments',
      'ecovisPaymentAllocations', 'ecovisLoans', 'ecovisMovements', 'usersSafe',
    ];
    for (const entity of expectedEntities) {
      assert.ok(entity in res.body.data, `Missing entity: ${entity}`);
      assert.ok(Array.isArray(res.body.data[entity]), `${entity} should be array`);
    }
  });

  await t.test('backup includes coverageManifest with detected entities', async () => {
    const res = await request('GET', '/api/admin/backup');
    assert.ok(Array.isArray(res.body.coverageManifest.entitiesDetected));
    assert.ok(Array.isArray(res.body.coverageManifest.entitiesIncluded));
    assert.ok(res.body.coverageManifest.entitiesDetected.length > 0);
  });

  await t.test('backup recordCounts match actual data lengths', async () => {
    const res = await request('GET', '/api/admin/backup');
    for (const [key, count] of Object.entries(res.body.backupMetadata.recordCounts)) {
      assert.equal(count, res.body.data[key].length, `Count mismatch for ${key}`);
    }
  });

  await t.test('POST /api/admin/backup/preview validates backup file', async () => {
    const res = await request('POST', '/api/admin/backup/preview', { foo: 'bar' });
    assert.equal(res.status, 400);
  });

  await t.test('POST /api/admin/backup/preview returns comparison', async () => {
    const backupRes = await request('GET', '/api/admin/backup');
    const previewRes = await request('POST', '/api/admin/backup/preview', backupRes.body);
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.body.preview);
    assert.ok('projects' in previewRes.body.preview);
    assert.ok('conflicts' in previewRes.body);
  });

  await t.test('preview does not modify data', async () => {
    const beforeRes = await request('GET', '/api/admin/backup');
    await request('POST', '/api/admin/backup/preview', beforeRes.body);
    const afterRes = await request('GET', '/api/admin/backup');
    const beforeCounts = { ...beforeRes.body.backupMetadata.recordCounts };
    const afterCounts = { ...afterRes.body.backupMetadata.recordCounts };
    delete beforeCounts.auditLogs;
    delete afterCounts.auditLogs;
    delete beforeCounts.loginAttempts;
    delete afterCounts.loginAttempts;
    delete beforeCounts.backupImportLogs;
    delete afterCounts.backupImportLogs;
    assert.deepEqual(beforeCounts, afterCounts);
  });

  await t.test('POST /api/admin/backup/import adds missing records', async () => {
    const backupRes = await request('GET', '/api/admin/backup');
    const backup = backupRes.body;
    backup.data.employees.push({
      id: 999,
      employee_number: 'EMP-TEST-999',
      full_name: 'Test Employee Backup',
      hire_date: '2020-01-01',
      active: 1,
    });
    const importRes = await request('POST', '/api/admin/backup/import', backup);
    assert.equal(importRes.status, 200);
    assert.ok(importRes.body.importLog);
    assert.equal(importRes.body.importLog.summary.employees.added, 1);
  });

  await t.test('import omits duplicates on second run', async () => {
    const backupRes = await request('GET', '/api/admin/backup');
    const importRes = await request('POST', '/api/admin/backup/import', backupRes.body);
    assert.equal(importRes.status, 200);
    for (const [, val] of Object.entries(importRes.body.importLog.summary)) {
      assert.equal(val.added, 0, 'Should not add duplicates');
    }
  });

  await t.test('import detects orphan records as conflicts', async () => {
    const backupRes = await request('GET', '/api/admin/backup');
    const backup = backupRes.body;
    backup.data.projectPayments.push({
      id: 9999,
      project_id: 99999,
      amount: 100,
      currency: 'MXN',
      payment_date: '2024-01-01',
    });
    const importRes = await request('POST', '/api/admin/backup/import', backup);
    assert.equal(importRes.status, 200);
    const hasConflict = importRes.body.importLog.conflicts.some(c => c.entity === 'projectPayments');
    assert.ok(hasConflict, 'Should report orphan payment as conflict');
  });

  await t.test('non-admin cannot access backup endpoints', async () => {
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    await request('POST', '/api/admin/verify', { password: 'admin123' });
    try {
      await request('POST', '/api/users', { username: 'normaluser', password: 'user12345' });
    } catch {}
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'normaluser', password: 'user12345' });

    const backupRes = await request('GET', '/api/admin/backup');
    assert.equal(backupRes.status, 403);

    const previewRes = await request('POST', '/api/admin/backup/preview', {});
    assert.equal(previewRes.status, 403);

    const importRes = await request('POST', '/api/admin/backup/import', {});
    assert.equal(importRes.status, 403);
  });

  await t.test('old export-general-excel endpoint is removed', async () => {
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const res = await request('GET', '/api/admin/export-general-excel');
    assert.ok(res.status === 404 || res.status >= 400);
  });

  await t.test('backup includes all records not just paginated page', async () => {
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const projData = {
      quote_number: 'COT-BACKUP-ALL-1',
      order_number: 'PED-BACKUP-1',
      purchase_order_not_applicable: true,
      tecnico_id: 1,
      vendedor_id: 2,
      client_name: 'Test Client',
      project_description: 'Test project for backup',
      expected_margin: 10,
      total_invoiced: 5000,
      total_invoiced_currency: 'MXN',
      progress_percent: 0,
      fecha_vencimiento: '2026-12-31',
      promised_delivery_date: '2026-12-01',
      status: 'Pendiente',
      risk: 'Bajo',
    };
    await request('POST', '/api/projects', projData);
    projData.quote_number = 'COT-BACKUP-ALL-2';
    projData.order_number = 'PED-BACKUP-2';
    await request('POST', '/api/projects', projData);

    const backupRes = await request('GET', '/api/admin/backup');
    assert.equal(backupRes.status, 200);
    assert.ok(backupRes.body.data.projects.length >= 2, 'Backup should include all projects');
    assert.equal(
      backupRes.body.backupMetadata.recordCounts.projects,
      backupRes.body.data.projects.length,
    );
  });

  await t.test('import detects data-differs conflicts', async () => {
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const backupRes = await request('GET', '/api/admin/backup');
    const backup = backupRes.body;
    const existingProject = backup.data.projects[0];
    if (existingProject) {
      existingProject.seller = 'MODIFIED_SELLER_FOR_CONFLICT_TEST';
    }
    const previewRes = await request('POST', '/api/admin/backup/preview', backup);
    assert.equal(previewRes.status, 200);
    if (existingProject) {
      const hasConflict = previewRes.body.conflicts.some(c => c.entity === 'projects');
      assert.ok(hasConflict, 'Should detect data-differs conflict');
    }
  });

  await t.test('backup coverageManifest includes planned entities', async () => {
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const res = await request('GET', '/api/admin/backup');
    assert.ok(Array.isArray(res.body.coverageManifest.entitiesPlanned));
    assert.ok(res.body.coverageManifest.entitiesPlanned.length > 0);
    const plannedKeys = res.body.coverageManifest.entitiesPlanned.map(e => e.entity);
    assert.ok(plannedKeys.includes('roles'), 'Should include planned roles entity');
    const includedKeys = res.body.coverageManifest.entitiesIncluded;
    assert.ok(includedKeys.includes('auditLogs'), 'Should include auditLogs in included entities');
    assert.ok(includedKeys.includes('loginAttempts'), 'Should include loginAttempts in included entities');
    assert.ok(includedKeys.includes('backupImportLogs'), 'Should include backupImportLogs in included entities');
    assert.ok(includedKeys.includes('userPermissions'), 'Should include userPermissions in included entities');
  });
});
