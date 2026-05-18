'use strict';

/**
 * Calculates vacation days entitlement based on Mexico's Ley Federal del Trabajo.
 * @param {string|Date} hireDate - Employee hire date
 * @param {string|Date} referenceDate - Date to calculate against (typically today)
 * @returns {number} Days entitled
 */
function calculateVacationEntitlement(hireDate, referenceDate) {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);

  if (Number.isNaN(hire.getTime()) || Number.isNaN(ref.getTime())) {
    throw new Error('Fechas invalidas.');
  }

  const completedYears = getCompletedYears(hire, ref);

  if (completedYears < 1) {
    return 0;
  }

  if (completedYears <= 5) {
    return 10 + completedYears * 2;
  }

  return 22 + Math.floor((completedYears - 6) / 5) * 2;
}

/**
 * Calculates the number of complete years between two dates.
 */
function getCompletedYears(startDate, endDate) {
  let years = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < startDate.getDate())) {
    years -= 1;
  }

  return Math.max(0, years);
}

/**
 * Calculates business days (Monday-Friday) between two dates inclusive.
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @param {object} [options]
 * @param {string[]} [options.holidays] - Array of date strings (YYYY-MM-DD) to exclude
 * @returns {number} Business days count
 */
function calculateBusinessDays(startDate, endDate, options = {}) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Fechas invalidas.');
  }

  if (end < start) {
    throw new Error('La fecha final no puede ser menor que la fecha inicial.');
  }

  const holidays = new Set((options.holidays || []).map((d) => normalizeDate(new Date(d))));
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      if (!holidays.has(normalizeDate(current))) {
        count += 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function normalizeDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Gets the current vacation exercise year for an employee.
 * The exercise year is determined by the anniversary of the hire date.
 */
function getCurrentExerciseYear(hireDate, referenceDate) {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);
  const completedYears = getCompletedYears(hire, ref);
  if (completedYears < 1) {
    return 1;
  }
  return completedYears;
}

/**
 * Calculates the full vacation balance for an employee in a given exercise year,
 * including carry-over from previous exercises.
 *
 * @param {object} params
 * @param {string} params.hireDate - Employee hire date
 * @param {number} params.exerciseYear - The exercise year to compute
 * @param {Array} params.allRequests - All vacation_requests for this employee (all years)
 * @param {string} [params.referenceDate] - Reference date (default: today)
 * @returns {object} Balance breakdown
 */
function calculateVacationBalance({ hireDate, exerciseYear, allRequests, referenceDate }) {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);

  const entitlementDays = calculateVacationEntitlement(hireDate, refDate);

  const carriedBalanceFromPreviousExercise = computeCarriedBalance(
    hireDate, exerciseYear, allRequests, refDate,
  );

  const exerciseRequests = allRequests.filter(
    (r) => r.vacation_exercise_year === exerciseYear && r.status !== 'cancelada',
  );
  const takenDays = exerciseRequests
    .filter((r) => r.status === 'tomada')
    .reduce((sum, r) => sum + r.requested_days, 0);
  const scheduledDays = exerciseRequests
    .filter((r) => r.status === 'programada')
    .reduce((sum, r) => sum + r.requested_days, 0);

  const availableDays = entitlementDays + carriedBalanceFromPreviousExercise - takenDays - scheduledDays;
  const negativeCarryToNextExercise = availableDays < 0 ? availableDays : 0;

  return {
    entitlementDays,
    takenDays,
    scheduledDays,
    carriedBalanceFromPreviousExercise,
    availableDays,
    balanceAfterRequests: availableDays,
    negativeCarryToNextExercise,
  };
}

/**
 * Recursively computes the carried balance from previous exercise years.
 * Only negative balances carry over.
 */
function computeCarriedBalance(hireDate, exerciseYear, allRequests, referenceDate) {
  if (exerciseYear <= 1) {
    return 0;
  }

  const prevYear = exerciseYear - 1;
  const prevEntitlement = calculateEntitlementForExercise(hireDate, prevYear);

  const prevCarried = computeCarriedBalance(hireDate, prevYear, allRequests, referenceDate);

  const prevRequests = allRequests.filter(
    (r) => r.vacation_exercise_year === prevYear && r.status !== 'cancelada',
  );
  const prevUsed = prevRequests.reduce((sum, r) => sum + r.requested_days, 0);

  const prevBalance = prevEntitlement + prevCarried - prevUsed;
  return prevBalance < 0 ? prevBalance : 0;
}

/**
 * Calculates entitlement for a specific exercise year number (1-based).
 */
function calculateEntitlementForExercise(hireDate, exerciseYear) {
  if (exerciseYear < 1) return 0;
  if (exerciseYear <= 5) return 10 + exerciseYear * 2;
  return 22 + Math.floor((exerciseYear - 6) / 5) * 2;
}

module.exports = {
  calculateVacationEntitlement,
  calculateBusinessDays,
  getCompletedYears,
  getCurrentExerciseYear,
  calculateVacationBalance,
  calculateEntitlementForExercise,
};
