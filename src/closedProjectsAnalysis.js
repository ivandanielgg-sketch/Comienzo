'use strict';

const { isPostgres } = require('./db/dialect');
const { roundMoney, hasHistoricalAmountMxn } = require('./calculations');

/**
 * Análisis de proyectos cerrados.
 *
 * Fecha: `projects.created_at`. El año y el mes son la fecha calendario
 * almacenada (prefijo YYYY-MM-DD), la misma que muestra la columna Creación
 * y que usa `date(created_at)` / strftime. No se reinterpreta en otra zona.
 *
 * Importes MXN:
 * - Facturado: snapshot `invoiced_amount_mxn` si existe; si la moneda es MXN,
 *   el importe capturado. No se convierte con el tipo de cambio vigente.
 * - Cobrado y costos: snapshot `amount_mxn` si existe; si la moneda es MXN,
 *   el importe capturado. Los costos no tienen columna histórica; un costo
 *   en USD/EUR sin snapshot queda incompleto.
 * - Pendiente = facturado − cobrado, solo si ambos son confiables.
 * - Utilidad = facturado − costos. Es el numerador del margen final existente
 *   (`final_margin = (facturado − costos) / facturado`). No es cobrado − costos.
 *
 * Un importe desconocido no se sustituye por cero ni por el tipo de cambio actual.
 * Si falta una parte, el subtotal de esa métrica queda incompleto.
 */

const MONTH_LABELS = [
  null,
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const GROUP_MODES = new Set(['none', 'year', 'month']);

const CSV_HEADERS = [
  'Identificador',
  'Nombre del proyecto',
  'Cliente',
  'Fecha de creación',
  'Fecha de cierre',
  'Estado',
  'Facturado MXN',
  'Cobrado MXN',
  'Pendiente MXN',
  'Costos MXN',
  'Utilidad MXN',
];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function queryScalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCreatedYear(value) {
  const raw = queryScalar(value);
  if (raw == null || raw === '' || raw === 'all' || raw === 'todos') return null;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw badRequest('El año de creación no es válido.');
  }
  return year;
}

function parseCreatedMonth(value) {
  const raw = queryScalar(value);
  if (raw == null || raw === '' || raw === 'all' || raw === 'todos') return null;
  const month = Number(raw);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw badRequest('El mes de creación no es válido.');
  }
  return month;
}

function calendarDateParts(value) {
  if (value == null || value === '') {
    return { year: null, month: null, date: null, complete: false };
  }
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return { year: null, month: null, date: null, complete: false };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { year: null, month: null, date: null, complete: false };
  }
  return {
    year,
    month,
    date: `${match[1]}-${match[2]}-${match[3]}`,
    complete: true,
  };
}

function matchesCreatedPeriod(createdAt, year, month) {
  if (year == null && month == null) return true;
  const parts = calendarDateParts(createdAt);
  if (!parts.complete) return false;
  if (year != null && parts.year !== year) return false;
  if (month != null && parts.month !== month) return false;
  return true;
}

function metric(amountMxn, complete, reason) {
  return {
    amount_mxn: complete ? roundMoney(amountMxn) : null,
    complete: Boolean(complete),
    reason: complete ? null : reason,
    incomplete_count: complete ? 0 : 1,
    reasons: complete || !reason ? [] : [reason],
  };
}

function reliableCapturedMxn(item, amountField, currencyField, snapshotField) {
  if (!item) return metric(null, false, 'sin_importe');
  const currency = item[currencyField] || 'MXN';
  const snapshot = item[snapshotField];
  const hasSnapshot = snapshotField === 'amount_mxn'
    ? hasHistoricalAmountMxn(item)
    : snapshot != null && snapshot !== '';
  if (hasSnapshot) {
    const value = Number(snapshot);
    if (!Number.isFinite(value)) return metric(null, false, 'sin_importe');
    return metric(value, true, null);
  }
  if (item[amountField] == null || item[amountField] === '') {
    return metric(null, false, 'sin_importe');
  }
  const amount = Number(item[amountField]);
  if (!Number.isFinite(amount)) return metric(null, false, 'sin_importe');
  if (currency !== 'MXN') return metric(null, false, 'sin_snapshot_fx');
  return metric(amount, true, null);
}

function sumEntries(entries) {
  if (!entries || !entries.length) return metric(0, true, null);
  let total = 0;
  for (const entry of entries) {
    const part = reliableCapturedMxn(entry, 'amount', 'currency', 'amount_mxn');
    if (!part.complete) return metric(null, false, part.reason);
    total += part.amount_mxn;
  }
  return metric(total, true, null);
}

