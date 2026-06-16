'use strict';

const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { isDbTruthy } = require('./db/dialect');
const { TIMEZONE } = require('./dateHelper');
const { getEmpleadosActivos } = require('./vacations');

const KPI_DEPARTMENTS = ['Ventas', 'Técnico', 'Cobranza', 'Facturación'];

const LEAD_CHANNELS = [
  'WhatsApp', 'Correo', 'Teléfono', 'Técnico', 'Cliente recurrente',
  'Visita proactiva', 'Dirección', 'Web', 'Referido', 'Otro',
];

const REWORK_CAUSES = [
  'error técnico', 'mala selección', 'material incorrecto',
  'información incompleta del cliente', 'alcance mal definido',
  'falla de proveedor', 'falta de herramienta', 'falta de supervisión',
  'error de programación', 'otro',
];

const MARGIN_MIN = 0.30;
const MARGIN_TARGET = 0.40;

/** Semáforo vendedor Ventas: brecha margen real − deseado (puntos %). Documentado aquí; sin kpi_settings aún. */
const VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW = -5;

const UNAVAILABLE = 'Dato no disponible';
const NOT_CAPTURED = 'Dato no capturado';

function formatCurrencyMXN(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentDisplay(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Number(value)}%`;
}

const CURRENCY_KPI_KEYS = /(_mxn$|^quoted_amount|^sold_amount|^invoiced_amount|^collected_amount|^overdue_amount|^quoted_amount_mxn)/i;
const PERCENT_KPI_KEYS = /(rate|margin|portfolio|compliance|evidence|percent)/i;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getCdmxDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getPeriodRange(periodType, startDate, endDate) {
  const { year, month } = getCdmxDateParts(new Date());

  switch (periodType) {
    case 'previous_month': {
      let y = year;
      let m = month - 1;
      if (m < 1) { m = 12; y -= 1; }
      return {
        startDate: formatDate(y, m, 1),
        endDate: formatDate(y, m, lastDayOfMonth(y, m)),
        label: `Mes anterior (${pad2(m)}/${y})`,
      };
    }
    case 'current_quarter': {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      const qEndMonth = qStart + 2;
      return {
        startDate: formatDate(year, qStart, 1),
        endDate: formatDate(year, qEndMonth, lastDayOfMonth(year, qEndMonth)),
        label: `Trimestre actual (${year})`,
      };
    }
    case 'current_year':
      return {
        startDate: formatDate(year, 1, 1),
        endDate: formatDate(year, 12, 31),
        label: `Año actual (${year})`,
      };
    case 'custom':
      if (!startDate || !endDate) {
        throw new Error('Rango personalizado requiere startDate y endDate.');
      }
      if (startDate > endDate) {
        throw new Error('La fecha inicial no puede ser posterior a la final.');
      }
      return { startDate, endDate, label: `${startDate} a ${endDate}` };
    case 'current_month':
    default:
      return {
        startDate: formatDate(year, month, 1),
        endDate: formatDate(year, month, lastDayOfMonth(year, month)),
        label: `Mes actual (${pad2(month)}/${year})`,
      };
  }
}

function extractDate(value) {
  if (!value) return null;
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : null;
}

function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr) return false;
  const d = extractDate(dateStr);
  return d >= startDate && d <= endDate;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeProjectStatus(status) {
  const s = normalizeText(status);
  if (['pendiente'].includes(s)) return 'pendiente';
  if (['en proceso', 'en_proceso'].includes(s)) return 'en_proceso';
  if (['terminado'].includes(s)) return 'terminado';
  if (['cerrado'].includes(s)) return 'cerrado';
  if (['cancelado'].includes(s)) return 'cancelado';
  return s || 'pendiente';
}

function normalizeCollectionStatus(project, totals) {
  const pending = totals?.pending_collection ?? 0;
  const charged = totals?.total_charged ?? 0;
  if (pending <= 0.01 && charged > 0) return 'pagado';
  if (charged > 0 && pending > 0.01) return 'parcial';
  const dueDate = project.due_date;
  if (dueDate) {
    const today = extractDate(new Date().toISOString());
    if (today > dueDate) return 'vencido';
  }
  return 'pendiente';
}

function normalizeReportStatus(report, isComplete) {
  if (report?.archived_at) return 'archivado';
  if (report?.deleted_at) return 'eliminado';
  if (isComplete) return 'completo';
  return 'pendiente';
}

function normalizeQuoteStatus(project) {
  if (project.deleted_at) return 'cancelada';
  if (project.closed_at) return 'ganada';
  const s = normalizeProjectStatus(project.status);
  if (s === 'cancelado') return 'cancelada';
  if (s === 'terminado' || s === 'cerrado') return 'ganada';
  return 'enviada';
}

function normalizeDepartment(dept) {
  if (!dept) return null;
  const d = normalizeText(dept);
  if (d === 'ventas') return 'Ventas';
  if (d === 'tecnico') return 'Técnico';
  if (d === 'cobranza') return 'Cobranza';
  if (d === 'facturacion') return 'Facturación';
  return null;
}

function normalizeKpiArea(area) {
  if (!area) return null;
  const d = normalizeText(area);
  if (d === 'ventas') return 'Ventas';
  if (d === 'tecnico' || d === 'tecnico') return 'Técnico';
  if (d === 'sin asignar' || d === 'sin_asignar') return null;
  return normalizeDepartment(area);
}

function mapKpiEmployee(row) {
  const area = row.kpi_area || row.primary_department || row.department || null;
  const primary = area;
  const kpiDept = normalizeKpiArea(area);
  return {
    employeeId: row.id,
    fullName: row.full_name,
    active: !!row.active,
    department: row.department,
    position: row.position,
    userId: row.user_id || null,
    primaryDepartment: primary,
    secondaryDepartment: row.secondary_department || null,
    kpiDepartment: kpiDept,
    kpiArea: row.kpi_area || null,
    kpiEligible: isDbTruthy(row.kpi_eligible),
  };
}

function loadActiveKpiEmployees(db) {
  const rows = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY full_name').all();
  return rows
    .map(mapKpiEmployee)
    .filter((e) => e.kpiEligible);
}

function getExchangeRateMap(db) {
  const rates = { MXN: 1 };
  db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all()
    .forEach((r) => { rates[r.currency] = Number(r.rate_to_mxn); });
  return rates;
}

function loadProjectsWithTotals(db, exchangeRates) {
  const projects = db.prepare(
    'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY id',
  ).all();
  return projects.map((p) => {
    const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ?').all(p.id);
    const costs = db.prepare('SELECT * FROM project_costs WHERE project_id = ?').all(p.id);
    const totals = buildProjectTotals(p, payments, costs, exchangeRates);
    return { ...p, totals, payments, costs };
  });
}

function safeRatio(numerator, denominator) {
  if (!denominator || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? roundMoney(result) : null;
}

function safePercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return roundMoney(value * 100);
}

function kpiValue(value, options = {}) {
  const opts = typeof options === 'boolean' ? { unavailable: options } : options;
  const {
    unavailable = false,
    notCaptured = false,
    type = null,
    key = null,
    hasData = undefined,
  } = opts;
  if (unavailable) {
    return { value: null, display: UNAVAILABLE, available: false, not_captured: false, has_data: false };
  }
  if (notCaptured) {
    return { value: null, display: NOT_CAPTURED, available: false, not_captured: true, has_data: false };
  }
  if (value === null || value === undefined) {
    return { value: null, display: '—', available: true, not_captured: false, has_data: false };
  }
  let display = String(value);
  const resolvedType = type || (key && CURRENCY_KPI_KEYS.test(key) ? 'currency' : (key && PERCENT_KPI_KEYS.test(key) ? 'percent' : null));
  if (resolvedType === 'currency') display = formatCurrencyMXN(value);
  else if (resolvedType === 'percent') display = formatPercentDisplay(value);
  else if (resolvedType === 'points') display = `${Number(value)} pts`;
  const resolvedHasData = hasData !== undefined ? hasData : true;
  return { value, display, available: true, not_captured: false, has_data: resolvedHasData };
}

function isVentasDepartment(dept) {
  if (!dept) return false;
  const d = normalizeText(dept);
  return d === 'ventas';
}

/** Vendedores activos: getEmpleadosActivos (Vacaciones) ∩ departamento Ventas ∩ kpi_eligible. */
function getVentasEmpleadosActivos(db) {
  const activos = getEmpleadosActivos(db);
  if (!activos.length) return [];
  const placeholders = activos.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, full_name, department, primary_department, position, kpi_eligible, active
     FROM employees WHERE id IN (${placeholders})`,
  ).all(...activos.map((e) => e.id));
  return rows
    .filter((row) => {
      const dept = row.primary_department || row.department || '';
      return isVentasDepartment(dept) && isDbTruthy(row.kpi_eligible);
    })
    .map((row) => ({
      employeeId: row.id,
      fullName: row.full_name,
      active: isDbTruthy(row.active),
      department: row.department,
      position: row.position,
      primaryDepartment: row.primary_department || row.department,
      kpiDepartment: 'Ventas',
      kpiEligible: true,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

function projectMatchesSeller(project, seller) {
  const empId = seller.employeeId;
  const name = normalizeText(seller.fullName);
  return project.vendedor_id === empId
    || (!project.vendedor_id && normalizeText(project.seller).includes(name));
}

function filterClosedInPeriod(projects, period) {
  return projects.filter(
    (p) => p.closed_at && isDateInRange(p.closed_at, period.startDate, period.endDate),
  );
}

function countProjectsClosedForSeller(projects, employeeId, start, end) {
  return projects.filter(
    (p) => p.vendedor_id === employeeId
      && p.closed_at
      && isDateInRange(p.closed_at, start, end),
  ).length;
}

function sumCollectedInPeriod(projects, period, exchangeRates, sellerFilter = null) {
  let collected = 0;
  for (const p of projects) {
    if (sellerFilter && !projectMatchesSeller(p, sellerFilter)) continue;
    for (const pay of p.payments || []) {
      if (isDateInRange(pay.payment_date, period.startDate, period.endDate)) {
        collected += convertAmountToMxn(pay.amount, pay.currency || 'MXN', exchangeRates);
      }
    }
  }
  return roundMoney(collected);
}

function getVentasSellerTrafficLight(closedWithSale, complianceProjects) {
  if (!closedWithSale.length) return 'gray';
  if (!complianceProjects.length) return 'gray';
  const gaps = complianceProjects.map((p) => {
    const realPct = (p.totals.final_margin ?? 0) * 100;
    const desiredPct = Number(p.expected_margin);
    return realPct - desiredPct;
  });
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap >= 0) return 'green';
  if (avgGap >= VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW) return 'yellow';
  return 'red';
}

function computeMarginComplianceMetrics(closedProjects) {
  const withSale = closedProjects.filter((p) => (p.totals?.total_invoiced_mxn ?? 0) > 0);
  const realMargins = withSale
    .map((p) => p.totals.final_margin)
    .filter((m) => m !== null && Number.isFinite(m));
  const avgRealMargin = realMargins.length
    ? safePercent(realMargins.reduce((a, b) => a + b, 0) / realMargins.length)
    : null;

  const withDesired = withSale.filter((p) => Number(p.expected_margin) > 0);
  const desiredMargins = withDesired.map((p) => Number(p.expected_margin));
  const avgDesiredMargin = desiredMargins.length
    ? roundMoney(desiredMargins.reduce((a, b) => a + b, 0) / desiredMargins.length)
    : null;

  const gapPoints = withDesired.map((p) => {
    const realPct = (p.totals.final_margin ?? 0) * 100;
    return roundMoney(realPct - Number(p.expected_margin));
  });
  const avgGapPoints = gapPoints.length
    ? roundMoney(gapPoints.reduce((a, b) => a + b, 0) / gapPoints.length)
    : null;

  return {
    avgRealMargin,
    avgDesiredMargin,
    avgGapPoints,
    closedWithSale: withSale,
    complianceProjects: withDesired,
  };
}

function buildVentasAlertsGrouped(projects) {
  const open = projects.filter(
    (p) => !p.closed_at && !p.next_commercial_action && !p.next_commercial_action_date,
  );
  const byKey = {};
  for (const p of open) {
    const sellerId = p.vendedor_id || null;
    const sellerName = p.seller || 'Sin vendedor';
    const key = sellerId != null ? `id:${sellerId}` : `name:${normalizeText(sellerName)}`;
    if (!byKey[key]) {
      byKey[key] = {
        seller_id: sellerId,
        seller_name: sellerName,
        count: 0,
        alerts: [],
      };
    }
    byKey[key].count += 1;
    byKey[key].alerts.push({
      type: 'cotizacion_sin_seguimiento',
      project_id: p.id,
      quote_number: p.quote_number,
      client_name: p.client_name,
      date: extractDate(p.created_at),
      suggested_action: 'Registrar próxima acción comercial',
    });
  }
  return Object.values(byKey).sort((a, b) => b.count - a.count);
}

function getMarginTrafficLight(margin) {
  if (margin === null || margin === undefined || !Number.isFinite(margin)) return 'gray';
  if (margin >= MARGIN_TARGET) return 'green';
  if (margin >= MARGIN_MIN) return 'yellow';
  if (margin >= 0.20) return 'red';
  return 'critical';
}

function getCollectionTrafficLight(daysOverdue) {
  if (daysOverdue === null || daysOverdue === undefined) return 'gray';
  if (daysOverdue <= 0) return 'green';
  if (daysOverdue <= 30) return 'yellow';
  if (daysOverdue <= 120) return 'red';
  return 'critical';
}

function getReportTrafficLight(daysSinceFinished, hasReport) {
  if (hasReport) return 'green';
  if (daysSinceFinished === null) return 'gray';
  if (daysSinceFinished <= 7) return 'yellow';
  return 'red';
}

function getFollowUpTrafficLight(hasNextAction) {
  return hasNextAction ? 'green' : 'red';
}

function parseReportData(report) {
  if (!report?.report_data) return {};
  try {
    return typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data;
  } catch {
    return {};
  }
}

function isReportComplete(report) {
  if (!report) return false;
  if (report.technical_report_complete) return true;

  const hasDate = !!report.report_date;
  const hasClient = !!report.client_name;
  const hasTechnician = !!(
    report.executed_by_employee_id
    || report.technician_name
    || report.assigned_technicians
  );
  const hasActivity = !!(report.service_name || report.comments);

  if (report.report_type === 'boiler_startup') {
    return hasDate && hasClient && hasTechnician && hasActivity
      && !!(report.equipment_model_serial || report.burner_model);
  }

  const data = parseReportData(report);
  const hasEquipment = !!(data.equipment || data.equipment_model || data.plant);
  const hasFindings = !!(data.findings || data.hallazgos || data.observations || report.comments);
  return hasDate && hasClient && hasTechnician && hasActivity && (hasEquipment || hasFindings);
}

function hasReportEvidence(report) {
  const data = parseReportData(report);
  const evidence = data.evidence || data.photos || data.evidencia;
  if (Array.isArray(evidence) && evidence.length > 0) return true;
  if (data.before_photos || data.during_photos || data.after_photos) return true;
  return !!(report.safety_tests || report.emissions_low_fire || report.emissions_high_fire);
}

function daysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const a = new Date(extractDate(fromDate) + 'T12:00:00');
  const b = new Date(extractDate(toDate) + 'T12:00:00');
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

function applyFilters(projects, filters) {
  let result = projects;
  if (filters.clientName) {
    result = result.filter((p) => normalizeText(p.client_name).includes(normalizeText(filters.clientName)));
  }
  if (filters.projectId) {
    result = result.filter((p) => p.id === Number(filters.projectId));
  }
  if (filters.status) {
    const fs = normalizeText(filters.status);
    result = result.filter((p) => {
      const ps = normalizeProjectStatus(p.status);
      const cs = normalizeCollectionStatus(p, p.totals);
      return ps === fs || cs === fs || normalizeText(p.status) === fs;
    });
  }
  if (filters.employeeId && filters.employee) {
    const emp = filters.employee;
    const empId = Number(emp.employeeId);
    result = result.filter((p) => {
      const dept = emp.kpiDepartment;
      if (dept === 'Ventas') {
        return p.vendedor_id === empId
          || (!p.vendedor_id && normalizeText(p.seller).includes(normalizeText(emp.fullName)));
      }
      if (dept === 'Técnico') {
        return p.tecnico_id === empId
          || (!p.tecnico_id && normalizeText(p.technician_name).includes(normalizeText(emp.fullName)));
      }
      return p.vendedor_id === empId || p.tecnico_id === empId
        || normalizeText(p.seller).includes(normalizeText(emp.fullName))
        || normalizeText(p.technician_name).includes(normalizeText(emp.fullName));
    });
  }
  return result;
}

function resolveProjectDueDate(project) {
  return project.fecha_vencimiento || project.due_date || project.promised_delivery_date || null;
}

function loadReportsForKpis(db) {
  const sqlFull = `
    SELECT r.*, e.full_name AS executed_by_name
    FROM project_reports r
    LEFT JOIN employees e ON e.id = r.executed_by_employee_id
    WHERE r.deleted_at IS NULL AND r.archived_at IS NULL`;
  const sqlLegacy = `
    SELECT r.*, NULL AS executed_by_name
    FROM project_reports r
    WHERE r.deleted_at IS NULL`;
  try {
    return db.prepare(sqlFull).all();
  } catch (_) {
    return db.prepare(sqlLegacy).all();
  }
}

function filterReportsForCharts(reports, projects, period, filters, employees) {
  const projectIds = new Set(projects.map((p) => p.id));
  let rows = reports.filter((r) => projectIds.has(r.project_id));
  rows = rows.filter((r) => isDateInRange(r.report_date, period.startDate, period.endDate));
  if (filters.department) {
    const dept = normalizeDepartment(filters.department) || filters.department;
    if (dept === 'Técnico') {
      const techIds = new Set(
        employees.filter((e) => e.kpiDepartment === 'Técnico').map((e) => e.employeeId),
      );
      rows = rows.filter((r) => techIds.has(r.executed_by_employee_id));
    }
  }
  if (filters.employeeId && filters.employee?.kpiDepartment === 'Técnico') {
    rows = rows.filter((r) => r.executed_by_employee_id === filters.employee.employeeId);
  }
  return rows;
}


function ensureKpiSettingsRow(db) {
  const row = db.prepare('SELECT id FROM kpi_settings WHERE id = 1').get();
  if (row) return;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO kpi_settings (
      id, margin_green_threshold, margin_yellow_threshold, margin_red_threshold,
      receivable_bucket1_days, receivable_bucket2_days, receivable_bucket3_days,
      receivable_critical_days, report_missing_critical_days, require_manual_quote_capture,
      created_at, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(MARGIN_TARGET, MARGIN_MIN, 0.20, 30, 60, 90, 120, 7, 1, now, now);
}

function loadKpiSettings(db) {
  ensureKpiSettingsRow(db);
  const row = db.prepare('SELECT * FROM kpi_settings WHERE id = 1').get();
  if (!row) {
    return {
      margin_green_threshold: MARGIN_TARGET,
      margin_yellow_threshold: MARGIN_MIN,
      margin_red_threshold: 0.20,
      receivable_bucket1_days: 30,
      receivable_bucket2_days: 60,
      receivable_bucket3_days: 90,
      receivable_critical_days: 120,
      report_missing_critical_days: 7,
      require_manual_quote_capture: 1,
    };
  }
  return row;
}

function settingsToApi(settings) {
  const marginGreen = Number(settings.margin_green_threshold);
  const marginYellow = Number(settings.margin_yellow_threshold);
  const marginRed = Number(settings.margin_red_threshold);
  return {
    margin_green_percent: roundMoney((Number.isFinite(marginGreen) ? marginGreen : MARGIN_TARGET) * 100),
    margin_yellow_percent: roundMoney((Number.isFinite(marginYellow) ? marginYellow : MARGIN_MIN) * 100),
    margin_red_percent: roundMoney((Number.isFinite(marginRed) ? marginRed : 0.20) * 100),
    receivable_bucket1_days: Number(settings.receivable_bucket1_days) || 30,
    receivable_bucket2_days: Number(settings.receivable_bucket2_days) || 60,
    receivable_bucket3_days: Number(settings.receivable_bucket3_days) || 90,
    receivable_critical_days: Number(settings.receivable_critical_days) || 120,
    report_missing_critical_days: Number(settings.report_missing_critical_days) || 7,
    require_manual_quote_capture: Number(settings.require_manual_quote_capture) !== 0,
    margin_green_threshold: Number.isFinite(marginGreen) ? marginGreen : MARGIN_TARGET,
    margin_yellow_threshold: Number.isFinite(marginYellow) ? marginYellow : MARGIN_MIN,
    margin_red_threshold: Number.isFinite(marginRed) ? marginRed : 0.20,
  };
}

function getMonthsInPeriod(period) {
  const start = period.startDate;
  const end = period.endDate;
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7));
  const months = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

function loadManualQuoteCapturesForPeriod(db, period) {
  const months = getMonthsInPeriod(period);
  if (!months.length) return [];
  const clauses = months.map(() => '(year = ? AND month = ?)').join(' OR ');
  const params = [];
  months.forEach((mo) => { params.push(mo.year, mo.month); });
  return db.prepare(
    `SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL AND (${clauses}) ORDER BY year, month, employee_id`,
  ).all(...params);
}

function aggregateManualQuotesForMonth(captures, year, month) {
  const byEmployee = captures.filter(
    (c) => c.year === year && c.month === month && c.employee_id != null,
  );
  if (!byEmployee.length) {
    return { quotesSent: 0, quotedAmountMxn: 0, hasCapture: false, byEmployee: true };
  }
  return {
    quotesSent: byEmployee.reduce((s, c) => s + (c.quotes_sent_count || 0), 0),
    quotedAmountMxn: roundMoney(byEmployee.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0)),
    hasCapture: true,
    byEmployee: true,
  };
}

function aggregateManualQuotesForPeriod(captures, period) {
  const months = getMonthsInPeriod(period);
  let quotesSent = 0;
  let quotedAmountMxn = 0;
  let missingMonths = [];
  let capturedMonths = 0;
  for (const mo of months) {
    const agg = aggregateManualQuotesForMonth(captures, mo.year, mo.month);
    if (!agg.hasCapture) missingMonths.push(`${mo.month}/${mo.year}`);
    else {
      capturedMonths += 1;
      quotesSent += agg.quotesSent;
      quotedAmountMxn += agg.quotedAmountMxn;
    }
  }
  return {
    quotesSent,
    quotedAmountMxn: roundMoney(quotedAmountMxn),
    hasCapture: capturedMonths > 0,
    hasFullCapture: missingMonths.length === 0,
    missingMonths,
    capturedMonths,
  };
}

function getManualQuotesForEmployee(captures, period, employeeId) {
  const months = getMonthsInPeriod(period);
  let quotesSent = 0;
  let quotedAmountMxn = 0;
  let hasAny = false;
  for (const mo of months) {
    const monthRows = captures.filter((c) => c.year === mo.year && c.month === mo.month);
    const empRow = monthRows.find((c) => c.employee_id === employeeId);
    if (empRow) {
      hasAny = true;
      quotesSent += empRow.quotes_sent_count || 0;
      quotedAmountMxn += empRow.quoted_amount_mxn || 0;
    }
  }
  return { quotesSent, quotedAmountMxn: roundMoney(quotedAmountMxn), hasCapture: hasAny };
}

function getFormulaDefinitions(settings) {
  const s = settingsToApi(settings);
  return [
    {
      key: 'quotes_sent',
      name: 'Cotizaciones enviadas',
      description: 'Numero de cotizaciones enviadas en el periodo segun captura manual mensual.',
      formula_text: 'Cotizaciones enviadas = Suma de capturas manuales del periodo',
      data_source: 'Captura manual de cotizaciones (kpi_manual_quote_captures)',
      periodicity: 'Mensual',
      editable: false,
      parameters: [],
    },
    {
      key: 'quoted_amount_mxn',
      name: 'Monto cotizado',
      description: 'Monto total cotizado en MXN segun captura manual.',
      formula_text: 'Monto cotizado = Suma quoted_amount_mxn de capturas del periodo',
      data_source: 'Captura manual de cotizaciones',
      periodicity: 'Mensual',
      editable: false,
      parameters: [],
    },
    {
      key: 'close_rate',
      name: 'Tasa de cierre',
      description: 'Porcentaje de proyectos autorizados respecto a cotizaciones enviadas capturadas.',
      formula_text: 'Tasa de cierre = Proyectos autorizados / Cotizaciones enviadas',
      data_source: 'Proyectos del sistema + Captura manual',
      periodicity: 'Periodo consultado',
      editable: false,
      parameters: [],
    },
    {
      key: 'gross_margin_real',
      name: 'Margen bruto real',
      description: 'Margen bruto promedio de proyectos.',
      formula_text: 'Margen bruto real = (Venta MXN - Costo directo MXN) / Venta MXN',
      data_source: 'Proyectos, pagos y costos',
      periodicity: 'Periodo consultado',
      editable: true,
      parameters: [
        { key: 'margin_green_percent', label: 'Verde >=', value: s.margin_green_percent, unit: '%' },
        { key: 'margin_yellow_percent', label: 'Amarillo >=', value: s.margin_yellow_percent, unit: '%' },
        { key: 'margin_red_percent', label: 'Rojo >=', value: s.margin_red_percent, unit: '%' },
      ],
      semaphore: {
        green: `>= ${s.margin_green_percent}%`,
        yellow: `${s.margin_yellow_percent}% a ${s.margin_green_percent - 0.01}%`,
        red: `${s.margin_red_percent}% a ${s.margin_yellow_percent - 0.01}%`,
        critical: `< ${s.margin_red_percent}%`,
      },
    },
    {
      key: 'invoices_issued',
      name: 'Facturas emitidas (criterio administrativo)',
      description: 'Todos los proyectos del periodo se consideran facturados para efectos del tablero.',
      formula_text: 'Facturas emitidas = Numero de proyectos creados en el periodo',
      data_source: 'Proyectos',
      periodicity: 'Periodo consultado',
      editable: false,
      parameters: [],
    },
    {
      key: 'invoiced_amount_mxn',
      name: 'Monto facturado (criterio administrativo)',
      description: 'Suma de montos de proyectos del periodo en MXN.',
      formula_text: 'Monto facturado = Suma total_invoiced_mxn de proyectos del periodo',
      data_source: 'Proyectos',
      periodicity: 'Periodo consultado',
      editable: false,
      parameters: [],
    },
  ];
}


function computeVentasBySeller(projects, period, manualQuotes, sellers, exchangeRates) {
  const closed = filterClosedInPeriod(projects, period);
  return sellers.map((seller) => {
    const sellerClosed = closed.filter((p) => projectMatchesSeller(p, seller));
    const manualEmp = getManualQuotesForEmployee(manualQuotes || [], period, seller.employeeId);
    const soldAmount = roundMoney(
      sellerClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
    );
    const closedCount = sellerClosed.length;
    const quotesSent = manualEmp.hasCapture ? manualEmp.quotesSent : null;
    const quotedAmount = manualEmp.hasCapture ? manualEmp.quotedAmountMxn : null;
    const closeRateCount = quotesSent > 0 ? safePercent(safeRatio(closedCount, quotesSent)) : null;
    const closeRateAmount = quotedAmount > 0 ? safePercent(safeRatio(soldAmount, quotedAmount)) : null;
    const marginMetrics = computeMarginComplianceMetrics(sellerClosed);
    const collected = sumCollectedInPeriod(projects, period, exchangeRates, seller);
    const trafficLight = getVentasSellerTrafficLight(
      marginMetrics.closedWithSale,
      marginMetrics.complianceProjects,
    );

    return {
      employee_id: seller.employeeId,
      full_name: seller.fullName,
      quotes_sent: quotesSent,
      quoted_amount_mxn: quotedAmount,
      projects_closed: closedCount,
      sold_amount_mxn: soldAmount,
      close_rate_count: closeRateCount,
      close_rate_amount: closeRateAmount,
      avg_real_margin: marginMetrics.avgRealMargin,
      avg_desired_margin: marginMetrics.avgDesiredMargin,
      margin_gap_points: marginMetrics.avgGapPoints,
      collected_amount_mxn: collected > 0 ? collected : null,
      traffic_light: trafficLight,
      has_sold_data: closedCount > 0 && soldAmount > 0,
      has_quote_data: manualEmp.hasCapture,
    };
  }).sort((a, b) => (b.sold_amount_mxn || 0) - (a.sold_amount_mxn || 0));
}

function computeSalesKpis(projects, period, manualQuotes, settings, exchangeRates, sellers) {
  const manualAgg = aggregateManualQuotesForPeriod(manualQuotes || [], period);
  const closed = filterClosedInPeriod(projects, period);
  const soldAmount = roundMoney(closed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0));
  const closedCount = closed.length;
  const hasQuoteData = manualAgg.hasCapture;

  const quotesSentVal = hasQuoteData ? manualAgg.quotesSent : null;
  const quotedAmountVal = hasQuoteData ? manualAgg.quotedAmountMxn : null;

  const closeRateCount = quotesSentVal > 0 ? safePercent(safeRatio(closedCount, quotesSentVal)) : null;
  const closeRateAmount = quotedAmountVal > 0 ? safePercent(safeRatio(soldAmount, quotedAmountVal)) : null;

  const marginMetrics = computeMarginComplianceMetrics(closed);
  const collectedAmount = sumCollectedInPeriod(projects, period, exchangeRates);

  const pendingCapture = (settings?.require_manual_quote_capture !== 0 && manualAgg.missingMonths.length)
    ? {
        months: manualAgg.missingMonths,
        message: `Falta captura de cotizaciones para: ${manualAgg.missingMonths.join(', ')}`,
      }
    : null;

  const sellersTable = computeVentasBySeller(
    projects,
    period,
    manualQuotes,
    sellers || [],
    exchangeRates,
  );
  const salesAlertsBySeller = buildVentasAlertsGrouped(projects);

  return {
    quotes_sent: kpiValue(quotesSentVal, { hasData: hasQuoteData, key: 'quotes_sent' }),
    quoted_amount_mxn: kpiValue(quotedAmountVal, {
      hasData: hasQuoteData,
      type: 'currency',
      key: 'quoted_amount_mxn',
    }),
    projects_closed: kpiValue(closedCount > 0 ? closedCount : null, { hasData: closedCount > 0 }),
    sold_amount_mxn: kpiValue(closedCount > 0 ? soldAmount : null, {
      hasData: closedCount > 0,
      type: 'currency',
      key: 'sold_amount_mxn',
    }),
    close_rate_count: kpiValue(closeRateCount, { hasData: closeRateCount !== null }),
    close_rate_amount: kpiValue(closeRateAmount, { hasData: closeRateAmount !== null }),
    avg_real_margin: kpiValue(marginMetrics.avgRealMargin, {
      hasData: marginMetrics.avgRealMargin !== null,
    }),
    avg_desired_margin: kpiValue(marginMetrics.avgDesiredMargin, {
      hasData: marginMetrics.avgDesiredMargin !== null,
    }),
    margin_gap_points: kpiValue(marginMetrics.avgGapPoints, {
      hasData: marginMetrics.avgGapPoints !== null,
      type: 'points',
    }),
    collected_amount_mxn: kpiValue(collectedAmount > 0 ? collectedAmount : null, {
      hasData: collectedAmount > 0,
      type: 'currency',
      key: 'collected_amount_mxn',
    }),
    manual_capture_missing_months: manualAgg.missingMonths,
    pending_capture: pendingCapture,
    sellers_table: sellersTable,
    sales_alerts_by_seller: salesAlertsBySeller,
    margin_min_percent: MARGIN_MIN * 100,
    margin_target_percent: MARGIN_TARGET * 100,
  };
}

