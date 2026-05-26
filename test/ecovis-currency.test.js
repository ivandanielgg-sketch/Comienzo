const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEcovisAccountSummary,
  calculateProjectPaidAmountMXN,
  calculateProjectStatus,
  calculateEcovisProjectPaymentStatus,
  calculatePaymentUnallocated,
  calculatePurchaseOrderBalance,
  convertToMXN,
  roundMoney,
} = require('../src/ecovis');

// --- Currency conversion tests ---

test('convertToMXN with MXN returns same amount', () => {
  const rates = { MXN: 1, USD: 17.29, EUR: 19.50 };
  assert.equal(convertToMXN(10000, 'MXN', rates), 10000);
});

test('convertToMXN with USD converts correctly', () => {
  const rates = { MXN: 1, USD: 17.29, EUR: 19.50 };
  assert.equal(convertToMXN(10000, 'USD', rates), 172900);
});

test('convertToMXN with EUR converts correctly', () => {
  const rates = { MXN: 1, USD: 17.29, EUR: 19.50 };
  assert.equal(convertToMXN(10000, 'EUR', rates), 195000);
});

test('convertToMXN with null currency defaults to amount unchanged', () => {
  const rates = { MXN: 1, USD: 17 };
  assert.equal(convertToMXN(5000, null, rates), 5000);
});

test('convertToMXN with unknown currency returns amount as-is', () => {
  const rates = { MXN: 1, USD: 17 };
  assert.equal(convertToMXN(5000, 'GBP', rates), 5000);
});

// --- Exchange rate snapshot tests ---

test('snapshot exchange rate is stored and not recalculated', () => {
  const project = { total_amount: 10000, amount_mxn: 172900, currency: 'USD', exchange_rate_to_mxn: 17.29, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 5000, amount_mxn: 86450, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.total_amount_mxn, 172900);
  assert.equal(result.paid_amount_mxn, 86450);
  assert.equal(result.pending_amount_mxn, 86450);
  assert.equal(result.is_fully_paid, false);
  assert.equal(result.status, 'parcialmente_pagado');
});

test('changing global exchange rate does not alter historical snapshot', () => {
  const oldRate = 17.29;
  const project = { total_amount: 10000, amount_mxn: 10000 * oldRate, currency: 'USD', exchange_rate_to_mxn: oldRate, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 10000, amount_mxn: 10000 * oldRate, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.is_fully_paid, true);
  assert.equal(result.status, 'pagado');
});

// --- Project payment status tests ---

test('project partially paid appears as active', () => {
  const project = { total_amount: 50000, amount_mxn: 50000, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 25000, amount_mxn: 25000, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.status, 'parcialmente_pagado');
  assert.equal(result.is_fully_paid, false);
  assert.equal(result.pending_amount_mxn, 25000);
});

test('project 100% paid is marked as pagado', () => {
  const project = { total_amount: 50000, amount_mxn: 50000, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 50000, amount_mxn: 50000, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.status, 'pagado');
  assert.equal(result.is_fully_paid, true);
  assert.equal(result.pending_amount_mxn, 0);
});

test('project 100% paid with tolerance is fully paid', () => {
  const project = { total_amount: 50000, amount_mxn: 50000, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 49999.995, amount_mxn: 49999.995, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.is_fully_paid, true);
  assert.equal(result.status, 'pagado');
});

test('cancelled allocation does not count toward paid amount', () => {
  const project = { total_amount: 50000, amount_mxn: 50000, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 50000, amount_mxn: 50000, is_cancelled: 1 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.status, 'pendiente');
  assert.equal(result.is_fully_paid, false);
  assert.equal(result.paid_amount_mxn, 0);
});

test('if allocation cancelled and project gets pending again, returns to active', () => {
  const project = { total_amount: 50000, amount_mxn: 50000, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 50000, amount_mxn: 50000, is_cancelled: 1 },
    { allocation_type: 'proyecto', amount: 20000, amount_mxn: 20000, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.status, 'parcialmente_pagado');
  assert.equal(result.is_fully_paid, false);
  assert.equal(result.pending_amount_mxn, 30000);
});

// --- Summary tests with MXN ---

test('calculateEcovisAccountSummary uses amount_mxn fields', () => {
  const projects = [
    { id: 1, total_amount: 10000, amount_mxn: 172900, currency: 'USD', is_cancelled: 0, paid_amount_mxn: 86450, pending_amount_mxn: 86450 },
  ];
  const payments = [
    { id: 1, amount: 5000, amount_mxn: 86450, currency: 'USD', is_cancelled: 0 },
  ];
  const allocations = [
    { payment_id: 1, allocation_type: 'proyecto', amount: 5000, amount_mxn: 86450, is_cancelled: 0 },
  ];

  const result = calculateEcovisAccountSummary(projects, payments, allocations, []);
  assert.equal(result.total_projected, 172900);
  assert.equal(result.total_paid_to_projects, 86450);
  assert.equal(result.pending_project_amount, 86450);
  assert.equal(result.total_payments_received, 86450);
});

