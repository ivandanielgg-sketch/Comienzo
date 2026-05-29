'use strict';

const { createdByFields, updatedByFields, logAuditEvent, nowUtc } = require('./audit');
const { MODULES, isAdminOnlyModule } = require('./permissions');
const { roundMoney } = require('./calculations');

function registerNewModules(app, db, { requireAuth, requirePermission, badRequest, requiredText, optionalText, numberValue, enumValue, currencyValue, booleanValue, trim }) {

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

  app.get('/api/commissions/summary', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const totalEarned = db.prepare("SELECT COALESCE(SUM(commission_amount_mxn), 0) as total FROM sales_commissions WHERE deleted_at IS NULL AND status NOT IN ('no_aplica', 'cancelada')").get().total;
      const totalPaid = db.prepare("SELECT COALESCE(SUM(amount_mxn), 0) as total FROM sales_commission_payments WHERE deleted_at IS NULL").get().total;
      const activeAgents = db.prepare("SELECT COUNT(*) as cnt FROM sales_commission_agents WHERE active = 1 AND deleted_at IS NULL").get().cnt;
      const pendingProjects = db.prepare("SELECT COUNT(*) as cnt FROM projects WHERE closed_at IS NOT NULL AND deleted_at IS NULL AND id NOT IN (SELECT project_id FROM sales_commissions WHERE deleted_at IS NULL AND status != 'cancelada')").get().cnt;
      const agentSummaries = db.prepare("SELECT sca.id, sca.name, sca.active, COALESCE((SELECT SUM(sc.commission_amount_mxn) FROM sales_commissions sc WHERE sc.sales_agent_id = sca.id AND sc.deleted_at IS NULL AND sc.status NOT IN ('no_aplica', 'cancelada')), 0) as earned_mxn, COALESCE((SELECT SUM(scp.amount_mxn) FROM sales_commission_payments scp WHERE scp.sales_agent_id = sca.id AND scp.deleted_at IS NULL), 0) as paid_mxn, (SELECT COUNT(*) FROM sales_commissions sc2 WHERE sc2.sales_agent_id = sca.id AND sc2.deleted_at IS NULL AND sc2.status NOT IN ('no_aplica', 'cancelada')) as projects_count FROM sales_commission_agents sca WHERE sca.deleted_at IS NULL ORDER BY sca.name").all();
      res.json({ total_earned_mxn: roundMoney(totalEarned), total_paid_mxn: roundMoney(totalPaid), pending_balance_mxn: roundMoney(totalEarned - totalPaid), active_agents: activeAgents, pending_projects: pendingProjects, agents: agentSummaries.map(a => ({ ...a, pending_mxn: roundMoney(a.earned_mxn - a.paid_mxn) })) });
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/agents', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const agents = db.prepare('SELECT * FROM sales_commission_agents WHERE deleted_at IS NULL ORDER BY name').all();
      res.json(agents);
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/agents', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const name = requiredText(req.body, 'name', 'Nombre de vendedora');
      const startDate = requiredText(req.body, 'start_date', 'Fecha de inicio');
      const relatedUserId = req.body.related_user_id || null;
      const notes = optionalText(req.body, 'notes');
      const audit = createdByFields(req);
      const result = db.prepare('INSERT INTO sales_commission_agents (name, related_user_id, active, start_date, notes, created_by_user_id, created_by_name, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)').run(name, relatedUserId, startDate, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission_agent', entityId: agent.id, entityLabel: name, after: agent });
      res.status(201).json(agent);
    } catch (error) { next(error); }
  });

  app.put('/api/commissions/agents/:id', requireAuth, requirePermission('commissions', 'edit'), (req, res, next) => {
    try {
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!agent) throw badRequest('Vendedora no encontrada.');
      const name = requiredText(req.body, 'name', 'Nombre de vendedora');
      const active = booleanValue(req.body, 'active');
      const startDate = req.body.start_date || agent.start_date;
      const endDate = optionalText(req.body, 'end_date');
      const notes = optionalText(req.body, 'notes');
      const audit = updatedByFields(req);
      db.prepare('UPDATE sales_commission_agents SET name=?, related_user_id=?, active=?, start_date=?, end_date=?, notes=?, updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?')
        .run(name, req.body.related_user_id || null, active, startDate, endDate, notes, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);
      const updated = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ?').get(req.params.id);
      logAuditEvent(db, { req, action: active ? 'update' : 'deactivate', module: 'commissions', entityType: 'sales_commission_agent', entityId: updated.id, entityLabel: name, before: agent, after: updated });
      res.json(updated);
    } catch (error) { next(error); }
  });

  app.get('/api/commissions/available-projects', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const rates = {};
      db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all().forEach(r => { rates[r.currency] = r.rate_to_mxn; });
      rates.MXN = 1;
      const projects = db.prepare("SELECT p.* FROM projects p WHERE p.closed_at IS NOT NULL AND p.deleted_at IS NULL AND p.id NOT IN (SELECT sc.project_id FROM sales_commissions sc WHERE sc.deleted_at IS NULL AND sc.status != 'cancelada') ORDER BY p.closed_at DESC").all();
      const result = projects.map(p => {
        const totalInvoicedMxn = roundMoney((p.total_invoiced || 0) * (rates[p.total_invoiced_currency] || 1));
        const totalCostsMxn = roundMoney(db.prepare("SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN ? WHEN 'EUR' THEN ? ELSE 1 END), 0) as t FROM project_costs WHERE project_id = ?").get(rates.USD || 17, rates.EUR || 19, p.id).t);
        const grossProfitMxn = roundMoney(totalInvoicedMxn - totalCostsMxn);
        return { id: p.id, quote_number: p.quote_number, order_number: p.order_number, client_name: p.client_name, project_description: p.project_description, closed_at: p.closed_at, seller: p.seller, total_sale_mxn: totalInvoicedMxn, total_costs_mxn: totalCostsMxn, gross_profit_mxn: grossProfitMxn, net_profit_mxn: grossProfitMxn, margin: totalInvoicedMxn > 0 ? roundMoney((grossProfitMxn / totalInvoicedMxn) * 100) : 0 };
      });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/api/commissions', requireAuth, requirePermission('commissions', 'view'), (req, res, next) => {
    try {
      const commissions = db.prepare("SELECT sc.*, sca.name as agent_name, p.quote_number, p.client_name, p.order_number FROM sales_commissions sc JOIN sales_commission_agents sca ON sca.id = sc.sales_agent_id JOIN projects p ON p.id = sc.project_id WHERE sc.deleted_at IS NULL ORDER BY sc.assigned_at DESC").all();
      res.json(commissions);
    } catch (error) { next(error); }
  });

  app.post('/api/commissions', requireAuth, requirePermission('commissions', 'create'), (req, res, next) => {
    try {
      const projectId = numberValue(req.body, 'project_id', 'Proyecto', { min: 1 });
      const salesAgentId = numberValue(req.body, 'sales_agent_id', 'Vendedora', { min: 1 });
      const baseType = enumValue(req.body, 'commission_calculation_base_type', 'Base de calculo', ['total_sale_mxn', 'gross_profit_mxn', 'net_profit_mxn', 'no_aplica']);
      const existing = db.prepare("SELECT id FROM sales_commissions WHERE project_id = ? AND deleted_at IS NULL AND status != 'cancelada'").get(projectId);
      if (existing) throw badRequest('Este proyecto ya tiene una comision activa asignada.');
      const project = db.prepare('SELECT * FROM projects WHERE id = ? AND closed_at IS NOT NULL').get(projectId);
      if (!project) throw badRequest('Proyecto no encontrado o no esta cerrado.');
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL').get(salesAgentId);
      if (!agent) throw badRequest('Vendedora no encontrada.');
      const rates = {};
      db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all().forEach(r => { rates[r.currency] = r.rate_to_mxn; });
      rates.MXN = 1;
      const totalSaleMxn = roundMoney((project.total_invoiced || 0) * (rates[project.total_invoiced_currency] || 1));
      const totalCostsMxn = roundMoney(db.prepare("SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN ? WHEN 'EUR' THEN ? ELSE 1 END), 0) as t FROM project_costs WHERE project_id = ?").get(rates.USD || 17, rates.EUR || 19, projectId).t);
      const grossProfitMxn = roundMoney(totalSaleMxn - totalCostsMxn);
      const netProfitMxn = grossProfitMxn;
      let commissionBaseMxn = 0, commissionPercentage = 0, commissionAmountMxn = 0, status = 'pendiente', noApplyReason = null;
      if (baseType === 'no_aplica') {
        noApplyReason = requiredText(req.body, 'no_apply_reason', 'Motivo de No Aplica');
        status = 'no_aplica';
      } else {
        commissionPercentage = numberValue(req.body, 'commission_percentage', 'Porcentaje de comision', { min: 1, max: 20 });
        if (baseType === 'total_sale_mxn') commissionBaseMxn = totalSaleMxn;
        else if (baseType === 'gross_profit_mxn') commissionBaseMxn = grossProfitMxn;
        else if (baseType === 'net_profit_mxn') commissionBaseMxn = netProfitMxn;
        if (commissionBaseMxn < 0) throw badRequest('La base de calculo es negativa. Se sugiere usar No Aplica.');
        commissionAmountMxn = roundMoney(commissionBaseMxn * (commissionPercentage / 100));
      }
      const audit = createdByFields(req);
      const result = db.prepare('INSERT INTO sales_commissions (project_id, sales_agent_id, commission_calculation_base_type, commission_base_mxn, total_sale_mxn_snapshot, gross_profit_mxn_snapshot, net_profit_mxn_snapshot, commission_percentage, commission_amount_mxn, status, no_apply_reason, notes, assigned_by_user_id, assigned_by_name, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(projectId, salesAgentId, baseType, commissionBaseMxn, totalSaleMxn, grossProfitMxn, netProfitMxn, commissionPercentage, commissionAmountMxn, status, noApplyReason, optionalText(req.body, 'notes'), audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at, audit.created_at);
      const commission = db.prepare('SELECT * FROM sales_commissions WHERE id = ?').get(result.lastInsertRowid);
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission', entityId: commission.id, entityLabel: `${project.quote_number} - ${agent.name}`, after: commission, metadata: { base_type: baseType } });
      res.status(201).json(commission);
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
      let payments;
      if (agentId) { payments = db.prepare('SELECT * FROM sales_commission_payments WHERE sales_agent_id = ? AND deleted_at IS NULL ORDER BY payment_date DESC').all(agentId); }
      else { payments = db.prepare('SELECT scp.*, sca.name as agent_name FROM sales_commission_payments scp JOIN sales_commission_agents sca ON sca.id = scp.sales_agent_id WHERE scp.deleted_at IS NULL ORDER BY scp.payment_date DESC').all(); }
      res.json(payments);
    } catch (error) { next(error); }
  });

  app.post('/api/commissions/payments', requireAuth, requirePermission('commissions', 'pay'), (req, res, next) => {
    try {
      const salesAgentId = numberValue(req.body, 'sales_agent_id', 'Vendedora', { min: 1 });
      const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
      const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
      const currency = currencyValue(req.body, 'currency', 'Moneda');
      const exchangeRateToMxn = currency === 'MXN' ? 1 : numberValue(req.body, 'exchange_rate_to_mxn', 'Tipo de cambio', { min: 0.01 });
      const amountMxn = roundMoney(amountOriginal * exchangeRateToMxn);
      const paymentMethod = optionalText(req.body, 'payment_method');
      const reference = optionalText(req.body, 'reference');
      const notes = optionalText(req.body, 'notes');
      const audit = createdByFields(req);
      const agent = db.prepare('SELECT * FROM sales_commission_agents WHERE id = ? AND deleted_at IS NULL').get(salesAgentId);
      if (!agent) throw badRequest('Vendedora no encontrada.');
      const result = db.prepare('INSERT INTO sales_commission_payments (sales_agent_id, payment_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn, payment_method, reference, notes, created_by_user_id, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(salesAgentId, paymentDate, amountOriginal, currency, exchangeRateToMxn, amountMxn, paymentMethod, reference, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      const payment = db.prepare('SELECT * FROM sales_commission_payments WHERE id = ?').get(result.lastInsertRowid);
      const totalPaidMxn = db.prepare("SELECT COALESCE(SUM(amount_mxn), 0) as total FROM sales_commission_payments WHERE sales_agent_id = ? AND deleted_at IS NULL").get(salesAgentId).total;
      const pendingCommissions = db.prepare("SELECT * FROM sales_commissions WHERE sales_agent_id = ? AND deleted_at IS NULL AND status IN ('pendiente', 'parcial') ORDER BY assigned_at").all(salesAgentId);
      let remaining = totalPaidMxn;
      for (const c of pendingCommissions) {
        if (remaining >= c.commission_amount_mxn) { db.prepare("UPDATE sales_commissions SET status='pagada', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(c.id); remaining -= c.commission_amount_mxn; }
        else if (remaining > 0) { db.prepare("UPDATE sales_commissions SET status='parcial', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(c.id); remaining = 0; }
      }
      logAuditEvent(db, { req, action: 'create', module: 'commissions', entityType: 'sales_commission_payment', entityId: payment.id, entityLabel: `${agent.name} - ${amountMxn} MXN`, after: payment });
      res.status(201).json(payment);
    } catch (error) { next(error); }
  });

  // ===================== ACTIVITY MONITOR MODULE =====================

  app.get('/api/activity-monitor/sessions', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      cleanupInactiveSessions(db);
      const active = db.prepare('SELECT * FROM user_session_activities WHERE is_active = 1 ORDER BY last_activity_at DESC').all();
      res.json(active);
    } catch (error) { next(error); }
  });

  app.get('/api/activity-monitor/weekly-report', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const year = Number(req.query.year) || new Date().getFullYear();
      const week = Number(req.query.week) || Math.ceil((Date.now() - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const startOfYear = new Date(year, 0, 1);
      const weekStart = new Date(startOfYear.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const sessions = db.prepare('SELECT user_id, user_name, role, COUNT(*) as total_sessions, SUM(duration_seconds) as total_seconds, MAX(last_activity_at) as last_activity FROM user_session_activities WHERE login_at >= ? AND login_at < ? GROUP BY user_id ORDER BY total_seconds DESC').all(weekStart.toISOString(), weekEnd.toISOString());
      const deniedAccess = db.prepare("SELECT user_name, COUNT(*) as count FROM audit_logs WHERE action = 'access_denied' AND timestamp_utc >= ? AND timestamp_utc < ? GROUP BY user_name").all(weekStart.toISOString(), weekEnd.toISOString());
      res.json({ year, week, week_start: weekStart.toISOString(), week_end: weekEnd.toISOString(), users: sessions.map(s => ({ ...s, avg_per_day: s.total_seconds ? Math.round(s.total_seconds / 7) : 0 })), denied_access: deniedAccess });
    } catch (error) { next(error); }
  });

  app.get('/api/activity-monitor/recent-sessions', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const sessions = db.prepare('SELECT * FROM user_session_activities ORDER BY login_at DESC LIMIT 50').all();
      res.json({ data: sessions });
    } catch (error) { next(error); }
  });

  app.get('/api/activity-monitor/recent-events', requireAuth, requirePermission('activityMonitor', 'view'), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') return res.status(403).json({ message: 'Solo admin puede ver el monitor.' });
      const events = db.prepare('SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, metadata_json FROM audit_logs ORDER BY id DESC LIMIT 50').all();
      res.json({ data: events });
    } catch (error) { next(error); }
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