function computeVentasChartData(sales, chartsPayload) {
  const quoted = sales.quoted_amount_mxn?.value ?? 0;
  const sold = sales.sold_amount_mxn?.value ?? 0;
  const collected = sales.collected_amount_mxn?.value ?? 0;

  const funnelStages = [
    { key: 'quoted', label: 'Cotizado', amount: quoted, color: '#2563eb' },
    { key: 'sold', label: 'Vendido', amount: sold, color: '#0d9488' },
    { key: 'collected', label: 'Cobrado', amount: collected, color: '#eab308' },
  ].filter((s) => s.amount > 0);

  const sellerRanking = (sales.sellers_table || [])
    .filter((s) => (s.sold_amount_mxn || 0) > 0)
    .sort((a, b) => (b.sold_amount_mxn || 0) - (a.sold_amount_mxn || 0))
    .map((s) => ({
      label: s.full_name,
      sold_amount_mxn: roundMoney(s.sold_amount_mxn || 0),
      quoted_amount_mxn: roundMoney(s.quoted_amount_mxn || 0),
    }));

  const marginGapBySeller = (sales.sellers_table || [])
    .filter((s) => s.margin_gap_points != null && s.has_sold_data && s.avg_desired_margin != null)
    .sort((a, b) => (b.margin_gap_points || 0) - (a.margin_gap_points || 0))
    .map((s) => ({
      label: s.full_name,
      gap_points: s.margin_gap_points,
    }));

  return {
    monthly_trend: chartsPayload?.monthly_trend || [],
    sales_funnel: { stages: funnelStages },
    seller_ranking: sellerRanking,
    margin_gap_by_seller: marginGapBySeller,
  };
}

