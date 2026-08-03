const test = require('node:test');
const assert = require('node:assert/strict');
const { generateEcovisIntegrityDiagnostic } = require('../src/ecovis');

test('diagnostic reports duplicate cargos keep oldest matching amount', () => {
  const projects = [
    {
      id: 1,
      project_name: 'Alpha',
      status: 'pendiente',
      is_cancelled: 0,
      amount_mxn: 1000,
      total_amount: 1000,
      paid_amount_mxn: 0,
      pending_amount_mxn: 1000,
    },
  ];
  const movements = [
    {
      id: 10,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 1,
      amount: 1000,
      amount_mxn: 1000,
      is_cancelled: 0,
      created_at: '2026-01-01T10:00:00.000Z',
      movement_date: '2026-01-01',
      description: 'first',
    },
    {
      id: 11,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 1,
      amount: 1000,
      amount_mxn: 1000,
      is_cancelled: 0,
      created_at: '2026-02-01T10:00:00.000Z',
      movement_date: '2026-02-01',
      description: 'duplicate',
    },
    {
      id: 12,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 1,
      amount: 999,
      amount_mxn: 999,
      is_cancelled: 0,
      created_at: '2025-12-01T10:00:00.000Z',
      movement_date: '2025-12-01',
      description: 'older mismatch',
    },
  ];

  const result = generateEcovisIntegrityDiagnostic(projects, movements);
  assert.equal(result.read_only, true);
  assert.equal(result.duplicates.projects_with_duplicate_cargos, 1);
  assert.equal(result.duplicates.by_project.length, 1);
  const row = result.duplicates.by_project[0];
  assert.equal(row.keep_movement_id, 10);
  assert.deepEqual(row.cancel_movement_ids, [12, 11]);
  assert.equal(row.needs_manual_review, false);
  assert.equal(result.duplicates.proposed_cancellation_reason, 'Limpieza 2026-08: cargo duplicado');
});

test('diagnostic marks manual review when no cargo matches project amount', () => {
  const projects = [
    {
      id: 2,
      project_name: 'Beta',
      status: 'pendiente',
      is_cancelled: 0,
      amount_mxn: 5000,
      pending_amount_mxn: 5000,
      paid_amount_mxn: 0,
    },
  ];
  const movements = [
    {
      id: 20,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 2,
      amount_mxn: 4000,
      is_cancelled: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      movement_date: '2026-03-01',
      description: 'old',
    },
    {
      id: 21,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 2,
      amount_mxn: 4500,
      is_cancelled: 0,
      created_at: '2026-04-01T00:00:00.000Z',
      movement_date: '2026-04-01',
      description: 'newer',
    },
  ];

  const result = generateEcovisIntegrityDiagnostic(projects, movements);
  const row = result.duplicates.by_project[0];
  assert.equal(row.keep_movement_id, 20);
  assert.deepEqual(row.cancel_movement_ids, [21]);
  assert.equal(row.needs_manual_review, true);
  assert.equal(result.duplicates.projects_needing_manual_review, 1);
});

test('diagnostic lists orphan cargos on cancelled projects', () => {
  const projects = [
    {
      id: 3,
      project_name: 'Cancelled',
      status: 'cancelado',
      is_cancelled: 1,
      amount_mxn: 300,
      pending_amount_mxn: 0,
      paid_amount_mxn: 0,
      cancelled_at: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 4,
      project_name: 'Active',
      status: 'pendiente',
      is_cancelled: 0,
      amount_mxn: 100,
      pending_amount_mxn: 100,
      paid_amount_mxn: 0,
    },
  ];
  const movements = [
    {
      id: 30,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 3,
      amount_mxn: 300,
      is_cancelled: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      movement_date: '2026-01-01',
      description: 'orphan cargo',
    },
    {
      id: 31,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 4,
      amount_mxn: 100,
      is_cancelled: 0,
      created_at: '2026-01-02T00:00:00.000Z',
      movement_date: '2026-01-02',
      description: 'active cargo',
    },
  ];

  const result = generateEcovisIntegrityDiagnostic(projects, movements);
  assert.equal(result.orphans.count, 1);
  assert.equal(result.orphans.total_amount_mxn, 300);
  assert.equal(result.orphans.movements[0].id, 30);
  assert.equal(result.orphans.proposed_cancellation_reason, 'Limpieza 2026-08: proyecto cancelado');
});

