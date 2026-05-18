const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateBusinessDays,
  calculateVacationEntitlement,
  calculateVacationSummary,
  validateVacationRequest,
} = require('../src/vacations');

const referenceDate = '2026-05-18';

test('calculateVacationEntitlement follows LFT completed-year table', () => {
  const cases = [
    [0, 0],
    [1, 12],
    [2, 14],
    [3, 16],
    [4, 18],
    [5, 20],
    [6, 22],
    [10, 22],
    [11, 24],
    [15, 24],
    [16, 26],
    [21, 28],
    [26, 30],
    [31, 32],
  ];

  for (const [years, expectedDays] of cases) {
    const hireYear = 2026 - years;
    assert.equal(
      calculateVacationEntitlement(`${hireYear}-05-18`, referenceDate),
      expectedDays,
      `${years} completed years`,
    );
  }
});

test('calculateBusinessDays counts weekdays inclusively', () => {
  assert.equal(calculateBusinessDays('2026-05-18', '2026-05-22'), 5);
  assert.equal(calculateBusinessDays('2026-05-22', '2026-05-25'), 2);
  assert.equal(calculateBusinessDays('2026-05-23', '2026-05-24'), 0);
  assert.equal(calculateBusinessDays('2026-05-18', '2026-05-18'), 1);
  assert.throws(
    () => calculateBusinessDays('2026-05-19', '2026-05-18'),
    /fecha final/i,
  );
});

test('validateVacationRequest rejects requests greater than pending balance', () => {
  const employee = { id: 1, hireDate: '2025-05-18' };

  assert.throws(
    () =>
      validateVacationRequest({
        employee,
        existingRequests: [],
        startDate: '2026-05-18',
        endDate: '2026-06-05',
        status: 'programada',
        referenceDate,
      }),
    /superan los dias pendientes/i,
  );
});

test('validateVacationRequest rejects overlapping active requests', () => {
  const employee = { id: 1, hireDate: '2020-05-18' };
  const existingRequests = [
    {
      id: 1,
      startDate: '2026-05-18',
      endDate: '2026-05-22',
      requestedDays: 5,
      status: 'programada',
    },
  ];

  assert.throws(
    () =>
      validateVacationRequest({
        employee,
        existingRequests,
        startDate: '2026-05-20',
        endDate: '2026-05-25',
        status: 'programada',
        referenceDate,
      }),
    /empalmada/i,
  );
});

test('cancelled requests do not discount or block future requests', () => {
  const employee = { id: 1, hireDate: '2020-05-18' };
  const existingRequests = [
    {
      id: 1,
      startDate: '2026-05-18',
      endDate: '2026-05-22',
      requestedDays: 5,
      status: 'cancelada',
    },
  ];

  const validation = validateVacationRequest({
    employee,
    existingRequests,
    startDate: '2026-05-18',
    endDate: '2026-05-22',
    status: 'programada',
    referenceDate,
  });

  assert.equal(validation.requestedDays, 5);
  assert.equal(
    calculateVacationSummary(employee, existingRequests, referenceDate).scheduledDays,
    0,
  );
});

test('programmed and taken requests discount pending balance', () => {
  const employee = { id: 1, hireDate: '2020-05-18' };
  const summary = calculateVacationSummary(
    employee,
    [
      { requestedDays: 4, status: 'programada' },
      { requestedDays: 3, status: 'tomada' },
      { requestedDays: 2, status: 'cancelada' },
    ],
    referenceDate,
  );

  assert.equal(summary.scheduledDays, 4);
  assert.equal(summary.takenDays, 3);
  assert.equal(summary.pendingDays, 15);
});