function subtractMetrics(minuend, subtrahend) {
  if (!minuend.complete || !subtrahend.complete) {
    return metric(null, false, !minuend.complete ? minuend.reason : subtrahend.reason);
  }
  return metric(minuend.amount_mxn - subtrahend.amount_mxn, true, null);
}

function analyzeClosedProject(project, payments = [], costs = []) {
  const created = calendarDateParts(project?.created_at);
  const closed = calendarDateParts(project?.closed_at);
  const invoiced = reliableCapturedMxn(
    project,
    'total_invoiced',
    'total_invoiced_currency',
    'invoiced_amount_mxn',
  );
  const charged = sumEntries(payments);
  const costsMxn = sumEntries(costs);
  return {
    id: project?.id ?? null,
    project_description: project?.project_description || '',
    client_name: project?.client_name || '',
    status: project?.status || '',
    created,
    closed_date: closed.date,
    invoiced,
    charged,
    pending: subtractMetrics(invoiced, charged),
    costs: costsMxn,
    profit: subtractMetrics(invoiced, costsMxn),
  };
}

function incompleteCalculableLabel(metric, projectCount) {
  const incomplete = Number(metric && metric.incomplete_count) || 0;
  const total = Number(projectCount);
  if (!Number.isInteger(total) || total <= 0 || incomplete <= 0 || incomplete > total) {
    return 'Incompleto';
  }
  return `Incompleto — ${total - incomplete} de ${total} proyectos calculables`;
}

function summarizeProjects(projects) {
  const keys = ['invoiced', 'charged', 'pending', 'costs', 'profit'];
  const summary = { project_count: projects.length };
  for (const key of keys) {
    const incomplete = projects.filter((project) => !project[key].complete);
    if (!projects.length) {
      summary[key] = metric(0, true, null);
      continue;
    }
    if (incomplete.length) {
      const reasons = [...new Set(incomplete.map((project) => project[key].reason).filter(Boolean))];
      summary[key] = {
        amount_mxn: null,
        complete: false,
        reason: reasons[0] || null,
        incomplete_count: incomplete.length,
        reasons,
      };
      continue;
    }
    const amount = projects.reduce((total, project) => total + Number(project[key].amount_mxn), 0);
    summary[key] = metric(amount, true, null);
  }
  return summary;
}

function groupByCreation(projects) {
  const byYear = new Map();
  for (const project of projects) {
    const year = project.created.complete ? project.created.year : null;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(project);
  }
  const years = [...byYear.keys()].sort((a, b) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });
  return years.map((year) => {
    const items = byYear.get(year);
    const byMonth = new Map();
    for (const project of items) {
      const month = project.created.complete ? project.created.month : null;
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(project);
    }
    const months = [...byMonth.keys()].sort((a, b) => {
      if (a == null) return 1;
      if (b == null) return -1;
      return a - b;
    }).map((month) => {
      const monthItems = byMonth.get(month);
      const label = year != null && month != null
        ? `${MONTH_LABELS[month]} ${year}`
        : 'Sin fecha de creación';
      return {
        year,
        month,
        label,
        ...summarizeProjects(monthItems),
      };
    });
    return {
      year,
      label: year == null ? 'Sin fecha de creación' : String(year),
      months,
      ...summarizeProjects(items),
    };
  });
}

function buildClosedProjectsAnalysis(rows, { year = null, month = null } = {}) {
  const projects = rows
    .filter((row) => matchesCreatedPeriod(row.created_at, year, month))
    .map((row) => analyzeClosedProject(row, row.payments || [], row.costs || []));
  return {
    total: summarizeProjects(projects),
    groups: groupByCreation(projects),
    projects,
  };
}

function createdYearExpr(column = 'p.created_at') {
  if (isPostgres()) {
    return `CAST(EXTRACT(YEAR FROM LEFT(${column}::text, 10)::date) AS INTEGER)`;
  }
  return `CAST(strftime('%Y', ${column}) AS INTEGER)`;
}

function createdMonthExpr(column = 'p.created_at') {
  if (isPostgres()) {
    return `CAST(EXTRACT(MONTH FROM LEFT(${column}::text, 10)::date) AS INTEGER)`;
  }
  return `CAST(strftime('%m', ${column}) AS INTEGER)`;
}

function appendCreatedPeriodSql(whereClause, params, query = {}) {
  const year = parseCreatedYear(query.created_year);
  const month = parseCreatedMonth(query.created_month);
  let clause = whereClause;
  const next = [...params];
  if (year != null) {
    clause += ` AND ${createdYearExpr('p.created_at')} = ?`;
    next.push(year);
  }
  if (month != null) {
    clause += ` AND ${createdMonthExpr('p.created_at')} = ?`;
    next.push(month);
  }
  return {
    whereClause: clause,
    params: next,
    created_year: year,
    created_month: month,
  };
}