function computeProjectsKpis(projects, reportsByProject, settings) {
  const active = projects.filter((p) => {
    const s = normalizeProjectStatus(p.status);
    return ['pendiente', 'en_proceso'].includes(s) && !p.closed_at;
  });

  const withMargin = projects.map((p) => {
    const sale = p.totals.total_invoiced_mxn;
    const cost = p.totals.spent;
    const grossMargin = sale > 0 ? roundMoney((sale - cost) / sale) : null;
    return { ...p, grossMargin };
  });

  const redMargin = withMargin.filter(
    (p) => p.grossMargin !== null && p.grossMargin < (settings?.margin_yellow_threshold ?? MARGIN_MIN),
  );

  const finished = projects.filter(
    (p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at,
  );
  const onTime = finished.filter((p) => {
    const delivery = extractDate(p.promised_delivery_date);
    const closed = extractDate(p.closed_at || p.technical_closed_at);
    if (!delivery || !closed) return false;
    const report = reportsByProject[p.id];
    const reportComplete = report ? isReportComplete(report) : !!p.technical_report_complete;
    return closed <= delivery && reportComplete;
  });
  const deliveryCompliance = safeRatio(onTime.length, finished.length);

  const rework = projects.filter((p) => p.rework);
  const reworkRate = safeRatio(rework.length, finished.length);

  const technicalPending = finished.filter((p) => {
    const report = reportsByProject[p.id];
    return !report || !isReportComplete(report);
  });

  const marginsWithValue = withMargin.filter((p) => p.grossMargin !== null);
  const avgGrossMargin = marginsWithValue.length
    ? marginsWithValue.reduce((s, p) => s + p.grossMargin, 0) / marginsWithValue.length
    : null;

  return {
    active_projects: kpiValue(active.length),
    gross_margin_real: kpiValue(avgGrossMargin !== null ? safePercent(avgGrossMargin) : null),
    red_margin_projects: kpiValue(redMargin.length),
    red_margin_list: redMargin.map((p) => ({
      project_id: p.id,
      quote_number: p.quote_number,
      client_name: p.client_name,
      margin_percent: safePercent(p.grossMargin),
      traffic_light: getMarginTrafficLight(p.grossMargin),
    })),
    delivery_compliance: kpiValue(deliveryCompliance !== null ? safePercent(deliveryCompliance) : null),
    reworks: kpiValue(rework.length),
    rework_rate: kpiValue(reworkRate !== null ? safePercent(reworkRate) : null),
    rework_causes_catalog: REWORK_CAUSES,
    technical_close_pending: kpiValue(technicalPending.length),
  };
}

function computeReportsKpis(projects, reports) {
  const finished = projects.filter(
    (p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at,
  );
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  let complete = 0;
  let withEvidence = 0;
  let withoutReport = 0;

  for (const p of finished) {
    const report = reportsByProject[p.id];
    if (!report) {
      withoutReport += 1;
      continue;
    }
    if (isReportComplete(report)) complete += 1;
    if (hasReportEvidence(report)) withEvidence += 1;
  }

  const total = finished.length;
  return {
    complete_reports: kpiValue(safeRatio(complete, total) !== null ? safePercent(safeRatio(complete, total)) : null),
    complete_count: kpiValue(complete),
    complete_evidence: kpiValue(safeRatio(withEvidence, total) !== null ? safePercent(safeRatio(withEvidence, total)) : null),
    services_without_report: kpiValue(withoutReport),
    services_total: kpiValue(total),
  };
}

function computeBillingKpis(projects, period) {
  const inPeriod = projects.filter((p) => isDateInRange(p.created_at, period.startDate, period.endDate));
  const invoicedAmount = roundMoney(inPeriod.reduce((s, p) => s + p.totals.total_invoiced_mxn, 0));

  const hasInvoiceIssuedAt = projects.some((p) => p.invoice_issued_at);
  const hasInvoiceDate = projects.some((p) => p.invoice_date && !p.invoice_date_na);
  let billingTimeDays = kpiValue(null, { unavailable: !hasInvoiceIssuedAt && !hasInvoiceDate });
  if (hasInvoiceIssuedAt || hasInvoiceDate) {
    const times = projects
      .map((p) => {
        const techClose = p.technical_closed_at || (normalizeProjectStatus(p.status) === 'terminado' ? p.updated_at : null);
        const invoiceDate = p.invoice_issued_at || (p.invoice_date_na ? null : p.invoice_date);
        return daysBetween(techClose, invoiceDate);
      })
      .filter((d) => d !== null && d >= 0);
    billingTimeDays = kpiValue(
      times.length ? roundMoney(times.reduce((a, b) => a + b, 0) / times.length) : null,
    );
  } else {
    billingTimeDays = kpiValue(null, { unavailable: true });
  }

  const cancelled = projects.filter((p) => p.invoice_cancelled);
  const withError = projects.filter((p) => p.invoice_error);
  const pendingDocs = projects.filter((p) => p.invoice_pending_docs);

  return {
    invoices_issued: kpiValue(inPeriod.length),
    invoiced_amount_mxn: kpiValue(invoicedAmount, { type: 'currency', key: 'invoiced_amount_mxn' }),
    billing_time_days: billingTimeDays,
    billing_admin_note: 'Criterio administrativo: todos los proyectos del periodo se consideran facturados.',
    cancelled_invoices: kpiValue(cancelled.length),
    error_invoices: kpiValue(withError.length),
    pending_documentation: kpiValue(pendingDocs.length),
  };
}

function computeCollectionKpis(projects, period, exchangeRates) {
  const today = extractDate(new Date().toISOString());
  let collectedAmount = 0;
  let collectedInvoices = 0;
  const collectionDays = [];
  let totalReceivable = 0;
  let overdueAmount = 0;
  let over120Count = 0;
  let over120Amount = 0;
  let withoutContact = 0;

  for (const p of projects) {
    const pending = p.totals.pending_collection;
    if (pending > 0) totalReceivable += pending;

    for (const pay of p.payments) {
      if (isDateInRange(pay.payment_date, period.startDate, period.endDate)) {
        collectedAmount += convertAmountToMxn(pay.amount, pay.currency || 'MXN', exchangeRates);
      }
    }

    if (p.totals.total_charged > 0 && pending <= 0.01) collectedInvoices += 1;

    const invoiceDate = p.invoice_date_na ? null : p.invoice_date;
    if (invoiceDate && p.payments.length) {
      const lastPay = [...p.payments].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))[0];
      const days = daysBetween(invoiceDate, lastPay.payment_date);
      if (days !== null && days >= 0) collectionDays.push(days);
    }

    if (pending > 0.01) {
      const dueDate = p.due_date;
      if (dueDate && today > dueDate) {
        overdueAmount += pending;
        const daysOver = daysBetween(dueDate, today);
        if (daysOver !== null && daysOver > 120) {
          over120Count += 1;
          over120Amount += pending;
        }
      }
      if (!p.collection_contact_at && !p.collection_notes) withoutContact += 1;
    }
  }

  return {
    collected_amount_mxn: kpiValue(roundMoney(collectedAmount), { type: 'currency', key: 'collected_amount_mxn' }),
    collected_invoices: kpiValue(collectedInvoices),
    avg_collection_days: kpiValue(
      collectionDays.length
        ? roundMoney(collectionDays.reduce((a, b) => a + b, 0) / collectionDays.length)
        : null,
    ),
    overdue_portfolio: kpiValue(safeRatio(overdueAmount, totalReceivable) !== null ? safePercent(safeRatio(overdueAmount, totalReceivable)) : null),
    overdue_amount_mxn: kpiValue(roundMoney(overdueAmount), { type: 'currency', key: 'overdue_amount_mxn' }),
    accounts_over_120_days: kpiValue(over120Count),
    accounts_over_120_amount_mxn: kpiValue(roundMoney(over120Amount), { type: 'currency', key: 'accounts_over_120_amount_mxn' }),
    invoices_without_contact: kpiValue(withoutContact),
  };
}

