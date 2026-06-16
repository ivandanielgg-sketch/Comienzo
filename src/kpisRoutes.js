'use strict';

const bcrypt = require('bcryptjs');
const { logAuditEvent, createdByFields, updatedByFields } = require('./audit');
const { isDbTruthy } = require('./db/dialect');
const { TIMEZONE } = require('./dateHelper');
const { buildKpiExcelWorkbook } = require('./kpisExport');
const {
  computeSummary,
  computeDepartments,
  computeEmployees,
  computeAlerts,
  computeDetail,
  getPeriodRange,
  loadKpiSettings,
  settingsToApi,
  getFormulaDefinitions,
  normalizeKpiArea,
  getVentasEmpleadosActivos,
} = require('./kpis');

const KPI_REAUTH_MS = 15 * 60 * 1000;
const KPI_AREAS_PHASE1 = ['Ventas', 'Técnico', 'Sin asignar'];

const KPI_EMPLOYEE_SELECT = `
  SELECT e.id, e.full_name, e.position, e.active, e.department, e.kpi_area, e.kpi_eligible, e.user_id,
         e.kpi_configured_at, e.kpi_configured_by_name,
         EXISTS (SELECT 1 FROM vacation_requests vr WHERE vr.employee_id = e.id) AS has_vacation_requests
  FROM employees e
`;

const KPI_VENDEDOR_WHERE = `
  e.active = 1 AND (
    EXISTS (SELECT 1 FROM vacation_requests vr WHERE vr.employee_id = e.id)
    OR LOWER(COALESCE(e.position, '')) LIKE '%vended%'
    OR LOWER(COALESCE(e.position, '')) LIKE '%ventas%'
    OR e.kpi_area = 'Ventas'
    OR e.primary_department = 'Ventas'
  )
`;

const KPI_TECNICO_WHERE = `
  e.active = 1 AND (
    LOWER(COALESCE(e.position, '')) LIKE '%técnico%'
    OR LOWER(COALESCE(e.position, '')) LIKE '%tecnico%'
    OR e.kpi_area = 'Técnico'
    OR e.primary_department = 'Técnico'
  )
`;

function mapKpiEmployeeConfigRow(r) {
  return {
    employee_id: r.id,
    full_name: r.full_name,
    position: r.position,
    active: isDbTruthy(r.active),
    kpi_area: r.kpi_area || 'Sin asignar',
    kpi_eligible: isDbTruthy(r.kpi_eligible),
    user_id: r.user_id,
    has_vacation_requests: isDbTruthy(r.has_vacation_requests),
    kpi_configured_at: r.kpi_configured_at,
    kpi_configured_by_name: r.kpi_configured_by_name,
  };
}

function requireAdminOnly(db, moduleName, deniedMessage) {
  return (req, res, next) => {
    if (req.session.role !== 'admin') {
      logAuditEvent(db, {
        req,
        action: 'access_denied',
        module: moduleName,
        metadata: { reason: 'admin_only', endpoint: req.originalUrl },
      });
      return res.status(403).json({ message: deniedMessage });
    }
    return next();
  };
}

function isKpiReauthValid(req) {
  const at = req.session.kpiReauthAt || 0;
  return Date.now() - at < KPI_REAUTH_MS;
}

function requireKpiReauth(db) {
  return (req, res, next) => {
    if (!isKpiReauthValid(req)) {
      return res.status(403).json({ message: 'Reautenticacion admin requerida para configuracion KPI.' });
    }
    return next();
  };
}

function parseKpiQuery(query) {
  return {
    periodType: query.periodType || 'current_month',
    startDate: query.startDate || null,
    endDate: query.endDate || null,
    department: query.department || null,
    employeeId: query.employeeId || null,
    clientName: query.clientName || null,
    projectId: query.projectId || null,
    status: query.status || null,
    section: query.section || 'all',
  };
}

