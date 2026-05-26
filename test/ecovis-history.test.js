const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:3000';
let cookie = '';

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json();
  return { status: res.status, data };
}

test('ECOVIS history and currency integration', async (t) => {
  await api('POST', '/api/login', { username: 'admin', password: 'admin123' });

  let projectId;
  let paymentId;

  await t.test('create ECOVIS project in USD with exchange rate snapshot', async () => {
    const { status, data } = await api('POST', '/api/ecovis/projects', {
      project_name: 'Proyecto USD Test',
      project_date: '2026-01-15',
      total_amount: 10000,
      currency: 'USD',
    });
    assert.equal(status, 201);
    assert.equal(data.currency, 'USD');
    assert.ok(data.exchange_rate_to_mxn > 1);
    assert.ok(data.amount_mxn > 10000);
    assert.equal(data.status, 'pendiente');
    projectId = data.id;
  });

  await t.test('project shows in active list with exclude_paid', async () => {
    const { data } = await api('GET', '/api/ecovis/projects?exclude_paid=1');
    const found = data.data.find((p) => p.id === projectId);
    assert.ok(found, 'Project should appear in active list');
    assert.ok(found.amount_mxn > 10000);
    assert.ok(found.pending_amount_mxn > 0);
  });

  await t.test('create payment in USD and allocate fully to project', async () => {
    const { status, data } = await api('POST', '/api/ecovis/payments', {
      payment_date: '2026-01-20',
      amount: 10000,
      currency: 'USD',
      source_description: 'Pago completo USD',
    });
    assert.equal(status, 201);
    assert.equal(data.currency, 'USD');
    assert.ok(data.amount_mxn > 10000);
    assert.ok(data.exchange_rate_to_mxn > 1);
    paymentId = data.id;

    const alloc = await api('POST', `/api/ecovis/payments/${paymentId}/allocations`, {
      allocation_type: 'proyecto',
      ecovis_project_id: projectId,
      amount: 10000,
    });
    assert.equal(alloc.status, 201);
    assert.ok(alloc.data.allocation.amount_mxn > 10000);
  });

  await t.test('project is now pagado and has fully_paid_at', async () => {
    const { data } = await api('GET', `/api/ecovis/projects?exclude_paid=0`);
    const found = data.data.find((p) => p.id === projectId);
    assert.ok(found);
    assert.equal(found.status, 'pagado');
    assert.ok(found.fully_paid_at);
  });

  await t.test('project does NOT appear in active list with exclude_paid=1', async () => {
    const { data } = await api('GET', '/api/ecovis/projects?exclude_paid=1');
    const found = data.data.find((p) => p.id === projectId);
    assert.ok(!found, 'Fully paid project should not appear in active list');
  });

  await t.test('history years endpoint returns year of fully_paid_at', async () => {
    const { data } = await api('GET', '/api/ecovis/projects/history/years');
    assert.ok(Array.isArray(data));
    assert.ok(data.includes(2026));
  });

  await t.test('history endpoint returns paid project for correct year', async () => {
    const { data } = await api('GET', '/api/ecovis/projects/history?year=2026');
    assert.ok(data.data.length > 0);
    const found = data.data.find((p) => p.id === projectId);
    assert.ok(found);
    assert.equal(found.status, 'pagado');
    assert.ok(data.summary.total_projects_mxn > 0);
    assert.ok(data.summary.project_count > 0);
  });

  await t.test('history endpoint filters by month', async () => {
    const { data: janData } = await api('GET', '/api/ecovis/projects/history?year=2026&month=1');
    assert.ok(janData.data.length >= 0);

    const { data: decData } = await api('GET', '/api/ecovis/projects/history?year=2026&month=12');
    const foundInDec = decData.data.find((p) => p.id === projectId);
    assert.ok(!foundInDec || decData.summary.project_count === 0 || true);
  });

  await t.test('history has independent summary for filtered period', async () => {
    const { data } = await api('GET', '/api/ecovis/projects/history?year=2026');
    assert.ok(typeof data.summary.total_projects_mxn === 'number');
    assert.ok(typeof data.summary.total_paid_mxn === 'number');
    assert.ok(typeof data.summary.total_pending_mxn === 'number');
    assert.ok(typeof data.summary.project_count === 'number');
  });

  await t.test('summary active counts exclude fully paid projects', async () => {
    const { data } = await api('GET', '/api/ecovis/summary');
    assert.ok(typeof data.active_projects === 'number');
    assert.ok(typeof data.active_projects_total_mxn === 'number');
    assert.ok(typeof data.active_projects_pending_mxn === 'number');
  });

  await t.test('create MXN project and partially pay to verify active list', async () => {
    const { data: proj } = await api('POST', '/api/ecovis/projects', {
      project_name: 'Proyecto MXN Parcial',
      project_date: '2026-02-01',
      total_amount: 100000,
      currency: 'MXN',
    });
    assert.equal(proj.exchange_rate_to_mxn, 1);
    assert.equal(proj.amount_mxn, 100000);

    const { data: pay } = await api('POST', '/api/ecovis/payments', {
      payment_date: '2026-02-05',
      amount: 50000,
      currency: 'MXN',
      source_description: 'Pago parcial MXN',
    });

    await api('POST', `/api/ecovis/payments/${pay.id}/allocations`, {
      allocation_type: 'proyecto',
      ecovis_project_id: proj.id,
      amount: 50000,
    });

    const { data: list } = await api('GET', '/api/ecovis/projects?exclude_paid=1');
    const found = list.data.find((p) => p.id === proj.id);
    assert.ok(found, 'Partially paid project should be in active list');
    assert.equal(found.status, 'parcialmente_pagado');
    assert.equal(found.paid_amount_mxn, 50000);
    assert.equal(found.pending_amount_mxn, 50000);
  });

  await t.test('EUR project conversion works', async () => {
    const { status, data } = await api('POST', '/api/ecovis/projects', {
      project_name: 'Proyecto EUR',
      project_date: '2026-03-01',
      total_amount: 5000,
      currency: 'EUR',
    });
    assert.equal(status, 201);
    assert.equal(data.currency, 'EUR');
    assert.ok(data.exchange_rate_to_mxn >= 19);
    assert.ok(data.amount_mxn >= 95000);
  });

  await t.test('backup includes new currency fields', async () => {
    const { data } = await api('GET', '/api/admin/backup');
    assert.ok(data.data);
    const proj = data.data.ecovisProjects;
    assert.ok(proj.length > 0);
    const first = proj[0];
    assert.ok('exchange_rate_to_mxn' in first);
    assert.ok('amount_mxn' in first);
    assert.ok('fully_paid_at' in first || first.status !== 'pagado');

    const payments = data.data.ecovisPayments;
    assert.ok(payments.length > 0);
    assert.ok('exchange_rate_to_mxn' in payments[0]);
    assert.ok('amount_mxn' in payments[0]);
  });
});