function computeDepartmentKpis(department, sales, projectsKpi, reports, billing, collection) {
  const map = {
    Ventas: {
      quotes_sent: sales.quotes_sent,
      quoted_amount_mxn: sales.quoted_amount_mxn,
      projects_closed: sales.projects_closed,
      sold_amount_mxn: sales.sold_amount_mxn,
      close_rate_count: sales.close_rate_count,
      close_rate_amount: sales.close_rate_amount,
      avg_real_margin: sales.avg_real_margin,
      margin_gap_points: sales.margin_gap_points,
      collected_amount_mxn: sales.collected_amount_mxn,
    },
    Técnico: {
      complete_reports: reports.complete_reports,
      services_without_report: reports.services_without_report,
      reworks: projectsKpi.reworks,
      technical_close_pending: projectsKpi.technical_close_pending,
    },
    Cobranza: {
      collected_amount_mxn: collection.collected_amount_mxn,
      overdue_portfolio: collection.overdue_portfolio,
      avg_collection_days: collection.avg_collection_days,
      accounts_over_120_days: collection.accounts_over_120_days,
    },
    Facturación: {
      invoices_issued: billing.invoices_issued,
      billing_time_days: billing.billing_time_days,
      cancelled_invoices: billing.cancelled_invoices,
      pending_documentation: billing.pending_documentation,
    },
  };
  return { department, kpis: map[department] || {} };
}

