'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://127.0.0.1:3000';
let cookie = '';

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function projectPayload(suffix) {
  return {
    quote_number: `FILT-${suffix}`,
    order_number: `PED-FILT-${suffix}`,
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: 2,
    client_name: `Cliente Filtro ${suffix}`,
    project_description: `Proyecto filtro ${suffix}`,
    expected_margin: 20,
    total_invoiced: 1160,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    promised_delivery_date: '2026-12-01',
    status: 'En Proceso',
    risk: 'Medio',
  };
}

test('without_expenses_or_payments filter keeps only projects with zero cost and payment rows', async (t) => {
  const login = await api('POST', '/api/login', { username: 'admin', password: 'admin123' });
  assert.equal(login.status, 200);

  const none = await api('POST', '/api/projects', projectPayload(`NONE-${Date.now()}`));
  assert.equal(none.status, 201, JSON.stringify(none.data));
  const onlyCosts = await api('POST', '/api/projects', projectPayload(`COST-${Date.now()}`));
  assert.equal(onlyCosts.status, 201);
  const onlyPays = await api('POST', '/api/projects', projectPayload(`PAY-${Date.now()}`));
  assert.equal(onlyPays.status, 201);
  const both = await api('POST', '/api/projects', projectPayload(`BOTH-${Date.now()}`));
  assert.equal(both.status, 201);

  const noneId = none.data.id;
  const costId = onlyCosts.data.id;
  const payId = onlyPays.data.id;
  const bothId = both.data.id;

  // La API exige amount >= 0.01; el filtro se basa en existencia de filas.
  // Un amount=0 insertado a nivel BD también excluye (probado aparte abajo).
  const zeroCost = await api('POST', `/api/projects/${costId}/costs`, {
    category: 'Otros',
    description: 'Costo filtro',
    amount: 0.01,
    currency: 'MXN',
    cost_date: '2026-11-01',
  });
  assert.equal(zeroCost.status, 201, JSON.stringify(zeroCost.data));

  const pay = await api('POST', `/api/projects/${payId}/payments`, {
    amount: 0.01,
    currency: 'MXN',
    payment_date: '2026-11-01',
    notes: 'Pago filtro',
  });
  assert.equal(pay.status, 201, JSON.stringify(pay.data));

  const bothCost = await api('POST', `/api/projects/${bothId}/costs`, {
    category: 'Otros',
    description: 'Costo ambos',
    amount: 10,
    currency: 'MXN',
    cost_date: '2026-11-01',
  });
  assert.equal(bothCost.status, 201);
  const bothPay = await api('POST', `/api/projects/${bothId}/payments`, {
    amount: 10,
    currency: 'MXN',
    payment_date: '2026-11-01',
    notes: 'Pago ambos',
  });
  assert.equal(bothPay.status, 201);

  await t.test('filter returns only the project without any expense or payment rows', async () => {
    const res = await api('GET', `/api/projects?without_expenses_or_payments=1&search=${encodeURIComponent('FILT-')}&limit=50`);
    assert.equal(res.status, 200);
    const ids = (res.data.data || []).map((p) => p.id);
    assert.ok(ids.includes(noneId), 'proyecto sin gastos/pagos debe aparecer');
    assert.ok(!ids.includes(costId), 'solo costos no debe aparecer');
    assert.ok(!ids.includes(payId), 'solo pagos no debe aparecer');
    assert.ok(!ids.includes(bothId), 'con ambos no debe aparecer');
    assert.equal(res.data.filters.without_expenses_or_payments, true);
  });

  await t.test('filter is applied before pagination totals', async () => {
    const filtered = await api('GET', '/api/projects?without_expenses_or_payments=1&limit=15');
    assert.equal(filtered.status, 200);
    assert.ok(filtered.data.pagination.totalRecords >= 1);
    assert.ok(filtered.data.data.length <= filtered.data.pagination.limit);
    assert.ok(filtered.data.data.length <= filtered.data.pagination.totalRecords);
    assert.ok(filtered.data.data.every((p) => Number(p.total_charged) === 0 && Number(p.spent) === 0));
  });

  await t.test('deleting the only payment makes the project match the filter again', async () => {
    const detail = await api('GET', `/api/projects/${payId}`);
    assert.equal(detail.status, 200);
    const paymentId = (detail.data.payments || [])[0]?.id;
    assert.ok(paymentId);
    const del = await api('DELETE', `/api/projects/${payId}/payments/${paymentId}`, {
      password: 'admin123',
    });
    assert.equal(del.status, 200, JSON.stringify(del.data));

    const res = await api('GET', `/api/projects?without_expenses_or_payments=1&search=${encodeURIComponent(onlyPays.data.quote_number)}&limit=50`);
    assert.equal(res.status, 200);
    const ids = (res.data.data || []).map((p) => p.id);
    assert.ok(ids.includes(payId), 'tras DELETE duro del pago, el proyecto vuelve a calificar');
  });
});

test('zero-amount cost/payment rows still exclude a project (existence, not sum)', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY);
    CREATE TABLE project_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0)
    );
    CREATE TABLE project_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0)
    );
  `);
  db.prepare('INSERT INTO projects (id) VALUES (1), (2), (3)').run();
  db.prepare('INSERT INTO project_costs (project_id, amount) VALUES (2, 0)').run();
  db.prepare('INSERT INTO project_payments (project_id, amount) VALUES (3, 0)').run();

  // Misma expresión que PROJECT_FILTERS.without_expenses_or_payments en server.js.
  // Regla aplicada: DELETE duro en project_costs/project_payments (sin soft-delete);
  // se filtra por EXISTS de filas, no por suma de importes.
  const rows = db.prepare(`
    SELECT p.id
    FROM projects p
    WHERE (CASE
      WHEN NOT EXISTS (SELECT 1 FROM project_costs pc WHERE pc.project_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM project_payments pp WHERE pp.project_id = p.id)
      THEN 1 ELSE 0 END) = 1
    ORDER BY p.id
  `).all();

  assert.deepEqual(rows.map((r) => r.id), [1]);
  db.close();
});
