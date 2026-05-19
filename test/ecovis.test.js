const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEcovisAccountSummary,
  calculateProjectPaidAmount,
  calculateProjectStatus,
  calculatePaymentUnallocated,
} = require('../src/ecovis');

test('calculateProjectStatus returns pendiente when no payments', () => {
  assert.equal(calculateProjectStatus({ total_amount: 10000, is_cancelled: 0 }, 0), 'pendiente');
});

test('calculateProjectStatus returns parcialmente_pagado with partial payment', () => {
  assert.equal(calculateProjectStatus({ total_amount: 10000, is_cancelled: 0 }, 5000), 'parcialmente_pagado');
});

test('calculateProjectStatus returns pagado when fully paid', () => {
  assert.equal(calculateProjectStatus({ total_amount: 10000, is_cancelled: 0 }, 10000), 'pagado');
  assert.equal(calculateProjectStatus({ total_amount: 10000, is_cancelled: 0 }, 15000), 'pagado');
});

test('calculateProjectStatus returns cancelado for cancelled project', () => {
  assert.equal(calculateProjectStatus({ total_amount: 10000, is_cancelled: 1 }, 5000), 'cancelado');
});

test('calculateProjectPaidAmount sums proyecto-type allocations', () => {
  const allocations = [
    { allocation_type: 'proyecto', amount: 5000 },
    { allocation_type: 'proyecto', amount: 3000 },
    { allocation_type: 'saldo_a_favor', amount: 2000 },
  ];
  assert.equal(calculateProjectPaidAmount(allocations), 8000);
});

test('calculateProjectPaidAmount returns 0 with no allocations', () => {
  assert.equal(calculateProjectPaidAmount([]), 0);
});

test('calculatePaymentUnallocated computes remaining amount', () => {
  const payment = { amount: 100000 };
  const allocations = [
    { amount: 60000 },
    { amount: 20000 },
  ];
  assert.equal(calculatePaymentUnallocated(payment, allocations), 20000);
});

test('calculatePaymentUnallocated returns full amount when no allocations', () => {
  assert.equal(calculatePaymentUnallocated({ amount: 50000 }, []), 50000);
});

test('calculateEcovisAccountSummary with empty data', () => {
  const result = calculateEcovisAccountSummary([], [], [], []);
  assert.equal(result.total_projected, 0);
  assert.equal(result.total_paid_to_projects, 0);
  assert.equal(result.pending_project_amount, 0);
  assert.equal(result.outstanding_loans, 0);
  assert.equal(result.net_balance, 0);
  assert.equal(result.active_projects, 0);
});

test('calculateEcovisAccountSummary with projects and payments', () => {
  const projects = [
    { id: 1, total_amount: 50000, is_cancelled: 0 },
    { id: 2, total_amount: 30000, is_cancelled: 0 },
  ];
  const payments = [
    { id: 1, amount: 100000, is_cancelled: 0 },
  ];
  const allocations = [
    { payment_id: 1, allocation_type: 'proyecto', amount: 50000 },
    { payment_id: 1, allocation_type: 'proyecto', amount: 10000 },
    { payment_id: 1, allocation_type: 'saldo_a_favor', amount: 20000 },
  ];

  const result = calculateEcovisAccountSummary(projects, payments, allocations, []);
  assert.equal(result.total_projected, 80000);
  assert.equal(result.total_paid_to_projects, 60000);
  assert.equal(result.pending_project_amount, 20000);
  assert.equal(result.active_projects, 2);
});

test('calculateEcovisAccountSummary excludes cancelled projects', () => {
  const projects = [
    { total_amount: 50000, is_cancelled: 0 },
    { total_amount: 30000, is_cancelled: 1 },
  ];
  const result = calculateEcovisAccountSummary(projects, [], [], []);
  assert.equal(result.total_projected, 50000);
  assert.equal(result.active_projects, 1);
  assert.equal(result.total_projects, 2);
});

test('calculateEcovisAccountSummary with loans and repayments', () => {
  const movements = [
    { movement_type: 'prestamo_ecovis_a_revram', amount: 200000 },
    { movement_type: 'devolucion', amount: 50000 },
  ];
  const result = calculateEcovisAccountSummary([], [], [], movements);
  assert.equal(result.total_loans, 200000);
  assert.equal(result.total_repayments, 50000);
  assert.equal(result.outstanding_loans, 150000);
  assert.equal(result.revram_owes_ecovis, 150000);
  assert.equal(result.net_balance, -150000);
});

test('calculateEcovisAccountSummary net balance positive when ECOVIS owes REVRAM', () => {
  const projects = [
    { total_amount: 100000, is_cancelled: 0 },
  ];
  const result = calculateEcovisAccountSummary(projects, [], [], []);
  assert.equal(result.ecovis_owes_revram, 100000);
  assert.equal(result.net_balance, 100000);
});