function computeEmployeeKpis(employee, projects, reports, period, manualQuotes) {
  const name = normalizeText(employee.fullName);
  const dept = employee.kpiDepartment;
  const related = projects.filter((p) => {
    if (dept === 'Ventas') {
      return p.vendedor_id === employee.employeeId
        || (!p.vendedor_id && normalizeText(p.seller).includes(name));
    }
    if (dept === 'Técnico') {
      return p.tecnico_id === employee.employeeId
        || (!p.tecnico_id && normalizeText(p.technician_name).includes(name));
    }
    return p.vendedor_id === employee.employeeId || p.tecnico_id === employee.employeeId
      || normalizeText(p.seller).includes(name) || normalizeText(p.technician_name).includes(name);
  });

  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  let kpis = {};
  let trafficLight = 'gray';

  if (dept === 'Ventas') {
    return null;
  } else if (dept === 'Técnico') {
    const assigned = related.filter(
      (p) => p.tecnico_id === employee.employeeId
        || (!p.tecnico_id && normalizeText(p.technician_name).includes(name)),
    );
    const finished = assigned.filter((p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at);
    const executedInPeriod = reports.filter((r) => (
      r.executed_by_employee_id === employee.employeeId
      && isDateInRange(r.report_date, period.startDate, period.endDate)
    ));
    let complete = 0;
    let noReport = 0;
    for (const p of finished) {
      const r = reportsByProject[p.id];
      if (!r || !isReportComplete(r)) noReport += 1;
      else complete += 1;
    }
    const executedComplete = executedInPeriod.filter((r) => isReportComplete(r)).length;
    kpis = {
      assigned_services: assigned.length,
      services_executed: executedInPeriod.length,
      complete_reports: finished.length ? safePercent(safeRatio(complete, finished.length)) : null,
      executed_reports_complete: executedInPeriod.length
        ? safePercent(safeRatio(executedComplete, executedInPeriod.length))
        : null,
      services_without_report: noReport,
      reworks: assigned.filter((p) => p.rework).length,
    };
    trafficLight = noReport > 0 ? 'red' : 'green';
  } else if (dept === 'Cobranza') {
    const pending = related.filter((p) => p.totals.pending_collection > 0.01);
    const overdue = pending.filter((p) => p.due_date && extractDate(new Date().toISOString()) > p.due_date);
    kpis = {
      collected_amount_mxn: roundMoney(related.reduce((s, p) => s + p.totals.total_charged, 0)),
      overdue_assigned: roundMoney(overdue.reduce((s, p) => s + p.totals.pending_collection, 0)),
      accounts_over_120: overdue.filter((p) => daysBetween(p.due_date, new Date().toISOString()) > 120).length,
      avg_collection_days: null,
    };
    trafficLight = overdue.length > 0 ? 'red' : 'green';
  } else if (dept === 'Facturación') {
    const invoiced = related.filter((p) => {
      const d = p.invoice_issued_at || p.invoice_date;
      return d && isDateInRange(d, period.startDate, period.endDate);
    });
    kpis = {
      invoices_issued: invoiced.length,
      avg_billing_days: null,
      cancelled: related.filter((p) => p.invoice_cancelled).length,
      pending_docs: related.filter((p) => p.invoice_pending_docs).length,
    };
    trafficLight = kpis.pending_docs > 0 ? 'yellow' : 'green';
  } else {
    kpis = { note: 'Sin departamento KPI asignado' };
  }

  return {
    employee: employee.fullName,
    employee_id: employee.employeeId,
    department: dept || 'Sin departamento asignado',
    kpis,
    traffic_light: trafficLight,
    alerts: [],
  };
}

function generateAlerts(projects, reports, settings, sales) {
  const alerts = [];
  const today = extractDate(new Date().toISOString());
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  for (const p of projects) {
    const sale = p.totals.total_invoiced_mxn;
    const margin = sale > 0 ? (sale - p.totals.spent) / sale : null;
    if (margin !== null && margin < MARGIN_MIN) {
      alerts.push({
        type: 'margen_rojo',
        severity: margin < 0.20 ? 'critical' : 'high',
        responsible: p.seller || p.technician_name,
        date: today,
        suggested_action: 'Revisar costos y margen del proyecto',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
        traffic_light: getMarginTrafficLight(margin),
      });
    }

    const finished = normalizeProjectStatus(p.status) === 'terminado' || p.closed_at;
    if (finished) {
      const report = reportsByProject[p.id];
      if (!report || !isReportComplete(report)) {
        alerts.push({
          type: 'servicio_sin_reporte',
          severity: 'high',
          responsible: p.technician_name,
          date: extractDate(p.closed_at || p.updated_at),
          suggested_action: 'Completar reporte técnico',
          link: { module: 'reports', project_id: p.id, quote_number: p.quote_number },
        });
      }
    }

    if (p.invoice_pending_docs) {
      alerts.push({
        type: 'factura_pendiente_documentacion',
        severity: 'medium',
        responsible: 'Facturación',
        date: today,
        suggested_action: 'Completar documentación para facturar',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
      });
    }

    if (p.totals.pending_collection > 0.01) {
      const due = p.due_date;
      if (due && today > due) {
        const days = daysBetween(due, today);
        alerts.push({
          type: days > 120 ? 'cuenta_mayor_120_dias' : 'cuenta_vencida',
          severity: days > 120 ? 'critical' : 'high',
          responsible: 'Cobranza',
          date: due,
          suggested_action: 'Contactar cliente para gestionar cobro',
          link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
          traffic_light: getCollectionTrafficLight(days),
        });
      }
    }

    if (p.closed_at && p.totals.pending_collection > 0.01) {
      alerts.push({
        type: 'proyecto_cerrado_sin_cobro',
        severity: 'high',
        responsible: 'Cobranza',
        date: extractDate(p.closed_at),
        suggested_action: 'Gestionar cobro pendiente',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
      });
    }
  }

  if (settings?.require_manual_quote_capture && sales?.manual_capture_missing_months?.length) {
    // Captura pendiente: ver bloque Ventas (pending_capture), no alerta operativa.
  }

  const sev = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => (sev[a.severity] || 9) - (sev[b.severity] || 9));
}


