'use strict';

const { createdByFields, updatedByFields, logAuditEvent, nowUtc } = require('./audit');
const { MODULES, isAdminOnlyModule } = require('./permissions');
const { roundMoney, buildProjectTotals } = require('./calculations');
const { getEmpleadosActivos } = require('./vacations');
const {
  PROJECT_COMMISSION_BASE_TYPES,
  loadExchangeRates,
  mapProjectForCommission,
  calculateProjectCommission,
  mapCommissionListRow,
  parseCommissionsPeriod,
  buildCommissionsDashboard,
} = require('./commissions');

function commissionProjectMetrics(db, project) {
  const rates = loadExchangeRates(db);
  const payments = db.prepare('SELECT amount, currency FROM project_payments WHERE project_id = ?').all(project.id);
  const costs = db.prepare('SELECT amount, currency FROM project_costs WHERE project_id = ?').all(project.id);
  const totals = buildProjectTotals(project, payments, costs, rates);
  const totalSaleMxn = totals.total_invoiced_mxn;
  const totalCostsMxn = totals.spent;
  const grossProfitMxn = roundMoney(totalSaleMxn - totalCostsMxn);
  return {
    rates,
    totalSaleMxn,
    totalCostsMxn,
    grossProfitMxn,
    netProfitMxn: grossProfitMxn,
    finalMargin: totals.final_margin,
  };
}

/** Agregado por usuario — compatible SQLite y PostgreSQL (PG exige agregados fuera de GROUP BY). */
const SESSION_USER_AGGREGATE_SQL = `
  SELECT user_id,
         MAX(user_name) AS user_name,
         MAX(role) AS role,
         COUNT(*) AS total_sessions,
         COALESCE(SUM(duration_seconds), 0) AS total_seconds,
         MAX(last_activity_at) AS last_activity
  FROM user_session_activities
`;

function logActivityMonitorError(route, error) {
  console.error(`[activity-monitor] ${route}:`, error.message, {
    code: error.code,
    detail: error.detail,
    stack: error.stack,
  });
}

