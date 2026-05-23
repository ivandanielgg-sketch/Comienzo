'use strict';

const ATTENDANCE_STATUSES = [
  { code: 'A', label: 'Asistencia', color: '#ffffff', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'A*', label: 'Personal fuera de taller / Trabajo fuera', color: '#b3e5fc', counts_as_absence: 0, requires_project_location: 1, requires_extra_payment: 0 },
  { code: 'F', label: 'Falta', color: '#fff9c4', counts_as_absence: 1, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'B', label: 'Baja', color: '#e0e0e0', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'PC', label: 'Permiso c/goce de sueldo', color: '#ffcdd2', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'PS', label: 'Permiso s/goce de sueldo', color: '#ef9a9a', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'D', label: 'Descanso', color: '#bbdefb', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'I', label: 'Incapacidad', color: '#c8e6c9', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
  { code: 'V', label: 'Vacaciones', color: '#b2dfdb', counts_as_absence: 0, requires_project_location: 0, requires_extra_payment: 0 },
];

const VALID_STATUS_CODES = ATTENDANCE_STATUSES.map((s) => s.code);

const VALID_WEEK_STATUSES = ['borrador', 'cerrada', 'cancelada'];

const DAY_COLUMNS = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];

/**
 * Calculates the Monday–Sunday date range for a given ISO week number and year.
 * Uses ISO 8601 week numbering (week starts on Monday).
 */
function calculateWeekRange(year, weekNumber) {
  if (!Number.isFinite(year) || !Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    throw new Error('Año y número de semana inválidos.');
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayOfWeek = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4DayOfWeek - 1));

  const mondayOfTarget = new Date(mondayOfWeek1);
  mondayOfTarget.setUTCDate(mondayOfTarget.getUTCDate() + (weekNumber - 1) * 7);

  const sundayOfTarget = new Date(mondayOfTarget);
  sundayOfTarget.setUTCDate(sundayOfTarget.getUTCDate() + 6);

  const weekStartDate = mondayOfTarget.toISOString().slice(0, 10);
  const weekEndDate = sundayOfTarget.toISOString().slice(0, 10);

  const label = formatWeekLabel(weekNumber, mondayOfTarget, sundayOfTarget);

  return { weekStartDate, weekEndDate, label };
}

function formatWeekLabel(weekNumber, monday, sunday) {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const monDay = days[monday.getUTCDay()];
  const monDate = monday.getUTCDate();
  const monMonth = months[monday.getUTCMonth()];

  const sunDay = days[sunday.getUTCDay()];
  const sunDate = sunday.getUTCDate();
  const sunMonth = months[sunday.getUTCMonth()];
  const sunYear = sunday.getUTCFullYear();

  return `Semana ${weekNumber}. ${monDay}, ${monDate} de ${monMonth} – ${sunDay}, ${sunDate} de ${sunMonth} de ${sunYear}`;
}

function calculateDailyAbsences(employees) {
  const days = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];
  const absencesByDay = {};
  const dayLabels = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  dayLabels.forEach((label, idx) => {
    absencesByDay[label] = 0;
    for (const emp of employees) {
      if (isAbsence(emp[days[idx]])) {
        absencesByDay[label] += 1;
      }
    }
  });

  return absencesByDay;
}

function isAbsence(statusCode) {
  const status = ATTENDANCE_STATUSES.find((s) => s.code === statusCode);
  return status ? status.counts_as_absence === 1 : false;
}

function calculateTotalExtraPayments(employees) {
  let total = 0;
  for (const emp of employees) {
    if (emp.extra_payment_amount && Number.isFinite(Number(emp.extra_payment_amount))) {
      total += Number(emp.extra_payment_amount);
    }
  }
  return total;
}

function calculateAttendanceSummary(employees) {
  const absencesByDay = calculateDailyAbsences(employees);
  const totalAbsences = Object.values(absencesByDay).reduce((sum, v) => sum + v, 0);
  const totalExtraPayments = calculateTotalExtraPayments(employees);

  const countByStatus = {};
  const days = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];

  for (const emp of employees) {
    for (const day of days) {
      const code = emp[day] || 'A';
      countByStatus[code] = (countByStatus[code] || 0) + 1;
    }
  }

  return {
    totalEmployees: employees.length,
    absencesByDay,
    totalAbsences,
    totalExtraPayments,
    countByStatus,
  };
}

function generateDefaultAttendance() {
  return {
    monday_status: 'A',
    tuesday_status: 'A',
    wednesday_status: 'A',
    thursday_status: 'A',
    friday_status: 'A',
    saturday_status: 'D',
    sunday_status: 'D',
  };
}

function validateStatusCode(code) {
  return VALID_STATUS_CODES.includes(code);
}

function employeeHasOutsideWork(emp) {
  const days = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];
  return days.some((d) => emp[d] === 'A*');
}

module.exports = {
  ATTENDANCE_STATUSES,
  VALID_STATUS_CODES,
  VALID_WEEK_STATUSES,
  DAY_COLUMNS,
  calculateWeekRange,
  formatWeekLabel,
  calculateDailyAbsences,
  calculateTotalExtraPayments,
  calculateAttendanceSummary,
  generateDefaultAttendance,
  validateStatusCode,
  isAbsence,
  employeeHasOutsideWork,
};
