const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildProjectHistorial, pickSafeSummary } = require('../src/projectHistorial');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

function createMemoryDb() {
  const audit = [];
  const payments = [];
  const costs = [];
  const projects = [{ id: 7, quote_number: 'Q-7' }];
  let auditId = 1;

  const api = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      return {
        get(...params) {
          if (text.startsWith('SELECT id, quote_number FROM projects')) {
            return projects.find((p) => p.id === Number(params[0])) || null;
          }
          return null;
        },
        all(...params) {
          if (text.startsWith('SELECT id FROM project_payments')) {
            return payments.filter((p) => p.project_id === Number(params[0])).map((p) => ({ id: p.id }));
          }
          if (text.startsWith('SELECT id FROM project_costs')) {
            return costs.filter((c) => c.project_id === Number(params[0])).map((c) => ({ id: c.id }));
          }
          if (text.includes('FROM audit_logs')) {
            const projectId = Number(params[0]);
            return audit.filter((row) => {
              const meta = row.metadata_json ? JSON.parse(row.metadata_json) : {};
              const before = row.before_json ? JSON.parse(row.before_json) : {};
              return (
                (row.entity_type === 'project' && Number(row.entity_id) === projectId)
                || Number(meta.project_id) === projectId
                || Number(before.project_id) === projectId
                || (row.entity_type === 'project_payment' && payments.some((p) => p.id === row.entity_id && p.project_id === projectId))
                || (row.entity_type === 'project_cost' && costs.some((c) => c.id === row.entity_id && c.project_id === projectId))
              );
            });
          }
          if (text.includes('FROM project_payments')) {
            return payments.filter((p) => p.project_id === Number(params[0]));
          }
          if (text.includes('FROM project_costs')) {
            return costs.filter((c) => c.project_id === Number(params[0]));
          }
          return [];
        },
        run() {
          return { lastInsertRowid: auditId++ };
        },
      };
    },
    _audit: audit,
    _payments: payments,
    _costs: costs,
  };

  return api;
}

test('historial API route is read-only with projects view permission', () => {
  assert.match(serverJs, /app\.get\('\/api\/projects\/:id\/historial'/);
  assert.match(serverJs, /requirePermission\('projects', 'view'\).*[\s\S]{0,120}historial|historial[\s\S]{0,120}requirePermission\('projects', 'view'\)/);
  assert.match(serverJs, /buildProjectHistorial/);
});

test('workspace UI exposes five tabs and feature flag toggle', () => {
  assert.match(indexHtml, /id="project-workspace"/);
  assert.match(indexHtml, /id="projects-workspace-mode-toggle"/);
  assert.match(indexHtml, /data-ws-tab="info"/);
  assert.match(indexHtml, /data-ws-tab="payments"/);
  assert.match(indexHtml, /data-ws-tab="costs"/);
  assert.match(indexHtml, /data-ws-tab="reports"/);
  assert.match(indexHtml, /data-ws-tab="historial"/);
  assert.match(indexHtml, /id="projects-new-button"/);
  assert.match(indexHtml, /project-workspace\.js\?v=stage4-workspace/);
  assert.match(appJs, /label: 'FACTURADO \(MXN\)'/);
  assert.match(appJs, /key: 'created_at', label: 'Creacion'/);
  assert.match(appJs, /function openProjectWorkspace/);
  assert.match(appJs, /confirmLeaveProjectWorkspace/);
});

test('pickSafeSummary redacts password-like fields via sanitize', () => {
  const summary = pickSafeSummary({
    status: 'En Proceso',
    password: 'secret',
    amount: 10,
  });
  assert.equal(summary.status, 'En Proceso');
  assert.equal(summary.amount, 10);
  assert.equal(summary.password, undefined);
});

test('buildProjectHistorial avoids inventing events and dedupes payment create', () => {
  const db = createMemoryDb();
  db._payments.push({
    id: 11,
    project_id: 7,
    amount: 100,
    currency: 'MXN',
    amount_mxn: 100,
    exchange_rate_to_mxn: 1,
    payment_date: '2026-10-01',
    notes: 'Abono',
    created_at: '2026-10-01T12:00:00.000Z',
    created_by_user_id: 1,
    created_by_name: 'admin',
  });
  db._audit.push({
    id: 1,
    user_id: 1,
    user_name: 'admin',
    action: 'create',
    module: 'payments',
    entity_type: 'project_payment',
    entity_id: 11,
    entity_label: 'Pago 100 MXN',
    timestamp_utc: '2026-10-01T12:00:01.000Z',
    before_json: null,
    after_json: JSON.stringify({ amount: 100, currency: 'MXN' }),
    metadata_json: JSON.stringify({ project_id: 7 }),
  });
  db._audit.push({
    id: 2,
    user_id: 1,
    user_name: 'admin',
    action: 'update',
    module: 'projects',
    entity_type: 'project',
    entity_id: 7,
    entity_label: 'Q-7',
    timestamp_utc: '2026-10-02T10:00:00.000Z',
    before_json: JSON.stringify({ status: 'Pendiente' }),
    after_json: JSON.stringify({ status: 'En Proceso' }),
    metadata_json: null,
  });

  const result = buildProjectHistorial(db, 7, { limit: 50, offset: 0 });
  assert.equal(result.project_id, 7);
  assert.ok(result.total >= 2);
  const paymentEvents = result.data.filter((e) => e.event_type === 'payment_registered');
  assert.equal(paymentEvents.length, 1);
  assert.equal(paymentEvents[0].source, 'project_payments');
  assert.equal(paymentEvents[0].movement_at, '2026-10-01');
  assert.equal(paymentEvents[0].recorded_at, '2026-10-01T12:00:00.000Z');
  const updates = result.data.filter((e) => e.event_type === 'project_updated');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].summary.changed_fields, ['status']);
});

test('buildProjectHistorial returns 404 for missing project', () => {
  const db = createMemoryDb();
  assert.throws(() => buildProjectHistorial(db, 999, {}), (err) => err.status === 404);
});