function computeReceivableBuckets(projects, settings) {
  const today = extractDate(new Date().toISOString());
  const buckets = {
    por_vencer: { label: 'Por vencer', amount: 0, count: 0 },
    vencidos: { label: 'Vencidos', amount: 0, count: 0 },
  };
  for (const p of projects) {
    const pending = p.totals?.pending_collection || 0;
    if (pending <= 0.01) continue;
    const due = resolveProjectDueDate(p);
    if (!due || today <= due) {
      buckets.por_vencer.amount += pending;
      buckets.por_vencer.count += 1;
    } else {
      buckets.vencidos.amount += pending;
      buckets.vencidos.count += 1;
    }
  }
  Object.values(buckets).forEach((b) => { b.amount = roundMoney(b.amount); });
  return Object.values(buckets);
}

function computeSellerSuccessForPeriod(projects, manualQuotes, period, sellers, filters) {
  let ventasSellers = sellers;
  if (filters.department) {
    const dept = normalizeDepartment(filters.department) || filters.department;
    if (dept !== 'Ventas') ventasSellers = [];
    else ventasSellers = sellers;
  }
  if (filters.employeeId && filters.employee?.kpiDepartment === 'Ventas') {
    ventasSellers = ventasSellers.filter((e) => e.employeeId === filters.employee.employeeId);
  }

  const months = getMonthsInPeriod(period).slice(-12);
  const monthlySuccess = [];
  for (const mo of months) {
    const start = formatDate(mo.year, mo.month, 1);
    const end = formatDate(mo.year, mo.month, lastDayOfMonth(mo.year, mo.month));
    const monthCaptures = manualQuotes.filter((c) => c.year === mo.year && c.month === mo.month);
    let quotes = 0;
    let closed = 0;
    let quotedAmount = 0;
    let soldAmount = 0;
    if (ventasSellers.length) {
      for (const seller of ventasSellers) {
        quotes += monthCaptures
          .filter((c) => c.employee_id === seller.employeeId)
          .reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
        quotedAmount += monthCaptures
          .filter((c) => c.employee_id === seller.employeeId)
          .reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0);
        closed += countProjectsClosedForSeller(projects, seller.employeeId, start, end);
      }
      const monthClosed = projects.filter(
        (p) => p.closed_at && isDateInRange(p.closed_at, start, end)
          && ventasSellers.some((s) => projectMatchesSeller(p, s)),
      );
      soldAmount = roundMoney(
        monthClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
      );
    } else {
      quotes = monthCaptures.reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
      quotedAmount = roundMoney(monthCaptures.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0));
      const monthClosed = projects.filter((p) => p.closed_at && isDateInRange(p.closed_at, start, end));
      closed = monthClosed.length;
      soldAmount = roundMoney(
        monthClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
      );
    }
    monthlySuccess.push({
      label: `${pad2(mo.month)}/${mo.year}`,
      quotes_sent: quotes,
      projects_closed: closed,
      quoted_amount_mxn: roundMoney(quotedAmount),
      sold_amount_mxn: soldAmount,
      success_percent: safePercent(safeRatio(closed, quotes)),
    });
  }

  const sellerRates = ventasSellers.map((seller) => {
    const { quotesSent, quotedAmountMxn, hasCapture } = getManualQuotesForEmployee(
      manualQuotes,
      period,
      seller.employeeId,
    );
    const sellerClosed = filterClosedInPeriod(projects, period)
      .filter((p) => projectMatchesSeller(p, seller));
    const won = sellerClosed.length;
    const sold = roundMoney(
      sellerClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
    );
    return {
      employee_id: seller.employeeId,
      full_name: seller.fullName,
      quotes_sent: hasCapture ? quotesSent : 0,
      projects_closed: won,
      quoted_amount_mxn: quotedAmountMxn,
      sold_amount_mxn: sold,
      success_percent: hasCapture && quotesSent > 0 ? safePercent(safeRatio(won, quotesSent)) : null,
    };
  });

  return { monthlySuccess, sellerRates };
}

