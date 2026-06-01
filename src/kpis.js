'use strict';

const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { TIMEZONE } = require('./dateHelper');

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

const UNAVAILABLE = 'Dato no disponible';

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
  if (report?.deleted_at) return 'archivado';
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

function mapKpiEmployee(row) {
  const primary = row.primary_department || row.department || null;
  const kpiDept = normalizeDepartment(primary);
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
    kpiEligible: row.kpi_eligible !== 0,
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

function kpiValue(value, unavailable = false) {
  if (unavailable) return { value: null, display: UNAVAILABLE, available: false };
  if (value === null || value === undefined) return { value: null, display: '—', available: true };
  return { value, display: String(value), available: true };
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
  const hasTechnician = !!(report.technician_name || report.assigned_technicians);
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
    const name = normalizeText(emp.fullName);
    result = result.filter((p) => {
      const dept = emp.kpiDepartment;
      if (dept === 'Ventas') return normalizeText(p.seller).includes(name);
      if (dept === 'Técnico') return normalizeText(p.technician_name).includes(name);
      return normalizeText(p.seller).includes(name) || normalizeText(p.technician_name).includes(name);
    });
  }
  return result;
}

function computeSalesKpis(projects, period, hasLeadModule) {
  const inPeriod = projects.filter((p) => isDateInRange(p.created_at, period.startDate, period.endDate));
  const quotesSent = inPeriod.length;
  const quotedAmount = roundMoney(inPeriod.reduce((s, p) => s + p.totals.total_invoiced_mxn, 0));

  const won = projects.filter(
    (p) => p.closed_at && isDateInRange(p.closed_at, period.startDate, period.endDate),
  );
  const soldAmount = roundMoney(won.reduce((s, p) => s + p.totals.total_invoiced_mxn, 0));
  const wonCount = won.length;

  const closeRate = safeRatio(wonCount, quotesSent);
  const profitableWon = won.filter((p) => {
    const margin = p.expected_margin != null ? p.expected_margin / 100 : p.totals.final_margin;
    return margin !== null && margin >= MARGIN_MIN;
  }).length;
  const profitableCloseRate = safeRatio(profitableWon, quotesSent);

  const hasNextActionField = projects.some((p) => 'next_commercial_action' in p);
  let quotesWithoutFollowUp = kpiValue(null, !hasNextActionField);
  if (hasNextActionField) {
    const noFollowUp = inPeriod.filter(
      (p) => !p.next_commercial_action && !p.next_commercial_action_date && !p.closed_at,
    ).length;
    quotesWithoutFollowUp = kpiValue(noFollowUp);
  }

  const margins = inPeriod
    .map((p) => (p.expected_margin != null ? p.expected_margin / 100 : p.totals.final_margin))
    .filter((m) => m !== null && Number.isFinite(m));
  const avgMargin = margins.length
    ? roundMoney(margins.reduce((a, b) => a + b, 0) / margins.length)
    : null;

  let leadsByChannel = kpiValue(null, !hasLeadModule);
  const withChannel = inPeriod.filter((p) => p.lead_channel).length;
  if (withChannel > 0) {
    const byChannel = {};
    for (const ch of LEAD_CHANNELS) byChannel[ch] = 0;
    inPeriod.forEach((p) => {
      if (p.lead_channel) byChannel[p.lead_channel] = (byChannel[p.lead_channel] || 0) + 1;
    });
    leadsByChannel = kpiValue(byChannel);
  }

  return {
    leads_by_channel: leadsByChannel,
    quotes_sent: kpiValue(quotesSent),
    quoted_amount_mxn: kpiValue(quotedAmount),
    sold_amount_mxn: kpiValue(soldAmount),
    close_rate: kpiValue(closeRate !== null ? safePercent(closeRate) : null),
    profitable_close_rate: kpiValue(profitableCloseRate !== null ? safePercent(profitableCloseRate) : null),
    quotes_without_follow_up: quotesWithoutFollowUp,
    avg_estimated_margin: kpiValue(avgMargin !== null ? safePercent(avgMargin) : null),
    margin_min_percent: MARGIN_MIN * 100,
    margin_target_percent: MARGIN_TARGET * 100,
    lead_channels_catalog: LEAD_CHANNELS,
  };
}

