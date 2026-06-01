'use strict';

const { logAuditEvent } = require('./audit');
const {
  computeSummary,
  computeDepartments,
  computeEmployees,
  computeAlerts,
  computeDetail,
  getPeriodRange,
} = require('./kpis');

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

function registerKpiRoutes(app, db, { requireAuth }) {
  const kpiDeniedMessage = 'Acceso restringido. Solo el administrador puede consultar el Tablero KPIs.';
  const requireKpiAdmin = requireAdminOnly(db, 'kpis', kpiDeniedMessage);

  function auditKpiAccess(req, filters) {
    logAuditEvent(db, {
      req,
      action: 'view',
      module: 'kpis',
      entityType: 'kpi_dashboard',
      entityLabel: 'Tablero KPIs',
      metadata: { filters },
    });
  }

  function kpiHandler(computeFn) {
    return (req, res, next) => {
      try {
        const params = parseKpiQuery(req.query);
        getPeriodRange(params.periodType, params.startDate, params.endDate);
        auditKpiAccess(req, params);
        res.json(computeFn(db, params));
      } catch (error) {
        error.statusCode = 400;
        next(error);
      }
    };
  }

  app.get('/api/kpis/summary', requireAuth, requireKpiAdmin, kpiHandler(computeSummary));
  app.get('/api/kpis/departments', requireAuth, requireKpiAdmin, kpiHandler(computeDepartments));
  app.get('/api/kpis/employees', requireAuth, requireKpiAdmin, kpiHandler(computeEmployees));
  app.get('/api/kpis/alerts', requireAuth, requireKpiAdmin, kpiHandler(computeAlerts));
  app.get('/api/kpis/detail', requireAuth, requireKpiAdmin, kpiHandler(computeDetail));

  app.get('/api/kpis/filters', requireAuth, requireKpiAdmin, (req, res) => {
    const employees = db.prepare(
      'SELECT id, full_name, department, primary_department, active, kpi_eligible FROM employees WHERE active = 1 AND kpi_eligible != 0 ORDER BY full_name',
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
        department: e.primary_department || e.department,
      })),
      clients: clients.map((c) => c.client_name),
      projects,
    });
  });
}

module.exports = { registerKpiRoutes, requireAdminOnly };