function computeServicesByMonth(reports, period, employees, filters) {
  const months = getMonthsInPeriod(period).slice(-12);
  const labels = months.map((mo) => `${pad2(mo.month)}/${mo.year}`);
  const techEmployees = employees.filter((e) => e.kpiDepartment === 'Técnico');
  let techIds = new Set(techEmployees.map((e) => e.employeeId));
  if (filters.employeeId && filters.employee?.kpiDepartment === 'Técnico') {
    techIds = new Set([filters.employee.employeeId]);
  } else if (filters.department) {
    const dept = normalizeDepartment(filters.department) || filters.department;
    if (dept === 'Ventas') techIds = new Set();
    else if (dept === 'Técnico') techIds = new Set(techEmployees.map((e) => e.employeeId));
  }

  const counts = {};
  for (const report of reports) {
    const techId = report.executed_by_employee_id;
    if (!techId || !techIds.has(techId)) continue;
    const monthKey = extractDate(report.report_date).slice(0, 7);
    if (!monthKey) continue;
    const key = `${techId}`;
    if (!counts[key]) {
      counts[key] = {
        employee_id: techId,
        full_name: report.executed_by_name || `Tecnico #${techId}`,
        byMonth: {},
      };
    }
    counts[key].byMonth[monthKey] = (counts[key].byMonth[monthKey] || 0) + 1;
  }

  const series = Object.values(counts)
    .map((row) => ({
      employee_id: row.employee_id,
      full_name: row.full_name,
      data: months.map((mo) => {
        const mk = `${mo.year}-${pad2(mo.month)}`;
        return row.byMonth[mk] || 0;
      }),
      total: months.reduce((s, mo) => s + (row.byMonth[`${mo.year}-${pad2(mo.month)}`] || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return { labels, series };
}

function computeEmployeeComparisonChart(sellerRates, servicesByMonth, filters) {
  const dept = filters.department ? (normalizeDepartment(filters.department) || filters.department) : null;
  if (dept === 'Técnico') {
    return {
      mode: 'technician_services',
      items: servicesByMonth.series.map((s) => ({
        label: s.full_name,
        value: s.total,
      })),
    };
  }
  return {
    mode: 'seller_sold_amount',
    items: sellerRates.map((s) => ({
      label: s.full_name,
      value: s.sold_amount_mxn || 0,
      close_rate: s.success_percent,
      projects_closed: s.projects_closed,
      quotes_sent: s.quotes_sent,
    })),
  };
}

function computeKpiCharts(db, {
  projects,
  period,
  manualQuotes,
  exchangeRates,
  reports,
  employees,
  ventasSellers,
  filters,
}) {
  const months = getMonthsInPeriod(period).slice(-12);
  const filteredReports = filterReportsForCharts(reports, projects, period, filters, employees);
  const { monthlySuccess, sellerRates } = computeSellerSuccessForPeriod(
    projects,
    manualQuotes,
    period,
    ventasSellers || [],
    filters,
  );
  const servicesByMonth = computeServicesByMonth(filteredReports, period, employees, filters);

  const trend = [];
  for (const mo of months) {
    const start = formatDate(mo.year, mo.month, 1);
    const end = formatDate(mo.year, mo.month, lastDayOfMonth(mo.year, mo.month));
    const subPeriod = { startDate: start, endDate: end, label: `${pad2(mo.month)}/${mo.year}` };
    const monthQuoteRows = manualQuotes.filter((c) => c.year === mo.year && c.month === mo.month);
    let quotesSent = monthQuoteRows.reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
    let quotedAmount = roundMoney(monthQuoteRows.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0));
    if (filters.employeeId && filters.employee?.kpiDepartment === 'Ventas') {
      quotesSent = monthQuoteRows
        .filter((c) => c.employee_id === filters.employee.employeeId)
        .reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
      quotedAmount = roundMoney(
        monthQuoteRows
          .filter((c) => c.employee_id === filters.employee.employeeId)
          .reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0),
      );
    } else if (ventasSellers?.length) {
      const sellerIds = new Set(ventasSellers.map((s) => s.employeeId));
      const sellerRows = monthQuoteRows.filter((c) => sellerIds.has(c.employee_id));
      quotesSent = sellerRows.reduce((s, c) => s + (c.quotes_sent_count || 0), 0);
      quotedAmount = roundMoney(sellerRows.reduce((s, c) => s + (c.quoted_amount_mxn || 0), 0));
    }
    const monthClosed = projects.filter((p) => p.closed_at && isDateInRange(p.closed_at, start, end));
    const sold = roundMoney(
      monthClosed.reduce((s, p) => s + (p.totals?.total_invoiced_mxn ?? 0), 0),
    );
    let collected = 0;
    for (const p of projects) {
      for (const pay of p.payments || []) {
        if (isDateInRange(pay.payment_date, start, end)) {
          collected += convertAmountToMxn(pay.amount, pay.currency || 'MXN', exchangeRates);
        }
      }
    }
    const successRow = monthlySuccess.find((r) => r.label === subPeriod.label);
    trend.push({
      label: subPeriod.label,
      quoted_amount_mxn: quotedAmount,
      sold_amount_mxn: sold,
      collected_amount_mxn: roundMoney(collected),
      quotes_sent: quotesSent,
      projects_closed: successRow?.projects_closed ?? monthClosed.length,
      quote_success_percent: successRow?.success_percent ?? null,
    });
  }

  const settings = loadKpiSettings(db);
  const receivable_buckets = computeReceivableBuckets(projects, settings);
  const employee_comparison = computeEmployeeComparisonChart(sellerRates, servicesByMonth, filters);

  return {
    monthly_trend: trend,
    receivable_buckets,
    seller_close_rates: sellerRates,
    services_by_month: servicesByMonth,
    employee_comparison,
  };
}


function buildVentasSummaryCards(sales) {
  const metricMap = {
    quotes_sent: { label: 'Cotizaciones enviadas (cant.)', group: 'captacion' },
    quoted_amount_mxn: { label: 'Monto cotizado (MXN)', group: 'captacion' },
    projects_closed: { label: 'Proyectos cerrados (cant.)', group: 'cierre' },
    sold_amount_mxn: { label: 'Monto vendido (MXN)', group: 'cierre' },
    close_rate_count: { label: 'Tasa de cierre por cantidad (%)', group: 'cierre' },
    close_rate_amount: { label: 'Tasa de cierre por monto (%)', group: 'cierre' },
    avg_real_margin: { label: 'Margen real promedio (%)', group: 'rentabilidad' },
    avg_desired_margin: { label: 'Margen deseado promedio (%)', group: 'rentabilidad' },
    margin_gap_points: { label: 'Brecha margen (pts)', group: 'rentabilidad' },
    collected_amount_mxn: { label: 'Monto cobrado (MXN)', group: 'cobro' },
  };
  const groups = {
    captacion: { title: 'Captación', cards: [] },
    cierre: { title: 'Cierre', cards: [] },
    rentabilidad: { title: 'Rentabilidad', cards: [] },
    cobro: { title: 'Cobro', cards: [] },
  };
  Object.entries(metricMap).forEach(([key, meta]) => {
    const metric = sales[key];
    if (!metric?.has_data) return;
    groups[meta.group].cards.push({
      label: meta.label,
      value: metric.display,
      section: 'ventas',
      key,
      group: meta.group,
    });
  });
  return Object.values(groups).filter((g) => g.cards.length > 0);
}


function buildKpiContext(db, query) {
  const periodType = query.periodType || 'current_month';
  const period = getPeriodRange(periodType, query.startDate, query.endDate);
  const exchangeRates = getExchangeRateMap(db);

  let employees = loadActiveKpiEmployees(db);
  if (query.department) {
    const dept = normalizeDepartment(query.department) || query.department;
    employees = employees.filter((e) => e.kpiDepartment === dept);
  }
  if (query.employeeId) {
    employees = employees.filter((e) => e.employeeId === Number(query.employeeId));
  }

  const employee = query.employeeId
    ? loadActiveKpiEmployees(db).find((e) => e.employeeId === Number(query.employeeId))
    : null;

  let projects = loadProjectsWithTotals(db, exchangeRates);
  projects = applyFilters(projects, {
    clientName: query.clientName,
    projectId: query.projectId,
    status: query.status,
    employeeId: query.employeeId,
    employee,
  });

  const reports = loadReportsForKpis(db);
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  const settings = loadKpiSettings(db);
  const manualQuotes = loadManualQuoteCapturesForPeriod(db, period);
  let ventasSellers = getVentasEmpleadosActivos(db);
  if (query.employeeId) {
    const empId = Number(query.employeeId);
    ventasSellers = ventasSellers.filter((s) => s.employeeId === empId);
  }
  const sales = computeSalesKpis(projects, period, manualQuotes, settings, exchangeRates, ventasSellers);
  const projectsKpi = computeProjectsKpis(projects, reportsByProject, settings);
  const reportsKpi = computeReportsKpis(projects, reports);
  const billing = computeBillingKpis(projects, period);
  const collection = computeCollectionKpis(projects, period, exchangeRates);
  const charts = computeKpiCharts(db, {
    projects,
    period,
    manualQuotes,
    exchangeRates,
    reports,
    employees,
    ventasSellers,
    filters: {
      department: query.department || null,
      employeeId: query.employeeId ? Number(query.employeeId) : null,
      employee,
    },
  });
  sales.charts = computeVentasChartData(sales, charts);
  const unassigned = loadActiveKpiEmployees(db).filter((e) => !e.kpiDepartment);

  return {
    period, periodType, employees, unassignedEmployees: unassigned, ventasSellers,
    projects, reports, sales, projectsKpi, reportsKpi, billing, collection, settings, manualQuotes, charts,
    filters: {
      department: query.department || null,
      employeeId: query.employeeId ? Number(query.employeeId) : null,
      clientName: query.clientName || null,
      projectId: query.projectId ? Number(query.projectId) : null,
      status: query.status || null,
    },
  };
}

function computeSummary(db, query) {
  const ctx = buildKpiContext(db, query);
  const departments = KPI_DEPARTMENTS.map((d) =>
    computeDepartmentKpis(d, ctx.sales, ctx.projectsKpi, ctx.reportsKpi, ctx.billing, ctx.collection),
  );
  const alerts = generateAlerts(ctx.projects, ctx.reports, ctx.settings, ctx.sales);
  const ventasSummaryGroups = buildVentasSummaryCards(ctx.sales);
  const ventasSummaryCards = ventasSummaryGroups.flatMap((g) => g.cards);

  return {
    period: ctx.period,
    period_type: ctx.periodType,
    filters: ctx.filters,
    timezone: TIMEZONE,
    summary_cards: [
      ...ventasSummaryCards,
      { label: 'Margen real', value: ctx.projectsKpi.gross_margin_real.display, section: 'proyectos' },
      { label: 'CxC vencida', value: ctx.collection.overdue_portfolio.display, section: 'cobranza' },
      { label: 'Reportes completos', value: ctx.reportsKpi.complete_reports.display, section: 'reportes' },
      { label: 'Facturas emitidas', value: ctx.billing.invoices_issued.display, section: 'facturacion' },
      { label: 'Alertas activas', value: String(alerts.length), section: 'alertas' },
    ],
    ventas_summary_cards: ventasSummaryCards,
    ventas_summary_groups: ventasSummaryGroups,
    ventas: ctx.sales,
    proyectos: ctx.projectsKpi,
    reportes: ctx.reportsKpi,
    facturacion: ctx.billing,
    cobranza: ctx.collection,
    departments,
    unassigned_employees: ctx.unassignedEmployees.map((e) => ({
      employeeId: e.employeeId, fullName: e.fullName, department: e.department,
    })),
    charts: ctx.charts,
    settings_display: settingsToApi(ctx.settings),
    has_weighted_score: false,
    has_public_ranking: false,
  };
}

function computeDepartments(db, query) {
  const ctx = buildKpiContext(db, query);
  return {
    period: ctx.period,
    departments: KPI_DEPARTMENTS.map((d) =>
      computeDepartmentKpis(d, ctx.sales, ctx.projectsKpi, ctx.reportsKpi, ctx.billing, ctx.collection),
    ),
    unassigned_employees: ctx.unassignedEmployees,
  };
}

function computeEmployees(db, query) {
  const ctx = buildKpiContext(db, query);
  const allEmployees = loadActiveKpiEmployees(db).filter((e) => e.kpiDepartment !== 'Ventas');
  const filtered = query.department
    ? allEmployees.filter((e) => e.kpiDepartment === (normalizeDepartment(query.department) || query.department))
    : allEmployees;

  return {
    period: ctx.period,
    employees: filtered
      .map((e) => computeEmployeeKpis(e, ctx.projects, ctx.reports, ctx.period, ctx.manualQuotes))
      .filter(Boolean),
    has_weighted_score: false,
    has_public_ranking: false,
  };
}

function computeAlerts(db, query) {
  const ctx = buildKpiContext(db, query);
  const alerts = generateAlerts(ctx.projects, ctx.reports, ctx.settings, ctx.sales);
  return { period: ctx.period, alerts };
}

function computeDetail(db, query) {
  const ctx = buildKpiContext(db, query);
  const section = query.section || 'all';
  const result = { period: ctx.period, filters: ctx.filters, section };

  if (section === 'ventas' || section === 'all') result.ventas = ctx.sales;
  if (section === 'proyectos' || section === 'all') result.proyectos = ctx.projectsKpi;
  if (section === 'reportes' || section === 'all') result.reportes = ctx.reportsKpi;
  if (section === 'facturacion' || section === 'all') result.facturacion = ctx.billing;
  if (section === 'cobranza' || section === 'all') result.cobranza = ctx.collection;
  if (section === 'projects' || section === 'all') {
    result.projects = ctx.projects.map((p) => ({
      id: p.id,
      quote_number: p.quote_number,
      client_name: p.client_name,
      seller: p.seller,
      technician_name: p.technician_name,
      status: normalizeProjectStatus(p.status),
      collection_status: normalizeCollectionStatus(p, p.totals),
      quote_status: normalizeQuoteStatus(p),
      total_invoiced_mxn: p.totals.total_invoiced_mxn,
      spent_mxn: p.totals.spent,
      margin_percent: safePercent(p.totals.final_margin),
      margin_traffic_light: getMarginTrafficLight(p.totals.final_margin),
      pending_collection_mxn: p.totals.pending_collection,
    }));
  }
  return result;
}

module.exports = {
  KPI_DEPARTMENTS,
  LEAD_CHANNELS,
  REWORK_CAUSES,
  MARGIN_MIN,
  MARGIN_TARGET,
  UNAVAILABLE,
  NOT_CAPTURED,
  formatCurrencyMXN,
  formatPercentDisplay,
  loadKpiSettings,
  settingsToApi,
  aggregateManualQuotesForPeriod,
  getFormulaDefinitions,
  normalizeKpiArea,
  getPeriodRange,
  normalizeProjectStatus,
  normalizeCollectionStatus,
  normalizeReportStatus,
  normalizeQuoteStatus,
  normalizeDepartment,
  mapKpiEmployee,
  loadActiveKpiEmployees,
  isReportComplete,
  getMarginTrafficLight,
  getCollectionTrafficLight,
  getReportTrafficLight,
  getFollowUpTrafficLight,
  computeSummary,
  computeDepartments,
  computeEmployees,
  computeAlerts,
  computeDetail,
  generateAlerts,
  computeKpiCharts,
  computeReceivableBuckets,
  resolveProjectDueDate,
  getVentasEmpleadosActivos,
  VENTAS_SEMAPHORE_MARGIN_GAP_YELLOW,
  buildVentasSummaryCards,
  computeVentasBySeller,
  getVentasSellerTrafficLight,
  computeVentasChartData,
};