function closedCreationPeriodsSql() {
  const yearExpr = createdYearExpr('created_at');
  const monthExpr = createdMonthExpr('created_at');
  return `
    SELECT ${yearExpr} AS year, ${monthExpr} AS month, COUNT(*) AS project_count
    FROM projects
    WHERE closed_at IS NOT NULL
    GROUP BY ${yearExpr}, ${monthExpr}
    ORDER BY year, month
  `;
}

function buildCreationPeriods(rows) {
  const monthsByYear = {};
  const monthSet = new Set();
  for (const row of rows || []) {
    const year = Number(row.year);
    const month = Number(row.month);
    if (!Number.isInteger(year) || year <= 0) continue;
    if (!Number.isInteger(month) || month < 1 || month > 12) continue;
    const key = String(year);
    if (!monthsByYear[key]) monthsByYear[key] = [];
    if (!monthsByYear[key].includes(month)) monthsByYear[key].push(month);
    monthSet.add(month);
  }
  for (const key of Object.keys(monthsByYear)) {
    monthsByYear[key].sort((a, b) => a - b);
  }
  return {
    years: Object.keys(monthsByYear).map(Number).sort((a, b) => b - a),
    monthsByYear,
    months: [...monthSet].sort((a, b) => a - b),
  };
}

function monthsAvailableForYear(periods, year) {
  const source = periods || { months: [], monthsByYear: {} };
  if (year == null || year === '') return [...(source.months || [])];
  return [...(source.monthsByYear?.[String(year)] || [])];
}

function normalizeClosedListState(input = {}) {
  const yearRaw = input.year == null ? '' : String(input.year).trim();
  const monthRaw = input.month == null ? '' : String(input.month).trim();
  let year = '';
  let month = '';
  if (yearRaw && yearRaw !== 'all' && yearRaw !== 'todos') {
    const yearNum = Number(yearRaw);
    if (Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2100) year = String(yearNum);
  }
  if (monthRaw && monthRaw !== 'all' && monthRaw !== 'todos') {
    const monthNum = Number(monthRaw);
    if (Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12) month = String(monthNum);
  }
  const group = GROUP_MODES.has(input.group) ? input.group : 'none';
  const search = typeof input.search === 'string' ? input.search : '';
  const sortBy = typeof input.sortBy === 'string' ? input.sortBy : '';
  const sortOrder = input.sortOrder === 'desc' ? 'desc' : 'asc';
  const pageNum = Number(input.page);
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  return { year, month, group, search, sortBy, sortOrder, page };
}

function reconcileClosedPeriod(state, periods) {
  const normalized = normalizeClosedListState(state);
  const availableMonths = monthsAvailableForYear(periods, normalized.year);
  if (normalized.month && !availableMonths.map(String).includes(normalized.month)) {
    normalized.month = '';
  }
  return { ...normalized, availableMonths };
}

function closedListStateSurvivesOpenAndReturn(state) {
  return normalizeClosedListState(normalizeClosedListState(state));
}

function csvEscape(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvMoney(part) {
  if (!part || !part.complete || part.amount_mxn == null) return 'incompleto';
  return String(part.amount_mxn);
}

function buildClosedProjectsCsv(projects) {
  const lines = [CSV_HEADERS.join(',')];
  for (const project of projects || []) {
    lines.push([
      csvEscape(project.id),
      csvEscape(project.project_description),
      csvEscape(project.client_name),
      csvEscape(project.created?.date || ''),
      csvEscape(project.closed_date || ''),
      csvEscape(project.status),
      csvMoney(project.invoiced),
      csvMoney(project.charged),
      csvMoney(project.pending),
      csvMoney(project.costs),
      csvMoney(project.profit),
    ].join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

module.exports = {
  MONTH_LABELS,
  CSV_HEADERS,
  parseCreatedYear,
  parseCreatedMonth,
  calendarDateParts,
  matchesCreatedPeriod,
  analyzeClosedProject,
  summarizeProjects,
  buildClosedProjectsAnalysis,
  createdYearExpr,
  createdMonthExpr,
  appendCreatedPeriodSql,
  incompleteCalculableLabel,
  closedCreationPeriodsSql,
  buildCreationPeriods,
  monthsAvailableForYear,
  normalizeClosedListState,
  reconcileClosedPeriod,
  closedListStateSurvivesOpenAndReturn,
  buildClosedProjectsCsv,
};
