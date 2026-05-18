const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateVacationEntitlement,
  calculateBusinessDays,
  getCompletedYears,
} = require('../src/vacations');

describe('calculateVacationEntitlement', () => {
  const hireDate = '2020-01-15';

  it('0 years = 0 days', () => {
    assert.strictEqual(calculateVacationEntitlement('2020-01-15', '2020-12-31'), 0);
  });

  it('1 year = 12 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2021-01-15'), 12);
  });

  it('2 years = 14 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2022-01-15'), 14);
  });

  it('3 years = 16 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2023-01-15'), 16);
  });

  it('4 years = 18 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2024-01-15'), 18);
  });

  it('5 years = 20 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2025-01-15'), 20);
  });

  it('6 years = 22 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2026-01-15'), 22);
  });

  it('10 years = 22 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2030-01-15'), 22);
  });

  it('11 years = 24 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2031-01-15'), 24);
  });

  it('15 years = 24 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2035-01-15'), 24);
  });

  it('16 years = 26 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2036-01-15'), 26);
  });

  it('21 years = 28 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2041-01-15'), 28);
  });

  it('26 years = 30 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2046-01-15'), 30);
  });

  it('31 years = 32 days', () => {
    assert.strictEqual(calculateVacationEntitlement(hireDate, '2051-01-15'), 32);
  });
});

describe('calculateBusinessDays', () => {
  it('Monday to Friday = 5 days', () => {
    assert.strictEqual(calculateBusinessDays('2026-01-05', '2026-01-09'), 5);
  });

  it('Friday to next Monday = 2 days', () => {
    assert.strictEqual(calculateBusinessDays('2026-01-09', '2026-01-12'), 2);
  });

  it('Saturday to Sunday = 0 days', () => {
    assert.strictEqual(calculateBusinessDays('2026-01-10', '2026-01-11'), 0);
  });

  it('Monday to Monday (same day) = 1 day', () => {
    assert.strictEqual(calculateBusinessDays('2026-01-05', '2026-01-05'), 1);
  });

  it('end date before start date throws error', () => {
    assert.throws(
      () => calculateBusinessDays('2026-01-10', '2026-01-05'),
      /La fecha final no puede ser menor que la fecha inicial/,
    );
  });

  it('two week span = 10 business days', () => {
    assert.strictEqual(calculateBusinessDays('2026-01-05', '2026-01-16'), 10);
  });

  it('excludes holidays', () => {
    assert.strictEqual(
      calculateBusinessDays('2026-01-05', '2026-01-09', { holidays: ['2026-01-07'] }),
      4,
    );
  });
});

describe('getCompletedYears', () => {
  it('same date = 0 years', () => {
    assert.strictEqual(getCompletedYears(new Date('2020-06-01'), new Date('2020-06-01')), 0);
  });

  it('one day before anniversary = 0 years', () => {
    assert.strictEqual(getCompletedYears(new Date('2020-06-15'), new Date('2021-06-14')), 0);
  });

  it('exactly one year = 1 year', () => {
    assert.strictEqual(getCompletedYears(new Date('2020-06-15'), new Date('2021-06-15')), 1);
  });
});