function computeProjectsKpis(projects, reportsByProject) {
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
    (p) => p.grossMargin !== null && p.grossMargin < MARGIN_MIN,
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
  const hasInvoiceIssuedAt = projects.some((p) => p.invoice_issued_at);
  const hasInvoiceDate = projects.some((p) => p.invoice_date && !p.invoice_date_na);

  const invoiced = projects.filter((p) => {
    const date = p.invoice_issued_at || (p.invoice_date_na ? null : p.invoice_date);
    return date && isDateInRange(date, period.startDate, period.endDate);
  });

  const invoicedAmount = roundMoney(invoiced.reduce((s, p) => s + p.totals.total_invoiced_mxn, 0));

  let billingTimeDays = kpiValue(null, !hasInvoiceIssuedAt && !hasInvoiceDate);
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
  }

  const cancelled = projects.filter((p) => p.invoice_cancelled);
  const withError = projects.filter((p) => p.invoice_error);
  const pendingDocs = projects.filter((p) => p.invoice_pending_docs);

  return {
    invoices_issued: kpiValue(invoiced.length),
    invoiced_amount_mxn: kpiValue(invoicedAmount),
    billing_time_days: billingTimeDays,
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
    collected_amount_mxn: kpiValue(roundMoney(collectedAmount)),
    collected_invoices: kpiValue(collectedInvoices),
    avg_collection_days: kpiValue(
      collectionDays.length
        ? roundMoney(collectionDays.reduce((a, b) => a + b, 0) / collectionDays.length)
        : null,
    ),
    overdue_portfolio: kpiValue(safeRatio(overdueAmount, totalReceivable) !== null ? safePercent(safeRatio(overdueAmount, totalReceivable)) : null),
    overdue_amount_mxn: kpiValue(roundMoney(overdueAmount)),
    accounts_over_120_days: kpiValue(over120Count),
    accounts_over_120_amount_mxn: kpiValue(roundMoney(over120Amount)),
    invoices_without_contact: kpiValue(withoutContact),
  };
}

