'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEcovisAccountSummary,
  buildEcovisStatementLedger,
  buildEcovisAccountHeader,
  describeEcovisNetBalance,
  roundMoney,
} = require('../src/ecovis');

test('describeEcovisNetBalance directions', () => {
  assert.equal(describeEcovisNetBalance(1500).status, 'ecovis_owes');
  assert.equal(describeEcovisNetBalance(-800).status, 'revram_owes');
  assert.equal(describeEcovisNetBalance(0).status, 'settled');
  assert.equal(describeEcovisNetBalance(0.001).status, 'settled');
});

test('header equation matches net_balance components', () => {
  const projects = [{ id: 1, amount_mxn: 100000, is_cancelled: 0 }];
  const allocations = [
    { allocation_type: 'proyecto', amount_mxn: 30000, is_cancelled: 0 },
  ];
  const movements = [
    { id: 10, movement_type: 'prestamo_ecovis_a_revram', amount_mxn: 20000, is_cancelled: 0 },
    { id: 11, movement_type: 'ajuste', direction: 'ecovis_debe_a_revram', amount_mxn: 5000, is_cancelled: 0 },
  ];
  const summary = calculateEcovisAccountSummary(projects, [], allocations, movements);
  const header = buildEcovisAccountHeader(summary);
  // A=70000, B=+5000, C=20000 → net=55000
  assert.equal(summary.pending_project_amount, 70000);
  assert.equal(summary.adjustments, 5000);
  assert.equal(summary.outstanding_loans, 20000);
  assert.equal(summary.net_balance, 55000);
  assert.equal(header.equation.net_balance, 55000);
  assert.equal(header.status, 'ecovis_owes');
  assert.equal(header.favor_of, 'REVRAM');
});

test('ledger running balance matches header net_balance (three-way)', () => {
  // Proyecto 100k, pago asignado 40k, prestamo 25k, devolucion 5k, ajuste -2k (REVRAM debe)
  const projects = [
    { id: 1, amount_mxn: 100000, total_amount: 100000, is_cancelled: 0 },
  ];
  const payments = [
    { id: 1, amount_mxn: 40000, amount: 40000, is_cancelled: 0 },
  ];
  const allocations = [
    {
      payment_id: 1,
      allocation_type: 'proyecto',
      ecovis_project_id: 1,
      amount_mxn: 40000,
      amount: 40000,
      is_cancelled: 0,
    },
  ];
  const movements = [
    {
      id: 1,
      movement_date: '2026-01-05',
      movement_type: 'proyecto',
      description: 'Proyecto Alpha',
      amount: 100000,
      amount_mxn: 100000,
      currency: 'MXN',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 1,
      is_cancelled: 0,
    },
    {
      id: 2,
      movement_date: '2026-01-10',
      movement_type: 'pago_recibido',
      description: 'Transferencia',
      amount: 40000,
      amount_mxn: 40000,
      currency: 'MXN',
      direction: 'neutral',
      related_payment_id: 1,
      is_cancelled: 0,
    },
    {
      id: 3,
      movement_date: '2026-01-10',
      movement_type: 'aplicacion_a_proyecto',
      description: 'Abono Alpha',
      amount: 40000,
      amount_mxn: 40000,
      currency: 'MXN',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 1,
      related_payment_id: 1,
      is_cancelled: 0,
    },
    {
      id: 4,
      movement_date: '2026-01-15',
      movement_type: 'prestamo_ecovis_a_revram',
      description: 'Prestamo',
      amount: 25000,
      amount_mxn: 25000,
      currency: 'MXN',
      direction: 'revram_debe_a_ecovis',
      is_cancelled: 0,
    },
    {
      id: 5,
      movement_date: '2026-01-20',
      movement_type: 'devolucion',
      description: 'Devolucion parcial',
      amount: 5000,
      amount_mxn: 5000,
      currency: 'MXN',
      direction: 'ecovis_debe_a_revram',
      reference: '4',
      is_cancelled: 0,
    },
    {
      id: 6,
      movement_date: '2026-01-25',
      movement_type: 'ajuste',
      description: 'Ajuste en contra',
      amount: 2000,
      amount_mxn: 2000,
      currency: 'MXN',
      direction: 'revram_debe_a_ecovis',
      is_cancelled: 0,
    },
  ];

  const summary = calculateEcovisAccountSummary(projects, payments, allocations, movements);
  const header = buildEcovisAccountHeader(summary);
  const ledger = buildEcovisStatementLedger(movements, { cancelledProjectIds: new Set() });

  // A = 100000 - 40000 = 60000
  // B = -2000
  // C = 25000 - 5000 = 20000
  // net = 60000 - 2000 - 20000 = 38000
  assert.equal(summary.pending_project_amount, 60000);
  assert.equal(summary.adjustments, -2000);
  assert.equal(summary.outstanding_loans, 20000);
  assert.equal(summary.net_balance, 38000);
  assert.equal(header.equation.net_balance, 38000);
  assert.equal(ledger.closing_balance, 38000);
  assert.equal(ledger.rows[ledger.rows.length - 1].running_balance, 38000);

  // pago_recibido is informational: does not move running balance
  const paymentRow = ledger.rows.find((r) => r.movement_type === 'pago_recibido');
  assert.equal(paymentRow.affects_balance, false);
  assert.equal(paymentRow.informational, true);
});

