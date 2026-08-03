const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const {
  calculateEcovisAccountSummary,
  buildEcovisAccountHeader,
  buildEcovisStatementLedger,
  generateEcovisIntegrityDiagnostic,
} = require('../src/ecovis');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-ecovis-phase2.db');
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

function waitForServer(timeoutMs = 10000) {
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

test('official balance uses Σ pending_amount_mxn not direction sums', () => {
  const projects = [
    { id: 1, amount_mxn: 1000, pending_amount_mxn: 600, paid_amount_mxn: 400, is_cancelled: 0, status: 'parcialmente_pagado' },
    { id: 2, amount_mxn: 500, pending_amount_mxn: 500, paid_amount_mxn: 0, is_cancelled: 0, status: 'pendiente' },
    { id: 3, amount_mxn: 200, pending_amount_mxn: 0, paid_amount_mxn: 0, is_cancelled: 1, status: 'cancelado' },
  ];
  const movements = [
    { id: 1, movement_type: 'proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 1, amount_mxn: 1000, is_cancelled: 0, movement_date: '2026-01-01' },
    { id: 2, movement_type: 'proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 1, amount_mxn: 1000, is_cancelled: 0, movement_date: '2026-01-02' },
    { id: 3, movement_type: 'aplicacion_a_proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 1, amount_mxn: 400, is_cancelled: 0, movement_date: '2026-01-03' },
    { id: 4, movement_type: 'proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 2, amount_mxn: 500, is_cancelled: 0, movement_date: '2026-01-01' },
    { id: 5, movement_type: 'proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 3, amount_mxn: 200, is_cancelled: 0, movement_date: '2026-01-01' },
  ];
  const summary = calculateEcovisAccountSummary(projects, [], [], movements);
  const header = buildEcovisAccountHeader(summary);
  assert.equal(summary.pending_project_amount, 1100);
  assert.equal(summary.ecovis_owes_revram, 1100);
  assert.equal(header.amount, 1100);
  assert.equal(header.label, 'ECOVIS debe a REVRAM');

  const naiveDebe = movements
    .filter((m) => !m.is_cancelled && m.direction === 'ecovis_debe_a_revram')
    .reduce((s, m) => s + m.amount_mxn, 0);
  assert.equal(naiveDebe, 3100);
  assert.notEqual(summary.pending_project_amount, naiveDebe);

  const ledger = buildEcovisStatementLedger(movements, {
    cancelledProjectIds: new Set([3]),
    activeProjectIds: new Set([1, 2]),
    projectById: { 1: projects[0], 2: projects[1], 3: projects[2] },
    officialClosingBalance: summary.pending_project_amount,
  });
  assert.equal(ledger.closing_balance, 1100);
  const duplicateRow = ledger.rows.find((r) => r.id === 2);
  assert.ok(duplicateRow);
  assert.equal(duplicateRow.affects_balance, false);
});

test('diagnostic orphan cleanup candidates only', () => {
  const projects = [
    { id: 1, project_name: 'Active', status: 'pendiente', is_cancelled: 0, amount_mxn: 100, pending_amount_mxn: 100 },
    { id: 2, project_name: 'Cancelled', status: 'cancelado', is_cancelled: 1, amount_mxn: 50, pending_amount_mxn: 0 },
  ];
  const movements = [
    {
      id: 10, movement_type: 'proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 1,
      amount_mxn: 100, is_cancelled: 0, created_at: '2026-01-01', movement_date: '2026-01-01', description: 'keep',
    },
    {
      id: 11, movement_type: 'aplicacion_a_proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 1,
      amount_mxn: 40, is_cancelled: 0, created_at: '2026-01-02', movement_date: '2026-01-02', description: 'hist app',
    },
    {
      id: 12, movement_type: 'proyecto', direction: 'ecovis_debe_a_revram', related_project_id: 2,
      amount_mxn: 50, is_cancelled: 0, created_at: '2026-01-01', movement_date: '2026-01-01', description: 'orphan',
    },
  ];
  const diag = generateEcovisIntegrityDiagnostic(projects, movements);
  assert.deepEqual(diag.orphans.proposed_cancel_movement_ids, [12]);
  assert.equal(diag.orphans.proposed_cancellation_reason, 'Limpieza 2026-08: proyecto cancelado');
  const appOnActive = diag.active_projects_debe.projects[0].movements.find((m) => m.id === 11);
  assert.equal(appOnActive.proposed_action, 'none');
});

test('ECOVIS phase2 integration regressions', async (t) => {
  await t.before(async () => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, SESSION_SECRET: 'test-ecovis-p2', ADMIN_PASSWORD: 'admin123' },
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

  let projectId;
  let paymentId;

  await t.test('double save project does not create extra proyecto cargos', async () => {
    const created = await request('POST', '/api/ecovis/projects', {
      project_name: 'Phase2 Proj',
      project_date: '2026-08-01',
      total_amount: 10000,
      currency: 'MXN',
      purchase_order_not_applicable: true,
    }, adminCookie);
    assert.equal(created.status, 201);
    projectId = created.body.id;

    const body = {
      project_name: 'Phase2 Proj',
      project_date: '2026-08-01',
      total_amount: 10000,
      currency: 'MXN',
    };
    const first = await request('PUT', `/api/ecovis/projects/${projectId}`, body, adminCookie);
    assert.equal(first.status, 200);
    const second = await request('PUT', `/api/ecovis/projects/${projectId}`, body, adminCookie);
    assert.equal(second.status, 200);

    const movs = await request('GET', '/api/ecovis/movements?limit=9999&movement_type=proyecto', null, adminCookie);
    const projectCargos = (movs.body.data || []).filter(
      (m) => Number(m.related_project_id) === Number(projectId) && !m.is_cancelled,
    );
    assert.equal(projectCargos.length, 1, 'Exactly one active proyecto cargo after double save');
  });

  await t.test('new payment allocation uses debt-reducing direction and does not inflate official balance', async () => {
    const pay = await request('POST', '/api/ecovis/payments', {
      payment_date: '2026-08-02',
      amount: 3000,
      currency: 'MXN',
    }, adminCookie);
    assert.equal(pay.status, 201);
    paymentId = pay.body.id;

    const before = await request('GET', '/api/ecovis/summary', null, adminCookie);
    const pendingBefore = before.body.pending_project_amount;

    const alloc = await request('POST', `/api/ecovis/payments/${paymentId}/allocations`, {
      allocation_type: 'proyecto',
      ecovis_project_id: projectId,
      amount: 3000,
    }, adminCookie);
    assert.equal(alloc.status, 201);

    const movs = await request('GET', '/api/ecovis/movements?limit=9999&movement_type=aplicacion_a_proyecto', null, adminCookie);
    const app = (movs.body.data || []).find(
      (m) => Number(m.related_project_id) === Number(projectId) && Number(m.related_payment_id) === Number(paymentId),
    );
    assert.ok(app);
    assert.equal(app.direction, 'revram_debe_a_ecovis');

    const after = await request('GET', '/api/ecovis/summary', null, adminCookie);
    assert.equal(after.body.pending_project_amount, pendingBefore - 3000);
    assert.equal(after.body.ecovis_owes_revram, after.body.pending_project_amount);
    assert.equal(after.body.header.amount, after.body.pending_project_amount);

    const statement = await request('GET', '/api/ecovis/statement?limit=100', null, adminCookie);
    assert.equal(statement.body.statement.balance_source, 'projects_pending_amount_mxn');
    assert.equal(statement.body.statement.closing_balance, after.body.pending_project_amount);
    assert.equal(statement.body.statement.official_balance_pending_mxn, after.body.pending_project_amount);
  });

  await t.test('cancel project cascades movements and inserts neutral cancelacion memo', async () => {
    const created = await request('POST', '/api/ecovis/projects', {
      project_name: 'To Cancel',
      project_date: '2026-08-03',
      total_amount: 500,
      currency: 'MXN',
      purchase_order_not_applicable: true,
    }, adminCookie);
    assert.equal(created.status, 201);
    const cancelId = created.body.id;

    const cancel = await request('POST', `/api/ecovis/projects/${cancelId}/cancel`, {
      reason: 'Prueba cascada',
    }, adminCookie);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.is_cancelled, 1);

    const movs = await request('GET', '/api/ecovis/movements?limit=9999', null, adminCookie);
    const related = (movs.body.data || []).filter((m) => Number(m.related_project_id) === Number(cancelId));
    const proyecto = related.filter((m) => m.movement_type === 'proyecto');
    assert.ok(proyecto.length >= 1);
    assert.ok(proyecto.every((m) => m.is_cancelled));
    const cancelacion = related.find((m) => m.movement_type === 'cancelacion' && !m.is_cancelled);
    assert.ok(cancelacion);
    assert.equal(cancelacion.direction, 'neutral');
  });

  await t.test('cleanup-orphans cancels only orphan debe movements', async () => {
    const created = await request('POST', '/api/ecovis/projects', {
      project_name: 'Orphan Source',
      project_date: '2026-08-04',
      total_amount: 250,
      currency: 'MXN',
      purchase_order_not_applicable: true,
    }, adminCookie);
    assert.equal(created.status, 201);
    const orphanProjectId = created.body.id;

    const movsBefore = await request('GET', '/api/ecovis/movements?limit=9999&movement_type=proyecto', null, adminCookie);
    const cargo = (movsBefore.body.data || []).find(
      (m) => Number(m.related_project_id) === Number(orphanProjectId) && !m.is_cancelled,
    );
    assert.ok(cargo);

    const cancel = await request('POST', `/api/ecovis/projects/${orphanProjectId}/cancel`, {
      reason: 'Para generar huerfano de prueba',
    }, adminCookie);
    assert.equal(cancel.status, 200);

    // Simulate historical orphan: reactivate the proyecto cargo after cancel cascade.
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    db.prepare(
      `UPDATE ecovis_movements
       SET is_cancelled = 0, cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL
       WHERE id = ?`,
    ).run(cargo.id);
    db.close();

    const diag = await request('GET', '/api/ecovis/diagnostic', null, adminCookie);
    assert.ok(diag.body.orphans.proposed_cancel_movement_ids.includes(cargo.id));

    const cleanup = await request('POST', '/api/ecovis/diagnostic/cleanup-orphans', {}, adminCookie);
    assert.equal(cleanup.status, 200);
    assert.ok(cleanup.body.cancelled_count >= 1);
    assert.equal(cleanup.body.cancellation_reason, 'Limpieza 2026-08: proyecto cancelado');
    assert.equal(cleanup.body.diagnostic.orphans.count, 0);

    const db2 = new Database(DB_PATH);
    const row = db2.prepare('SELECT is_cancelled, cancellation_reason FROM ecovis_movements WHERE id = ?').get(cargo.id);
    db2.close();
    assert.equal(row.is_cancelled, 1);
    assert.equal(row.cancellation_reason, 'Limpieza 2026-08: proyecto cancelado');
  });
});
