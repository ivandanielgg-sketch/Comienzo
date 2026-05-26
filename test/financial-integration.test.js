const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:3000';
let adminCookie = '';
let userCookie = '';

async function api(method, path, body, cookie) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie || adminCookie },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && !cookie) adminCookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

test('Financial Statements module integration', async (t) => {
  // Login as admin
  await api('POST', '/api/login', { username: 'admin', password: 'admin123' });

  // Create a non-admin user for permission tests
  const createRes = await api('POST', '/api/users', { username: 'testfinuser', password: 'test123456', role: 'user' });
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testfinuser', password: 'test123456' }),
  });
  userCookie = loginRes.headers.get('set-cookie').split(';')[0];

  await t.test('non-admin cannot access financial endpoints (403)', async () => {
    const { status, data } = await api('GET', '/api/financial/settings', null, userCookie);
    assert.equal(status, 403);
    assert.ok(data.message.includes('Solo el administrador'));
  });

  await t.test('non-admin cannot access accounts payable', async () => {
    const { status } = await api('GET', '/api/financial/accounts-payable', null, userCookie);
    assert.equal(status, 403);
  });

  await t.test('non-admin cannot access statements', async () => {
    const { status } = await api('GET', '/api/financial/statements', null, userCookie);
    assert.equal(status, 403);
  });

  await t.test('admin can read financial settings', async () => {
    const { status, data } = await api('GET', '/api/financial/settings');
    assert.equal(status, 200);
    assert.equal(data.estimated_isr_rate, 0.1);
    assert.equal(data.ivan_commission_rate, 0.1);
  });

  await t.test('admin can update settings with password', async () => {
    const { status, data } = await api('PUT', '/api/financial/settings', {
      admin_password: 'admin123',
      estimated_isr_rate: 0.12,
      ivan_commission_rate: 0.10,
    });
    assert.equal(status, 200);
    assert.equal(data.estimated_isr_rate, 0.12);
    // Reset back
    await api('PUT', '/api/financial/settings', {
      admin_password: 'admin123',
      estimated_isr_rate: 0.10,
      ivan_commission_rate: 0.10,
    });
  });

  await t.test('settings update fails without password', async () => {
    const { status } = await api('PUT', '/api/financial/settings', {
      estimated_isr_rate: 0.15,
    });
    assert.equal(status, 400);
  });

  await t.test('create account payable in MXN', async () => {
    const { status, data } = await api('POST', '/api/financial/accounts-payable', {
      supplier_name: 'Proveedor Test',
      invoice_number: 'FAC-001',
      invoice_date: '2026-04-10',
      amount_original: 50000,
      currency: 'MXN',
      category: 'Compra de materiales',
    });
    assert.equal(status, 201);
    assert.equal(data.supplier_name, 'Proveedor Test');
    assert.equal(data.amount_mxn, 50000);
    assert.equal(data.status, 'pendiente');
    assert.equal(data.exchange_rate_to_mxn, 1);
  });

  await t.test('create account payable in USD with exchange rate', async () => {
    const { status, data } = await api('POST', '/api/financial/accounts-payable', {
      supplier_name: 'Supplier USD',
      invoice_number: 'INV-USD-001',
      invoice_date: '2026-04-15',
      amount_original: 5000,
      currency: 'USD',
      category: 'Servicios externos',
    });
    assert.equal(status, 201);
    assert.equal(data.currency, 'USD');
    assert.ok(data.exchange_rate_to_mxn >= 17);
    assert.ok(data.amount_mxn >= 85000);
  });

  await t.test('account payable persists when pending', async () => {
    const { data } = await api('GET', '/api/financial/accounts-payable?status=pendiente');
    assert.ok(data.data.length >= 2);
  });

  await t.test('create manual payroll', async () => {
    const { status, data } = await api('POST', '/api/financial/payroll', {
      year: 2026,
      month: 4,
      concept: 'Nómina quincenal 1',
      amount_original: 120000,
      currency: 'MXN',
    });
    assert.equal(status, 201);
    assert.equal(data.amount_mxn, 120000);
    assert.equal(data.year, 2026);
    assert.equal(data.month, 4);
  });

  await t.test('create financial adjustment', async () => {
    const { status, data } = await api('POST', '/api/financial/adjustments', {
      year: 2026,
      month: 4,
      adjustment_type: 'gasto_operativo',
      concept: 'Ajuste renta oficina',
      amount_original: 15000,
      currency: 'MXN',
    });
    assert.equal(status, 201);
    assert.equal(data.amount_mxn, 15000);
    assert.equal(data.status, 'activo');
  });

  await t.test('create bank summary', async () => {
    const { status, data } = await api('POST', '/api/financial/bank-summaries', {
      bank_name: 'BBVA',
      year: 2026,
      month: 4,
      currency: 'MXN',
      initial_balance_original: 500000,
      deposits_original: 200000,
      withdrawals_original: 150000,
      final_balance_original: 550000,
    });
    assert.equal(status, 201);
    assert.equal(data.bank_name, 'BBVA');
    assert.equal(data.initial_balance_mxn, 500000);
  });

  await t.test('create bank movement and classify', async () => {
    const { data: summaries } = await api('GET', '/api/financial/bank-summaries?year=2026&month=4');
    const summaryId = summaries.data[0].id;

    const { status, data } = await api('POST', '/api/financial/bank-movements', {
      bank_statement_summary_id: summaryId,
      transaction_date: '2026-04-05',
      description: 'DEPOSITO TRANSFERENCIA',
      reference: 'REF123',
      deposit_original: 100000,
      withdrawal_original: 0,
    });
    assert.equal(status, 201);
    assert.equal(data.classification_status, 'sin_clasificar');

    // Classify it
    const { status: classStatus, data: classified } = await api('PUT', `/api/financial/bank-movements/${data.id}/classify`, {
      classification_status: 'clasificado',
      classification_type: 'ingreso_proyecto',
      related_project_id: null,
    });
    assert.equal(classStatus, 200);
    assert.equal(classified.classification_status, 'clasificado');
    assert.equal(classified.classification_type, 'ingreso_proyecto');
  });

  await t.test('generate financial statement for April 2026', async () => {
    const { status, data } = await api('POST', '/api/financial/statements/generate', {
      year: 2026,
      month: 4,
    });
    assert.ok(status === 201 || status === 200);
    assert.equal(data.year, 2026);
    assert.equal(data.month, 4);
    assert.ok(data.status === 'borrador');
    assert.ok(data.operating_expenses_mxn >= 0);
    assert.ok(typeof data.estimated_isr_mxn === 'number');
    assert.ok(typeof data.ivan_commission_mxn === 'number');
    assert.ok(!isNaN(data.real_administrative_profit_mxn));
  });

  await t.test('close financial statement creates snapshot', async () => {
    const { data: stmts } = await api('GET', '/api/financial/statements');
    const stmt = stmts.data[0];
    const { status, data } = await api('POST', `/api/financial/statements/${stmt.id}/close`);
    assert.equal(status, 200);
    assert.equal(data.status, 'cerrado');
    assert.ok(data.closed_at);
  });

  await t.test('cannot update closed statement', async () => {
    const { status } = await api('POST', '/api/financial/statements/generate', {
      year: 2026, month: 4,
    });
    assert.equal(status, 400);
  });

  await t.test('reopen allows regeneration', async () => {
    const { data: stmts } = await api('GET', '/api/financial/statements');
    const stmt = stmts.data[0];
    const { status } = await api('POST', `/api/financial/statements/${stmt.id}/reopen`);
    assert.equal(status, 200);

    const { status: genStatus } = await api('POST', '/api/financial/statements/generate', {
      year: 2026, month: 4,
    });
    assert.equal(genStatus, 200);
  });

  await t.test('accounts receivable comes from projects', async () => {
    const { status, data } = await api('GET', '/api/financial/accounts-receivable');
    assert.equal(status, 200);
    assert.ok('data' in data);
    assert.ok('summary' in data);
    assert.ok(typeof data.summary.total_mxn === 'number');
  });

  await t.test('backup includes financial entities', async () => {
    const { data } = await api('GET', '/api/admin/backup');
    assert.ok('financialStatements' in data.data);
    assert.ok('accountsPayable' in data.data);
    assert.ok('bankStatementSummaries' in data.data);
    assert.ok('bankStatementMovements' in data.data);
    assert.ok('manualPayrollExpenses' in data.data);
    assert.ok('financialAdjustments' in data.data);
    assert.ok('financialSettings' in data.data);
  });
});