test('calculateEcovisAccountSummary does not mix currencies', () => {
  const projects = [
    { id: 1, total_amount: 10000, amount_mxn: 172900, currency: 'USD', is_cancelled: 0, paid_amount_mxn: 0, pending_amount_mxn: 172900 },
    { id: 2, total_amount: 50000, amount_mxn: 50000, currency: 'MXN', is_cancelled: 0, paid_amount_mxn: 0, pending_amount_mxn: 50000 },
  ];
  const result = calculateEcovisAccountSummary(projects, [], [], []);
  assert.equal(result.total_projected, 222900);
  assert.equal(result.active_projects, 2);
});

test('calculateEcovisAccountSummary excludes fully paid from active count', () => {
  const projects = [
    { id: 1, total_amount: 10000, amount_mxn: 10000, is_cancelled: 0, paid_amount_mxn: 10000, pending_amount_mxn: 0 },
    { id: 2, total_amount: 50000, amount_mxn: 50000, is_cancelled: 0, paid_amount_mxn: 20000, pending_amount_mxn: 30000 },
  ];
  const result = calculateEcovisAccountSummary(projects, [], [], []);
  assert.equal(result.active_projects, 1);
  assert.equal(result.active_projects_total_mxn, 50000);
  assert.equal(result.active_projects_paid_mxn, 20000);
  assert.equal(result.active_projects_pending_mxn, 30000);
});

// --- Purchase order balance with MXN ---

test('calculatePurchaseOrderBalance uses amount_mxn', () => {
  const po = { id: 1, total_amount: 5000, amount_mxn: 86450, currency: 'USD', is_cancelled: 0, status: 'pendiente' };
  const allocations = [
    { allocation_type: 'orden_compra', ecovis_purchase_order_id: 1, amount: 2500, amount_mxn: 43225, is_cancelled: 0 },
  ];
  const result = calculatePurchaseOrderBalance(po, allocations);
  assert.equal(result.total_amount_mxn, 86450);
  assert.equal(result.total_applied_payments, 43225);
  assert.equal(result.pending_balance, 43225);
  assert.equal(result.status, 'parcialmente_pagada');
});

test('calculatePurchaseOrderBalance fully paid', () => {
  const po = { id: 1, total_amount: 5000, amount_mxn: 86450, currency: 'USD', is_cancelled: 0, status: 'pendiente' };
  const allocations = [
    { allocation_type: 'orden_compra', ecovis_purchase_order_id: 1, amount: 5000, amount_mxn: 86450, is_cancelled: 0 },
  ];
  const result = calculatePurchaseOrderBalance(po, allocations);
  assert.equal(result.status, 'pagada');
  assert.equal(result.pending_balance, 0);
});

// --- USD payment to MXN project ---

test('USD payment allocation to MXN project deducts correctly in MXN', () => {
  const project = { total_amount: 172900, amount_mxn: 172900, currency: 'MXN', is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 10000, amount_mxn: 172900, currency: 'USD', exchange_rate_to_mxn: 17.29, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.paid_amount_mxn, 172900);
  assert.equal(result.is_fully_paid, true);
});

test('MXN payment to USD project deducts correctly in MXN', () => {
  const project = { total_amount: 10000, amount_mxn: 172900, currency: 'USD', exchange_rate_to_mxn: 17.29, is_cancelled: 0 };
  const allocations = [
    { allocation_type: 'proyecto', amount: 172900, amount_mxn: 172900, currency: 'MXN', exchange_rate_to_mxn: 1, is_cancelled: 0 },
  ];
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  assert.equal(result.paid_amount_mxn, 172900);
  assert.equal(result.is_fully_paid, true);
});

// --- Loans with currency ---

test('calculateEcovisAccountSummary with loans uses amount_mxn', () => {
  const movements = [
    { movement_type: 'prestamo_ecovis_a_revram', amount: 10000, amount_mxn: 172900, currency: 'USD', is_cancelled: 0 },
    { movement_type: 'devolucion', amount: 5000, amount_mxn: 86450, currency: 'USD', is_cancelled: 0 },
  ];
  const result = calculateEcovisAccountSummary([], [], [], movements);
  assert.equal(result.total_loans, 172900);
  assert.equal(result.total_repayments, 86450);
  assert.equal(result.outstanding_loans, 86450);
});

// --- No NaN in cards ---

test('no NaN in summary with empty or undefined amount_mxn', () => {
  const projects = [
    { id: 1, total_amount: 10000, is_cancelled: 0 },
  ];
  const result = calculateEcovisAccountSummary(projects, [], [], []);
  assert.ok(!isNaN(result.total_projected));
  assert.ok(!isNaN(result.pending_project_amount));
  assert.ok(!isNaN(result.net_balance));
  assert.ok(!isNaN(result.active_projects_total_mxn));
  assert.ok(!isNaN(result.active_projects_paid_mxn));
  assert.ok(!isNaN(result.active_projects_pending_mxn));
});
