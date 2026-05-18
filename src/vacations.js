function parseDateOnly(value, label = 'Fecha') {
  const date = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`${label} no es valida.`);
  }

  return date;
}

function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

function calculateCompletedYears(hireDate, referenceDate = new Date()) {
  const hire = parseDateOnly(hireDate, 'Fecha de ingreso');
  const reference =
    referenceDate instanceof Date ? referenceDate : parseDateOnly(referenceDate, 'Fecha de referencia');

  let completedYears = reference.getFullYear() - hire.getFullYear();
  const anniversary = new Date(
    reference.getFullYear(),
    hire.getMonth(),
    hire.getDate(),
  );

  if (reference < anniversary) {
    completedYears -= 1;
  }

  return Math.max(completedYears, 0);
}

function calculateVacationEntitlement(hireDate, referenceDate = new Date()) {
  const completedYears = calculateCompletedYears(hireDate, referenceDate);

  if (completedYears < 1) {
    return 0;
  }

  if (completedYears <= 5) {
    return 10 + completedYears * 2;
  }

  return 22 + Math.floor((completedYears - 6) / 5) * 2;
}

function calculateBusinessDays(startDate, endDate, options = {}) {
  const start = parseDateOnly(startDate, 'Fecha inicial');
  const end = parseDateOnly(endDate, 'Fecha final');

  if (end < start) {
    throw new Error('La fecha final no puede ser menor que la fecha inicial.');
  }

  const holidays = new Set(options.holidays || []);
  let businessDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateKey = toDateOnlyString(current);

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateKey)) {
      businessDays += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return businessDays;
}

function getVacationExerciseYear(hireDate, referenceDate = new Date()) {
  const hire = parseDateOnly(hireDate, 'Fecha de ingreso');
  const reference =
    referenceDate instanceof Date ? referenceDate : parseDateOnly(referenceDate, 'Fecha de referencia');
  const anniversary = new Date(
    reference.getFullYear(),
    hire.getMonth(),
    hire.getDate(),
  );

  return reference >= anniversary ? reference.getFullYear() : reference.getFullYear() - 1;
}

function dateRangesOverlap(startA, endA, startB, endB) {
  const aStart = parseDateOnly(startA, 'Fecha inicial');
  const aEnd = parseDateOnly(endA, 'Fecha final');
  const bStart = parseDateOnly(startB, 'Fecha inicial existente');
  const bEnd = parseDateOnly(endB, 'Fecha final existente');

  return aStart <= bEnd && bStart <= aEnd;
}

function calculateVacationSummary(employee, requests = [], referenceDate = new Date()) {
  const correspondingDays = calculateVacationEntitlement(employee.hireDate, referenceDate);
  const takenDays = requests
    .filter((request) => request.status === 'tomada')
    .reduce((total, request) => total + Number(request.requestedDays || 0), 0);
  const scheduledDays = requests
    .filter((request) => request.status === 'programada')
    .reduce((total, request) => total + Number(request.requestedDays || 0), 0);
  const pendingDays = correspondingDays - takenDays - scheduledDays;

  return {
    completedYears: calculateCompletedYears(employee.hireDate, referenceDate),
    vacationExerciseYear: getVacationExerciseYear(employee.hireDate, referenceDate),
    correspondingDays,
    takenDays,
    scheduledDays,
    pendingDays: Math.max(pendingDays, 0),
  };
}

function validateVacationRequest({
  employee,
  existingRequests = [],
  startDate,
  endDate,
  status,
  referenceDate = new Date(),
  excludeRequestId = null,
}) {
  if (!employee) {
    throw new Error('Empleado es obligatorio.');
  }

  if (!['programada', 'tomada', 'cancelada'].includes(status)) {
    throw new Error('Estatus de vacaciones no es valido.');
  }

  const requestedDays = calculateBusinessDays(startDate, endDate);
  if (requestedDays <= 0) {
    throw new Error('Los dias solicitados deben ser mayores a 0.');
  }

  const blockingRequests = existingRequests.filter(
    (request) =>
      request.status !== 'cancelada' && Number(request.id) !== Number(excludeRequestId),
  );
  const overlaps = blockingRequests.some((request) =>
    dateRangesOverlap(startDate, endDate, request.startDate, request.endDate),
  );

  if (overlaps) {
    throw new Error('Ya existe una solicitud de vacaciones empalmada para el empleado.');
  }

  const summary = calculateVacationSummary(employee, blockingRequests, referenceDate);
  if (status !== 'cancelada' && requestedDays > summary.pendingDays) {
    throw new Error('Los dias solicitados superan los dias pendientes.');
  }

  return {
    requestedDays,
    vacationExerciseYear: summary.vacationExerciseYear,
    summary,
  };
}

module.exports = {
  calculateBusinessDays,
  calculateCompletedYears,
  calculateVacationEntitlement,
  calculateVacationSummary,
  dateRangesOverlap,
  getVacationExerciseYear,
  parseDateOnly,
  validateVacationRequest,
};