test('diagnostic comparative includes per-project pending totals', () => {
  const projects = [
    {
      id: 10,
      project_name: 'P1',
      status: 'pendiente',
      is_cancelled: 0,
      amount_mxn: 1000,
      paid_amount_mxn: 200,
      pending_amount_mxn: 800,
    },
    {
      id: 11,
      project_name: 'P2',
      status: 'parcialmente_pagado',
      is_cancelled: 0,
      amount_mxn: 500,
      paid_amount_mxn: 100,
      pending_amount_mxn: 400,
    },
    {
      id: 12,
      project_name: 'Paid',
      status: 'pagado',
      is_cancelled: 0,
      amount_mxn: 200,
      paid_amount_mxn: 200,
      pending_amount_mxn: 0,
    },
  ];
  const movements = [
    {
      id: 40,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 10,
      amount_mxn: 1000,
      is_cancelled: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      movement_date: '2026-01-01',
      description: 'p1',
    },
    {
      id: 41,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 11,
      amount_mxn: 500,
      is_cancelled: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      movement_date: '2026-01-01',
      description: 'p2',
    },
    {
      id: 42,
      movement_type: 'pago_recibido',
      direction: 'neutral',
      related_project_id: null,
      amount_mxn: 300,
      is_cancelled: 0,
      created_at: '2026-01-03T00:00:00.000Z',
      movement_date: '2026-01-03',
      description: 'payment',
    },
  ];

  const result = generateEcovisIntegrityDiagnostic(projects, movements);
  assert.equal(result.comparative.balance_from_projects_pending_mxn, 1200);
  assert.equal(result.comparative.projects_with_balance_count, 2);
  assert.equal(result.comparative.projects_with_balance.length, 2);
  assert.equal(result.comparative.projects_with_balance[0].project_id, 10);
  assert.equal(result.comparative.projects_with_balance[0].total_amount_mxn, 1000);
  assert.equal(result.comparative.projects_with_balance[0].paid_amount_mxn, 200);
  assert.equal(result.comparative.projects_with_balance[0].pending_amount_mxn, 800);
  assert.equal(result.comparative.balance_from_movements_cargo_mxn, 1500);
  assert.equal(result.comparative.difference_mxn, 300);
  assert.equal(result.comparative.neutral_pago_recibido_count, 1);
  assert.equal(result.comparative.neutral_pago_recibido_amount_mxn, 300);
});

test('diagnostic ignores cancelled movements', () => {
  const projects = [
    {
      id: 5,
      project_name: 'Clean',
      status: 'pendiente',
      is_cancelled: 0,
      amount_mxn: 100,
      pending_amount_mxn: 100,
      paid_amount_mxn: 0,
    },
  ];
  const movements = [
    {
      id: 50,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 5,
      amount_mxn: 100,
      is_cancelled: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      movement_date: '2026-01-01',
      description: 'keep',
    },
    {
      id: 51,
      movement_type: 'proyecto',
      direction: 'ecovis_debe_a_revram',
      related_project_id: 5,
      amount_mxn: 100,
      is_cancelled: 1,
      created_at: '2026-01-02T00:00:00.000Z',
      movement_date: '2026-01-02',
      description: 'already cancelled',
    },
  ];

  const result = generateEcovisIntegrityDiagnostic(projects, movements);
  assert.equal(result.duplicates.projects_with_duplicate_cargos, 0);
  assert.equal(result.proposed_cleanup_summary.total_movements_to_cancel, 0);
});
