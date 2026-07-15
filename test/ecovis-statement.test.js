'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEcovisAccountSummary,
  buildEcovisStatementLedger,
  buildEcovisAccountHeader,
  describeEcovisNetBalance,
  resolveStatementConcept,
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
    { allocation_type: 'proyecto', ecovis_project_id: 1, amount_mxn: 30000, is_cancelled: 0 },
  ];
  const movements = [
    { id: 10, movement_type: 'prestamo_ecovis_a_revram', amount_mxn: 20000, is_cancelled: 0 },
    { id: 11, movement_type: 'ajuste', direction: 'ecovis_debe_a_revram', amount_mxn: 5000, is_cancelled: 0 },
  ];
  const summary = calculateEcovisAccountSummary(projects, [], allocations, movements);
  const header = buildEcovisAccountHeader(summary);
  assert.equal(summary.pending_project_amount, 70000);
  assert.equal(summary.adjustments, 5000);
  assert.equal(summary.outstanding_loans, 20000);
  assert.equal(summary.net_balance, 55000);
  assert.equal(header.equation.net_balance, 55000);
  assert.equal(header.status, 'ecovis_owes');
  assert.equal(header.favor_of, 'REVRAM');
});

test('ledger running balance matches header net_balance (three-way)', () => {
  const projects = [
    { id: 1, amount_mxn: 100000, total_amount: 100000, is_cancelled: 0, project_name: 'Alpha' },
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
      description: 'Alpha',
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
      description: 'proyecto',
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
  const ledger = buildEcovisStatementLedger(movements, {
    cancelledProjectIds: new Set(),
    activeProjectIds: new Set([1]),
    projectById: { 1: projects[0] },
  });

  assert.equal(summary.pending_project_amount, 60000);
  assert.equal(summary.adjustments, -2000);
  assert.equal(summary.outstanding_loans, 20000);
  assert.equal(summary.net_balance, 38000);
  assert.equal(header.equation.net_balance, 38000);
  assert.equal(ledger.closing_balance, 38000);

  const paymentRow = ledger.rows.find((r) => r.movement_type === 'pago_recibido');
  assert.equal(paymentRow.affects_balance, false);
  assert.equal(paymentRow.informational, true);

  const appRow = ledger.rows.find((r) => r.movement_type === 'aplicacion_a_proyecto');
  assert.equal(appRow.concept, 'Aplicacion a Alpha');
});

test('cancelled project movements are omitted from statement listing', () => {
  const movements = [
    {
      id: 1,
      movement_date: '2026-02-01',
      movement_type: 'proyecto',
      description: 'ldga3042',
      amount_mxn: 348,
      related_project_id: 9,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 2,
      movement_date: '2026-02-02',
      movement_type: 'aplicacion_a_proyecto',
      description: 'ldga3042',
      amount_mxn: 348,
      related_project_id: 9,
      is_cancelled: 0,
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 3,
      movement_date: '2026-02-03',
      movement_type: 'cancelacion',
      description: 'Motivo X',
      amount_mxn: 348,
      related_project_id: 9,
      is_cancelled: 0,
      cancellation_reason: 'Motivo X',
      direction: 'ecovis_debe_a_revram',
    },
    {
      id: 4,
      movement_date: '2026-02-04',
      movement_type: 'prestamo_ecovis_a_revram',
      description: 'Prestamo vigente',
      amount_mxn: 1000,
      is_cancelled: 0,
      direction: 'revram_debe_a_ecovis',
    },
  ];
  const ledger = buildEcovisStatementLedger(movements, {
    cancelledProjectIds: new Set([9]),
    activeProjectIds: new Set(),
    projectById: { 9: { id: 9, project_name: 'ldga3042', is_cancelled: 1 } },
  });
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0].movement_type, 'prestamo_ecovis_a_revram');
  assert.equal(ledger.closing_balance, -1000);
});

test('allocations to cancelled projects do not reduce pending in summary', () => {
  const projects = [
    { id: 1, amount_mxn: 100000, is_cancelled: 1 },
    { id: 2, amount_mxn: 50000, is_cancelled: 0 },
  ];
  const allocations = [
    { allocation_type: 'proyecto', ecovis_project_id: 1, amount_mxn: 40000, is_cancelled: 0 },
    { allocation_type: 'proyecto', ecovis_project_id: 2, amount_mxn: 10000, is_cancelled: 0 },
  ];
  const summary = calculateEcovisAccountSummary(projects, [], allocations, []);
  assert.equal(summary.total_projected, 50000);
  assert.equal(summary.total_paid_to_projects, 10000);
  assert.equal(summary.pending_project_amount, 40000);
  assert.equal(summary.net_balance, 40000);
});

test('resolveStatementConcept prefers project name over autofilled notes', () => {
  const concept = resolveStatementConcept(
    {
      movement_type: 'aplicacion_a_proyecto',
      description: 'ldga3042',
      related_project_id: 37,
    },
    { 37: { id: 37, project_name: 'Arranque caldera planta Norte' } },
  );
  assert.equal(concept, 'Aplicacion a Arranque caldera planta Norte');
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
    activeProjectIds: new Set([1, 2]),
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
  const ledger = buildEcovisStatementLedger(movements, {
    cancelledProjectIds: new Set(),
    activeProjectIds: new Set([1, 2]),
  });
  const desc = [...ledger.rows].reverse();
  assert.equal(desc[0].running_balance, 3000);
  assert.equal(desc[1].running_balance, 1000);
  assert.equal(roundMoney(desc[0].running_balance), ledger.closing_balance);
});