function mapManualQuoteRow(row) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    department: row.department,
    employee_id: row.employee_id,
    employee_name_snapshot: row.employee_name_snapshot,
    quotes_sent_count: row.quotes_sent_count,
    quoted_amount_original: row.quoted_amount_original,
    currency: row.currency,
    exchange_rate_to_mxn: row.exchange_rate_to_mxn,
    quoted_amount_mxn: row.quoted_amount_mxn,
    notes: row.notes,
    created_by_name: row.created_by_name,
    updated_by_name: row.updated_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateManualQuoteBody(body, isUpdate = false) {
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw Object.assign(new Error('Ano invalido.'), { statusCode: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw Object.assign(new Error('Mes invalido.'), { statusCode: 400 });
  }
  const quotesSent = Number(body.quotes_sent_count ?? body.quotesSentCount);
  const quotedOriginal = Number(body.quoted_amount_original ?? body.quotedAmountOriginal);
  if (!Number.isFinite(quotesSent) || quotesSent < 0) {
    throw Object.assign(new Error('Numero de cotizaciones debe ser >= 0.'), { statusCode: 400 });
  }
  if (!Number.isFinite(quotedOriginal) || quotedOriginal < 0) {
    throw Object.assign(new Error('Monto cotizado debe ser >= 0.'), { statusCode: 400 });
  }
  const currency = (body.currency || 'MXN').toUpperCase();
  let exchangeRate = Number(body.exchange_rate_to_mxn ?? body.exchangeRateToMXN ?? 1);
  if (currency === 'MXN') exchangeRate = 1;
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw Object.assign(new Error('Tipo de cambio invalido.'), { statusCode: 400 });
  }
  const quotedMxn = Number(body.quoted_amount_mxn ?? body.quotedAmountMXN);
  const computedMxn = currency === 'MXN' ? quotedOriginal : round2(quotedOriginal * exchangeRate);
  const finalMxn = Number.isFinite(quotedMxn) && quotedMxn >= 0 ? round2(quotedMxn) : computedMxn;
  const employeeIdRaw = body.employee_id != null ? body.employee_id : body.employeeId;
  const employeeId = employeeIdRaw != null && employeeIdRaw !== '' ? Number(employeeIdRaw) : null;
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw Object.assign(new Error('Vendedora es obligatoria.'), { statusCode: 400 });
  }

  return {
    year,
    month,
    department: 'Ventas',
    employee_id: employeeId,
    employee_name_snapshot: body.employee_name_snapshot || body.employeeNameSnapshot || null,
    quotes_sent_count: Math.floor(quotesSent),
    quoted_amount_original: round2(quotedOriginal),
    currency,
    exchange_rate_to_mxn: exchangeRate,
    quoted_amount_mxn: finalMxn,
    notes: body.notes || null,
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function validateSalesEmployee(db, employeeId) {
  const match = getVentasEmpleadosActivos(db).find((e) => e.employeeId === Number(employeeId));
  if (!match) {
    throw Object.assign(new Error('Vendedora no encontrada, inactiva o no habilitada para KPI Ventas.'), { statusCode: 400 });
  }
  return {
    id: match.employeeId,
    full_name: match.fullName,
    kpi_area: 'Ventas',
    primary_department: match.primaryDepartment,
    kpi_eligible: 1,
    active: 1,
  };
}


function registerKpiRoutes(app, db, { requireAuth }) {
  const kpiDeniedMessage = 'Acceso restringido. Solo el administrador puede consultar el Tablero KPIs.';
  const requireKpiAdmin = requireAdminOnly(db, 'kpis', kpiDeniedMessage);

  function auditKpiAccess(req, filters, action = 'view') {
    logAuditEvent(db, {
      req,
      action,
      module: 'kpis',
      entityType: 'kpi_dashboard',
      entityLabel: 'Tablero KPIs',
      metadata: { filters },
    });
  }

  function kpiHandler(computeFn, auditAction = 'view') {
    return (req, res, next) => {
      try {
        const params = parseKpiQuery(req.query);
        getPeriodRange(params.periodType, params.startDate, params.endDate);
        auditKpiAccess(req, params, auditAction);
        res.json(computeFn(db, params));
      } catch (error) {
        error.statusCode = error.statusCode || 400;
        next(error);
      }
    };
  }

  app.get('/api/kpis/summary', requireAuth, requireKpiAdmin, kpiHandler(computeSummary));
  app.get('/api/kpis/departments', requireAuth, requireKpiAdmin, kpiHandler(computeDepartments));
  app.get('/api/kpis/employees', requireAuth, requireKpiAdmin, kpiHandler(computeEmployees));
  app.get('/api/kpis/alerts', requireAuth, requireKpiAdmin, kpiHandler(computeAlerts));
  app.get('/api/kpis/detail', requireAuth, requireKpiAdmin, kpiHandler(computeDetail));

  app.get('/api/kpis/formulas', requireAuth, requireKpiAdmin, (req, res) => {
    const settings = loadKpiSettings(db);
    auditKpiAccess(req, {}, 'view_formulas');
    res.json({ formulas: getFormulaDefinitions(settings), timezone: TIMEZONE });
  });

  app.get('/api/kpis/settings', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res) => {
    const settings = loadKpiSettings(db);
    res.json(settingsToApi(settings));
  });

  app.put('/api/kpis/settings', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res, next) => {
    try {
      const body = req.body || {};
      const green = Number(body.margin_green_percent ?? body.marginGreenPercent);
      const yellow = Number(body.margin_yellow_percent ?? body.marginYellowPercent);
      const red = Number(body.margin_red_percent ?? body.marginRedPercent);
      if (![green, yellow, red].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) {
        throw Object.assign(new Error('Umbrales de margen invalidos.'), { statusCode: 400 });
      }
      if (green <= yellow || yellow <= red) {
        throw Object.assign(new Error('Umbrales deben cumplir: verde > amarillo > rojo.'), { statusCode: 400 });
      }
      const before = loadKpiSettings(db);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE kpi_settings SET
          margin_green_threshold = ?,
          margin_yellow_threshold = ?,
          margin_red_threshold = ?,
          receivable_bucket1_days = ?,
          receivable_bucket2_days = ?,
          receivable_bucket3_days = ?,
          receivable_critical_days = ?,
          report_missing_critical_days = ?,
          require_manual_quote_capture = ?,
          updated_at = ?,
          updated_by_user_id = ?,
          updated_by_name = ?
        WHERE id = 1
      `).run(
        green / 100,
        yellow / 100,
        red / 100,
        Number(body.receivable_bucket1_days) || before.receivable_bucket1_days,
        Number(body.receivable_bucket2_days) || before.receivable_bucket2_days,
        Number(body.receivable_bucket3_days) || before.receivable_bucket3_days,
        Number(body.receivable_critical_days) || before.receivable_critical_days,
        Number(body.report_missing_critical_days) || before.report_missing_critical_days,
        body.require_manual_quote_capture === false ? 0 : 1,
        now,
        req.session.userId,
        req.session.userName,
      );
      const after = loadKpiSettings(db);
      logAuditEvent(db, {
        req,
        action: 'update',
        module: 'kpis',
        entityType: 'kpi_settings',
        entityId: 1,
        entityLabel: 'Parametros KPI',
        before: settingsToApi(before),
        after: settingsToApi(after),
      });
      res.json(settingsToApi(after));
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.post('/api/kpis/admin-reauth', requireAuth, requireKpiAdmin, (req, res) => {
    const password = req.body?.password;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Contrasena requerida.' });
    }
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_active = 1").get(req.session.userId);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      logAuditEvent(db, { req, action: 'kpi_reauth_failed', module: 'kpis' });
      return res.status(403).json({
        success: false,
        message: 'Contrasena incorrecta o acceso no autorizado.',
      });
    }
    req.session.kpiReauthAt = Date.now();
    logAuditEvent(db, { req, action: 'kpi_reauth_success', module: 'kpis' });
    const expiresAt = new Date(Date.now() + KPI_REAUTH_MS).toISOString();
    return res.json({ success: true, expires_in_ms: KPI_REAUTH_MS, expiresAt });
  });

  app.get('/api/kpis/reauth-status', requireAuth, requireKpiAdmin, (req, res) => {
    res.json({ authenticated: isKpiReauthValid(req), expires_in_ms: KPI_REAUTH_MS });
  });

  app.get('/api/kpis/manual-quotes', requireAuth, requireKpiAdmin, (req, res) => {
    const year = req.query.year ? Number(req.query.year) : null;
    const month = req.query.month ? Number(req.query.month) : null;
    let rows;
    if (year && month) {
      rows = db.prepare(
        'SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL AND year = ? AND month = ? ORDER BY employee_id',
      ).all(year, month);
    } else {
      rows = db.prepare(
        'SELECT * FROM kpi_manual_quote_captures WHERE deleted_at IS NULL ORDER BY year DESC, month DESC, id DESC LIMIT 500',
      ).all();
    }
    auditKpiAccess(req, { year, month }, 'view_manual_quotes');
    res.json({ captures: rows.map(mapManualQuoteRow) });
  });

  app.post('/api/kpis/manual-quotes', requireAuth, requireKpiAdmin, (req, res, next) => {
    try {
      const data = validateManualQuoteBody(req.body);
      const emp = validateSalesEmployee(db, data.employee_id);
      data.employee_name_snapshot = emp.full_name;
      const dup = db.prepare(
        'SELECT id FROM kpi_manual_quote_captures WHERE deleted_at IS NULL AND year = ? AND month = ? AND COALESCE(employee_id, -1) = COALESCE(?, -1)',
      ).get(data.year, data.month, data.employee_id);
      if (dup) {
        logAuditEvent(db, {
          req,
          action: 'duplicate_blocked',
          module: 'kpis',
          entityType: 'kpi_manual_quote_capture',
          metadata: { year: data.year, month: data.month, employee_id: data.employee_id },
        });
        throw Object.assign(new Error('Ya existe captura para este ano, mes y vendedora.'), { statusCode: 409 });
      }
      const audit = createdByFields(req);
      const now = audit.created_at;
      const result = db.prepare(`
        INSERT INTO kpi_manual_quote_captures (
          year, month, department, employee_id, employee_name_snapshot,
          quotes_sent_count, quoted_amount_original, currency, exchange_rate_to_mxn, quoted_amount_mxn,
          notes, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.year, data.month, data.department, data.employee_id, data.employee_name_snapshot,
        data.quotes_sent_count, data.quoted_amount_original, data.currency, data.exchange_rate_to_mxn, data.quoted_amount_mxn,
        data.notes, audit.created_by_user_id, audit.created_by_name, now,
        audit.created_by_user_id, audit.created_by_name, now,
      );
      const row = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, {
        req,
        action: 'create',
        module: 'kpis',
        entityType: 'kpi_manual_quote_capture',
        entityId: row.id,
        entityLabel: `Captura ${data.month}/${data.year}`,
        after: mapManualQuoteRow(row),
      });
      res.status(201).json(mapManualQuoteRow(row));
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.put('/api/kpis/manual-quotes/:id', requireAuth, requireKpiAdmin, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!before) throw Object.assign(new Error('Captura no encontrada.'), { statusCode: 404 });
      const data = validateManualQuoteBody({ ...before, ...req.body }, true);
      const emp = validateSalesEmployee(db, data.employee_id);
      data.employee_name_snapshot = emp.full_name;
      const audit = updatedByFields(req);
      db.prepare(`
        UPDATE kpi_manual_quote_captures SET
          year = ?, month = ?, department = ?, employee_id = ?, employee_name_snapshot = ?,
          quotes_sent_count = ?, quoted_amount_original = ?, currency = ?,
          exchange_rate_to_mxn = ?, quoted_amount_mxn = ?, notes = ?,
          updated_by_user_id = ?, updated_by_name = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.year, data.month, data.department, data.employee_id, data.employee_name_snapshot,
        data.quotes_sent_count, data.quoted_amount_original, data.currency,
        data.exchange_rate_to_mxn, data.quoted_amount_mxn, data.notes,
        audit.updated_by_user_id, audit.updated_by_name, audit.updated_at,
        id,
      );
      const after = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE id = ?').get(id);
      logAuditEvent(db, {
        req,
        action: 'update',
        module: 'kpis',
        entityType: 'kpi_manual_quote_capture',
        entityId: id,
        entityLabel: `Captura ${data.month}/${data.year}`,
        before: mapManualQuoteRow(before),
        after: mapManualQuoteRow(after),
      });
      res.json(mapManualQuoteRow(after));
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.get('/api/kpis/employee-config', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res) => {
    const vendedores = db.prepare(`${KPI_EMPLOYEE_SELECT} WHERE ${KPI_VENDEDOR_WHERE} ORDER BY e.full_name`).all();
    const tecnicos = db.prepare(`${KPI_EMPLOYEE_SELECT} WHERE ${KPI_TECNICO_WHERE} ORDER BY e.full_name`).all();
    logAuditEvent(db, { req, action: 'view', module: 'kpis', entityType: 'kpi_employee_config', entityLabel: 'Config empleados KPI' });
    res.json({
      vendedores: vendedores.map(mapKpiEmployeeConfigRow),
      tecnicos: tecnicos.map(mapKpiEmployeeConfigRow),
      employees: [...vendedores, ...tecnicos].map(mapKpiEmployeeConfigRow),
      allowed_areas: KPI_AREAS_PHASE1,
    });
  });

  app.put('/api/kpis/employee-config/:id', requireAuth, requireKpiAdmin, requireKpiReauth(db), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      if (!before || !before.active) throw Object.assign(new Error('Empleado no encontrado o inactivo.'), { statusCode: 400 });
      const kpiArea = req.body.kpi_area || req.body.kpiArea || 'Sin asignar';
      if (!KPI_AREAS_PHASE1.includes(kpiArea)) {
        throw Object.assign(new Error('Area KPI invalida. Use Ventas, Tecnico o Sin asignar.'), { statusCode: 400 });
      }
      const kpiEligible = req.body.kpi_eligible === false || req.body.kpi_eligible === 0 ? 0 : 1;
      const primaryDept = kpiArea === 'Sin asignar' ? null : kpiArea;
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE employees SET
          kpi_area = ?,
          primary_department = ?,
          kpi_eligible = ?,
          kpi_configured_at = ?,
          kpi_configured_by_user_id = ?,
          kpi_configured_by_name = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        kpiArea === 'Sin asignar' ? null : kpiArea,
        primaryDept,
        kpiEligible,
        now,
        req.session.userId,
        req.session.userName,
        now,
        id,
      );
      const after = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      logAuditEvent(db, {
        req,
        action: 'update',
        module: 'kpis',
        entityType: 'employee_kpi_config',
        entityId: id,
        entityLabel: after.full_name,
        before: { kpi_area: before.kpi_area, kpi_eligible: before.kpi_eligible },
        after: { kpi_area: after.kpi_area, kpi_eligible: after.kpi_eligible },
      });
      res.json({
        employee_id: after.id,
        full_name: after.full_name,
        kpi_area: after.kpi_area || 'Sin asignar',
        kpi_eligible: isDbTruthy(after.kpi_eligible),
      });
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.get('/api/kpis/export/excel', requireAuth, requireKpiAdmin, (req, res, next) => {
    try {
      const params = parseKpiQuery(req.query);
      const period = getPeriodRange(params.periodType, params.startDate, params.endDate);
      const summary = computeSummary(db, params);
      const employees = computeEmployees(db, params);
      const alerts = computeAlerts(db, params);
      const settings = loadKpiSettings(db);
      const settingsApi = settingsToApi(settings);
      const payload = {
        summary_cards: summary.summary_cards,
        ventas: summary.ventas,
        proyectos: summary.proyectos,
        reportes: summary.reportes,
        cobranza: summary.cobranza,
        facturacion: summary.facturacion,
        employees: employees.employees,
        formulas: getFormulaDefinitions(settings),
        alerts: alerts.alerts,
        settings_rows: [
          { label: 'Margen verde >=', value: `${settingsApi.margin_green_percent}%` },
          { label: 'Margen amarillo >=', value: `${settingsApi.margin_yellow_percent}%` },
          { label: 'Margen rojo >=', value: `${settingsApi.margin_red_percent}%` },
          { label: 'Alerta captura cotizaciones', value: settingsApi.require_manual_quote_capture ? 'Activa' : 'Inactiva' },
        ],
        meta: {
          period_label: period.label,
          generated_at: new Date().toLocaleString('es-MX', { timeZone: TIMEZONE }),
          generated_by: req.session.userName,
          filters: params,
        },
      };
      const xml = buildKpiExcelWorkbook(payload);
      logAuditEvent(db, {
        req,
        action: 'export',
        module: 'kpis',
        entityType: 'kpi_export',
        entityLabel: 'Excel Tablero KPIs',
        metadata: { format: 'excel', period: period.label },
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tablero-kpis.xls"');
      res.send(xml);
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      next(error);
    }
  });

  app.get('/api/kpis/sales-employees', requireAuth, requireKpiAdmin, (req, res) => {
    const employees = getVentasEmpleadosActivos(db);
    res.json({
      employees: employees.map((r) => ({
        employee_id: r.employeeId,
        full_name: r.fullName,
        position: r.position,
        kpi_area: 'Ventas',
        primary_department: r.primaryDepartment,
      })),
    });
  });

  app.get('/api/kpis/filters', requireAuth, requireKpiAdmin, (req, res) => {
    const employees = db.prepare(
      'SELECT id, full_name, department, primary_department, kpi_area, active, kpi_eligible FROM employees WHERE active = 1 AND kpi_eligible != 0 ORDER BY full_name',
    ).all();
    const clients = db.prepare(
      'SELECT DISTINCT client_name FROM projects WHERE deleted_at IS NULL ORDER BY client_name',
    ).all();
    const projects = db.prepare(
      'SELECT id, quote_number, client_name FROM projects WHERE deleted_at IS NULL ORDER BY quote_number',
    ).all();
    auditKpiAccess(req, { action: 'filters' });
    res.json({
      departments: ['Ventas', 'Técnico', 'Cobranza', 'Facturación'],
      kpi_areas_phase1: KPI_AREAS_PHASE1,
      period_types: [
        { value: 'current_month', label: 'Mes actual' },
        { value: 'previous_month', label: 'Mes anterior' },
        { value: 'current_quarter', label: 'Trimestre actual' },
        { value: 'current_year', label: 'Año actual' },
        { value: 'custom', label: 'Rango personalizado' },
      ],
      statuses: {
        proyecto: ['pendiente', 'en_proceso', 'terminado', 'cerrado', 'cancelado'],
        cobranza: ['pendiente', 'parcial', 'pagado', 'vencido'],
        reporte: ['pendiente', 'completo', 'archivado'],
        cotizacion: ['abierta', 'enviada', 'ganada', 'perdida', 'cancelada'],
      },
      employees: employees.map((e) => ({
        employeeId: e.id,
        fullName: e.full_name,
        department: e.kpi_area || e.primary_department || e.department,
      })),
      clients: clients.map((c) => c.client_name),
      projects,
    });
  });
}

module.exports = { registerKpiRoutes, requireAdminOnly, isKpiReauthValid, KPI_REAUTH_MS };