function registerNewModules(app, db, { requireAuth, requirePermission, badRequest, requiredText, optionalText, numberValue, enumValue, currencyValue, booleanValue, trim }) {
  function getActiveEmployeeOrFail(employeeId) {
    const employee = db
      .prepare('SELECT id, full_name, hire_date, active FROM employees WHERE id = ? AND active = 1')
      .get(employeeId);
    if (!employee) throw badRequest('Empleado activo no encontrado en Vacaciones.');
    return employee;
  }

  function resolveCommissionAgentOrFail(salesAgentId) {
    const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL AND active = 1').get(salesAgentId);
    if (!agent) throw badRequest('Vendedora no encontrada o inactiva.');
    if (agent.employee_id) {
      const linkedEmployee = db.prepare('SELECT active FROM employees WHERE id = ?').get(agent.employee_id);
      if (!linkedEmployee || !linkedEmployee.active) throw badRequest('La vendedora debe ser un empleado activo de Vacaciones.');
    }
    return agent;
  }

  /** Asignacion: solo empleados activos de Vacaciones vinculados a vendedora registrada. */
  function resolveSalesAgentFromRequest(req) {
    if (req.body.employee_id != null && req.body.employee_id !== '') {
      const employeeId = numberValue(req.body, 'employee_id', 'Empleado', { min: 1 });
      getActiveEmployeeOrFail(employeeId);
      const agent = db
        .prepare('SELECT * FROM sales_commission_agents WHERE employee_id = ? AND deleted_at IS NULL AND active = 1')
        .get(employeeId);
      if (!agent) {
        throw badRequest('Registre al empleado como vendedora en la pestana 1 (Vendedoras) antes de asignar comisiones.');
      }
      return agent;
    }
    return resolveCommissionAgentOrFail(numberValue(req.body, 'sales_agent_id', 'Vendedora', { min: 1 }));
  }

  // ===================== ROLE PERMISSIONS CONFIGURATION =====================

  app.get('/api/admin/role-permissions', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede configurar roles.' });
      const rows = db.prepare('SELECT * FROM role_permissions ORDER BY role').all();
      const result = {};
      for (const row of rows) { result[row.role] = JSON.parse(row.permissions_json || '{}'); }
      res.json({ roles: result, modules: MODULES });
    } catch (error) { next(error); }
  });

  app.put('/api/admin/role-permissions/:role', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede configurar roles.' });
      const { role } = req.params;
      if (!['user', 'tecnico'].includes(role)) throw badRequest('No se puede modificar permisos del rol admin.');
      const { permissions } = req.body;
      if (!permissions || typeof permissions !== 'object') throw badRequest('Permisos invalidos.');
      for (const mod of Object.keys(permissions)) {
        if (isAdminOnlyModule(mod) && permissions[mod] && permissions[mod].length > 0) {
          throw badRequest(`El modulo ${mod} es exclusivo de administradores.`);
        }
      }
      const json = JSON.stringify(permissions);
      const existing = db.prepare('SELECT id FROM role_permissions WHERE role = ?').get(role);
      if (existing) {
        db.prepare('UPDATE role_permissions SET permissions_json = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ?').run(json, role);
      } else {
        db.prepare('INSERT INTO role_permissions (role, permissions_json) VALUES (?, ?)').run(role, json);
      }
      logAuditEvent(db, { req, action: 'update_role_permissions', module: 'users', entityType: 'role', entityLabel: role, after: permissions });
      res.json({ message: 'Permisos del rol actualizados.', permissions });
    } catch (error) { next(error); }
  });

  // ===================== COMMISSIONS MODULE =====================

  app.get('/api/commissions/active-employees', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      res.json(getEmpleadosActivos(db));
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/summary', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const period = parseCommissionsPeriod(req.query);
      const dashboard = buildCommissionsDashboard(db, period);
      const activeAgents = db.prepare("SELECT COUNT(*) as cnt FROM sales_commission_agents WHERE active = 1 AND deleted_at IS NULL").get().cnt;
      const pendingProjects = db.prepare(`SELECT COUNT(*) as cnt FROM projects WHERE deleted_at IS NULL
        AND id NOT IN (SELECT sc.project_id FROM sales_commissions sc WHERE sc.deleted_at IS NULL AND sc.status != 'cancelada' AND sc.project_id IS NOT NULL)`).get().cnt;
      const agentSummaries = db.prepare(`SELECT sca.id, sca.name, sca.employee_id, sca.active,
        COALESCE((SELECT SUM(sc.commission_amount_mxn) FROM sales_commissions sc WHERE sc.sales_agent_id = sca.id AND sc.deleted_at IS NULL AND sc.status NOT IN ('no_aplica', 'cancelada')), 0) as earned_mxn,
        COALESCE((SELECT SUM(sc.commission_amount_mxn) FROM sales_commissions sc WHERE sc.sales_agent_id = sca.id AND sc.deleted_at IS NULL AND sc.status = 'pendiente'), 0) as pending_commissions_mxn,
        COALESCE((SELECT SUM(scp.amount_mxn) FROM sales_commission_payments scp WHERE scp.sales_agent_id = sca.id AND scp.deleted_at IS NULL), 0) as paid_mxn,
        (SELECT COUNT(*) FROM sales_commissions sc2 WHERE sc2.sales_agent_id = sca.id AND sc2.deleted_at IS NULL AND sc2.status = 'pendiente') as pending_count
        FROM sales_commission_agents sca WHERE sca.deleted_at IS NULL ORDER BY sca.name`).all();
      res.json({
        ...dashboard,
        total_earned_mxn: dashboard.totals.commissions_generated_mxn,
        total_paid_mxn: dashboard.totals.commissions_paid_mxn,
        pending_balance_mxn: dashboard.totals.commissions_pending_mxn,
        active_agents: activeAgents,
        pending_projects: pendingProjects,
        agents: agentSummaries.map((a) => ({
          ...a,
          pending_mxn: roundMoney(a.pending_commissions_mxn),
        })),
      });
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/agents', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const agents = db.prepare(`SELECT sca.*, e.full_name as employee_name, e.employee_number
        FROM sales_commission_agents sca
        LEFT JOIN employees e ON e.id = sca.employee_id
        WHERE sca.deleted_at IS NULL
        ORDER BY sca.name`).all();
      res.json(agents);
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/agents', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const startDate = requiredText(req.body, 'start_date', 'Fecha de inicio');
      const relatedUserId = req.body.related_user_id || null;
      const notes = optionalText(req.body, 'notes');
      let name;
      let employeeId = null;
      if (req.body.employee_id != null && req.body.employee_id !== '') {
        employeeId = numberValue(req.body, 'employee_id', 'Empleado', { min: 1 });
        const employee = getActiveEmployeeOrFail(employeeId);
        const duplicate = db.prepare('SELECT id FROM sales_commission_agents WHERE employee_id = ? AND deleted_at IS NULL').get(employeeId);
        if (duplicate) throw badRequest('Este empleado ya esta registrado como vendedora.');
        name = employee.full_name;
      } else {
        name = requiredText(req.body, 'name', 'Nombre de vendedora');
      }
      const audit = createdByFields(req);
      const result = db.prepare(`INSERT INTO sales_commission_agents (name, employee_id, related_user_id, active, start_date, notes, created_by_user_id, created_by_name, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`).run(name, employeeId, relatedUserId, startDate, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission_agent', entityId: agent.id, entityLabel: name, after: agent });
      res.status(201).json(agent);
    } catch (error) { next(error); }
  });

  app.put('/api/commissions/agents/:id', requireAuth, requirePermission('commissions', 'edit'), (req, res, next) => {
    try {
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!agent) throw badRequest('Vendedora no encontrada.');
      const active = booleanValue(req.body, 'active');
      const startDate = req.body.start_date || agent.start_date;
      const endDate = optionalText(req.body, 'end_date');
      const notes = optionalText(req.body, 'notes');
      let name = agent.name;
      let employeeId = agent.employee_id;
      if (req.body.employee_id != null && req.body.employee_id !== '') {
        employeeId = numberValue(req.body, 'employee_id', 'Empleado', { min: 1 });
        const employee = getActiveEmployeeOrFail(employeeId);
        const duplicate = db.prepare('SELECT id FROM sales_commission_agents WHERE employee_id = ? AND deleted_at IS NULL AND id != ?').get(employeeId, req.params.id);
        if (duplicate) throw badRequest('Este empleado ya esta registrado como vendedora.');
        name = employee.full_name;
      } else if (req.body.name) {
        name = requiredText(req.body, 'name', 'Nombre de vendedora');
      }
      const audit = updatedByFields(req);
      db.prepare(`UPDATE sales_commission_agents SET name=?, employee_id=?, related_user_id=?, active=?, start_date=?, end_date=?, notes=?, updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?`)
        .run(name, employeeId, req.body.related_user_id || null, active, startDate, endDate, notes, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);
      const updated = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(req.params.id);
      logAuditEvent(db, { req, action: active ? 'update' : 'deactivate', module: 'commissions', entityType: 'sales_commission_agent', entityId: updated.id, entityLabel: name, before: agent, after: updated });
      res.json(updated);
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/available-projects', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const rates = loadExchangeRates(db);
      const projects = db.prepare(`SELECT p.* FROM projects p
        WHERE p.deleted_at IS NULL
          AND p.id NOT IN (
            SELECT sc.project_id FROM sales_commissions sc
            WHERE sc.deleted_at IS NULL AND sc.status != 'cancelada' AND sc.project_id IS NOT NULL
          )
        ORDER BY p.id DESC`).all();
      res.json(projects.map((p) => mapProjectForCommission(db, p, rates)));
    } catch (error) { next(error); }
  });

  app.get('/api/commissions', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const paidSearch = req.query.paid === '1' || req.query.archived === '1';
      if (paidSearch) {
        const clientName = trim(req.query.client_name);
        const quoteNumber = trim(req.query.quote_number);
        const orderNumber = trim(req.query.order_number);
        const dateFrom = trim(req.query.date_from);
        const dateTo = trim(req.query.date_to);
        if (!clientName && !quoteNumber && !orderNumber && !dateFrom && !dateTo) {
          throw badRequest('Indique al menos un filtro (cliente, cotizacion, pedido o rango de fechas) para consultar comisiones pagadas.');
        }
        const conditions = ["sc.deleted_at IS NULL", "sc.status = 'pagada'"];
        const params = [];
        if (clientName) {
          conditions.push('(p.client_name LIKE ? OR (sc.commission_type = \'extraordinaria\' AND sc.notes LIKE ?))');
          params.push(`%${clientName}%`, `%${clientName}%`);
        }
        if (quoteNumber) { conditions.push('p.quote_number LIKE ?'); params.push(`%${quoteNumber}%`); }
        if (orderNumber) { conditions.push('p.order_number LIKE ?'); params.push(`%${orderNumber}%`); }
        if (dateFrom) { conditions.push('date(COALESCE(sc.paid_at, sc.updated_at)) >= date(?)'); params.push(dateFrom); }
        if (dateTo) { conditions.push('date(COALESCE(sc.paid_at, sc.updated_at)) <= date(?)'); params.push(dateTo); }
        const rows = db.prepare(`SELECT sc.*, sca.name as agent_name, p.quote_number, p.client_name, p.order_number
          FROM sales_commissions sc
          JOIN sales_commission_agents sca ON sca.id = sc.sales_agent_id
          LEFT JOIN projects p ON p.id = sc.project_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(sc.paid_at, sc.updated_at) DESC`).all(...params);
        return res.json(rows.map(mapCommissionListRow));
      }
      const rows = db.prepare(`SELECT sc.*, sca.name as agent_name, p.quote_number, p.client_name, p.order_number
        FROM sales_commissions sc
        JOIN sales_commission_agents sca ON sca.id = sc.sales_agent_id
        LEFT JOIN projects p ON p.id = sc.project_id
        WHERE sc.deleted_at IS NULL AND sc.status = 'pendiente'
        ORDER BY sc.assigned_at DESC`).all();
      res.json(rows.map(mapCommissionListRow));
    } catch (error) { next(error); }
  });

  app.post('/api/commissions', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const projectId = numberValue(req.body, 'project_id', 'Proyecto', { min: 1 });
      const agent = resolveSalesAgentFromRequest(req);
      const salesAgentId = agent.id;
      const baseType = enumValue(req.body, 'commission_calculation_base_type', 'Tipo de comision', PROJECT_COMMISSION_BASE_TYPES);
      const existing = db.prepare("SELECT id FROM sales_commissions WHERE project_id = ? AND deleted_at IS NULL AND status != 'cancelada'").get(projectId);
      if (existing) throw badRequest('Este proyecto ya tiene una comision asignada y no puede reasignarse.');
      const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
      if (!project) throw badRequest('Proyecto no encontrado.');
      const { totalSaleMxn, grossProfitMxn, netProfitMxn, finalMargin } = commissionProjectMetrics(db, project);
      const manualAmount = baseType === 'monto_manual'
        ? numberValue(req.body, 'commission_amount_mxn', 'Monto de comision', { min: 0.01 })
        : null;
      const calc = calculateProjectCommission(baseType, totalSaleMxn, manualAmount);
      if (!calc || calc.commissionAmountMxn <= 0) throw badRequest('Monto de comision invalido.');
      const audit = createdByFields(req);
      const result = db.prepare(`INSERT INTO sales_commissions (
          project_id, sales_agent_id, commission_type, commission_calculation_base_type, commission_base_mxn,
          total_sale_mxn_snapshot, gross_profit_mxn_snapshot, net_profit_mxn_snapshot, final_margin_snapshot,
          commission_percentage, commission_amount_mxn, status, notes, reference,
          assigned_by_user_id, assigned_by_name, assigned_at, created_at, updated_at
        ) VALUES (?, ?, 'proyecto', ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?)`).run(
        projectId, salesAgentId, baseType, calc.commissionBaseMxn, totalSaleMxn, grossProfitMxn, netProfitMxn, finalMargin,
        calc.commissionPercentage, calc.commissionAmountMxn, optionalText(req.body, 'notes'), optionalText(req.body, 'reference'),
        audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at, audit.created_at,
      );
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `${project.quote_number} - ${agent.name}`, after: commission, metadata: { base_type: baseType, commission_type: 'proyecto' } });
      res.status(201).json(mapCommissionListRow({ ...commission, quote_number: project.quote_number, client_name: project.client_name, order_number: project.order_number, agent_name: agent.name }));
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/extraordinary', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const agent = resolveSalesAgentFromRequest(req);
      const salesAgentId = agent.id;
      const amountMxn = numberValue(req.body, 'commission_amount_mxn', 'Monto', { min: 0.01 });
      const description = requiredText(req.body, 'description', 'Descripcion');
      const reference = optionalText(req.body, 'reference');
      const audit = createdByFields(req);
      const rounded = roundMoney(amountMxn);
      const result = db.prepare(`INSERT INTO sales_commissions (
          project_id, sales_agent_id, commission_type, commission_calculation_base_type, commission_base_mxn,
          commission_percentage, commission_amount_mxn, status, notes, reference,
          assigned_by_user_id, assigned_by_name, assigned_at, created_at, updated_at
        ) VALUES (NULL, ?, 'extraordinaria', 'monto_manual', ?, 0, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?)`).run(
        salesAgentId, rounded, rounded, description, reference,
        audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at, audit.created_at,
      );
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `Extraordinaria - ${agent.name}`, after: commission, metadata: { commission_type: 'extraordinaria' } });
      res.status(201).json(mapCommissionListRow({ ...commission, agent_name: agent.name }));
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/:id/pay', requireAuth, requirePermission('commissions', 'pay'), (req, res, next) => {
    try {
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!commission) throw badRequest('Comision no encontrada.');
      if (commission.status === 'pagada') throw badRequest('Esta comision ya esta pagada.');
      if (commission.status === 'cancelada') throw badRequest('No se puede pagar una comision cancelada.');
      const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
      const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
      const currency = currencyValue(req.body, 'currency', 'Moneda');
      const exchangeRateToMxn = currency === 'MXN' ? 1 : numberValue(req.body, 'exchange_rate_to_mxn', 'Tipo de cambio', { min: 0.01 });
      const amountMxn = roundMoney(amountOriginal * exchangeRateToMxn);
      const reference = optionalText(req.body, 'reference');
      const notes = optionalText(req.body, 'notes');
      const audit = createdByFields(req);
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(commission.sales_agent_id);
      const payResult = db.prepare(`INSERT INTO sales_commission_payments (
          commission_id, sales_agent_id, payment_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn,
          reference, notes, created_by_user_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        commission.id, commission.sales_agent_id, paymentDate, amountOriginal, currency, exchangeRateToMxn, amountMxn,
        reference, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at,
      );
      db.prepare(`UPDATE sales_commissions SET status='pagada', paid_at=?, reference=COALESCE(?, reference), updated_at=? WHERE id=?`)
        .run(paymentDate, reference, audit.created_at, commission.id);
      const payment = db.prepare('SELECT * FROM sales_commission_payments WHERE id = ?').get(payResult.lastInsertRowid);
      const updated = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(commission.id);
      logAuditEvent(db, { req, action: 'pay', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `${agent?.name || ''} - ${amountMxn} MXN`, after: updated, metadata: { payment_id: payment.id } });
      res.status(201).json({ commission: mapCommissionListRow(updated), payment });
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/:id/cancel', requireAuth, requirePermission('commissions', 'delete'), (req, res, next) => {
    try {
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!commission) throw badRequest('Comision no encontrada.');
      if (commission.status === 'cancelada') throw badRequest('Ya esta cancelada.');
      const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
      const audit = updatedByFields(req);
      db.prepare("UPDATE sales_commissions SET status='cancelada', delete_reason=?, deleted_by_user_id=?, deleted_by_name=?, deleted_at=?, updated_at=? WHERE id=?").run(reason, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, audit.updated_at, req.params.id);
      logAuditEvent(db, { req, action: 'cancel', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, metadata: { reason } });
      res.json({ message: 'Comision cancelada.' });
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/payments', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const agentId = req.query.agent_id;
      const baseSql = `SELECT scp.*, sca.name as agent_name, sc.commission_type, p.quote_number
        FROM sales_commission_payments scp
        JOIN sales_commission_agents sca ON sca.id = scp.sales_agent_id
        LEFT JOIN sales_commissions sc ON sc.id = scp.commission_id
        LEFT JOIN projects p ON p.id = sc.project_id
        WHERE scp.deleted_at IS NULL`;
      const payments = agentId
        ? db.prepare(`${baseSql} AND scp.sales_agent_id = ? ORDER BY scp.payment_date DESC`).all(agentId)
        : db.prepare(`${baseSql} ORDER BY scp.payment_date DESC`).all();
      res.json(payments);
    } catch (error) { next(error); }
  });

  // ===================== ACTIVITY MONITOR MODULE =====================

  app.get('/api/activity-monitor/sessions', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      cleanupInactiveSessions(db);
      const active = db.prepare('SELECT * FROM user_session_activities WHERE is_active = 1 ORDER BY last_activity_at DESC').all();
      res.json(active);
    } catch (error) { logActivityMonitorError('GET /sessions', error); next(error); }
  });

  app.get('/api/activity-monitor/weekly-report', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const year = Number(req.query.year) || new Date().getFullYear();
      const week = Number(req.query.week) || Math.ceil((Date.now() - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const startOfYear = new Date(year, 0, 1);
      const weekStart = new Date(startOfYear.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const sessions = db.prepare(`${SESSION_USER_AGGREGATE_SQL} WHERE login_at >= ? AND login_at < ? GROUP BY user_id ORDER BY total_seconds DESC`).all(weekStart.toISOString(), weekEnd.toISOString());
      const deniedAccess = db.prepare("SELECT user_name, COUNT(*) as count FROM audit_logs WHERE action = 'access_denied' AND timestamp_utc >= ? AND timestamp_utc < ? GROUP BY user_name").all(weekStart.toISOString(), weekEnd.toISOString());
      res.json({ year, week, week_start: weekStart.toISOString(), week_end: weekEnd.toISOString(), users: sessions.map(s => ({ ...s, avg_per_day: s.total_seconds ? Math.round(s.total_seconds / 7) : 0 })), denied_access: deniedAccess });
    } catch (error) { logActivityMonitorError('GET /weekly-report', error); next(error); }
  });

  app.get('/api/activity-monitor/recent-sessions', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const sessions = db.prepare('SELECT * FROM user_session_activities ORDER BY login_at DESC LIMIT 50').all();
      res.json({ data: sessions });
    } catch (error) { logActivityMonitorError('GET /recent-sessions', error); next(error); }
  });

  app.get('/api/activity-monitor/recent-events', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const events = db.prepare('SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, metadata_json FROM audit_logs ORDER BY id DESC LIMIT 50').all();
      res.json({ data: events });
    } catch (error) { logActivityMonitorError('GET /recent-events', error); next(error); }
  });

  // ===================== ACTIVITY MONITOR SUMMARY WITH PERIOD FILTERS =====================

  function getActivityDateRange(periodType, params) {
    const CDMX_OFFSET = -6;
    function cdmxToUtc(dateStr) {
      const d = new Date(dateStr);
      d.setHours(d.getHours() - CDMX_OFFSET);
      return d.toISOString();
    }
    function lastDayOfMonth(year, month) {
      return new Date(year, month, 0).getDate();
    }
    function getISOWeekDates(year, weekNum) {
      const jan4 = new Date(year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { monday, sunday };
    }
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    if (periodType === 'year') {
      const y = Number(params.year);
      return {
        startDate: cdmxToUtc(`${y}-01-01T00:00:00`),
        endDate: cdmxToUtc(`${y}-12-31T23:59:59`),
        label: `${y}`,
      };
    }
    if (periodType === 'month') {
      const y = Number(params.year);
      const m = Number(params.month);
      const lastDay = lastDayOfMonth(y, m);
      const mStr = String(m).padStart(2, '0');
      return {
        startDate: cdmxToUtc(`${y}-${mStr}-01T00:00:00`),
        endDate: cdmxToUtc(`${y}-${mStr}-${String(lastDay).padStart(2,'0')}T23:59:59`),
        label: `${monthNames[m-1]} ${y}`,
      };
    }
    if (periodType === 'week') {
      const y = Number(params.year);
      const w = Number(params.weekNumber);
      const { monday, sunday } = getISOWeekDates(y, w);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return {
        startDate: cdmxToUtc(`${fmt(monday)}T00:00:00`),
        endDate: cdmxToUtc(`${fmt(sunday)}T23:59:59`),
        label: `Semana ${w} de ${y} (${fmt(monday)} a ${fmt(sunday)})`,
      };
    }
    if (periodType === 'day') {
      const dateStr = params.date;
      return {
        startDate: cdmxToUtc(`${dateStr}T00:00:00`),
        endDate: cdmxToUtc(`${dateStr}T23:59:59`),
        label: dateStr,
      };
    }
    return null;
  }

  app.get('/api/activity-monitor/summary', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const { periodType, year, month, weekNumber, date, userId, role } = req.query;
      if (!periodType || !['year', 'month', 'week', 'day'].includes(periodType)) {
        return res.status(400).json({ message: 'periodType es obligatorio (year, month, week, day).' });
      }
      if ((periodType === 'year' || periodType === 'month' || periodType === 'week') && !year) {
        return res.status(400).json({ message: 'year es obligatorio para este tipo de periodo.' });
      }
      if (periodType === 'month' && (!month || month < 1 || month > 12)) {
        return res.status(400).json({ message: 'month es obligatorio y debe ser 1-12.' });
      }
      if (periodType === 'week' && (!weekNumber || weekNumber < 1 || weekNumber > 53)) {
        return res.status(400).json({ message: 'weekNumber es obligatorio y debe ser 1-53.' });
      }
      if (periodType === 'day' && !date) {
        return res.status(400).json({ message: 'date es obligatorio para consulta por dia.' });
      }
      const range = getActivityDateRange(periodType, { year, month, weekNumber, date });
      if (!range) return res.status(400).json({ message: 'No se pudo calcular el rango de fechas.' });

      let sessionFilter = 'login_at >= ? AND login_at <= ?';
      let sessionParams = [range.startDate, range.endDate];
      let eventFilter = 'timestamp_utc >= ? AND timestamp_utc <= ?';
      let eventParams = [range.startDate, range.endDate];

      if (userId) { sessionFilter += ' AND user_id = ?'; sessionParams.push(Number(userId)); eventFilter += ' AND user_id = ?'; eventParams.push(Number(userId)); }
      if (role) { sessionFilter += ' AND role = ?'; sessionParams.push(role); eventFilter += ' AND module IS NOT NULL'; }

      const users = db.prepare(`${SESSION_USER_AGGREGATE_SQL} WHERE ${sessionFilter} GROUP BY user_id ORDER BY total_seconds DESC`).all(...sessionParams);

      const totalSessions = users.reduce((sum, u) => sum + u.total_sessions, 0);
      const totalDuration = users.reduce((sum, u) => sum + u.total_seconds, 0);

      const totalEvents = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE ${eventFilter}`).get(...eventParams).cnt;
      const deniedEvents = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'access_denied' AND ${eventFilter}`).get(...eventParams).cnt;

      const events = db.prepare(`SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc FROM audit_logs WHERE ${eventFilter} ORDER BY id DESC LIMIT 100`).all(...eventParams);

      const userResults = users.map(u => {
        const userEvents = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = ? AND ${eventFilter}`).get(u.user_id, ...eventParams).cnt;
        const userDenied = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = ? AND action = 'access_denied' AND ${eventFilter}`).get(u.user_id, ...eventParams).cnt;
        return { ...u, avg_per_session: u.total_sessions > 0 ? Math.round(u.total_seconds / u.total_sessions) : 0, total_events: userEvents, denied_access: userDenied };
      });

      logAuditEvent(db, { req, action: 'view_activity_summary', module: 'activityMonitor', metadata: { periodType, year, month, weekNumber, date } });

      res.json({
        period: { periodType, label: range.label, startDate: range.startDate, endDate: range.endDate },
        summary: { totalUsers: users.length, totalSessions, totalDurationSeconds: totalDuration, averageSessionDurationSeconds: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0, totalEvents, deniedAccessEvents: deniedEvents },
        users: userResults,
        events: events,
      });
    } catch (error) { logActivityMonitorError('GET /summary', error); next(error); }
  });

  // ===================== SKINS / USER PREFERENCES =====================

  const VALID_THEMES = ['default', 'dark', 'corporate', 'high_contrast'];

  app.get('/api/preferences/theme', requireAuth, (req, res, next) => {
    try {
      const pref = db.prepare('SELECT theme_name FROM user_preferences WHERE user_id = ?').get(req.session.userId);
      res.json({ theme: pref ? pref.theme_name : 'default' });
    } catch (error) { next(error); }
  });

  app.put('/api/preferences/theme', requireAuth, (req, res, next) => {
    try {
      const theme = trim(req.body.theme) || 'default';
      if (!VALID_THEMES.includes(theme)) throw badRequest('Tema invalido. Opciones: ' + VALID_THEMES.join(', '));
      const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(req.session.userId);
      if (existing) { db.prepare('UPDATE user_preferences SET theme_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(theme, req.session.userId); }
      else { db.prepare('INSERT INTO user_preferences (user_id, theme_name) VALUES (?, ?)').run(req.session.userId, theme); }
      logAuditEvent(db, { req, action: 'change_theme', module: 'preferences', entityType: 'user_preference', entityId: req.session.userId, metadata: { theme } });
      res.json({ theme });
    } catch (error) { next(error); }
  });
}

function updateSessionActivity(db, req) {
  if (!req.session || !req.session.userId) return;
  const crypto = require('node:crypto');
  const sessionHash = crypto.createHash('sha256').update(req.sessionID || '').digest('hex').substring(0, 16);
  const now = nowUtc();
  try {
    const existing = db.prepare('SELECT id, login_at FROM user_session_activities WHERE session_id_hash = ? AND is_active = 1').get(sessionHash);
    if (existing) {
      const duration = Math.floor((new Date(now) - new Date(existing.login_at)) / 1000);
      db.prepare('UPDATE user_session_activities SET last_activity_at = ?, duration_seconds = ?, updated_at = ? WHERE id = ?').run(now, duration, now, existing.id);
    } else {
      db.prepare('INSERT INTO user_session_activities (user_id, user_name, role, session_id_hash, login_at, last_activity_at, ip_address, user_agent, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)').run(req.session.userId, req.session.username, req.session.role, sessionHash, now, now, req.ip || null, req.get ? req.get('user-agent') || null : null, now, now);
    }
  } catch (e) { /* non-critical */ }
}

function closeSessionActivity(db, req) {
  if (!req.session || !req.sessionID) return;
  const crypto = require('node:crypto');
  const sessionHash = crypto.createHash('sha256').update(req.sessionID || '').digest('hex').substring(0, 16);
  const now = nowUtc();
  try {
    const existing = db.prepare('SELECT id, login_at FROM user_session_activities WHERE session_id_hash = ? AND is_active = 1').get(sessionHash);
    if (existing) {
      const duration = Math.floor((new Date(now) - new Date(existing.login_at)) / 1000);
      db.prepare('UPDATE user_session_activities SET logout_at = ?, last_activity_at = ?, duration_seconds = ?, is_active = 0, updated_at = ? WHERE id = ?').run(now, now, duration, now, existing.id);
    }
  } catch (e) { /* non-critical */ }
}

function cleanupInactiveSessions(db) {
  try {
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const inactive = db.prepare('SELECT id, login_at, last_activity_at FROM user_session_activities WHERE is_active = 1 AND last_activity_at < ?').all(threshold);
    for (const s of inactive) {
      const duration = Math.floor((new Date(s.last_activity_at) - new Date(s.login_at)) / 1000);
      db.prepare('UPDATE user_session_activities SET is_active = 0, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(duration, s.id);
    }
  } catch (e) { /* non-critical */ }
}

module.exports = { registerNewModules, updateSessionActivity, closeSessionActivity, cleanupInactiveSessions };
