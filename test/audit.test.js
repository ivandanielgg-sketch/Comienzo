const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-audit.db');
const PORT = 3098;

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

test('audit system', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-audit', ADMIN_PASSWORD: 'admin123' },
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

  await t.test('login creates audit log entry', async () => {
    const res = await request('GET', '/api/admin/audit-logs');
    assert.equal(res.status, 200);
    const loginLogs = res.body.data.filter((l) => l.action === 'login_success');
    assert.ok(loginLogs.length > 0, 'Should have login_success audit log');
    assert.equal(loginLogs[0].user_name, 'admin');
    assert.equal(loginLogs[0].module, 'auth');
  });

  await t.test('creating a project stores createdBy and createdAt', async () => {
    const res = await request('POST', '/api/projects', {
      quote_number: 'AUD-001',
      order_number: 'PED-AUD-001',
      purchase_order_not_applicable: true,
      seller: 'Auditor',
      client_name: 'Audit Client',
      project_description: 'Proyecto de prueba auditoría',
      technician_name: 'Tecnico Audit',
      promised_delivery_date: '2026-07-01',
      expected_margin: 25,
      total_invoiced: 10000,
      total_invoiced_currency: 'MXN',
      progress_percent: 0,
      status: 'Pendiente',
      risk: 'Bajo',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.created_by_name, 'admin');
    assert.ok(res.body.created_by_user_id);
    assert.ok(res.body.created_at);
  });

  await t.test('updating a project stores updatedBy and updatedAt', async () => {
    const res = await request('PUT', '/api/projects/1', {
      quote_number: 'AUD-001',
      order_number: 'PED-AUD-001',
      purchase_order_not_applicable: true,
      seller: 'Auditor Updated',
      client_name: 'Audit Client',
      project_description: 'Proyecto de prueba auditoría',
      technician_name: 'Tecnico Audit',
      promised_delivery_date: '2026-07-01',
      expected_margin: 30,
      total_invoiced: 10000,
      total_invoiced_currency: 'MXN',
      progress_percent: 50,
      status: 'En Proceso',
      risk: 'Medio',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.updated_by_name, 'admin');
    assert.ok(res.body.updated_by_user_id);
    assert.ok(res.body.updated_at);
  });

  await t.test('closing a project creates audit log', async () => {
    const getRes = await request('GET', '/api/projects/1');
    assert.equal(getRes.status, 200, `Project 1 should exist, got: ${JSON.stringify(getRes.body).substring(0, 100)}`);
    const res = await request('DELETE', '/api/projects/1', { password: 'admin123' });
    assert.equal(res.status, 204, `Delete should return 204, got ${res.status}: ${JSON.stringify(res.body)}`);

    const logs = await request('GET', '/api/admin/audit-logs?action=close&module=projects');
    assert.ok(logs.body.data.length > 0, 'Should have close audit log');
  });

  await t.test('report creation stores audit fields', async () => {
    const projRes = await request('POST', '/api/projects', {
      quote_number: 'AUD-002',
      order_number: 'PED-AUD-002',
      purchase_order_not_applicable: true,
      seller: 'Auditor',
      client_name: 'Audit Client',
      project_description: 'Proyecto para reporte',
      technician_name: 'Tecnico',
      promised_delivery_date: '2026-08-01',
      expected_margin: 20,
      total_invoiced: 5000,
      total_invoiced_currency: 'MXN',
      progress_percent: 0,
      status: 'Pendiente',
      risk: 'Bajo',
    });

    const repRes = await request('POST', '/api/reports', {
      project_id: projRes.body.id,
      report_type: 'boiler_startup',
      client_name: 'Audit Client',
      service_name: 'Servicio Test',
      report_date: '2026-07-01',
    });
    assert.equal(repRes.status, 201);
    assert.equal(repRes.body.created_by, 'admin');
    assert.ok(repRes.body.created_by_user_id);
    assert.ok(repRes.body.created_at);
  });

  await t.test('vacation request stores audit fields', async () => {
    const empRes = await request('POST', '/api/employees', {
      employee_number: 'EMP-AUD-001',
      full_name: 'Empleado Auditoría',
      hire_date: '2020-01-06',
    });
    assert.equal(empRes.status, 201);
    assert.equal(empRes.body.created_by_name, 'admin');

    const vacRes = await request('POST', `/api/employees/${empRes.body.id}/vacation-requests`, {
      start_date: '2026-07-01',
      end_date: '2026-07-03',
      status: 'programada',
    });
    assert.equal(vacRes.status, 201);
    assert.equal(vacRes.body.created_by, 'admin');
    assert.ok(vacRes.body.created_by_user_id);
  });

  await t.test('ECOVIS project stores audit fields', async () => {
    const res = await request('POST', '/api/ecovis/projects', {
      project_name: 'ECOVIS Audit',
      project_date: '2026-07-01',
      total_amount: 5000,
      currency: 'MXN',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.created_by, 'admin');
    assert.ok(res.body.created_by_user_id);
  });

  await t.test('audit log does not store secrets', async () => {
    const logs = await request('GET', '/api/admin/audit-logs');
    for (const log of logs.body.data) {
      if (log.before_json) {
        assert.ok(!log.before_json.includes('password_hash'), 'Should not contain password_hash');
      }
      if (log.after_json) {
        assert.ok(!log.after_json.includes('password_hash'), 'Should not contain password_hash');
      }
    }
  });

  await t.test('createdAt is stored in UTC (ISO format)', async () => {
    const logs = await request('GET', '/api/admin/audit-logs');
    for (const log of logs.body.data) {
      assert.ok(
        log.timestamp_utc.endsWith('Z') || log.timestamp_utc.includes('T'),
        `Timestamp should be ISO format: ${log.timestamp_utc}`,
      );
    }
  });

  await t.test('timestamps are shown in Hora CDMX format', async () => {
    const logs = await request('GET', '/api/admin/audit-logs');
    for (const log of logs.body.data) {
      assert.ok(log.timestamp_cdmx, 'Should have CDMX formatted timestamp');
      assert.ok(log.timestamp_cdmx.includes('/'), `CDMX format should have slashes: ${log.timestamp_cdmx}`);
    }
  });

  await t.test('project updatedAt is shown in CDMX format', async () => {
    const res = await request('GET', '/api/projects/2');
    assert.equal(res.status, 200);
    assert.ok(res.body.created_at_cdmx, 'Should have created_at_cdmx');
    assert.ok(res.body.created_at_cdmx.includes('/'));
  });

  await t.test('backup includes auditLogs', async () => {
    const res = await request('GET', '/api/admin/backup');
    assert.ok(res.body.data.auditLogs, 'Backup should include auditLogs');
    assert.ok(res.body.data.auditLogs.length > 0, 'Should have audit log entries in backup');
    assert.ok(res.body.backupMetadata.recordCounts.auditLogs > 0);
    assert.ok(res.body.backupMetadata.includedEntities.includes('auditLogs'));
  });

  await t.test('build works (server responds)', async () => {
    const res = await request('GET', '/api/session');
    assert.equal(res.status, 200);
  });
});
