const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateVacationEntitlement,
  calculateBusinessDays,
  getCompletedYears,
  calculateVacationBalance,
  calculateAnnualVacationEntitlementByYear,
  calculateAccruedVacationDays,
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

describe('calculateVacationBalance', () => {
  const hireDate = '2023-01-15';

  it('case 1: entitlement 12, taken 10, new request 2 = balance 0', () => {
    const allRequests = [
      { vacation_exercise_year: 1, status: 'tomada', requested_days: 10 },
    ];
    const balance = calculateVacationBalance({
      hireDate,
      exerciseYear: 1,
      allRequests,
      referenceDate: '2024-01-15',
    });
    assert.strictEqual(balance.entitlementDays, 12);
    assert.strictEqual(balance.availableDays, 2);
    assert.strictEqual(balance.negativeCarryToNextExercise, 0);
  });

  it('case 2: entitlement 12, taken 10, request 4 would yield -2', () => {
    const allRequests = [
      { vacation_exercise_year: 1, status: 'tomada', requested_days: 10 },
      { vacation_exercise_year: 1, status: 'programada', requested_days: 4 },
    ];
    const balance = calculateVacationBalance({
      hireDate,
      exerciseYear: 1,
      allRequests,
      referenceDate: '2024-01-15',
    });
    assert.strictEqual(balance.entitlementDays, 12);
    assert.strictEqual(balance.availableDays, -2);
    assert.strictEqual(balance.negativeCarryToNextExercise, -2);
  });

  it('case 3: next exercise inherits negative carry from previous', () => {
    const allRequests = [
      { vacation_exercise_year: 1, status: 'tomada', requested_days: 14 },
    ];
    const balance = calculateVacationBalance({
      hireDate,
      exerciseYear: 2,
      allRequests,
      referenceDate: '2025-01-15',
    });
    assert.strictEqual(balance.entitlementDays, 14);
    assert.strictEqual(balance.carriedBalanceFromPreviousExercise, -2);
    assert.strictEqual(balance.availableDays, 12);
  });

  it('case 4: cancelled request does not reduce balance', () => {
    const allRequests = [
      { vacation_exercise_year: 1, status: 'tomada', requested_days: 10 },
      { vacation_exercise_year: 1, status: 'cancelada', requested_days: 5 },
    ];
    const balance = calculateVacationBalance({
      hireDate,
      exerciseYear: 1,
      allRequests,
      referenceDate: '2024-01-15',
    });
    assert.strictEqual(balance.availableDays, 2);
  });

  it('case 5: programada and tomada both count toward used days without duplication', () => {
    const allRequests = [
      { vacation_exercise_year: 1, status: 'programada', requested_days: 5 },
      { vacation_exercise_year: 1, status: 'tomada', requested_days: 5 },
    ];
    const balance = calculateVacationBalance({
      hireDate,
      exerciseYear: 1,
      allRequests,
      referenceDate: '2024-01-15',
    });
    assert.strictEqual(balance.takenDays, 5);
    assert.strictEqual(balance.scheduledDays, 5);
    assert.strictEqual(balance.availableDays, 2);
  });

  it('zero carry when previous exercise had positive balance', () => {
    const allRequests = [
      { vacation_exercise_year: 1, status: 'tomada', requested_days: 5 },
    ];
    const balance = calculateVacationBalance({
      hireDate,
      exerciseYear: 2,
      allRequests,
      referenceDate: '2025-01-15',
    });
    assert.strictEqual(balance.carriedBalanceFromPreviousExercise, 0);
    assert.strictEqual(balance.availableDays, 14);
  });
});

describe('calculateAnnualVacationEntitlementByYear', () => {
  it('year 0 = 0', () => {
    assert.strictEqual(calculateAnnualVacationEntitlementByYear(0), 0);
  });
  it('year 1 = 12', () => {
    assert.strictEqual(calculateAnnualVacationEntitlementByYear(1), 12);
  });
  it('year 5 = 20', () => {
    assert.strictEqual(calculateAnnualVacationEntitlementByYear(5), 20);
  });
  it('year 6 = 22', () => {
    assert.strictEqual(calculateAnnualVacationEntitlementByYear(6), 22);
  });
  it('year 10 = 22', () => {
    assert.strictEqual(calculateAnnualVacationEntitlementByYear(10), 22);
  });
  it('year 11 = 24', () => {
    assert.strictEqual(calculateAnnualVacationEntitlementByYear(11), 24);
  });
});

describe('calculateAccruedVacationDays', () => {
  it('case 1: 0 completed years = 0 accrued days', () => {
    assert.strictEqual(calculateAccruedVacationDays('2026-01-15', '2026-06-01'), 0);
  });

  it('case 2: 1 completed year = 12 accrued days', () => {
    assert.strictEqual(calculateAccruedVacationDays('2025-01-15', '2026-01-15'), 12);
  });

  it('case 3: 2 completed years = 26 accrued days (12+14)', () => {
    assert.strictEqual(calculateAccruedVacationDays('2024-01-15', '2026-01-15'), 26);
  });

  it('case 4: 3 completed years = 42 accrued days (12+14+16)', () => {
    assert.strictEqual(calculateAccruedVacationDays('2023-01-15', '2026-01-15'), 42);
  });

  it('case 5: 4 completed years = 60 accrued days (12+14+16+18)', () => {
    assert.strictEqual(calculateAccruedVacationDays('2022-01-15', '2026-01-15'), 60);
  });

  it('case 6: 5 completed years = 80 accrued days (12+14+16+18+20)', () => {
    assert.strictEqual(calculateAccruedVacationDays('2021-01-15', '2026-01-15'), 80);
  });

  it('case 7: inactive employee - calculation stops at termination date', () => {
    const terminationDate = '2024-01-15';
    const accruedAtTermination = calculateAccruedVacationDays('2022-01-15', terminationDate);
    const accruedLater = calculateAccruedVacationDays('2022-01-15', '2026-06-01');
    assert.strictEqual(accruedAtTermination, 26);
    assert.notStrictEqual(accruedAtTermination, accruedLater);
  });
});