test('cancelled project movement does not affect running balance', () => {
  const movements = [
    {
      id: 1,
      movement_date: '2026-02-01',
      movement_type: 'proyecto',
      description: 'Cancelado',
      amount_mxn: 50000,
      related_project_id: 9,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 2,
      movement_date: '2026-02-02',
      movement_type: 'cancelacion',
      description: 'Motivo X',
      amount_mxn: 50000,
      related_project_id: 9,
      is_cancelled: 0,
      cancellation_reason: 'Motivo X',
      direction: 'ecovis_debe_a_revram',
    },
  ];
  const ledger = buildEcovisStatementLedger(movements, {
    cancelledProjectIds: new Set([9]),
  });
  assert.equal(ledger.closing_balance, 0);
  assert.equal(ledger.rows[0].affects_balance, false);
  assert.equal(ledger.rows[1].affects_balance, false);
});

test('date range opening and closing balances', () => {
  const movements = [
    {
      id: 1,
      movement_date: '2026-01-01',
      movement_type: 'proyecto',
      description: 'P1',
      amount_mxn: 10000,
      related_project_id: 1,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 2,
      movement_date: '2026-02-01',
      movement_type: 'proyecto',
      description: 'P2',
      amount_mxn: 5000,
      related_project_id: 2,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 3,
      movement_date: '2026-03-01',
      movement_type: 'prestamo_ecovis_a_revram',
      description: 'L1',
      amount_mxn: 3000,
      is_cancelled: 0,
      direction: 'revram_debe_a_ecovis',
    },
  ];
  const ledger = buildEcovisStatementLedger(movements, {
    from: '2026-02-01',
    to: '2026-02-28',
    cancelledProjectIds: new Set(),
  });
  assert.equal(ledger.opening_balance, 10000);
  assert.equal(ledger.closing_balance, 15000);
  assert.equal(ledger.rows.length, 1);
});

test('display order can be descending while balance was computed ascending', () => {
  const movements = [
    {
      id: 1,
      movement_date: '2026-01-01',
      movement_type: 'proyecto',
      description: 'A',
      amount_mxn: 1000,
      related_project_id: 1,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 2,
      movement_date: '2026-01-02',
      movement_type: 'proyecto',
      description: 'B',
      amount_mxn: 2000,
      related_project_id: 2,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
  ];
  const ledger = buildEcovisStatementLedger(movements, { cancelledProjectIds: new Set() });
  const desc = [...ledger.rows].reverse();
  assert.equal(desc[0].running_balance, 3000);
  assert.equal(desc[1].running_balance, 1000);
  assert.equal(roundMoney(desc[0].running_balance), ledger.closing_balance);
});