function computeDepartmentKpis(department, sales, projectsKpi, reports, billing, collection) {
  const map = {
    Ventas: {
      quotes_sent: sales.quotes_sent,
      quoted_amount_mxn: sales.quoted_amount_mxn,
      sold_amount_mxn: sales.sold_amount_mxn,
      close_rate: sales.close_rate,
      avg_estimated_margin: sales.avg_estimated_margin,
      quotes_without_follow_up: sales.quotes_without_follow_up,
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

function computeEmployeeKpis(employee, projects, reports, period) {
  const name = normalizeText(employee.fullName);
  const dept = employee.kpiDepartment;
  const related = projects.filter((p) => {
    if (dept === 'Ventas') return normalizeText(p.seller).includes(name);
    if (dept === 'Técnico') return normalizeText(p.technician_name).includes(name);
    return normalizeText(p.seller).includes(name) || normalizeText(p.technician_name).includes(name);
  });

  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  let kpis = {};
  let trafficLight = 'gray';

  if (dept === 'Ventas') {
    const quotes = related.filter((p) => isDateInRange(p.created_at, period.startDate, period.endDate));
    const won = related.filter((p) => p.closed_at && isDateInRange(p.closed_at, period.startDate, period.endDate));
    const noFollowUp = quotes.filter((p) => !p.next_commercial_action && !p.next_commercial_action_date).length;
    kpis = {
      quotes_sent: quotes.length,
      sold_amount_mxn: roundMoney(won.reduce((s, p) => s + p.totals.total_invoiced_mxn, 0)),
      close_rate: safePercent(safeRatio(won.length, quotes.length)),
      avg_margin: safePercent(
        quotes.length ? quotes.reduce((s, p) => s + (p.expected_margin || 0), 0) / quotes.length / 100 : null,
      ),
      quotes_without_follow_up: noFollowUp,
    };
    trafficLight = noFollowUp > 0 ? 'red' : 'green';
  } else if (dept === 'Técnico') {
    const assigned = related.filter((p) => normalizeText(p.technician_name).includes(name));
    const finished = assigned.filter((p) => normalizeProjectStatus(p.status) === 'terminado' || p.closed_at);
    let complete = 0;
    let noReport = 0;
    for (const p of finished) {
      const r = reportsByProject[p.id];
      if (!r || !isReportComplete(r)) noReport += 1;
      else complete += 1;
    }
    kpis = {
      assigned_services: assigned.length,
      complete_reports: finished.length ? safePercent(safeRatio(complete, finished.length)) : null,
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

function generateAlerts(projects, reports) {
  const alerts = [];
  const today = extractDate(new Date().toISOString());
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  for (const p of projects) {
    if (!p.next_commercial_action && !p.next_commercial_action_date && !p.closed_at) {
      alerts.push({
        type: 'cotizacion_sin_seguimiento',
        severity: 'medium',
        responsible: p.seller || 'Ventas',
        date: extractDate(p.created_at),
        suggested_action: 'Registrar próxima acción comercial',
        link: { module: 'projects', project_id: p.id, quote_number: p.quote_number },
      });
    }

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

  const sev = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => (sev[a.severity] || 9) - (sev[b.severity] || 9));
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

  const reports = db.prepare('SELECT * FROM project_reports WHERE deleted_at IS NULL').all();
  const reportsByProject = {};
  reports.forEach((r) => { reportsByProject[r.project_id] = r; });

  const hasLeadModule = false;
  const sales = computeSalesKpis(projects, period, hasLeadModule);
  const projectsKpi = computeProjectsKpis(projects, reportsByProject);
  const reportsKpi = computeReportsKpis(projects, reports);
  const billing = computeBillingKpis(projects, period);
  const collection = computeCollectionKpis(projects, period, exchangeRates);
  const unassigned = loadActiveKpiEmployees(db).filter((e) => !e.kpiDepartment);

  return {
    period, periodType, employees, unassignedEmployees: unassigned,
    projects, reports, sales, projectsKpi, reportsKpi, billing, collection,
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
  const alerts = generateAlerts(ctx.projects, ctx.reports);

  return {
    period: ctx.period,
    period_type: ctx.periodType,
    filters: ctx.filters,
    timezone: TIMEZONE,
    summary_cards: [
      { label: 'Cotizaciones enviadas', value: ctx.sales.quotes_sent.display, section: 'ventas' },
      { label: 'Monto vendido (MXN)', value: ctx.sales.sold_amount_mxn.display, section: 'ventas' },
      { label: 'Proyectos activos', value: ctx.projectsKpi.active_projects.display, section: 'proyectos' },
      { label: 'Reportes completos', value: ctx.reportsKpi.complete_reports.display, section: 'reportes' },
      { label: 'Facturas emitidas', value: ctx.billing.invoices_issued.display, section: 'facturacion' },
      { label: 'Monto cobrado (MXN)', value: ctx.collection.collected_amount_mxn.display, section: 'cobranza' },
      { label: 'Cartera vencida', value: ctx.collection.overdue_portfolio.display, section: 'cobranza' },
      { label: 'Alertas activas', value: String(alerts.length), section: 'alertas' },
    ],
    ventas: ctx.sales,
    proyectos: ctx.projectsKpi,
    reportes: ctx.reportsKpi,
    facturacion: ctx.billing,
    cobranza: ctx.collection,
    departments,
    unassigned_employees: ctx.unassignedEmployees.map((e) => ({
      employeeId: e.employeeId, fullName: e.fullName, department: e.department,
    })),
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
  const allEmployees = loadActiveKpiEmployees(db);
  const filtered = query.department
    ? allEmployees.filter((e) => e.kpiDepartment === (normalizeDepartment(query.department) || query.department))
    : allEmployees;

  return {
    period: ctx.period,
    employees: filtered.map((e) => computeEmployeeKpis(e, ctx.projects, ctx.reports, ctx.period)),
    has_weighted_score: false,
    has_public_ranking: false,
  };
}

function computeAlerts(db, query) {
  const ctx = buildKpiContext(db, query);
  return { period: ctx.period, alerts: generateAlerts(ctx.projects, ctx.reports) };
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
};
