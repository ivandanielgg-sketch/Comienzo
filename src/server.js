require('dotenv').config();

const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { getDb } = require('./db');
const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { createSqliteSessionStore } = require('./sessionStore');
const { calculateVacationEntitlement, calculateBusinessDays, getCompletedYears, getCurrentExerciseYear, calculateVacationBalance, calculateAccruedVacationDays } = require('./vacations');
const {
  parsePaginationParams,
  buildPaginationMeta,
  normalizeSort,
  addSqlFilters,
  buildListResponse,
} = require('./pagination');
const { calculateEcovisAccountSummary, calculateProjectPaidAmountMXN, calculateProjectStatus, calculatePaymentUnallocated, calculatePurchaseOrderBalance, convertToMXN, roundMoney: roundMoneyEcovis, calculateEcovisProjectPaymentStatus } = require('./ecovis');
const { createdByFields, updatedByFields, deletedByFields, logAuditEvent, nowUtc } = require('./audit');
const { formatDateTimeCDMX } = require('./dateHelper');
const { hasPermission, loadUserPermissions, saveUserPermissions, getDefaultPermissionsForRole, MODULES, isAdminOnlyModule } = require('./permissions');
const { registerNewModules, updateSessionActivity, closeSessionActivity } = require("./newModules");
const { ATTENDANCE_STATUSES, VALID_STATUS_CODES, VALID_WEEK_STATUSES, DAY_COLUMNS, calculateWeekRange, calculateAttendanceSummary, generateDefaultAttendance, validateStatusCode, employeeHasOutsideWork } = require('./attendance');

const app = express();
const db = getDb();
const PORT = process.env.PORT || 3000;

const VALID_STATUSES = ['Pendiente', 'En Proceso', 'Terminado'];
const VALID_RISKS = ['Alto', 'Medio', 'Bajo'];
const VALID_EMPLOYEE_FILTERS = ['all', 'active', 'inactive'];
const VALID_ECOVIS_STATUSES = ['pendiente', 'parcialmente_pagado', 'pagado', 'cancelado'];
const VALID_PAYMENT_STATUSES = ['asignado', 'parcial', 'cancelado'];
const VALID_LOAN_STATUSES = ['vigente', 'pagado'];
const VALID_COST_CATEGORIES = [
  'Compra',
  'Gasolina',
  'Casetas',
  'Viaticos',
  'Sueldo',
  'Materiales',
  'Hospedaje',
  'Otros',
];
const VALID_CURRENCIES = ['MXN', 'USD', 'EUR'];
const VALID_REPORT_TYPES = ['boiler_startup', 'general_equipment_service_delivery', 'autoflame_system_startup'];
const REPORT_TYPE_LABELS = {
  boiler_startup: 'FORMATO DE ARRANQUE DE CALDERA',
  general_equipment_service_delivery: 'ENTREGA GENERAL DE EQUIPO/SERVICIO',
  autoflame_system_startup: 'ARRANQUE DE SISTEMA AUTOFLAME',
};
const SESSION_TTL_MS = 1000 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = isProduction || process.env.TRUST_PROXY === 'true';

if (trustProxy) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());
app.use(
  session({
    name: 'proyectos.sid',
    store: createSqliteSessionStore(session, db, { ttlMs: SESSION_TTL_MS }),
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    proxy: trustProxy,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: SESSION_TTL_MS,
    },
  }),
);

app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Necesitas iniciar sesion.' });
  }

  const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.is_active) {
    logAuditEvent(db, { req, action: 'access_denied_inactive', module: 'auth', entityType: 'user', entityId: req.session.userId, entityLabel: req.session.username });
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
  }

  return next();
}

function requireAdminVerified(req, res, next) {
  if (!req.session.adminVerified) {
    return res.status(403).json({ message: 'Se requiere autorizacion del admin.' });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({
      message: 'Acceso restringido. Solo el administrador puede consultar y programar vacaciones.',
    });
  }

  return next();
}

function requireNotTecnico(req, res, next) {
  if (req.session.role === 'tecnico') {
    return res.status(403).json({
      message: 'Acceso restringido. El usuario tecnico no tiene acceso a este modulo.',
    });
  }

  return next();
}

function requirePermission(module, action) {
  return (req, res, next) => {
    const role = req.session.role;
    if (role === 'admin') return next();

    const perms = loadUserPermissions(db, req.session.userId, role);
    if (hasPermission(perms, module, action)) {
      return next();
    }

    logAuditEvent(db, {
      req,
      action: 'access_denied',
      module,
      entityType: 'permission',
      entityLabel: `${module}.${action}`,
      metadata: { required_permission: `${module}.${action}`, endpoint: req.originalUrl, method: req.method },
    });
    return res.status(403).json({
      message: 'Acceso restringido. No tienes permisos para consultar o modificar este apartado.',
    });
  };
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredText(body, field, label) {
  const value = trim(body[field]);
  if (!value) {
    throw badRequest(`${label} es obligatorio.`);
  }

  return value;
}

function optionalText(body, field) {
  const value = trim(body[field]);
  return value || null;
}

function parseDecimal(value) {
  if (typeof value === 'number') {
    return value;
  }

  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return 0;
  }

  const numericValue = rawValue.replace(/[^\d.,-]/g, '');
  const lastDotIndex = numericValue.lastIndexOf('.');
  const lastCommaIndex = numericValue.lastIndexOf(',');
  const decimalSeparator =
    lastDotIndex > lastCommaIndex
      ? '.'
      : lastCommaIndex > lastDotIndex
        ? ','
        : null;

  if (!decimalSeparator) {
    return Number(numericValue);
  }

  const normalizedValue = numericValue
    .split('')
    .filter((character, index) => {
      if (character !== '.' && character !== ',') {
        return true;
      }

      return index === (decimalSeparator === '.' ? lastDotIndex : lastCommaIndex);
    })
    .join('')
    .replace(decimalSeparator, '.');

  return Number(normalizedValue);
}

function numberValue(body, field, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = parseDecimal(body[field]);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw badRequest(`${label} debe ser un numero entre ${min} y ${max}.`);
  }

  return value;
}

function enumValue(body, field, label, validValues) {
  const value = requiredText(body, field, label);
  if (!validValues.includes(value)) {
    throw badRequest(`${label} no es valido.`);
  }

  return value;
}

function currencyValue(body, field, label) {
  const value = trim(body[field]) || 'MXN';
  if (!VALID_CURRENCIES.includes(value)) {
    throw badRequest(`${label} no es valido.`);
  }

  return value;
}

function booleanValue(body, field) {
  return body[field] === true || body[field] === 'true' || body[field] === 1 ? 1 : 0;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeProject(body) {
  const purchaseOrderNotApplicable = booleanValue(body, 'purchase_order_not_applicable');
  const purchaseOrderNumber = purchaseOrderNotApplicable
    ? null
    : requiredText(body, 'purchase_order_number', 'Numero de Orden de Compra');

  return {
    quote_number: requiredText(body, 'quote_number', 'Numero de cotizacion'),
    order_number: requiredText(body, 'order_number', 'Numero de Pedido'),
    purchase_order_number: purchaseOrderNumber,
    purchase_order_not_applicable: purchaseOrderNotApplicable,
    seller: requiredText(body, 'seller', 'Vendedor'),
    client_name: requiredText(body, 'client_name', 'Nombre del Cliente'),
    project_description: requiredText(body, 'project_description', 'Descripcion del proyecto'),
    expected_margin: numberValue(body, 'expected_margin', 'Margen esperado', {
      min: 0,
      max: 100,
    }),
    total_invoiced: numberValue(body, 'total_invoiced', 'Total Facturado', { min: 0 }),
    total_invoiced_currency: currencyValue(
      body,
      'total_invoiced_currency',
      'Moneda del Total Facturado',
    ),
    progress_percent: numberValue(body, 'progress_percent', 'Porcentaje de Avance', {
      min: 0,
      max: 100,
    }),
    technician_name: requiredText(body, 'technician_name', 'Tecnico Responsable'),
    promised_delivery_date: requiredText(
      body,
      'promised_delivery_date',
      'Fecha Prometida de entrega',
    ),
    status: enumValue(body, 'status', 'Estado', VALID_STATUSES),
    risk: enumValue(body, 'risk', 'Riesgo', VALID_RISKS),
    observations: optionalText(body, 'observations'),
  };
}

function normalizePayment(body) {
  return {
    amount: numberValue(body, 'amount', 'Cantidad cobrada', { min: 0.01 }),
    currency: currencyValue(body, 'currency', 'Moneda del pago'),
    payment_date: requiredText(body, 'payment_date', 'Fecha de pago'),
    notes: optionalText(body, 'notes'),
  };
}

function normalizeCost(body) {
  return {
    category: enumValue(body, 'category', 'Categoria', VALID_COST_CATEGORIES),
    description: requiredText(body, 'description', 'Descripcion'),
    amount: numberValue(body, 'amount', 'Importe gastado', { min: 0.01 }),
    currency: currencyValue(body, 'currency', 'Moneda del gasto'),
    cost_date: requiredText(body, 'cost_date', 'Fecha del gasto'),
  };
}

function normalizeUser(body, { requirePassword = false } = {}) {
  const username = requiredText(body, 'username', 'Usuario');
  const password = trim(body.password);

  if (requirePassword && !password) {
    throw badRequest('Contrasena es obligatoria.');
  }

  if (password && password.length < 6) {
    throw badRequest('La contrasena debe tener al menos 6 caracteres.');
  }

  return {
    username,
    password: password || null,
  };
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role || 'user',
    is_active: row.is_active !== undefined ? row.is_active : 1,
    created_at: row.created_at,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at: row.updated_at,
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
  };
}

function getExchangeRates() {
  return db
    .prepare(
      `SELECT currency, rate_to_mxn, updated_at
       FROM exchange_rates
       ORDER BY CASE currency WHEN 'MXN' THEN 1 WHEN 'USD' THEN 2 WHEN 'EUR' THEN 3 ELSE 4 END`,
    )
    .all();
}

function getExchangeRateMap() {
  return getExchangeRates().reduce((rates, row) => {
    rates[row.currency] = row.rate_to_mxn;
    return rates;
  }, { MXN: 1 });
}

function mapExchangeRateState() {
  const rates = getExchangeRates();
  const lastUpdatedAt = rates
    .filter((rate) => rate.currency !== 'MXN')
    .map((rate) => rate.updated_at)
    .sort()
    .at(-1);

  return {
    rates,
    last_updated_at: lastUpdatedAt || null,
  };
}

function mapMoneyEntry(row, exchangeRates) {
  return {
    ...row,
    currency: row.currency || 'MXN',
    amount_mxn: convertAmountToMxn(row.amount, row.currency || 'MXN', exchangeRates),
  };
}

function mapProject(row, exchangeRates = getExchangeRateMap()) {
  if (!row) {
    return null;
  }

  const payments = db
    .prepare('SELECT * FROM project_payments WHERE project_id = ? ORDER BY payment_date DESC, id DESC')
    .all(row.id)
    .map((payment) => mapMoneyEntry(payment, exchangeRates));
  const costs = db
    .prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY cost_date DESC, id DESC')
    .all(row.id)
    .map((cost) => mapMoneyEntry(cost, exchangeRates));
  const normalizedProject = {
    ...row,
    total_invoiced_currency: row.total_invoiced_currency || 'MXN',
  };
  const totals = buildProjectTotals(normalizedProject, payments, costs, exchangeRates);
  const costsWithInvoicePercentage = costs.map((cost) => ({
    ...cost,
    invoice_cost_percentage:
      totals.total_invoiced_mxn > 0
        ? roundMoney(cost.amount_mxn / totals.total_invoiced_mxn)
        : null,
  }));

  return {
    ...normalizedProject,
    purchase_order_display: row.purchase_order_not_applicable
      ? 'No Aplica'
      : row.purchase_order_number,
    payments,
    costs: costsWithInvoicePercentage,
    ...totals,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
    closed_at_cdmx: formatDateTimeCDMX(row.closed_at),
  };
}

function getProjectOrFail(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    const error = new Error('Proyecto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return project;
}

function getUserOrFail(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const error = new Error('Usuario no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return user;
}

function getAdminUserOrFail() {
  const adminUsername = process.env.ADMIN_USER || 'admin';
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);

  if (!user) {
    const error = new Error('Usuario admin no encontrado.');
    error.statusCode = 403;
    throw error;
  }

  return user;
}

function verifyAdminPassword(body) {
  const password = requiredText(body, 'password', 'Contrasena del admin');
  const adminUser = getAdminUserOrFail();

  if (!bcrypt.compareSync(password, adminUser.password_hash)) {
    const error = new Error('La contrasena del admin no es correcta.');
    error.statusCode = 403;
    throw error;
  }

  return adminUser;
}

function verifyActiveUserPassword(req) {
  const password = requiredText(req.body, 'password', 'Contrasena');
  const user = getUserOrFail(req.session.userId);

  if (!bcrypt.compareSync(password, user.password_hash)) {
    const error = new Error('La contrasena no es correcta.');
    error.statusCode = 403;
    throw error;
  }

  return user;
}

function buildWhere({ query, filters, baseWhere = [], search, params = [] }) {
  const whereParts = [...baseWhere];
  const searchParams = [...params];
  if (search && search.columns.length) {
    const pattern = `%${search.value}%`;
    whereParts.push(`(${search.columns.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    searchParams.push(...search.columns.map(() => pattern));
  }
  const filterResult = addSqlFilters(query, filters, whereParts, searchParams);
  return {
    whereClause: filterResult.whereParts.length ? filterResult.whereParts.join(' AND ') : '1=1',
    params: filterResult.params,
    filters: filterResult.activeFilters,
  };
}

function paginateSqlList({ tableSql, countSql, whereClause, params, page, limit, orderBy, map = (row) => row }) {
  const totalRecords = db.prepare(`${countSql} WHERE ${whereClause}`).get(...params).count;
  const pagination = buildPaginationMeta(page, limit, totalRecords);
  const data = db
    .prepare(`${tableSql} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pagination.limit, pagination.offset)
    .map(map);

  return { data, pagination };
}

function applyInMemoryFilters(rows, query, filterDefinitions = {}) {
  return rows.filter((row) => Object.entries(filterDefinitions).every(([key, definition]) => {
    const value = reqValue(query, key);
    const min = reqValue(query, `${key}_min`) || reqValue(query, `${key}_from`);
    const max = reqValue(query, `${key}_max`) || reqValue(query, `${key}_to`);
    const rowValue = row[key];

    if (definition.type === 'text') {
      return !value || String(rowValue ?? '').toLowerCase().includes(String(value).trim().toLowerCase());
    }
    if (definition.type === 'select') {
      return !value || String(rowValue ?? '') === String(value);
    }
    if (definition.type === 'boolean') {
      if (!value) return true;
      const expected = value === 'true' || value === '1';
      return Boolean(rowValue) === expected;
    }
    if (definition.type === 'date') {
      if (value && rowValue !== value) return false;
      if (min && rowValue < min) return false;
      if (max && rowValue > max) return false;
      return true;
    }
    if (definition.type === 'number' || definition.type === 'currency') {
      const numeric = Number(rowValue);
      if (value && numeric !== Number(value)) return false;
      if (min && numeric < Number(min)) return false;
      if (max && numeric > Number(max)) return false;
      return true;
    }
    return true;
  }));
}

function reqValue(query, key) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function collectActiveFilters(query, filterDefinitions = {}) {
  const filters = {};
  Object.keys(filterDefinitions).forEach((key) => {
    [key, `${key}_min`, `${key}_max`, `${key}_from`, `${key}_to`].forEach((filterKey) => {
      const value = reqValue(query, filterKey);
      if (value !== undefined && value !== '') {
        filters[filterKey] = value;
      }
    });
  });
  return filters;
}

function sortRows(rows, sortBy, sortOrder, defaultSort) {
  const direction = sortOrder === 'DESC' ? -1 : 1;
  const selectors = sortBy
    ? [{ key: sortBy, direction }]
    : defaultSort;
  return [...rows].sort((a, b) => {
    for (const selector of selectors) {
      const aValue = a[selector.key];
      const bValue = b[selector.key];
      if (aValue === bValue) continue;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * selector.direction;
      }
      return String(aValue).localeCompare(String(bValue), 'es', { numeric: true }) * selector.direction;
    }
    return 0;
  });
}

const PROJECT_CHARGED_SQL = `(SELECT COALESCE(SUM(pp.amount * COALESCE(er.rate_to_mxn, 1)), 0)
  FROM project_payments pp
  LEFT JOIN exchange_rates er ON COALESCE(pp.currency, 'MXN') = er.currency
  WHERE pp.project_id = p.id)`;
const PROJECT_SPENT_SQL = `(SELECT COALESCE(SUM(pc.amount * COALESCE(er.rate_to_mxn, 1)), 0)
  FROM project_costs pc
  LEFT JOIN exchange_rates er ON COALESCE(pc.currency, 'MXN') = er.currency
  WHERE pc.project_id = p.id)`;
const PROJECT_INVOICED_SQL = `(p.total_invoiced * COALESCE((SELECT rate_to_mxn FROM exchange_rates WHERE currency = COALESCE(p.total_invoiced_currency, 'MXN')), 1))`;
const PROJECT_PENDING_SQL = `(${PROJECT_INVOICED_SQL} - ${PROJECT_CHARGED_SQL})`;
const PROJECT_MARGIN_SQL = `(CASE WHEN ${PROJECT_INVOICED_SQL} > 0 THEN ((${PROJECT_INVOICED_SQL} - ${PROJECT_SPENT_SQL}) / ${PROJECT_INVOICED_SQL}) ELSE 0 END)`;
const PROJECT_SORTS = {
  id: 'p.id',
  quote_number: 'p.quote_number',
  order_number: 'p.order_number',
  purchase_order_number: 'p.purchase_order_number',
  client_name: 'p.client_name',
  project_description: 'p.project_description',
  status: 'p.status',
  risk: 'p.risk',
  seller: 'p.seller',
  technician_name: 'p.technician_name',
  promised_delivery_date: 'p.promised_delivery_date',
  closed_at: 'p.closed_at',
  total_invoiced_mxn: PROJECT_INVOICED_SQL,
  total_charged: PROJECT_CHARGED_SQL,
  spent: PROJECT_SPENT_SQL,
  pending_collection: PROJECT_PENDING_SQL,
  final_margin: PROJECT_MARGIN_SQL,
};
const PROJECT_FILTERS = {
  id: { type: 'number', column: 'p.id' },
  quote_number: { type: 'text', column: 'p.quote_number' },
  order_number: { type: 'text', column: 'p.order_number' },
  purchase_order_number: { type: 'text', column: 'p.purchase_order_number' },
  client_name: { type: 'text', column: 'p.client_name' },
  project_description: { type: 'text', column: 'p.project_description' },
  status: { type: 'select', column: 'p.status', options: VALID_STATUSES },
  risk: { type: 'select', column: 'p.risk', options: VALID_RISKS },
  seller: { type: 'text', column: 'p.seller' },
  technician_name: { type: 'text', column: 'p.technician_name' },
  promised_delivery_date: { type: 'date', column: 'p.promised_delivery_date' },
  closed_at: { type: 'date', column: 'date(p.closed_at)' },
  total_invoiced_mxn: { type: 'currency', column: PROJECT_INVOICED_SQL },
  total_charged: { type: 'currency', column: PROJECT_CHARGED_SQL },
  spent: { type: 'currency', column: PROJECT_SPENT_SQL },
  pending_collection: { type: 'currency', column: PROJECT_PENDING_SQL },
  final_margin: { type: 'number', column: PROJECT_MARGIN_SQL },
};

app.get('/api/session', (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  try { updateSessionActivity(db, req); } catch(e) { /* non-critical */ }
  const pref = db.prepare("SELECT theme_name FROM user_preferences WHERE user_id = ?").get(req.session.userId);
  const perms = loadUserPermissions(db, req.session.userId, req.session.role);
  return res.json({
    authenticated: true,
    user: { id: req.session.userId, username: req.session.username, role: req.session.role || 'user' },
    permissions: perms,
    theme: pref ? pref.theme_name : "default",
  });
});

app.post('/api/login', (req, res, next) => {
  try {
    const username = requiredText(req.body, 'username', 'Usuario');
    const password = requiredText(req.body, 'password', 'Contrasena');
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const now = nowUtc();

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (user && user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      if (lockExpiry > Date.now()) {
        recordLoginAttempt(username, user.id, ipAddress, userAgent, false, 'account_locked', user.locked_until);
        logAuditEvent(db, { req, action: 'login_blocked_locked', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: username, metadata: { locked_until: user.locked_until } });
        throw badRequest('Usuario o contrasena incorrectos.');
      }
      db.prepare('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?').run(user.id);
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      if (user) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        let lockedUntil = null;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
          db.prepare('UPDATE users SET failed_login_attempts = ?, last_failed_login_at = ?, locked_until = ? WHERE id = ?').run(attempts, now, lockedUntil, user.id);
          logAuditEvent(db, { req, action: 'user_locked', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: username, metadata: { attempts, locked_until: lockedUntil } });
        } else {
          db.prepare('UPDATE users SET failed_login_attempts = ?, last_failed_login_at = ? WHERE id = ?').run(attempts, now, user.id);
        }
        recordLoginAttempt(username, user.id, ipAddress, userAgent, false, 'invalid_credentials', lockedUntil);
      } else {
        recordLoginAttempt(username, null, ipAddress, userAgent, false, 'user_not_found', null);
      }
      logAuditEvent(db, { req, action: 'login_failed', module: 'auth', entityType: 'user', entityLabel: username, metadata: { attempted_username: username } });
      throw badRequest('Usuario o contrasena incorrectos.');
    }

    if (!user.is_active) {
      recordLoginAttempt(username, user.id, ipAddress, userAgent, false, 'user_inactive', null);
      logAuditEvent(db, { req, action: 'login_failed_inactive', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: username });
      throw badRequest('Usuario o contrasena incorrectos.');
    }

    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_failed_login_at = NULL WHERE id = ?').run(user.id);
    recordLoginAttempt(username, user.id, ipAddress, userAgent, true, null, null);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role || 'user';
    logAuditEvent(db, { req, action: 'login_success', module: 'auth', entityType: 'user', entityId: user.id, entityLabel: user.username });
    try { updateSessionActivity(db, req); } catch(e) { /* non-critical */ }
    return res.json({ username: user.username, role: user.role || 'user' });
  } catch (error) {
    return next(error);
  }
});

function recordLoginAttempt(userIdentifier, userId, ipAddress, userAgent, success, failureReason, lockedUntil) {
  try {
    db.prepare(
      `INSERT INTO login_attempts (user_identifier, user_id, ip_address, user_agent, success, failure_reason, attempted_at, locked_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(userIdentifier, userId, ipAddress, userAgent, success ? 1 : 0, failureReason, nowUtc(), lockedUntil);
  } catch (err) {
    console.error('Failed to record login attempt:', err.message);
  }
}

app.post('/api/logout', requireAuth, (req, res) => {
  logAuditEvent(db, { req, action: 'logout', module: 'auth', entityType: 'user', entityId: req.session.userId, entityLabel: req.session.username });
  closeSessionActivity(db, req);
  req.session.destroy(() => {
    res.clearCookie('proyectos.sid');
    res.status(204).end();
  });
});

app.post('/api/admin/verify', requireAuth, (req, res, next) => {
  try {
    verifyAdminPassword(req.body);
    req.session.adminVerified = true;
    res.json({ authorized: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/users', requireAuth, requirePermission('users', 'view'), (req, res) => {
  const { page, limit } = parsePaginationParams(req.query);
  const sorting = normalizeSort(
    req.query,
    { id: 'id', username: 'username', created_at: 'created_at' },
    'username ASC',
  );
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'id' },
      username: { type: 'text', column: 'username' },
      created_at: { type: 'date', column: 'date(created_at)' },
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT id, username, role, is_active, created_at, updated_at FROM users',
    countSql: 'SELECT COUNT(*) as count FROM users',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: mapUser,
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.post('/api/users', requireAuth, requirePermission('users', 'create'), (req, res, next) => {
  try {
    const user = normalizeUser(req.body, { requirePassword: true });
    const passwordHash = bcrypt.hashSync(user.password, 12);
    const role = ['admin', 'user', 'tecnico'].includes(trim(req.body.role)) ? trim(req.body.role) : 'user';
    const audit = createdByFields(req);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, role, created_by_user_id, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user.username, passwordHash, role, audit.created_by_user_id, audit.created_by_name, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'users', entityType: 'user', entityId: result.lastInsertRowid, entityLabel: user.username, after: { username: user.username, role } });
    res.status(201).json(mapUser(getUserOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/:id', requireAuth, requirePermission('users', 'edit'), (req, res, next) => {
  try {
    const before = getUserOrFail(req.params.id);
    const user = normalizeUser(req.body);
    const role = ['admin', 'user', 'tecnico'].includes(trim(req.body.role)) ? trim(req.body.role) : undefined;
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : undefined;
    const audit = updatedByFields(req);

    if (user.password) {
      db.prepare('UPDATE users SET username = ?, password_hash = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?').run(
        user.username,
        bcrypt.hashSync(user.password, 12),
        audit.updated_at,
        audit.updated_by_user_id,
        audit.updated_by_name,
        req.params.id,
      );
    } else {
      db.prepare('UPDATE users SET username = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?').run(
        user.username, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);
    }

    if (role) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    }

    if (isActive !== undefined) {
      db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive, req.params.id);
    }

    if (Number(req.session.userId) === Number(req.params.id)) {
      req.session.username = user.username;
      if (role) req.session.role = role;
    }

    logAuditEvent(db, { req, action: 'update', module: 'users', entityType: 'user', entityId: Number(req.params.id), entityLabel: user.username, before: { username: before.username, role: before.role, is_active: before.is_active }, after: { username: user.username, role: role || before.role, is_active: isActive !== undefined ? isActive : before.is_active } });
    res.json(mapUser(getUserOrFail(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/users/:id/permissions', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
  try {
    const user = getUserOrFail(req.params.id);
    const perms = loadUserPermissions(db, user.id, user.role);
    res.json({ userId: user.id, username: user.username, role: user.role, permissions: perms });
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/:id/permissions', requireAuth, requirePermission('users', 'managePermissions'), (req, res, next) => {
  try {
    const user = getUserOrFail(req.params.id);
    const permissions = req.body.permissions;
    if (!permissions || typeof permissions !== 'object') {
      throw badRequest('Permisos invalidos.');
    }
    saveUserPermissions(db, user.id, permissions);
    logAuditEvent(db, { req, action: 'update_permissions', module: 'users', entityType: 'user', entityId: user.id, entityLabel: user.username, after: permissions });
    res.json({ userId: user.id, username: user.username, permissions });
  } catch (error) {
    next(error);
  }
});

app.get('/api/session/permissions', requireAuth, (req, res) => {
  const perms = loadUserPermissions(db, req.session.userId, req.session.role);
  res.json({ permissions: perms, modules: MODULES });
});

app.get('/api/exchange-rates', requireAuth, requirePermission('settings', 'view'), (req, res) => {
  res.json(mapExchangeRateState());
});

app.put('/api/exchange-rates', requireAuth, requirePermission('settings', 'edit'), (req, res, next) => {
  try {
    const payload = req.body.rates || req.body;
    const usdRate = numberValue(payload, 'USD', 'Tipo de cambio USD', {
      min: 0.000001,
      max: 100000,
    });
    const eurRate = numberValue(payload, 'EUR', 'Tipo de cambio EUR', {
      min: 0.000001,
      max: 100000,
    });
    const updateRates = db.transaction(() => {
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate_to_mxn, updated_at)
         VALUES ('MXN', 1, CURRENT_TIMESTAMP)
         ON CONFLICT(currency) DO UPDATE SET rate_to_mxn = 1`,
      ).run();
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate_to_mxn, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(currency) DO UPDATE SET
           rate_to_mxn = excluded.rate_to_mxn,
           updated_at = CURRENT_TIMESTAMP`,
      ).run('USD', usdRate);
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate_to_mxn, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(currency) DO UPDATE SET
           rate_to_mxn = excluded.rate_to_mxn,
           updated_at = CURRENT_TIMESTAMP`,
      ).run('EUR', eurRate);
    });

    updateRates();
    res.json(mapExchangeRateState());
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects', requireAuth, requirePermission('projects', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.promised_delivery_date ASC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: PROJECT_FILTERS,
    baseWhere: ['p.closed_at IS NULL'],
    search: {
      value: search,
      columns: [
        'p.quote_number',
        'p.client_name',
        'p.order_number',
        'p.purchase_order_number',
        'p.seller',
        'p.technician_name',
        'p.project_description',
      ],
    },
  });

  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => mapProject(project, exchangeRates),
  });

  const globalWhereClause = 'p.closed_at IS NULL';
  const totalProjects = db.prepare(`SELECT COUNT(*) as count FROM projects p WHERE ${globalWhereClause}`).get().count;
  const totalCharged = db.prepare(
    `SELECT COALESCE(SUM(pp.amount * COALESCE(er.rate_to_mxn, 1)), 0) as total
     FROM project_payments pp
     LEFT JOIN exchange_rates er ON COALESCE(pp.currency, 'MXN') = er.currency
     JOIN projects p ON p.id = pp.project_id
     WHERE ${globalWhereClause}`,
  ).get().total;

  const totalSpent = db.prepare(
    `SELECT COALESCE(SUM(pc.amount * COALESCE(er.rate_to_mxn, 1)), 0) as total
     FROM project_costs pc
     LEFT JOIN exchange_rates er ON COALESCE(pc.currency, 'MXN') = er.currency
     JOIN projects p ON p.id = pc.project_id
     WHERE ${globalWhereClause}`,
  ).get().total;

  const totalInvoiced = db.prepare(
    `SELECT COALESCE(SUM(p.total_invoiced * COALESCE(er.rate_to_mxn, 1)), 0) as total
     FROM projects p
     LEFT JOIN exchange_rates er ON COALESCE(p.total_invoiced_currency, 'MXN') = er.currency
     WHERE ${globalWhereClause}`,
  ).get().total;

  const summary = {
    totalProjects,
    totalCharged: roundMoney(totalCharged),
    totalSpent: roundMoney(totalSpent),
    totalPending: roundMoney(totalInvoiced - totalCharged),
  };

  res.json(buildListResponse(result.data, result.pagination, sorting, filters, { summary }));
});

app.get('/api/closed-projects', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.closed_at DESC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: PROJECT_FILTERS,
    baseWhere: ['p.closed_at IS NOT NULL'],
    search: {
      value: search,
      columns: [
        'p.quote_number',
        'p.client_name',
        'p.order_number',
        'p.purchase_order_number',
        'p.seller',
        'p.technician_name',
        'p.project_description',
      ],
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => mapProject(project, exchangeRates),
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/projects/:id', requireAuth, requirePermission('projects', 'view'), (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    res.json(mapProject(project, getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects', requireAuth, requirePermission('projects', 'create'), (req, res, next) => {
  try {
    const project = normalizeProject(req.body);
    const audit = createdByFields(req);
    const result = db
      .prepare(
        `INSERT INTO projects (
          quote_number,
          order_number,
          purchase_order_number,
          purchase_order_not_applicable,
          seller,
          client_name,
          project_description,
          expected_margin,
          total_invoiced,
          total_invoiced_currency,
          progress_percent,
          technician_name,
          promised_delivery_date,
          status,
          risk,
          observations,
          created_at,
          updated_at,
          created_by_user_id,
          created_by_name
        ) VALUES (
          @quote_number,
          @order_number,
          @purchase_order_number,
          @purchase_order_not_applicable,
          @seller,
          @client_name,
          @project_description,
          @expected_margin,
          @total_invoiced,
          @total_invoiced_currency,
          @progress_percent,
          @technician_name,
          @promised_delivery_date,
          @status,
          @risk,
          @observations,
          @created_at,
          @updated_at,
          @created_by_user_id,
          @created_by_name
        )`,
      )
      .run({ ...project, created_at: audit.created_at, updated_at: audit.created_at, created_by_user_id: audit.created_by_user_id, created_by_name: audit.created_by_name });

    logAuditEvent(db, { req, action: 'create', module: 'projects', entityType: 'project', entityId: result.lastInsertRowid, entityLabel: project.quote_number, after: project });
    res.status(201).json(mapProject(getProjectOrFail(result.lastInsertRowid), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.put('/api/projects/:id', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    const before = getProjectOrFail(req.params.id);
    const project = normalizeProject(req.body);
    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE projects SET
        quote_number = @quote_number,
        order_number = @order_number,
        purchase_order_number = @purchase_order_number,
        purchase_order_not_applicable = @purchase_order_not_applicable,
        seller = @seller,
        client_name = @client_name,
        project_description = @project_description,
        expected_margin = @expected_margin,
        total_invoiced = @total_invoiced,
        total_invoiced_currency = @total_invoiced_currency,
        progress_percent = @progress_percent,
        technician_name = @technician_name,
        promised_delivery_date = @promised_delivery_date,
        status = @status,
        risk = @risk,
        observations = @observations,
        updated_at = @updated_at,
        updated_by_user_id = @updated_by_user_id,
        updated_by_name = @updated_by_name
      WHERE id = @id`,
    ).run({ ...project, id: req.params.id, ...audit });

    logAuditEvent(db, { req, action: 'update', module: 'projects', entityType: 'project', entityId: Number(req.params.id), entityLabel: project.quote_number, before, after: project });
    res.json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:id', requireAuth, requirePermission('projects', 'close'), (req, res, next) => {
  try {
    const before = getProjectOrFail(req.params.id);
    verifyAdminPassword(req.body);
    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE projects
       SET closed_at = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ?
       WHERE id = ? AND closed_at IS NULL`,
    ).run(audit.updated_at, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, Number(req.params.id));
    logAuditEvent(db, { req, action: 'close', module: 'projects', entityType: 'project', entityId: Number(req.params.id), entityLabel: before.quote_number, before: { closed_at: null }, after: { closed_at: audit.updated_at } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/closed-projects/:id', requireAuth, requirePermission('closedProjects', 'delete'), (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    if (!project.closed_at) {
      throw badRequest('El proyecto aun no esta cerrado.');
    }

    verifyAdminPassword(req.body);
    db.prepare('DELETE FROM projects WHERE id = ? AND closed_at IS NOT NULL').run(req.params.id);
    logAuditEvent(db, { req, action: 'delete', module: 'projects', entityType: 'project', entityId: Number(req.params.id), entityLabel: project.quote_number, before: project });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/payments', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const payment = normalizePayment(req.body);
    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO project_payments (project_id, amount, currency, payment_date, notes, created_at, created_by_user_id, created_by_name)
       VALUES (@project_id, @amount, @currency, @payment_date, @notes, @created_at, @created_by_user_id, @created_by_name)`,
    ).run({ ...payment, project_id: req.params.id, ...audit });

    logAuditEvent(db, { req, action: 'create', module: 'payments', entityType: 'project_payment', entityId: result.lastInsertRowid, entityLabel: `Pago ${payment.amount} ${payment.currency}`, after: payment });
    res.status(201).json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId/payments/:paymentId', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.projectId);
    verifyAdminPassword(req.body);
    const before = db.prepare('SELECT * FROM project_payments WHERE id = ? AND project_id = ?').get(req.params.paymentId, req.params.projectId);
    db.prepare('DELETE FROM project_payments WHERE id = ? AND project_id = ?').run(
      req.params.paymentId,
      req.params.projectId,
    );
    logAuditEvent(db, { req, action: 'delete', module: 'payments', entityType: 'project_payment', entityId: Number(req.params.paymentId), entityLabel: before ? `Pago ${before.amount}` : null, before });
    res.json(mapProject(getProjectOrFail(req.params.projectId), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/costs', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const cost = normalizeCost(req.body);
    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO project_costs (project_id, category, description, amount, currency, cost_date, created_at, created_by_user_id, created_by_name)
       VALUES (@project_id, @category, @description, @amount, @currency, @cost_date, @created_at, @created_by_user_id, @created_by_name)`,
    ).run({ ...cost, project_id: req.params.id, ...audit });

    logAuditEvent(db, { req, action: 'create', module: 'costs', entityType: 'project_cost', entityId: result.lastInsertRowid, entityLabel: `${cost.category} ${cost.amount}`, after: cost });
    res.status(201).json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId/costs/:costId', requireAuth, requirePermission('projects', 'edit'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.projectId);
    verifyAdminPassword(req.body);
    const before = db.prepare('SELECT * FROM project_costs WHERE id = ? AND project_id = ?').get(req.params.costId, req.params.projectId);
    db.prepare('DELETE FROM project_costs WHERE id = ? AND project_id = ?').run(
      req.params.costId,
      req.params.projectId,
    );
    logAuditEvent(db, { req, action: 'delete', module: 'costs', entityType: 'project_cost', entityId: Number(req.params.costId), entityLabel: before ? `${before.category} ${before.amount}` : null, before });
    res.json(mapProject(getProjectOrFail(req.params.projectId), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

// ===================== REPORTS MODULE =====================

function generateReportFolio(projectId) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const existing = db.prepare(
    'SELECT COUNT(*) as count FROM project_reports WHERE project_id = ?',
  ).get(projectId);
  const counter = (existing.count || 0) + 1;
  return `REP-${projectId}-${dateStr}-${String(counter).padStart(3, '0')}`;
}

app.get('/api/reports/projects', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const reportCountSql = '(SELECT COUNT(*) FROM project_reports WHERE project_id = p.id AND deleted_at IS NULL)';
  const sorting = normalizeSort(req.query, {
    ...PROJECT_SORTS,
    report_count: reportCountSql,
  }, 'p.status ASC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: { ...req.query, status: req.query.status || status },
    filters: {
      ...PROJECT_FILTERS,
      report_count: { type: 'number', column: reportCountSql },
    },
    baseWhere: ['p.closed_at IS NULL'],
    search: {
      value: search,
      columns: ['p.client_name', 'p.project_description', 'p.quote_number', 'p.order_number', 'p.purchase_order_number'],
    },
  });

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM projects p WHERE ${whereClause}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const rows = db.prepare(
    `SELECT p.*, ${reportCountSql} as report_count
     FROM projects p
     WHERE ${whereClause}
     ORDER BY ${sorting.orderBy}
     LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = rows.map((row) => ({
    id: row.id,
    quote_number: row.quote_number,
    order_number: row.order_number,
    client_name: row.client_name,
    project_description: row.project_description,
    status: row.status,
    closed_at: row.closed_at,
    report_count: row.report_count,
  }));

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.get('/api/reports', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const reports = db.prepare(
    `SELECT r.*, p.quote_number, p.order_number, p.client_name AS project_client,
            p.project_description, p.status AS project_status, p.closed_at
     FROM project_reports r
     JOIN projects p ON r.project_id = p.id
     ORDER BY r.created_at DESC`,
  ).all();
  res.json(reports);
});

app.get('/api/projects/:id/reports', requireAuth, requirePermission('reports', 'view'), (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const { page, limit, search } = parsePaginationParams(req.query);
    const sorting = normalizeSort(req.query, {
      id: 'id',
      report_folio: 'report_folio',
      report_date: 'report_date',
      service_name: 'service_name',
      technician_name: 'technician_name',
      created_at: 'created_at',
    }, 'created_at DESC');
    const { whereClause, params, filters } = buildWhere({
      query: req.query,
      filters: {
        id: { type: 'number', column: 'id' },
        report_folio: { type: 'text', column: 'report_folio' },
        report_date: { type: 'date', column: 'report_date' },
        service_name: { type: 'text', column: 'service_name' },
        technician_name: { type: 'text', column: 'technician_name' },
        created_at: { type: 'date', column: 'date(created_at)' },
      },
      baseWhere: ['project_id = ?', 'deleted_at IS NULL'],
      params: [req.params.id],
      search: {
        value: search,
        columns: ['report_folio', 'service_name', 'technician_name', 'client_name'],
      },
    });
    const result = paginateSqlList({
      tableSql: 'SELECT * FROM project_reports',
      countSql: 'SELECT COUNT(*) as count FROM project_reports',
      whereClause,
      params,
      page,
      limit,
      orderBy: sorting.orderBy,
    });

    res.json(buildListResponse(result.data, result.pagination, sorting, filters));
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/:id', requireAuth, requirePermission('reports', 'view'), (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(report.project_id);
    res.json({ ...report, project });
  } catch (error) {
    next(error);
  }
});

app.post('/api/reports', requireAuth, requirePermission('reports', 'create'), (req, res, next) => {
  try {
    const projectId = req.body.project_id;
    if (!projectId) {
      throw badRequest('El proyecto es obligatorio.');
    }
    getProjectOrFail(projectId);

    const reportType = trim(req.body.report_type) || 'boiler_startup';
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      throw badRequest('Tipo de reporte no valido.');
    }

    const clientName = requiredText(req.body, 'client_name', 'Cliente');
    const serviceName = requiredText(req.body, 'service_name', 'Nombre de servicio');
    const reportDate = requiredText(req.body, 'report_date', 'Fecha del reporte');

    if (reportType === 'general_equipment_service_delivery') {
      requiredText(req.body, 'assigned_technicians', 'Tecnico asignado');
      const reportData = req.body.report_data || {};
      if (!reportData.activity_description || !String(reportData.activity_description).trim()) {
        throw badRequest('Descripcion de Actividades es obligatorio.');
      }
    }

    if (reportType === 'autoflame_system_startup') {
      const reportData = req.body.report_data || {};
      if (!reportData.site_name || !String(reportData.site_name).trim()) {
        throw badRequest('Sitio / planta es obligatorio.');
      }
      requiredText(req.body, 'assigned_technicians', 'Tecnico / ingeniero responsable');
    }

    let reportFolio = trim(req.body.report_folio);
    if (!reportFolio) {
      reportFolio = generateReportFolio(projectId);
    }

    const existing = db.prepare('SELECT id FROM project_reports WHERE report_folio = ?').get(reportFolio);
    if (existing) {
      throw badRequest('El folio de reporte ya existe. Usa un folio diferente.');
    }

    const safetyTests = req.body.safety_tests ? JSON.stringify(req.body.safety_tests) : null;
    const emissionsLow = req.body.emissions_low_fire ? JSON.stringify(req.body.emissions_low_fire) : null;
    const emissionsHigh = req.body.emissions_high_fire ? JSON.stringify(req.body.emissions_high_fire) : null;
    const reportData = req.body.report_data ? JSON.stringify(req.body.report_data) : null;

    const result = db.prepare(
      `INSERT INTO project_reports (
        project_id, report_folio, report_type, client_name, client_address, service_name,
        report_date, assigned_technicians, burner_model, equipment_model_serial,
        pumps_motors_model, fuel, voltage, gas_pressure_inh2o, liquid_fuel_pressure_psi,
        working_pressure, pump_amperage, fan_amperage, condensate_tank_temp_c,
        operating_output_temp_c, flue_gas_temp_c, safety_tests, comments,
        emissions_low_fire, emissions_high_fire, technician_name, plant_manager_name,
        report_data, created_by, updated_by, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (
        @project_id, @report_folio, @report_type, @client_name, @client_address, @service_name,
        @report_date, @assigned_technicians, @burner_model, @equipment_model_serial,
        @pumps_motors_model, @fuel, @voltage, @gas_pressure_inh2o, @liquid_fuel_pressure_psi,
        @working_pressure, @pump_amperage, @fan_amperage, @condensate_tank_temp_c,
        @operating_output_temp_c, @flue_gas_temp_c, @safety_tests, @comments,
        @emissions_low_fire, @emissions_high_fire, @technician_name, @plant_manager_name,
        @report_data, @created_by, @updated_by, @created_by_user_id, @updated_by_user_id, @created_at, @updated_at
      )`,
    ).run({
      project_id: projectId,
      report_folio: reportFolio,
      report_type: reportType,
      client_name: clientName,
      client_address: optionalText(req.body, 'client_address'),
      service_name: serviceName,
      report_date: reportDate,
      assigned_technicians: optionalText(req.body, 'assigned_technicians'),
      burner_model: optionalText(req.body, 'burner_model'),
      equipment_model_serial: optionalText(req.body, 'equipment_model_serial'),
      pumps_motors_model: optionalText(req.body, 'pumps_motors_model'),
      fuel: optionalText(req.body, 'fuel'),
      voltage: optionalText(req.body, 'voltage'),
      gas_pressure_inh2o: optionalText(req.body, 'gas_pressure_inh2o'),
      liquid_fuel_pressure_psi: optionalText(req.body, 'liquid_fuel_pressure_psi'),
      working_pressure: optionalText(req.body, 'working_pressure'),
      pump_amperage: optionalText(req.body, 'pump_amperage'),
      fan_amperage: optionalText(req.body, 'fan_amperage'),
      condensate_tank_temp_c: optionalText(req.body, 'condensate_tank_temp_c'),
      operating_output_temp_c: optionalText(req.body, 'operating_output_temp_c'),
      flue_gas_temp_c: optionalText(req.body, 'flue_gas_temp_c'),
      safety_tests: safetyTests,
      comments: optionalText(req.body, 'comments'),
      emissions_low_fire: emissionsLow,
      emissions_high_fire: emissionsHigh,
      technician_name: optionalText(req.body, 'technician_name'),
      plant_manager_name: optionalText(req.body, 'plant_manager_name'),
      report_data: reportData,
      created_by: req.session.username,
      updated_by: req.session.username,
      created_by_user_id: req.session.userId,
      updated_by_user_id: req.session.userId,
      created_at: nowUtc(),
      updated_at: nowUtc(),
    });

    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(result.lastInsertRowid);
    logAuditEvent(db, { req, action: 'create', module: 'reports', entityType: 'project_report', entityId: result.lastInsertRowid, entityLabel: reportFolio });
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

app.put('/api/reports/:id', requireAuth, requirePermission('reports', 'edit'), (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    if (report.deleted_at) {
      if (req.session.role !== 'admin') {
        throw badRequest('Acceso restringido. Solo el administrador puede modificar reportes archivados.');
      }
    }

    const clientName = requiredText(req.body, 'client_name', 'Cliente');
    const serviceName = requiredText(req.body, 'service_name', 'Nombre de servicio');
    const reportDate = requiredText(req.body, 'report_date', 'Fecha del reporte');

    const safetyTests = req.body.safety_tests ? JSON.stringify(req.body.safety_tests) : null;
    const emissionsLow = req.body.emissions_low_fire ? JSON.stringify(req.body.emissions_low_fire) : null;
    const emissionsHigh = req.body.emissions_high_fire ? JSON.stringify(req.body.emissions_high_fire) : null;
    const reportData = req.body.report_data ? JSON.stringify(req.body.report_data) : report.report_data;

    const auditUpdate = updatedByFields(req);
    db.prepare(
      `UPDATE project_reports SET
        client_name = @client_name, client_address = @client_address,
        service_name = @service_name, report_date = @report_date,
        assigned_technicians = @assigned_technicians, burner_model = @burner_model,
        equipment_model_serial = @equipment_model_serial, pumps_motors_model = @pumps_motors_model,
        fuel = @fuel, voltage = @voltage, gas_pressure_inh2o = @gas_pressure_inh2o,
        liquid_fuel_pressure_psi = @liquid_fuel_pressure_psi, working_pressure = @working_pressure,
        pump_amperage = @pump_amperage, fan_amperage = @fan_amperage,
        condensate_tank_temp_c = @condensate_tank_temp_c, operating_output_temp_c = @operating_output_temp_c,
        flue_gas_temp_c = @flue_gas_temp_c, safety_tests = @safety_tests, comments = @comments,
        emissions_low_fire = @emissions_low_fire, emissions_high_fire = @emissions_high_fire,
        technician_name = @technician_name, plant_manager_name = @plant_manager_name,
        report_data = @report_data, updated_by = @updated_by, updated_by_user_id = @updated_by_user_id, updated_at = @updated_at
      WHERE id = @id`,
    ).run({
      id: req.params.id,
      client_name: clientName,
      client_address: optionalText(req.body, 'client_address'),
      service_name: serviceName,
      report_date: reportDate,
      assigned_technicians: optionalText(req.body, 'assigned_technicians'),
      burner_model: optionalText(req.body, 'burner_model'),
      equipment_model_serial: optionalText(req.body, 'equipment_model_serial'),
      pumps_motors_model: optionalText(req.body, 'pumps_motors_model'),
      fuel: optionalText(req.body, 'fuel'),
      voltage: optionalText(req.body, 'voltage'),
      gas_pressure_inh2o: optionalText(req.body, 'gas_pressure_inh2o'),
      liquid_fuel_pressure_psi: optionalText(req.body, 'liquid_fuel_pressure_psi'),
      working_pressure: optionalText(req.body, 'working_pressure'),
      pump_amperage: optionalText(req.body, 'pump_amperage'),
      fan_amperage: optionalText(req.body, 'fan_amperage'),
      condensate_tank_temp_c: optionalText(req.body, 'condensate_tank_temp_c'),
      operating_output_temp_c: optionalText(req.body, 'operating_output_temp_c'),
      flue_gas_temp_c: optionalText(req.body, 'flue_gas_temp_c'),
      safety_tests: safetyTests,
      comments: optionalText(req.body, 'comments'),
      emissions_low_fire: emissionsLow,
      emissions_high_fire: emissionsHigh,
      technician_name: optionalText(req.body, 'technician_name'),
      plant_manager_name: optionalText(req.body, 'plant_manager_name'),
      report_data: reportData,
      updated_by: req.session.username,
      updated_by_user_id: req.session.userId,
      updated_at: auditUpdate.updated_at,
    });

    const updated = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    logAuditEvent(db, { req, action: 'update', module: 'reports', entityType: 'project_report', entityId: Number(req.params.id), entityLabel: report.report_folio, before: report });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ===================== REPORT ARCHIVE & NEW ENDPOINTS =====================

app.get('/api/report-types', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  res.json(Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({ value, label })));
});

app.get('/api/reports/active', requireAuth, requirePermission('reports', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const sorting = normalizeSort(req.query, {
    id: 'r.id',
    report_folio: 'r.report_folio',
    report_date: 'r.report_date',
    report_type: 'r.report_type',
    service_name: 'r.service_name',
    client_name: 'r.client_name',
    technician_name: 'r.technician_name',
    created_at: 'r.created_at',
  }, 'r.created_at DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      report_type: { type: 'select', column: 'r.report_type', options: VALID_REPORT_TYPES },
      client_name: { type: 'text', column: 'r.client_name' },
      technician_name: { type: 'text', column: 'r.assigned_technicians' },
      report_date: { type: 'date', column: 'r.report_date' },
    },
    baseWhere: ['p.closed_at IS NULL', 'r.deleted_at IS NULL'],
    search: {
      value: search,
      columns: ['r.report_folio', 'r.client_name', 'r.service_name', 'r.assigned_technicians', 'p.project_description'],
    },
  });

  const tableSql = `SELECT r.*, p.project_description, p.quote_number, p.status AS project_status
    FROM project_reports r JOIN projects p ON r.project_id = p.id`;
  const countSql = `SELECT COUNT(*) as count FROM project_reports r JOIN projects p ON r.project_id = p.id`;
  const result = paginateSqlList({ tableSql, countSql, whereClause, params, page, limit, orderBy: sorting.orderBy });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/reports/archive/clients', requireAuth, requirePermission('reportsArchive', 'view'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  let sql = `
    SELECT p.client_name,
      COUNT(DISTINCT p.id) as closed_projects_count,
      COUNT(r.id) as reports_count,
      MAX(r.report_date) as last_report_date
    FROM projects p
    JOIN project_reports r ON r.project_id = p.id
    WHERE p.closed_at IS NOT NULL AND r.deleted_at IS NULL
  `;
  const params = [];
  if (search) {
    sql += ' AND p.client_name LIKE ?';
    params.push(`%${search}%`);
  }
  sql += ' GROUP BY p.client_name ORDER BY last_report_date DESC';
  const clients = db.prepare(sql).all(...params);
  res.json({ data: clients });
});

app.get('/api/reports/archive/client/:clientName', requireAuth, requirePermission('reportsArchive', 'view'), (req, res) => {
  const clientName = decodeURIComponent(req.params.clientName);
  const { page, limit, search } = parsePaginationParams(req.query);
  const sorting = normalizeSort(req.query, {
    id: 'r.id',
    report_folio: 'r.report_folio',
    report_date: 'r.report_date',
    report_type: 'r.report_type',
    service_name: 'r.service_name',
    technician_name: 'r.technician_name',
    created_at: 'r.created_at',
  }, 'r.report_date DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      report_type: { type: 'select', column: 'r.report_type', options: VALID_REPORT_TYPES },
      report_date: { type: 'date', column: 'r.report_date' },
    },
    baseWhere: ['p.closed_at IS NOT NULL', 'r.deleted_at IS NULL', 'p.client_name = ?'],
    params: [clientName],
    search: {
      value: search,
      columns: ['r.report_folio', 'r.service_name', 'r.assigned_technicians', 'p.project_description'],
    },
  });

  const tableSql = `SELECT r.*, p.project_description, p.quote_number, p.order_number, p.closed_at AS project_closed_at
    FROM project_reports r JOIN projects p ON r.project_id = p.id`;
  const countSql = `SELECT COUNT(*) as count FROM project_reports r JOIN projects p ON r.project_id = p.id`;
  const result = paginateSqlList({ tableSql, countSql, whereClause, params, page, limit, orderBy: sorting.orderBy });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.delete('/api/reports/:id', requireAuth, requirePermission('reports', 'delete'), (req, res, next) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({
        message: 'Acceso restringido. Solo el administrador puede modificar o eliminar reportes archivados.',
      });
    }
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const reason = requiredText(req.body, 'delete_reason', 'Motivo de eliminacion');
    const auditDel = deletedByFields(req);
    db.prepare(
      `UPDATE project_reports SET deleted_at = ?, deleted_by = ?, deleted_by_user_id = ?, delete_reason = ? WHERE id = ?`,
    ).run(auditDel.deleted_at, req.session.username, auditDel.deleted_by_user_id, reason, req.params.id);
    logAuditEvent(db, { req, action: 'soft_delete', module: 'reports', entityType: 'project_report', entityId: Number(req.params.id), entityLabel: report.report_folio, metadata: { reason } });
    res.json({ message: 'Reporte eliminado logicamente.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/closed-projects/by-client', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const exchangeRates = getExchangeRateMap();
  let sql = `
    SELECT p.client_name,
      COUNT(*) as projects_count,
      MAX(p.closed_at) as last_closed_at,
      SUM(p.total_invoiced * COALESCE((SELECT rate_to_mxn FROM exchange_rates WHERE currency = COALESCE(p.total_invoiced_currency, 'MXN')), 1)) as total_invoiced_mxn
    FROM projects p
    WHERE p.closed_at IS NOT NULL
  `;
  const params = [];
  if (search) {
    sql += ' AND p.client_name LIKE ?';
    params.push(`%${search}%`);
  }
  sql += ' GROUP BY p.client_name ORDER BY last_closed_at DESC';
  const clients = db.prepare(sql).all(...params);
  res.json({ data: clients });
});

app.get('/api/closed-projects/client/:clientName', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const clientName = decodeURIComponent(req.params.clientName);
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.closed_at DESC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: PROJECT_FILTERS,
    baseWhere: ['p.closed_at IS NOT NULL', 'p.client_name = ?'],
    params: [clientName],
    search: {
      value: search,
      columns: ['p.quote_number', 'p.order_number', 'p.project_description', 'p.technician_name'],
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => ({
      ...mapProject(project, exchangeRates),
      report_count: db.prepare('SELECT COUNT(*) as count FROM project_reports WHERE project_id = ? AND deleted_at IS NULL').get(project.id).count,
    }),
  });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/closed-projects/date-range', requireAuth, requirePermission('closedProjects', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const exchangeRates = getExchangeRateMap();
  const sorting = normalizeSort(req.query, PROJECT_SORTS, 'p.closed_at DESC, p.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      ...PROJECT_FILTERS,
      closed_at: { type: 'date', column: 'date(p.closed_at)' },
    },
    baseWhere: ['p.closed_at IS NOT NULL'],
    search: {
      value: search,
      columns: ['p.quote_number', 'p.client_name', 'p.order_number', 'p.project_description', 'p.technician_name'],
    },
  });
  const result = paginateSqlList({
    tableSql: 'SELECT p.* FROM projects p',
    countSql: 'SELECT COUNT(*) as count FROM projects p',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (project) => mapProject(project, exchangeRates),
  });
  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

// ===================== END REPORTS MODULE =====================

// ===================== VACATION MODULE =====================

const VALID_VACATION_STATUSES = ['programada', 'tomada', 'cancelada'];

function getEmployeeOrFail(employeeId) {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!employee) {
    const error = new Error('Empleado no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return employee;
}

function mapEmployee(row) {
  const today = new Date().toISOString().slice(0, 10);
  const referenceDate = row.active ? today : (row.termination_date || today);
  const completedYears = getCompletedYears(new Date(row.hire_date), new Date(referenceDate));
  const accruedDays = calculateAccruedVacationDays(row.hire_date, referenceDate);

  const allRequests = db.prepare(
    'SELECT * FROM vacation_requests WHERE employee_id = ?',
  ).all(row.id);

  const activeRequests = allRequests.filter((r) => r.status !== 'cancelada');
  const daysTaken = activeRequests
    .filter((r) => r.status === 'tomada')
    .reduce((sum, r) => sum + r.requested_days, 0);
  const daysScheduled = activeRequests
    .filter((r) => r.status === 'programada')
    .reduce((sum, r) => sum + r.requested_days, 0);
  const daysAvailable = accruedDays - daysTaken - daysScheduled;

  return {
    ...row,
    seniority_years: completedYears,
    accrued_days: accruedDays,
    days_taken: daysTaken,
    days_scheduled: daysScheduled,
    days_pending: daysAvailable,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
  };
}

function checkOverlap(employeeId, startDate, endDate, excludeRequestId) {
  let query = `SELECT id FROM vacation_requests
    WHERE employee_id = ? AND status != 'cancelada'
    AND start_date <= ? AND end_date >= ?`;
  const params = [employeeId, endDate, startDate];

  if (excludeRequestId) {
    query += ' AND id != ?';
    params.push(excludeRequestId);
  }

  return db.prepare(query).get(...params);
}

app.get('/api/employees', requireAuth, requirePermission('vacations', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const activeFilter = typeof req.query.activeFilter === 'string' ? req.query.activeFilter.trim() : 'all';
  const safeActiveFilter = VALID_EMPLOYEE_FILTERS.includes(activeFilter) ? activeFilter : 'all';
  const sorting = normalizeSort(req.query, {
    id: 'id',
    employee_number: 'employee_number',
    full_name: 'full_name',
    hire_date: 'hire_date',
    active: 'active',
    termination_date: 'termination_date',
    seniority_years: 'seniority_years',
    accrued_days: 'accrued_days',
    days_taken: 'days_taken',
    days_scheduled: 'days_scheduled',
    days_pending: 'days_pending',
  }, 'active DESC, full_name ASC');
  const dbFilters = {
    id: { type: 'number', column: 'id' },
    employee_number: { type: 'text', column: 'employee_number' },
    full_name: { type: 'text', column: 'full_name' },
    hire_date: { type: 'date', column: 'hire_date' },
    active: { type: 'boolean', column: 'active' },
    termination_date: { type: 'date', column: 'termination_date' },
  };
  const baseWhere = [];
  if (safeActiveFilter === 'active') {
    baseWhere.push('active = 1');
  } else if (safeActiveFilter === 'inactive') {
    baseWhere.push('active = 0');
  }
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: dbFilters,
    baseWhere,
    search: { value: search, columns: ['employee_number', 'full_name'] },
  });
  const allEmployees = db.prepare(`SELECT * FROM employees WHERE ${whereClause}`).all(...params).map(mapEmployee);
  const employeeFilters = {
    ...dbFilters,
    seniority_years: { type: 'number' },
    accrued_days: { type: 'number' },
    days_taken: { type: 'number' },
    days_scheduled: { type: 'number' },
    days_pending: { type: 'number' },
  };
  const filteredEmployees = applyInMemoryFilters(allEmployees, req.query, employeeFilters);
  const selectors = sorting.sortBy
    ? [
        ...(safeActiveFilter === 'inactive' ? [] : [{ key: 'active', direction: -1 }]),
        { key: sorting.sortBy, direction: sorting.sortOrder === 'DESC' ? -1 : 1 },
      ]
    : [{ key: 'active', direction: -1 }, { key: 'full_name', direction: 1 }];
  const sortedEmployees = sortRows(filteredEmployees, '', 'ASC', selectors);
  const pag = buildPaginationMeta(page, limit, sortedEmployees.length);
  const data = sortedEmployees.slice(pag.offset, pag.offset + pag.limit);

  res.json(buildListResponse(data, pag, sorting, { ...filters, ...collectActiveFilters(req.query, employeeFilters), activeFilter: safeActiveFilter }));
});

app.get('/api/employees/:id', requireAuth, requirePermission('vacations', 'view'), (req, res, next) => {
  try {
    const employee = getEmployeeOrFail(req.params.id);
    res.json(mapEmployee(employee));
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees', requireAuth, requirePermission('vacations', 'create'), (req, res, next) => {
  try {
    const employeeNumber = requiredText(req.body, 'employee_number', 'Numero de empleado');
    const fullName = requiredText(req.body, 'full_name', 'Nombre completo');
    const hireDate = requiredText(req.body, 'hire_date', 'Fecha de ingreso');
    const department = optionalText(req.body, 'department');
    const position = optionalText(req.body, 'position');
    const immediateBoss = optionalText(req.body, 'immediate_boss');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    let terminationDate = optionalText(req.body, 'termination_date');
    const inactiveReason = optionalText(req.body, 'inactive_reason');

    if (!active) {
      if (!terminationDate) {
        throw badRequest('La fecha de baja es obligatoria para empleados inactivos.');
      }
      if (new Date(terminationDate) < new Date(hireDate)) {
        throw badRequest('La fecha de baja no puede ser anterior a la fecha de ingreso.');
      }
    } else {
      terminationDate = null;
    }

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO employees (employee_number, full_name, hire_date, department, position, immediate_boss, active, termination_date, inactive_reason, created_at, updated_at, created_by_user_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(employeeNumber, fullName, hireDate, department, position, immediateBoss, active, terminationDate, inactiveReason, audit.created_at, audit.created_at, audit.created_by_user_id, audit.created_by_name);

    logAuditEvent(db, { req, action: 'create', module: 'employees', entityType: 'employee', entityId: result.lastInsertRowid, entityLabel: fullName });
    res.status(201).json(mapEmployee(getEmployeeOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/employees/:id', requireAuth, requirePermission('vacations', 'edit'), (req, res, next) => {
  try {
    const before = getEmployeeOrFail(req.params.id);
    const employeeNumber = requiredText(req.body, 'employee_number', 'Numero de empleado');
    const fullName = requiredText(req.body, 'full_name', 'Nombre completo');
    const hireDate = requiredText(req.body, 'hire_date', 'Fecha de ingreso');
    const department = optionalText(req.body, 'department');
    const position = optionalText(req.body, 'position');
    const immediateBoss = optionalText(req.body, 'immediate_boss');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    let terminationDate = optionalText(req.body, 'termination_date');
    const inactiveReason = optionalText(req.body, 'inactive_reason');

    if (!active) {
      if (!terminationDate) {
        throw badRequest('La fecha de baja es obligatoria para empleados inactivos.');
      }
      if (new Date(terminationDate) < new Date(hireDate)) {
        throw badRequest('La fecha de baja no puede ser anterior a la fecha de ingreso.');
      }
    } else {
      terminationDate = null;
    }

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE employees SET
        employee_number = ?, full_name = ?, hire_date = ?, department = ?,
        position = ?, immediate_boss = ?, active = ?,
        termination_date = ?, inactive_reason = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ?
       WHERE id = ?`,
    ).run(employeeNumber, fullName, hireDate, department, position, immediateBoss, active, terminationDate, inactiveReason, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);

    logAuditEvent(db, { req, action: 'update', module: 'employees', entityType: 'employee', entityId: Number(req.params.id), entityLabel: fullName, before });
    res.json(mapEmployee(getEmployeeOrFail(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/employees/:id/vacation-requests', requireAuth, requirePermission('vacations', 'view'), (req, res, next) => {
  try {
    getEmployeeOrFail(req.params.id);
    const { page, limit, search } = parsePaginationParams(req.query);
    const sorting = normalizeSort(req.query, {
      id: 'id',
      start_date: 'start_date',
      end_date: 'end_date',
      requested_days: 'requested_days',
      vacation_exercise_year: 'vacation_exercise_year',
      status: 'status',
      include_vacation_bonus: 'include_vacation_bonus',
      creates_negative_balance: 'creates_negative_balance',
      created_at: 'created_at',
    }, 'start_date DESC, id DESC');
    const { whereClause, params, filters } = buildWhere({
      query: req.query,
      filters: {
        id: { type: 'number', column: 'id' },
        start_date: { type: 'date', column: 'start_date' },
        end_date: { type: 'date', column: 'end_date' },
        requested_days: { type: 'number', column: 'requested_days' },
        vacation_exercise_year: { type: 'number', column: 'vacation_exercise_year' },
        status: { type: 'select', column: 'status', options: VALID_VACATION_STATUSES },
        include_vacation_bonus: { type: 'boolean', column: 'include_vacation_bonus' },
        creates_negative_balance: { type: 'boolean', column: 'creates_negative_balance' },
        notes: { type: 'text', column: 'notes' },
        created_at: { type: 'date', column: 'date(created_at)' },
      },
      baseWhere: ['employee_id = ?'],
      params: [req.params.id],
      search: { value: search, columns: ['notes', 'status'] },
    });
    const result = paginateSqlList({
      tableSql: 'SELECT * FROM vacation_requests',
      countSql: 'SELECT COUNT(*) as count FROM vacation_requests',
      whereClause,
      params,
      page,
      limit,
      orderBy: sorting.orderBy,
    });

    res.json(buildListResponse(result.data, result.pagination, sorting, filters));
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees/:id/vacation-requests', requireAuth, requirePermission('vacations', 'create'), (req, res, next) => {
  try {
    const employee = getEmployeeOrFail(req.params.id);
    if (!employee.active) {
      throw badRequest('No se pueden crear solicitudes para empleados inactivos.');
    }
    const startDate = requiredText(req.body, 'start_date', 'Fecha inicial');
    const endDate = requiredText(req.body, 'end_date', 'Fecha final');
    const status = enumValue(req.body, 'status', 'Estatus', VALID_VACATION_STATUSES);

    if (new Date(endDate) < new Date(startDate)) {
      throw badRequest('La fecha final no puede ser menor que la fecha inicial.');
    }

    const requestedDays = calculateBusinessDays(startDate, endDate);
    if (requestedDays <= 0) {
      throw badRequest('Los dias solicitados deben ser mayor a 0 (dias laborables).');
    }

    const today = new Date().toISOString().slice(0, 10);
    const exerciseYear = req.body.vacation_exercise_year
      ? Number(req.body.vacation_exercise_year)
      : getCurrentExerciseYear(employee.hire_date, today);

    const accruedDays = calculateAccruedVacationDays(employee.hire_date, today);
    const allRequests = db.prepare(
      'SELECT * FROM vacation_requests WHERE employee_id = ?',
    ).all(employee.id);
    const activeRequests = allRequests.filter((r) => r.status !== 'cancelada');
    const usedDays = activeRequests.reduce((sum, r) => sum + r.requested_days, 0);
    const available = accruedDays - usedDays;

    const willCreateNegativeBalance = requestedDays > available;
    const negativeDaysGenerated = willCreateNegativeBalance ? requestedDays - available : 0;
    const balanceAfterRequest = available - requestedDays;

    if (willCreateNegativeBalance) {
      if (!req.body.confirm_negative_balance) {
        return res.status(409).json({
          message: `Esta solicitud excede los dias disponibles (${available}). El empleado quedara con saldo negativo por vacaciones anticipadas y se descontara del siguiente ejercicio.`,
          requires_confirmation: true,
          available_days: available,
          requested_days: requestedDays,
          balance_after: balanceAfterRequest,
        });
      }
      const overrideReason = trim(req.body.admin_override_reason)
        || 'Vacaciones anticipadas autorizadas por direccion.';
      if (!overrideReason) {
        throw badRequest('Se requiere un motivo de autorizacion para vacaciones anticipadas.');
      }
    }

    const overlap = checkOverlap(employee.id, startDate, endDate);
    if (overlap) {
      throw badRequest('Las fechas se traslapan con otra solicitud activa.');
    }

    const includeVacationBonus = req.body.include_vacation_bonus === false || req.body.include_vacation_bonus === 0 ? 0 : 1;
    const notes = optionalText(req.body, 'notes');
    const adminOverrideReason = willCreateNegativeBalance
      ? (trim(req.body.admin_override_reason) || 'Vacaciones anticipadas autorizadas por direccion.')
      : null;

    const existingActiveRequests = activeRequests.filter(
      (r) => r.vacation_exercise_year === exerciseYear,
    );

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO vacation_requests
        (employee_id, start_date, end_date, requested_days, vacation_exercise_year,
         status, is_first_vacation_of_exercise, include_vacation_bonus,
         created_by, created_by_user_id, authorized_by, hr_responsible, notes,
         creates_negative_balance, negative_days_generated, admin_override_reason, balance_after_request,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      employee.id, startDate, endDate, requestedDays, exerciseYear,
      status,
      existingActiveRequests.length === 0 ? 1 : 0,
      includeVacationBonus,
      req.session.username,
      audit.created_by_user_id,
      'Ivan Garcia',
      'Alejandra Gonzalez',
      notes,
      willCreateNegativeBalance ? 1 : 0,
      negativeDaysGenerated,
      adminOverrideReason,
      balanceAfterRequest,
      audit.created_at,
      audit.created_at,
    );

    const newRequest = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(result.lastInsertRowid);
    logAuditEvent(db, { req, action: 'create', module: 'vacations', entityType: 'vacation_request', entityId: result.lastInsertRowid, entityLabel: `${employee.full_name} ${startDate}-${endDate}` });
    res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
});

app.put('/api/vacation-requests/:id', requireAuth, requirePermission('vacations', 'edit'), (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    const employee = getEmployeeOrFail(request.employee_id);
    const startDate = requiredText(req.body, 'start_date', 'Fecha inicial');
    const endDate = requiredText(req.body, 'end_date', 'Fecha final');
    const status = enumValue(req.body, 'status', 'Estatus', VALID_VACATION_STATUSES);

    if (new Date(endDate) < new Date(startDate)) {
      throw badRequest('La fecha final no puede ser menor que la fecha inicial.');
    }

    const requestedDays = calculateBusinessDays(startDate, endDate);
    if (requestedDays <= 0) {
      throw badRequest('Los dias solicitados deben ser mayor a 0 (dias laborables).');
    }

    let willCreateNegativeBalance = false;
    let negativeDaysGenerated = 0;
    let balanceAfterRequest = 0;

    if (status !== 'cancelada') {
      const today = new Date().toISOString().slice(0, 10);
      const refDate = employee.active ? today : (employee.termination_date || today);
      const accruedDays = calculateAccruedVacationDays(employee.hire_date, refDate);

      const otherRequests = db.prepare(
        'SELECT * FROM vacation_requests WHERE employee_id = ? AND id != ? AND status != ?',
      ).all(employee.id, request.id, 'cancelada');
      const usedDays = otherRequests.reduce((sum, r) => sum + r.requested_days, 0);
      const available = accruedDays - usedDays;

      willCreateNegativeBalance = requestedDays > available;
      negativeDaysGenerated = willCreateNegativeBalance ? requestedDays - available : 0;
      balanceAfterRequest = available - requestedDays;

      if (willCreateNegativeBalance && !req.body.confirm_negative_balance) {
        return res.status(409).json({
          message: `Esta solicitud excede los dias disponibles (${available}). El empleado quedara con saldo negativo por vacaciones anticipadas.`,
          requires_confirmation: true,
          available_days: available,
          requested_days: requestedDays,
          balance_after: balanceAfterRequest,
        });
      }

      const overlap = checkOverlap(employee.id, startDate, endDate, request.id);
      if (overlap) {
        throw badRequest('Las fechas se traslapan con otra solicitud activa.');
      }
    }

    const includeVacationBonus = req.body.include_vacation_bonus === false || req.body.include_vacation_bonus === 0 ? 0 : 1;
    const notes = optionalText(req.body, 'notes');
    const adminOverrideReason = willCreateNegativeBalance
      ? (trim(req.body.admin_override_reason) || 'Vacaciones anticipadas autorizadas por direccion.')
      : null;

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE vacation_requests SET
        start_date = ?, end_date = ?, requested_days = ?, status = ?,
        include_vacation_bonus = ?, notes = ?,
        creates_negative_balance = ?, negative_days_generated = ?,
        admin_override_reason = ?, balance_after_request = ?,
        updated_at = ?, updated_by_user_id = ?, updated_by_name = ?
       WHERE id = ?`,
    ).run(
      startDate, endDate, requestedDays, status, includeVacationBonus, notes,
      willCreateNegativeBalance ? 1 : 0, negativeDaysGenerated,
      adminOverrideReason, balanceAfterRequest, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, request.id,
    );

    logAuditEvent(db, { req, action: 'update', module: 'vacations', entityType: 'vacation_request', entityId: request.id, entityLabel: `${employee.full_name} ${startDate}-${endDate}`, before: request });
    res.json(db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(request.id));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/vacation-requests/:id/cancel', requireAuth, requirePermission('vacations', 'edit'), (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    const audit = updatedByFields(req);
    db.prepare(
      "UPDATE vacation_requests SET status = 'cancelada', updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?",
    ).run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, request.id);

    logAuditEvent(db, { req, action: 'cancel', module: 'vacations', entityType: 'vacation_request', entityId: request.id, entityLabel: `Cancelada`, before: request });
    res.json(db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(request.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/vacation-requests/:id', requireAuth, requirePermission('vacations', 'view'), (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    const employee = getEmployeeOrFail(request.employee_id);
    const today = new Date().toISOString().slice(0, 10);
    const referenceDate = employee.active ? today : (employee.termination_date || today);
    const accruedDays = calculateAccruedVacationDays(employee.hire_date, referenceDate);
    const completedYears = getCompletedYears(new Date(employee.hire_date), new Date(referenceDate));

    const allRequests = db.prepare(
      'SELECT * FROM vacation_requests WHERE employee_id = ? AND status != ?',
    ).all(employee.id, 'cancelada');
    const daysTaken = allRequests
      .filter((r) => r.status === 'tomada')
      .reduce((sum, r) => sum + r.requested_days, 0);
    const daysScheduled = allRequests
      .filter((r) => r.status === 'programada')
      .reduce((sum, r) => sum + r.requested_days, 0);
    const daysAvailable = accruedDays - daysTaken - daysScheduled;

    res.json({
      ...request,
      employee,
      accrued_days: accruedDays,
      days_taken: daysTaken,
      days_scheduled: daysScheduled,
      days_pending: daysAvailable,
      seniority_years: completedYears,
      balance_after_this_request: request.balance_after_request,
    });
  } catch (error) {
    next(error);
  }
});

// ===================== END VACATION MODULE =====================

// ===================== ATTENDANCE MODULE =====================

function getPayrollWeekOrFail(weekId) {
  const week = db.prepare('SELECT * FROM payroll_attendance_weeks WHERE id = ?').get(weekId);
  if (!week) {
    const error = new Error('Nómina semanal no encontrada.');
    error.statusCode = 404;
    throw error;
  }
  return week;
}

function mapPayrollWeek(row) {
  const employees = db.prepare('SELECT * FROM payroll_attendance_employees WHERE payroll_attendance_week_id = ? ORDER BY employee_number_snapshot').all(row.id);
  const summary = calculateAttendanceSummary(employees);
  return {
    ...row,
    employees,
    summary,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
    closed_at_cdmx: formatDateTimeCDMX(row.closed_at),
  };
}

function mapPayrollWeekListItem(row) {
  const empCount = db.prepare('SELECT COUNT(*) as cnt FROM payroll_attendance_employees WHERE payroll_attendance_week_id = ?').get(row.id);
  const employees = db.prepare('SELECT monday_status, tuesday_status, wednesday_status, thursday_status, friday_status, saturday_status, sunday_status, extra_payment_amount FROM payroll_attendance_employees WHERE payroll_attendance_week_id = ?').all(row.id);
  const summary = calculateAttendanceSummary(employees);
  return {
    id: row.id,
    year: row.year,
    week_number: row.week_number,
    week_start_date: row.week_start_date,
    week_end_date: row.week_end_date,
    title: row.title,
    status: row.status,
    employee_count: empCount.cnt,
    total_absences: summary.totalAbsences,
    total_extra_payments: summary.totalExtraPayments,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    created_at_cdmx: formatDateTimeCDMX(row.created_at),
    updated_at_cdmx: formatDateTimeCDMX(row.updated_at),
    closed_at_cdmx: formatDateTimeCDMX(row.closed_at),
  };
}

// GET /api/attendance/weeks - List payroll weeks
app.get('/api/attendance/weeks', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);

  const filterDefs = {
    year: { type: 'number', column: 'year' },
    week_number: { type: 'number', column: 'week_number' },
    status: { type: 'select', column: 'status', options: VALID_WEEK_STATUSES },
    created_by_name: { type: 'text', column: 'created_by_name' },
    week_start_date: { type: 'date', column: 'week_start_date' },
    week_end_date: { type: 'date', column: 'week_end_date' },
  };

  const whereParts = [];
  const params = [];

  const { activeFilters } = addSqlFilters(req.query, filterDefs, whereParts, params);

  if (search) {
    whereParts.push('(title LIKE ? OR created_by_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const includeCancelled = req.query.include_cancelled === 'true' || req.query.include_cancelled === '1';
  const hasYearFilter = activeFilters.year != null;
  if (!includeCancelled && !activeFilters.status && !hasYearFilter) {
    whereParts.push("status != 'cancelada'");
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const orderBy = hasYearFilter ? 'year DESC, week_number ASC' : 'year DESC, week_number DESC';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM payroll_attendance_weeks ${whereClause}`).get(...params);
  const pagination = buildPaginationMeta(page, limit, countRow.total);

  const rows = db.prepare(`SELECT * FROM payroll_attendance_weeks ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, pagination.limit, pagination.offset);

  const data = rows.map(mapPayrollWeekListItem);

  const extra = {};
  if (hasYearFilter) {
    const summaryRows = db.prepare(`SELECT status, COUNT(*) as cnt FROM payroll_attendance_weeks ${whereClause} GROUP BY status`).all(...params);
    const counts = { borrador: 0, cerrada: 0, cancelada: 0 };
    for (const r of summaryRows) counts[r.status] = r.cnt;
    extra.summary = {
      year: activeFilters.year,
      totalWeeks: countRow.total,
      draftCount: counts.borrador,
      closedCount: counts.cerrada,
      cancelledCount: counts.cancelada,
    };
  }

  res.json(buildListResponse(data, pagination, { sortBy: '', sortOrder: hasYearFilter ? 'asc' : 'desc' }, activeFilters, extra));
});

// GET /api/attendance/statuses - Get attendance status catalog
app.get('/api/attendance/statuses', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  res.json(ATTENDANCE_STATUSES);
});

// GET /api/attendance/years - Get distinct years that have payroll weeks
app.get('/api/attendance/years', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  const rows = db.prepare('SELECT DISTINCT year FROM payroll_attendance_weeks ORDER BY year DESC').all();
  const years = rows.map((r) => r.year);
  res.json({ years });
});

// POST /api/attendance/weeks - Create new payroll week
app.post('/api/attendance/weeks', requireAuth, requirePermission('attendance', 'create'), (req, res) => {
  const { year, week_number } = req.body;

  if (!year || !week_number) {
    return res.status(400).json({ message: 'Año y número de semana son obligatorios.' });
  }

  const yearNum = Number(year);
  const weekNum = Number(week_number);

  if (!Number.isFinite(yearNum) || !Number.isFinite(weekNum) || weekNum < 1 || weekNum > 53) {
    return res.status(400).json({ message: 'Año o semana inválidos.' });
  }

  const existing = db.prepare("SELECT id FROM payroll_attendance_weeks WHERE year = ? AND week_number = ? AND deleted_at IS NULL AND status != 'cancelada'").get(yearNum, weekNum);
  if (existing) {
    return res.status(409).json({ message: 'Ya existe una nómina activa para esta semana/año.', existing_id: existing.id });
  }

  const { weekStartDate, weekEndDate, label } = calculateWeekRange(yearNum, weekNum);
  const audit = createdByFields(req);

  const result = db.prepare(`
    INSERT INTO payroll_attendance_weeks (year, week_number, week_start_date, week_end_date, title, status, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at)
    VALUES (?, ?, ?, ?, ?, 'borrador', ?, ?, ?, ?, ?, ?)
  `).run(yearNum, weekNum, weekStartDate, weekEndDate, label, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_by_user_id, audit.created_by_name, audit.created_at);

  const weekId = result.lastInsertRowid;

  const activeEmployees = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY employee_number').all();
  const defaults = generateDefaultAttendance();

  const insertEmp = db.prepare(`
    INSERT INTO payroll_attendance_employees (payroll_attendance_week_id, employee_id, employee_number_snapshot, full_name_snapshot, position_snapshot, department_snapshot, monday_status, tuesday_status, wednesday_status, thursday_status, friday_status, saturday_status, sunday_status, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const emp of activeEmployees) {
    insertEmp.run(weekId, emp.id, emp.employee_number, emp.full_name, emp.position || null, emp.department || null, defaults.monday_status, defaults.tuesday_status, defaults.wednesday_status, defaults.thursday_status, defaults.friday_status, defaults.saturday_status, defaults.sunday_status, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_by_user_id, audit.created_by_name, audit.created_at);
  }

  logAuditEvent(db, { req, action: 'create', module: 'attendance', entityType: 'payroll_week', entityId: weekId, entityLabel: label });

  const created = getPayrollWeekOrFail(weekId);
  res.status(201).json(mapPayrollWeek(created));
});

// GET /api/attendance/weeks/:id - Get payroll week details
app.get('/api/attendance/weeks/:id', requireAuth, requirePermission('attendance', 'view'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));
  res.json(mapPayrollWeek(week));
});

// PUT /api/attendance/weeks/:id - Update payroll week employees
app.put('/api/attendance/weeks/:id', requireAuth, requirePermission('attendance', 'edit'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  if (week.status === 'cerrada') {
    return res.status(403).json({ message: 'La nómina está cerrada. Debe reabrirse antes de editar.' });
  }
  if (week.status === 'cancelada') {
    return res.status(403).json({ message: 'No se puede editar una nómina cancelada.' });
  }

  const { employees } = req.body;
  if (!Array.isArray(employees)) {
    return res.status(400).json({ message: 'Se requiere un arreglo de empleados.' });
  }

  const audit = updatedByFields(req);

  const updateEmp = db.prepare(`
    UPDATE payroll_attendance_employees SET
      monday_status = ?, tuesday_status = ?, wednesday_status = ?,
      thursday_status = ?, friday_status = ?, saturday_status = ?, sunday_status = ?,
      project_location_text = ?, extra_payment_amount = ?, extra_payment_currency = ?, notes = ?,
      updated_by_user_id = ?, updated_by_name = ?, updated_at = ?
    WHERE id = ? AND payroll_attendance_week_id = ?
  `);

  for (const emp of employees) {
    if (!emp.id) continue;

    const days = [emp.monday_status, emp.tuesday_status, emp.wednesday_status, emp.thursday_status, emp.friday_status, emp.saturday_status, emp.sunday_status];
    for (const d of days) {
      if (d && !validateStatusCode(d)) {
        return res.status(400).json({ message: `Código de incidencia inválido: ${d}` });
      }
    }

    if (employeeHasOutsideWork(emp) && !emp.project_location_text) {
      return res.status(400).json({ message: `Proyecto/Ubicación es obligatorio cuando se usa A* (empleado ID ${emp.id}).` });
    }

    const extraAmount = emp.extra_payment_amount != null ? Number(emp.extra_payment_amount) : null;
    if (extraAmount !== null && (!Number.isFinite(extraAmount) || extraAmount < 0)) {
      return res.status(400).json({ message: 'Pago extra debe ser un número >= 0.' });
    }

    updateEmp.run(
      emp.monday_status || 'A', emp.tuesday_status || 'A', emp.wednesday_status || 'A',
      emp.thursday_status || 'A', emp.friday_status || 'A', emp.saturday_status || 'D', emp.sunday_status || 'D',
      emp.project_location_text || null, extraAmount, emp.extra_payment_currency || 'MXN', emp.notes || null,
      audit.updated_by_user_id, audit.updated_by_name, audit.updated_at,
      emp.id, week.id,
    );
  }

  db.prepare('UPDATE payroll_attendance_weeks SET updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?').run(audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, week.id);

  logAuditEvent(db, { req, action: 'update', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  const updated = getPayrollWeekOrFail(week.id);
  res.json(mapPayrollWeek(updated));
});

// POST /api/attendance/weeks/:id/close - Close payroll week
app.post('/api/attendance/weeks/:id/close', requireAuth, requirePermission('attendance', 'approve'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  if (week.status === 'cerrada') {
    return res.status(400).json({ message: 'La nómina ya está cerrada.' });
  }
  if (week.status === 'cancelada') {
    return res.status(400).json({ message: 'No se puede cerrar una nómina cancelada.' });
  }

  const now = nowUtc();
  db.prepare('UPDATE payroll_attendance_weeks SET status = ?, closed_by_user_id = ?, closed_by_name = ?, closed_at = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
    .run('cerrada', req.session.userId, req.session.username, now, req.session.userId, req.session.username, now, week.id);

  logAuditEvent(db, { req, action: 'close', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  const updated = getPayrollWeekOrFail(week.id);
  res.json(mapPayrollWeek(updated));
});

// POST /api/attendance/weeks/:id/reopen - Reopen payroll week (admin only)
app.post('/api/attendance/weeks/:id/reopen', requireAuth, requirePermission('attendance', 'reopen'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  if (week.status !== 'cerrada') {
    return res.status(400).json({ message: 'Solo se puede reabrir una nómina cerrada.' });
  }

  const now = nowUtc();
  db.prepare('UPDATE payroll_attendance_weeks SET status = ?, closed_by_user_id = NULL, closed_by_name = NULL, closed_at = NULL, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
    .run('borrador', req.session.userId, req.session.username, now, week.id);

  logAuditEvent(db, { req, action: 'reopen', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  const updated = getPayrollWeekOrFail(week.id);
  res.json(mapPayrollWeek(updated));
});

// DELETE /api/attendance/weeks/:id - Cancel payroll week (logical delete)
app.delete('/api/attendance/weeks/:id', requireAuth, requirePermission('attendance', 'delete'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));
  const { reason } = req.body || {};

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ message: 'El motivo de cancelación es obligatorio.' });
  }

  if (week.status === 'cancelada') {
    return res.status(400).json({ message: 'La nómina ya está cancelada.' });
  }

  const now = nowUtc();
  db.prepare('UPDATE payroll_attendance_weeks SET status = ?, deleted_at = ?, deleted_by_user_id = ?, deleted_by_name = ?, delete_reason = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
    .run('cancelada', now, req.session.userId, req.session.username, reason.trim(), req.session.userId, req.session.username, now, week.id);

  logAuditEvent(db, { req, action: 'cancel', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title, metadata: { reason: reason.trim() } });

  res.json({ message: 'Nómina cancelada correctamente.' });
});

// GET /api/attendance/weeks/:id/print - Get print data
app.get('/api/attendance/weeks/:id/print', requireAuth, requirePermission('attendance', 'print'), (req, res) => {
  const week = getPayrollWeekOrFail(Number(req.params.id));

  logAuditEvent(db, { req, action: 'print', module: 'attendance', entityType: 'payroll_week', entityId: week.id, entityLabel: week.title });

  res.json(mapPayrollWeek(week));
});

// ===================== END ATTENDANCE MODULE =====================

// ===================== ECOVIS MODULE =====================

const VALID_ECOVIS_DIRECTIONS = ['ecovis_debe_a_revram', 'revram_debe_a_ecovis', 'neutral'];

function getEcovisProjectOrFail(projectId) {
  const project = db.prepare('SELECT * FROM ecovis_projects WHERE id = ?').get(projectId);
  if (!project) {
    const error = new Error('Proyecto ECOVIS no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return project;
}

function getEcovisPaymentOrFail(paymentId) {
  const payment = db.prepare('SELECT * FROM ecovis_payments WHERE id = ?').get(paymentId);
  if (!payment) {
    const error = new Error('Pago ECOVIS no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return payment;
}

function recalculateProjectStatus(projectId) {
  const project = db.prepare('SELECT * FROM ecovis_projects WHERE id = ?').get(projectId);
  if (!project) return;
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND is_cancelled = 0',
  ).all(projectId);
  const result = calculateEcovisProjectPaymentStatus(project, allocations);
  const fullyPaidAt = result.is_fully_paid ? (project.fully_paid_at || nowUtc()) : null;
  db.prepare('UPDATE ecovis_projects SET status = ?, paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(result.status, result.paid_amount_mxn, result.pending_amount_mxn, fullyPaidAt, projectId);
}

function recalculatePaymentUnallocated(paymentId) {
  const payment = db.prepare('SELECT * FROM ecovis_payments WHERE id = ?').get(paymentId);
  if (!payment) return;
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0',
  ).all(paymentId);
  const unallocated = calculatePaymentUnallocated(payment, allocations);
  db.prepare('UPDATE ecovis_payments SET unallocated_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(unallocated, paymentId);
}

function recalculatePurchaseOrderStatus(poId) {
  const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(poId);
  if (!po) return;
  const allocations = db.prepare(
    'SELECT * FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND allocation_type = \'orden_compra\' AND is_cancelled = 0',
  ).all(poId);
  const totalMxn = Number(po.amount_mxn || po.total_amount || 0);
  const paidMxn = roundMoneyEcovis(allocations.reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0));
  const pendingMxn = roundMoneyEcovis(Math.max(0, totalMxn - paidMxn));
  let status = 'pendiente';
  if (po.is_cancelled) {
    status = 'cancelada';
  } else if (paidMxn >= totalMxn - 0.01 && paidMxn > 0) {
    status = 'pagada';
  } else if (paidMxn > 0) {
    status = 'parcialmente_pagada';
  }
  const fullyPaidAt = status === 'pagada' ? (po.fully_paid_at || nowUtc()) : null;
  db.prepare('UPDATE ecovis_purchase_orders SET status = ?, paid_amount_mxn = ?, pending_amount_mxn = ?, fully_paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, paidMxn, pendingMxn, fullyPaidAt, poId);
}

app.get('/api/ecovis/summary', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const projects = db.prepare('SELECT * FROM ecovis_projects').all();
  const payments = db.prepare('SELECT * FROM ecovis_payments').all();
  const allocations = db.prepare('SELECT * FROM ecovis_payment_allocations').all();
  const movements = db.prepare('SELECT * FROM ecovis_movements').all();
  const summary = calculateEcovisAccountSummary(projects, payments, allocations, movements);
  res.json(summary);
});

app.get('/api/ecovis/projects', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const paidSql = `(SELECT COALESCE(SUM(a.amount), 0) FROM ecovis_payment_allocations a WHERE a.ecovis_project_id = ep.id AND a.is_cancelled = 0)`;
  const paidMxnSql = `(SELECT COALESCE(SUM(a.amount_mxn), 0) FROM ecovis_payment_allocations a WHERE a.ecovis_project_id = ep.id AND a.allocation_type = 'proyecto' AND a.is_cancelled = 0)`;
  const pendingMxnSql = `(COALESCE(ep.amount_mxn, ep.total_amount) - ${paidMxnSql})`;

  const excludePaid = req.query.exclude_paid === '1' || req.query.exclude_paid === 'true';

  const sorting = normalizeSort(req.query, {
    id: 'ep.id',
    project_date: 'ep.project_date',
    project_name: 'ep.project_name',
    client_name: 'ep.client_name',
    quote_number: 'ep.quote_number',
    purchase_order_number: 'ep.purchase_order_number',
    invoice_number: 'ep.invoice_number',
    total_amount: 'ep.total_amount',
    amount_mxn: 'ep.amount_mxn',
    paid_amount: paidSql,
    paid_amount_mxn: paidMxnSql,
    pending_amount: `(ep.total_amount - ${paidSql})`,
    pending_amount_mxn: pendingMxnSql,
    status: 'ep.status',
  }, 'ep.project_date DESC, ep.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'ep.id' },
      project_date: { type: 'date', column: 'ep.project_date' },
      project_name: { type: 'text', column: 'ep.project_name' },
      client_name: { type: 'text', column: 'ep.client_name' },
      quote_number: { type: 'text', column: 'ep.quote_number' },
      purchase_order_number: { type: 'text', column: 'ep.purchase_order_number' },
      invoice_number: { type: 'text', column: 'ep.invoice_number' },
      total_amount: { type: 'currency', column: 'ep.total_amount' },
      paid_amount: { type: 'currency', column: paidSql },
      pending_amount: { type: 'currency', column: `(ep.total_amount - ${paidSql})` },
      status: { type: 'select', column: 'ep.status', options: VALID_ECOVIS_STATUSES },
    },
    search: {
      value: search,
      columns: ['ep.project_name', 'ep.quote_number', 'ep.purchase_order_number', 'ep.invoice_number', 'ep.description'],
    },
  });

  let extraWhere = '';
  if (excludePaid) {
    extraWhere = " AND ep.status != 'pagado' AND ep.is_cancelled = 0";
  }

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_projects ep WHERE ${whereClause}${extraWhere}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const projects = db.prepare(
    `SELECT ep.* FROM ecovis_projects ep WHERE ${whereClause}${extraWhere} ORDER BY ${sorting.orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = projects.map((project) => {
    const allocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND is_cancelled = 0',
    ).all(project.id);
    const paid_amount = roundMoneyEcovis(allocations.filter((a) => a.allocation_type === 'proyecto').reduce((sum, a) => sum + Number(a.amount || 0), 0));
    const paid_amount_mxn = roundMoneyEcovis(allocations.filter((a) => a.allocation_type === 'proyecto').reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0));
    const amount_mxn = Number(project.amount_mxn || project.total_amount || 0);
    const pending_amount = Math.max(0, Number(project.total_amount) - paid_amount);
    const pending_amount_mxn = roundMoneyEcovis(Math.max(0, amount_mxn - paid_amount_mxn));
    return { ...project, paid_amount, pending_amount, amount_mxn, paid_amount_mxn, pending_amount_mxn };
  });

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.post('/api/ecovis/projects', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const projectName = requiredText(req.body, 'project_name', 'Nombre del proyecto');
    const projectDate = requiredText(req.body, 'project_date', 'Fecha del proyecto');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const quoteNumber = optionalText(req.body, 'quote_number');
    const purchaseOrderNumber = optionalText(req.body, 'purchase_order_number');
    const invoiceNumber = optionalText(req.body, 'invoice_number');
    const description = optionalText(req.body, 'description');
    const notes = optionalText(req.body, 'notes');

    const ecovisPurchaseOrderId = req.body.ecovis_purchase_order_id || null;

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    const audit = createdByFields(req);
    const createProject = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO ecovis_projects (
          project_name, project_date, total_amount, currency, exchange_rate_to_mxn, amount_mxn, pending_amount_mxn,
          quote_number, purchase_order_number, invoice_number,
          description, notes, status, created_by, created_by_user_id, created_at, updated_at, ecovis_purchase_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?)`,
      ).run(
        projectName, projectDate, totalAmount, currency, exchangeRate, amountMxn, amountMxn,
        quoteNumber, purchaseOrderNumber, invoiceNumber,
        description, notes, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at, ecovisPurchaseOrderId,
      );

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_project_id, created_by, created_by_user_id, created_at, updated_at
        ) VALUES ('proyecto', ?, ?, ?, ?, ?, 'ecovis_debe_a_revram', ?, ?, ?, ?, ?, ?)`,
      ).run(projectDate, totalAmount, currency, exchangeRate, amountMxn, projectName, result.lastInsertRowid, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

      return result.lastInsertRowid;
    });

    const projectId = createProject();
    logAuditEvent(db, { req, action: 'create', module: 'ecovis', entityType: 'ecovis_project', entityId: projectId, entityLabel: projectName, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    res.status(201).json(getEcovisProjectOrFail(projectId));
  } catch (error) {
    next(error);
  }
});

app.put('/api/ecovis/projects/:id', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const project = getEcovisProjectOrFail(req.params.id);
    if (project.is_cancelled) {
      throw badRequest('No se puede editar un proyecto cancelado.');
    }

    const projectName = requiredText(req.body, 'project_name', 'Nombre del proyecto');
    const projectDate = requiredText(req.body, 'project_date', 'Fecha del proyecto');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const quoteNumber = optionalText(req.body, 'quote_number');
    const purchaseOrderNumber = optionalText(req.body, 'purchase_order_number');
    const invoiceNumber = optionalText(req.body, 'invoice_number');
    const description = optionalText(req.body, 'description');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE ecovis_projects SET
        project_name = ?, project_date = ?, total_amount = ?, currency = ?,
        exchange_rate_to_mxn = ?, amount_mxn = ?,
        quote_number = ?, purchase_order_number = ?, invoice_number = ?,
        description = ?, notes = ?, updated_at = ?, updated_by = ?, updated_by_user_id = ?
      WHERE id = ?`,
    ).run(
      projectName, projectDate, totalAmount, currency,
      exchangeRate, amountMxn,
      quoteNumber, purchaseOrderNumber, invoiceNumber,
      description, notes, audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, req.params.id,
    );

    recalculateProjectStatus(req.params.id);
    logAuditEvent(db, { req, action: 'update', module: 'ecovis', entityType: 'ecovis_project', entityId: Number(req.params.id), entityLabel: projectName, before: project, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    res.json(getEcovisProjectOrFail(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/projects/:id/cancel', requireAuth, requirePermission('ecovisAccount', 'cancel'), (req, res, next) => {
  try {
    const project = getEcovisProjectOrFail(req.params.id);
    if (project.is_cancelled) {
      throw badRequest('El proyecto ya esta cancelado.');
    }
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');

    const audit = updatedByFields(req);
    const cancelProject = db.transaction(() => {
      db.prepare(
        `UPDATE ecovis_projects SET
          is_cancelled = 1, cancelled_at = ?,
          cancelled_by = ?, cancellation_reason = ?,
          status = 'cancelado', updated_at = ?, updated_by = ?, updated_by_user_id = ?
        WHERE id = ?`,
      ).run(audit.updated_at, req.session.username, reason, audit.updated_at, audit.updated_by_name, audit.updated_by_user_id, req.params.id);

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, direction,
          description, related_project_id, created_by, created_by_user_id, created_at, updated_at
        ) VALUES ('cancelacion', date('now'), ?, ?, 'ecovis_debe_a_revram', ?, ?, ?, ?, ?, ?)`,
      ).run(project.total_amount, project.currency, reason, req.params.id, req.session.username, audit.updated_by_user_id, audit.updated_at, audit.updated_at);

      const affectedPayments = db.prepare(
        'SELECT DISTINCT payment_id FROM ecovis_payment_allocations WHERE ecovis_project_id = ?',
      ).all(req.params.id);
      for (const row of affectedPayments) {
        recalculatePaymentUnallocated(row.payment_id);
      }
    });

    cancelProject();
    logAuditEvent(db, { req, action: 'cancel', module: 'ecovis', entityType: 'ecovis_project', entityId: Number(req.params.id), entityLabel: project.project_name, metadata: { reason } });
    res.json(getEcovisProjectOrFail(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecovis/payments', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const allocatedSql = '(ep.amount - ep.unallocated_amount)';
  const statusSql = "(CASE WHEN ep.is_cancelled = 1 THEN 'cancelado' WHEN ep.unallocated_amount > 0 THEN 'parcial' ELSE 'asignado' END)";
  const sorting = normalizeSort(req.query, {
    id: 'ep.id',
    payment_date: 'ep.payment_date',
    amount: 'ep.amount',
    currency: 'ep.currency',
    payment_method: 'ep.payment_method',
    bank_reference: 'ep.bank_reference',
    allocated_amount: allocatedSql,
    unallocated_amount: 'ep.unallocated_amount',
    status: statusSql,
  }, 'ep.payment_date DESC, ep.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'ep.id' },
      payment_date: { type: 'date', column: 'ep.payment_date' },
      amount: { type: 'currency', column: 'ep.amount' },
      currency: { type: 'select', column: 'ep.currency', options: VALID_CURRENCIES },
      payment_method: { type: 'text', column: 'ep.payment_method' },
      bank_reference: { type: 'text', column: 'ep.bank_reference' },
      source_description: { type: 'text', column: 'ep.source_description' },
      allocated_amount: { type: 'currency', column: allocatedSql },
      unallocated_amount: { type: 'currency', column: 'ep.unallocated_amount' },
      status: { type: 'select', column: statusSql, options: VALID_PAYMENT_STATUSES },
    },
    search: {
      value: search,
      columns: ['ep.bank_reference', 'ep.source_description', 'ep.payment_method', 'ep.notes'],
    },
  });

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_payments ep WHERE ${whereClause}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const payments = db.prepare(
    `SELECT ep.* FROM ecovis_payments ep WHERE ${whereClause} ORDER BY ${sorting.orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = payments.map((payment) => {
    const allocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0',
    ).all(payment.id);
    const allocated_amount = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    return {
      ...payment,
      allocated_amount: Math.round((allocated_amount + Number.EPSILON) * 100) / 100,
      unallocated_amount: payment.unallocated_amount,
    };
  });

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.post('/api/ecovis/payments', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const paymentMethod = optionalText(req.body, 'payment_method');
    const bankReference = optionalText(req.body, 'bank_reference');
    const sourceDescription = optionalText(req.body, 'source_description');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(amount * exchangeRate);

    const audit = createdByFields(req);
    const createPayment = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO ecovis_payments (
          payment_date, amount, currency, exchange_rate_to_mxn, amount_mxn, payment_method,
          bank_reference, source_description, notes,
          unallocated_amount, created_by, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(paymentDate, amount, currency, exchangeRate, amountMxn, paymentMethod, bankReference, sourceDescription, notes, amount, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_payment_id, created_by, created_by_user_id, created_at, updated_at
        ) VALUES ('pago_recibido', ?, ?, ?, ?, ?, 'neutral', ?, ?, ?, ?, ?, ?)`,
      ).run(paymentDate, amount, currency, exchangeRate, amountMxn, sourceDescription || 'Pago recibido', result.lastInsertRowid, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

      return result.lastInsertRowid;
    });

    const paymentId = createPayment();
    logAuditEvent(db, { req, action: 'create', module: 'ecovis', entityType: 'ecovis_payment', entityId: paymentId, entityLabel: `Pago ${amount} ${currency}`, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    res.status(201).json(getEcovisPaymentOrFail(paymentId));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/payments/:id/allocations', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const payment = getEcovisPaymentOrFail(req.params.id);
    if (payment.is_cancelled) {
      throw badRequest('No se pueden crear asignaciones en un pago cancelado.');
    }

    const allocationType = requiredText(req.body, 'allocation_type', 'Tipo de asignacion');
    if (!['proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste'].includes(allocationType)) {
      throw badRequest('Tipo de asignacion no valido.');
    }

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const notes = optionalText(req.body, 'notes');

    const existingAllocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0',
    ).all(payment.id);
    const totalAllocated = existingAllocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const available = Math.round((Number(payment.amount) - totalAllocated + Number.EPSILON) * 100) / 100;

    if (amount > available + 0.005) {
      throw badRequest(`Monto excede el disponible del pago (${available}).`);
    }

    let ecovisProjectId = null;
    let ecovisPurchaseOrderId = null;
    if (allocationType === 'proyecto') {
      if (!req.body.ecovis_project_id) {
        throw badRequest('El proyecto es obligatorio para asignaciones de tipo proyecto.');
      }
      ecovisProjectId = req.body.ecovis_project_id;
      getEcovisProjectOrFail(ecovisProjectId);
    } else if (allocationType === 'orden_compra') {
      if (!req.body.ecovis_purchase_order_id) {
        throw badRequest('La orden de compra es obligatoria para asignaciones de tipo orden_compra.');
      }
      ecovisPurchaseOrderId = req.body.ecovis_purchase_order_id;
    }

    const allocationCurrency = payment.currency || 'MXN';
    const allocationRate = Number(payment.exchange_rate_to_mxn || 1);
    const allocationAmountMxn = roundMoneyEcovis(amount * allocationRate);

    let movementType;
    let direction;
    if (allocationType === 'proyecto') {
      movementType = 'aplicacion_a_proyecto';
      direction = 'ecovis_debe_a_revram';
    } else if (allocationType === 'orden_compra') {
      movementType = 'aplicacion_a_proyecto';
      direction = 'ecovis_debe_a_revram';
    } else if (allocationType === 'saldo_a_favor') {
      movementType = 'saldo_a_favor';
      direction = 'neutral';
    } else if (allocationType === 'prestamo') {
      movementType = 'prestamo_ecovis_a_revram';
      direction = 'revram_debe_a_ecovis';
    } else {
      movementType = 'ajuste';
      direction = 'neutral';
    }

    const createAllocation = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO ecovis_payment_allocations (
          payment_id, ecovis_project_id, ecovis_purchase_order_id, allocation_type, amount, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(payment.id, ecovisProjectId, ecovisPurchaseOrderId, allocationType, amount, allocationCurrency, allocationRate, allocationAmountMxn, notes, req.session.username);

      db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_payment_id, related_project_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        movementType, payment.payment_date, amount, allocationCurrency, allocationRate, allocationAmountMxn, direction,
        notes || allocationType, payment.id, ecovisProjectId, req.session.username,
      );

      recalculatePaymentUnallocated(payment.id);

      if (allocationType === 'proyecto' && ecovisProjectId) {
        recalculateProjectStatus(ecovisProjectId);
      }
      if (allocationType === 'orden_compra' && ecovisPurchaseOrderId) {
        recalculatePurchaseOrderStatus(ecovisPurchaseOrderId);
      }

      return result.lastInsertRowid;
    });

    const allocationId = createAllocation();
    const allocation = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE id = ?').get(allocationId);
    const updatedPayment = getEcovisPaymentOrFail(payment.id);

    res.status(201).json({ allocation, payment: updatedPayment });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecovis/loans', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const repaidSql = `(SELECT COALESCE(SUM(r.amount), 0) FROM ecovis_movements r WHERE r.movement_type = 'devolucion' AND r.reference = CAST(em.id AS TEXT))`;
  const outstandingSql = `(em.amount - ${repaidSql})`;
  const statusSql = `(CASE WHEN ${outstandingSql} <= 0 THEN 'pagado' ELSE 'vigente' END)`;
  const sorting = normalizeSort(req.query, {
    id: 'em.id',
    movement_date: 'em.movement_date',
    amount: 'em.amount',
    currency: 'em.currency',
    reference: 'em.reference',
    description: 'em.description',
    outstanding: outstandingSql,
    status: statusSql,
  }, 'em.movement_date DESC, em.id DESC');
  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      id: { type: 'number', column: 'em.id' },
      movement_date: { type: 'date', column: 'em.movement_date' },
      amount: { type: 'currency', column: 'em.amount' },
      currency: { type: 'select', column: 'em.currency', options: VALID_CURRENCIES },
      reference: { type: 'text', column: 'em.reference' },
      description: { type: 'text', column: 'em.description' },
      outstanding: { type: 'currency', column: outstandingSql },
      status: { type: 'select', column: statusSql, options: VALID_LOAN_STATUSES },
    },
    baseWhere: ["em.movement_type = 'prestamo_ecovis_a_revram'"],
    search: { value: search, columns: ['em.description', 'em.reference', 'em.notes'] },
  });

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_movements em WHERE ${whereClause}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const loans = db.prepare(
    `SELECT em.* FROM ecovis_movements em WHERE ${whereClause} ORDER BY ${sorting.orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  const data = loans.map((loan) => {
    const repayments = db.prepare(
      "SELECT * FROM ecovis_movements WHERE movement_type = 'devolucion' AND reference = ? ORDER BY movement_date DESC",
    ).all(String(loan.id));
    const total_repaid = repayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    return {
      ...loan,
      total_repaid: Math.round((total_repaid + Number.EPSILON) * 100) / 100,
      outstanding: Math.round((Number(loan.amount) - total_repaid + Number.EPSILON) * 100) / 100,
      repayments,
    };
  });

  res.json(buildListResponse(data, pag, sorting, filters));
});

app.post('/api/ecovis/loans', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const reference = optionalText(req.body, 'reference');
    const description = optionalText(req.body, 'description') || 'Prestamo ECOVIS a RevRam';
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(amount * exchangeRate);

    const result = db.prepare(
      `INSERT INTO ecovis_movements (
        movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
        description, reference, notes, created_by
      ) VALUES ('prestamo_ecovis_a_revram', ?, ?, ?, ?, ?, 'revram_debe_a_ecovis', ?, ?, ?, ?)`,
    ).run(movementDate, amount, currency, exchangeRate, amountMxn, description, reference, notes, req.session.username);

    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/loans/:id/repayment', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const loan = db.prepare(
      "SELECT * FROM ecovis_movements WHERE id = ? AND movement_type = 'prestamo_ecovis_a_revram'",
    ).get(req.params.id);
    if (!loan) {
      const error = new Error('Prestamo no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const reference = optionalText(req.body, 'reference');
    const notes = optionalText(req.body, 'notes');

    const loanCurrency = loan.currency || 'MXN';
    const loanRate = Number(loan.exchange_rate_to_mxn || 1);
    const repaymentAmountMxn = roundMoneyEcovis(amount * loanRate);

    const result = db.prepare(
      `INSERT INTO ecovis_movements (
        movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
        description, reference, notes, created_by
      ) VALUES ('devolucion', ?, ?, ?, ?, ?, 'neutral', ?, ?, ?, ?)`,
    ).run(movementDate, amount, loanCurrency, loanRate, repaymentAmountMxn, `Devolucion de prestamo #${loan.id}`, String(loan.id), notes, req.session.username);

    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecovis/movements', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const movementType = typeof req.query.movement_type === 'string'
    ? req.query.movement_type.trim()
    : (typeof req.query.type === 'string' ? req.query.type.trim() : '');
  const validTypes = ['proyecto', 'pago_recibido', 'prestamo_ecovis_a_revram', 'aplicacion_a_proyecto', 'saldo_a_favor', 'devolucion', 'ajuste', 'cancelacion'];
  const sorting = normalizeSort(req.query, {
    id: 'em.id',
    movement_date: 'em.movement_date',
    movement_type: 'em.movement_type',
    description: 'em.description',
    amount: 'em.amount',
    currency: 'em.currency',
    direction: 'em.direction',
    reference: 'em.reference',
    related_project_name: 'ep.project_name',
    created_by: 'em.created_by',
  }, 'em.movement_date DESC, em.id DESC');
  const query = { ...req.query };
  if (movementType && validTypes.includes(movementType)) {
    query.movement_type = movementType;
  }
  const { whereClause, params, filters } = buildWhere({
    query,
    filters: {
      id: { type: 'number', column: 'em.id' },
      movement_date: { type: 'date', column: 'em.movement_date' },
      movement_type: { type: 'select', column: 'em.movement_type', options: validTypes },
      description: { type: 'text', column: 'em.description' },
      amount: { type: 'currency', column: 'em.amount' },
      currency: { type: 'select', column: 'em.currency', options: VALID_CURRENCIES },
      direction: { type: 'select', column: 'em.direction', options: VALID_ECOVIS_DIRECTIONS },
      reference: { type: 'text', column: 'em.reference' },
      related_project_name: { type: 'text', column: 'ep.project_name' },
      created_by: { type: 'text', column: 'em.created_by' },
    },
    search: { value: search, columns: ['em.description', 'em.reference', 'em.notes', 'ep.project_name'] },
  });

  const totalRecords = db.prepare(
    `SELECT COUNT(*) as count FROM ecovis_movements em LEFT JOIN ecovis_projects ep ON ep.id = em.related_project_id WHERE ${whereClause}`,
  ).get(...params).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const movements = db.prepare(
    `SELECT em.*, ep.project_name as related_project_name
     FROM ecovis_movements em
     LEFT JOIN ecovis_projects ep ON ep.id = em.related_project_id
     WHERE ${whereClause}
     ORDER BY ${sorting.orderBy}
     LIMIT ? OFFSET ?`,
  ).all(...params, pag.limit, pag.offset);

  res.json(buildListResponse(movements, pag, sorting, filters));
});

app.post('/api/ecovis/adjustments', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const direction = requiredText(req.body, 'direction', 'Direccion');
    if (!VALID_ECOVIS_DIRECTIONS.includes(direction)) {
      throw badRequest('Direccion no valida.');
    }
    const description = requiredText(req.body, 'description', 'Motivo / Descripcion');
    const reference = optionalText(req.body, 'reference');
    const notes = optionalText(req.body, 'notes');

    const result = db.prepare(
      `INSERT INTO ecovis_movements (
        movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
        description, reference, notes, created_by
      ) VALUES ('ajuste', ?, ?, 'MXN', 1, ?, ?, ?, ?, ?, ?)`,
    ).run(movementDate, amount, amount, direction, description, reference, notes, req.session.username);

    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/apply-credit', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const ecovisProjectId = req.body.ecovis_project_id;
    if (!ecovisProjectId) {
      throw badRequest('El proyecto es obligatorio.');
    }
    const project = getEcovisProjectOrFail(ecovisProjectId);
    if (project.is_cancelled) {
      throw badRequest('No se puede aplicar credito a un proyecto cancelado.');
    }

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const movementDate = requiredText(req.body, 'movement_date', 'Fecha del movimiento');
    const notes = optionalText(req.body, 'notes');

    const projects = db.prepare('SELECT * FROM ecovis_projects').all();
    const payments = db.prepare('SELECT * FROM ecovis_payments').all();
    const allocations = db.prepare('SELECT * FROM ecovis_payment_allocations').all();
    const movements = db.prepare('SELECT * FROM ecovis_movements').all();
    const summary = calculateEcovisAccountSummary(projects, payments, allocations, movements);

    if (amount > summary.credit_balance + 0.005) {
      throw badRequest(`Saldo a favor insuficiente (disponible: ${summary.credit_balance}).`);
    }

    const applyCredit = db.transaction(() => {
      const creditCurrency = project.currency || 'MXN';
      const creditRate = Number(project.exchange_rate_to_mxn || 1);
      const creditAmountMxn = roundMoneyEcovis(amount * creditRate);

      const result = db.prepare(
        `INSERT INTO ecovis_movements (
          movement_type, movement_date, amount, currency, exchange_rate_to_mxn, amount_mxn, direction,
          description, related_project_id, notes, created_by
        ) VALUES ('saldo_a_favor', ?, ?, ?, ?, ?, 'ecovis_debe_a_revram', ?, ?, ?, ?)`,
      ).run(movementDate, amount, creditCurrency, creditRate, creditAmountMxn, `Aplicacion de saldo a favor a ${project.project_name}`, ecovisProjectId, notes, req.session.username);

      recalculateProjectStatus(ecovisProjectId);
      return result.lastInsertRowid;
    });

    const movementId = applyCredit();
    const movement = db.prepare('SELECT * FROM ecovis_movements WHERE id = ?').get(movementId);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

// ===================== ECOVIS HISTORY =====================

app.get('/api/ecovis/projects/history/years', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const years = db.prepare(
    `SELECT DISTINCT CAST(strftime('%Y', fully_paid_at) AS INTEGER) as year
     FROM ecovis_projects
     WHERE status = 'pagado' AND fully_paid_at IS NOT NULL AND is_cancelled = 0
     ORDER BY year DESC`,
  ).all().map((r) => r.year).filter((y) => y > 0);
  res.json(years);
});

app.get('/api/ecovis/projects/history', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const year = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;

  if (!year) {
    return res.json({
      data: [],
      summary: { total_projects_mxn: 0, total_paid_mxn: 0, total_pending_mxn: 0, project_count: 0 },
      pagination: buildPaginationMeta(1, limit, 0),
    });
  }

  let dateFilter = "AND strftime('%Y', ep.fully_paid_at) = ?";
  const dateParams = [String(year)];
  if (month && month >= 1 && month <= 12) {
    dateFilter += " AND CAST(strftime('%m', ep.fully_paid_at) AS INTEGER) = ?";
    dateParams.push(month);
  }

  const baseWhere = `ep.status = 'pagado' AND ep.fully_paid_at IS NOT NULL AND ep.is_cancelled = 0 ${dateFilter}`;

  let searchWhere = '';
  const searchParams = [];
  if (search) {
    searchWhere = " AND (ep.project_name LIKE ? OR ep.quote_number LIKE ? OR ep.purchase_order_number LIKE ? OR ep.invoice_number LIKE ?)";
    const term = `%${search}%`;
    searchParams.push(term, term, term, term);
  }

  const allParams = [...dateParams, ...searchParams];

  const totalRecords = db.prepare(`SELECT COUNT(*) as count FROM ecovis_projects ep WHERE ${baseWhere}${searchWhere}`).get(...allParams).count;
  const pag = buildPaginationMeta(page, limit, totalRecords);

  const projects = db.prepare(
    `SELECT ep.* FROM ecovis_projects ep WHERE ${baseWhere}${searchWhere} ORDER BY ep.fully_paid_at DESC, ep.id DESC LIMIT ? OFFSET ?`,
  ).all(...allParams, pag.limit, pag.offset);

  const data = projects.map((project) => {
    const allocations = db.prepare(
      'SELECT * FROM ecovis_payment_allocations WHERE ecovis_project_id = ? AND allocation_type = \'proyecto\' AND is_cancelled = 0',
    ).all(project.id);
    const paid_amount_mxn = roundMoneyEcovis(allocations.reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0));
    const amount_mxn = Number(project.amount_mxn || project.total_amount || 0);
    const pending_amount_mxn = roundMoneyEcovis(Math.max(0, amount_mxn - paid_amount_mxn));
    return { ...project, amount_mxn, paid_amount_mxn, pending_amount_mxn };
  });

  const summaryRow = db.prepare(
    `SELECT
      COALESCE(SUM(ep.amount_mxn), 0) as total_projects_mxn,
      COALESCE(SUM(ep.paid_amount_mxn), 0) as total_paid_mxn,
      COALESCE(SUM(CASE WHEN ep.pending_amount_mxn > 0 THEN ep.pending_amount_mxn ELSE 0 END), 0) as total_pending_mxn,
      COUNT(*) as project_count
    FROM ecovis_projects ep WHERE ${baseWhere}${searchWhere}`,
  ).get(...allParams);

  res.json({
    data,
    summary: {
      total_projects_mxn: roundMoneyEcovis(summaryRow.total_projects_mxn),
      total_paid_mxn: roundMoneyEcovis(summaryRow.total_paid_mxn),
      total_pending_mxn: roundMoneyEcovis(summaryRow.total_pending_mxn),
      project_count: summaryRow.project_count,
    },
    pagination: pag,
  });
});

// ===================== ECOVIS PURCHASE ORDERS =====================

app.get('/api/ecovis/purchase-orders', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const sorting = normalizeSort(req.query, {
    id: 'po.id',
    purchase_order_number: 'po.purchase_order_number',
    order_date: 'po.order_date',
    total_amount: 'po.total_amount',
    status: 'po.status',
  }, 'po.order_date DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      status: { type: 'select', column: 'po.status', options: ['pendiente', 'parcialmente_pagada', 'pagada', 'cancelada'] },
      purchase_order_number: { type: 'text', column: 'po.purchase_order_number' },
    },
    search: { value: search, columns: ['po.purchase_order_number', 'po.project_name', 'po.notes'] },
  });

  const allAllocations = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE is_cancelled = 0').all();
  const result = paginateSqlList({
    tableSql: 'SELECT po.* FROM ecovis_purchase_orders po',
    countSql: 'SELECT COUNT(*) as count FROM ecovis_purchase_orders po',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (po) => {
      const balance = calculatePurchaseOrderBalance(po, allAllocations);
      return { ...po, ...balance, created_at_cdmx: formatDateTimeCDMX(po.created_at), updated_at_cdmx: formatDateTimeCDMX(po.updated_at) };
    },
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

app.get('/api/ecovis/purchase-orders/:id', requireAuth, requirePermission('ecovisAccount', 'view'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    const allAllocations = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE is_cancelled = 0').all();
    const balance = calculatePurchaseOrderBalance(po, allAllocations);
    const poAllocations = db.prepare(
      `SELECT a.*, p.payment_date, p.bank_reference, p.amount as payment_amount
       FROM ecovis_payment_allocations a
       JOIN ecovis_payments p ON a.payment_id = p.id
       WHERE a.ecovis_purchase_order_id = ? AND a.is_cancelled = 0
       ORDER BY a.created_at DESC`,
    ).all(po.id);
    const relatedProjects = db.prepare('SELECT * FROM ecovis_projects WHERE ecovis_purchase_order_id = ? AND is_cancelled = 0').all(po.id);
    res.json({ ...po, ...balance, allocations: poAllocations, related_projects: relatedProjects, created_at_cdmx: formatDateTimeCDMX(po.created_at) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/purchase-orders', requireAuth, requirePermission('ecovisAccount', 'create'), (req, res, next) => {
  try {
    const purchaseOrderNumber = requiredText(req.body, 'purchase_order_number', 'Numero de orden de compra');
    const orderDate = requiredText(req.body, 'order_date', 'Fecha de orden');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const projectName = optionalText(req.body, 'project_name');
    const notes = optionalText(req.body, 'notes');
    const audit = createdByFields(req);

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    const existing = db.prepare('SELECT id FROM ecovis_purchase_orders WHERE purchase_order_number = ? AND is_cancelled = 0').get(purchaseOrderNumber);
    if (existing) throw badRequest('Ya existe una OC activa con ese numero.');

    const result = db.prepare(
      `INSERT INTO ecovis_purchase_orders (purchase_order_number, project_name, order_date, total_amount, currency, exchange_rate_to_mxn, amount_mxn, pending_amount_mxn, notes, created_by, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(purchaseOrderNumber, projectName, orderDate, totalAmount, currency, exchangeRate, amountMxn, amountMxn, notes, req.session.username, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'ecovis', entityType: 'ecovis_purchase_order', entityId: result.lastInsertRowid, entityLabel: purchaseOrderNumber, metadata: { currency, exchange_rate_to_mxn: exchangeRate, amount_mxn: amountMxn } });
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(po);
  } catch (error) {
    next(error);
  }
});

app.put('/api/ecovis/purchase-orders/:id', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    if (po.is_cancelled) throw badRequest('No se puede editar una OC cancelada.');

    const purchaseOrderNumber = requiredText(req.body, 'purchase_order_number', 'Numero de orden de compra');
    const orderDate = requiredText(req.body, 'order_date', 'Fecha de orden');
    const totalAmount = numberValue(req.body, 'total_amount', 'Monto total', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const projectName = optionalText(req.body, 'project_name');
    const notes = optionalText(req.body, 'notes');
    const audit = updatedByFields(req);

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyEcovis(totalAmount * exchangeRate);

    const dup = db.prepare('SELECT id FROM ecovis_purchase_orders WHERE purchase_order_number = ? AND is_cancelled = 0 AND id != ?').get(purchaseOrderNumber, req.params.id);
    if (dup) throw badRequest('Ya existe otra OC activa con ese numero.');

    db.prepare(
      `UPDATE ecovis_purchase_orders SET purchase_order_number = ?, project_name = ?, order_date = ?, total_amount = ?, currency = ?, exchange_rate_to_mxn = ?, amount_mxn = ?, notes = ?, updated_by = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?`,
    ).run(purchaseOrderNumber, projectName, orderDate, totalAmount, currency, exchangeRate, amountMxn, notes, req.session.username, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);

    recalculatePurchaseOrderStatus(Number(req.params.id));
    logAuditEvent(db, { req, action: 'update', module: 'ecovis', entityType: 'ecovis_purchase_order', entityId: Number(req.params.id), entityLabel: purchaseOrderNumber, before: po });
    res.json(db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/purchase-orders/:id/cancel', requireAuth, requirePermission('ecovisAccount', 'cancel'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    if (po.is_cancelled) throw badRequest('La OC ya esta cancelada.');
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
    const audit = updatedByFields(req);

    db.prepare(
      `UPDATE ecovis_purchase_orders SET is_cancelled = 1, status = 'cancelada', cancelled_at = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = ?, updated_by_user_id = ?, updated_by_name = ? WHERE id = ?`,
    ).run(audit.updated_at, req.session.username, reason, audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, req.params.id);

    logAuditEvent(db, { req, action: 'cancel', module: 'ecovis', entityType: 'ecovis_purchase_order', entityId: Number(req.params.id), entityLabel: po.purchase_order_number, metadata: { reason } });
    res.json(db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecovis/purchase-orders/:id/allocate', requireAuth, requirePermission('ecovisAccount', 'edit'), (req, res, next) => {
  try {
    const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) throw badRequest('Orden de compra no encontrada.');
    if (po.is_cancelled) throw badRequest('No se puede asignar a una OC cancelada.');

    const paymentId = req.body.payment_id;
    if (!paymentId) throw badRequest('payment_id es obligatorio.');
    const payment = db.prepare('SELECT * FROM ecovis_payments WHERE id = ?').get(paymentId);
    if (!payment) throw badRequest('Pago no encontrado.');
    if (payment.is_cancelled) throw badRequest('No se puede asignar a un pago cancelado.');

    const amount = numberValue(req.body, 'amount', 'Monto', { min: 0.01 });
    const notes = optionalText(req.body, 'notes');
    const audit = createdByFields(req);

    const existingAllocs = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE payment_id = ? AND is_cancelled = 0').all(paymentId);
    const totalAllocated = existingAllocs.reduce((s, a) => s + Number(a.amount), 0);
    const available = Number(payment.amount) - totalAllocated;
    if (amount > available + 0.01) throw badRequest(`Monto excede el disponible del pago ($${available.toFixed(2)}).`);

    const result = db.prepare(
      `INSERT INTO ecovis_payment_allocations (payment_id, ecovis_purchase_order_id, allocation_type, amount, notes, created_by, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, 'orden_compra', ?, ?, ?, ?, ?, ?)`,
    ).run(paymentId, po.id, amount, notes, req.session.username, audit.created_by_user_id, audit.created_at, audit.created_at);

    recalculatePaymentUnallocated(paymentId);
    recalculatePurchaseOrderStatus(po.id);

    logAuditEvent(db, { req, action: 'allocate_to_po', module: 'ecovis', entityType: 'ecovis_payment_allocation', entityId: result.lastInsertRowid, entityLabel: `${po.purchase_order_number} $${amount}` });
    res.status(201).json(db.prepare('SELECT * FROM ecovis_payment_allocations WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    next(error);
  }
});

function recalculatePurchaseOrderStatus(poId) {
  const po = db.prepare('SELECT * FROM ecovis_purchase_orders WHERE id = ?').get(poId);
  if (!po || po.is_cancelled) return;
  const allocs = db.prepare('SELECT * FROM ecovis_payment_allocations WHERE ecovis_purchase_order_id = ? AND is_cancelled = 0').all(poId);
  const totalApplied = allocs.reduce((s, a) => s + Number(a.amount), 0);
  let newStatus = 'pendiente';
  if (totalApplied >= Number(po.total_amount)) newStatus = 'pagada';
  else if (totalApplied > 0) newStatus = 'parcialmente_pagada';
  db.prepare('UPDATE ecovis_purchase_orders SET status = ? WHERE id = ?').run(newStatus, poId);
}

// ===================== END ECOVIS MODULE =====================

// ===================== SERVICE QUOTER MODULE =====================

// GET /api/service-quoter/config - Load configuration and service types
app.get('/api/service-quoter/config', requireAuth, requirePermission('serviceQuoter', 'view'), (req, res) => {
  const settings = db.prepare("SELECT key, value, label, category FROM service_quote_settings WHERE category != 'importacion' ORDER BY key").all();
  const serviceTypes = db.prepare('SELECT id, name, margin, active, sort_order FROM service_types WHERE active = 1 ORDER BY sort_order, id').all();
  res.json({ settings, serviceTypes });
});

// GET /api/service-quoter/service-types - List all service types (including inactive, for configure)
app.get('/api/service-quoter/service-types', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const serviceTypes = db.prepare(
    'SELECT id, name, margin, active, sort_order, created_by_name, created_at, updated_by_name, updated_at FROM service_types ORDER BY sort_order, id',
  ).all();
  res.json(serviceTypes.map((st) => ({
    ...st,
    created_at_cdmx: formatDateTimeCDMX(st.created_at),
    updated_at_cdmx: formatDateTimeCDMX(st.updated_at),
  })));
});

// POST /api/service-quoter/service-types - Create a new service type (requires admin password)
app.post('/api/service-quoter/service-types', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const { name, margin, sort_order, adminPassword } = req.body;
  if (!adminPassword) {
    return res.status(400).json({ message: 'Se requiere contraseña de administrador.' });
  }
  const adminUser = db.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
    logAuditEvent(db, { req, action: 'config_change_denied', module: 'serviceQuoter', entityType: 'service_type', entityLabel: 'Intento fallido: contraseña incorrecta' });
    return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
  }

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Nombre del tipo de servicio es obligatorio.' });
  }
  const marginNum = Number(margin);
  if (Number.isNaN(marginNum) || marginNum < 0 || marginNum >= 1) {
    return res.status(400).json({ message: 'Margen debe ser un valor entre 0 y menor a 1 (ej: 0.60 para 60%).' });
  }
  const sortNum = Number(sort_order) || 0;
  const audit = createdByFields(req);

  const result = db.prepare(
    `INSERT INTO service_types (name, margin, sort_order, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(String(name).trim(), marginNum, sortNum, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_by_user_id, audit.created_by_name, audit.created_at);

  logAuditEvent(db, {
    req, action: 'create', module: 'serviceQuoter', entityType: 'service_type',
    entityId: result.lastInsertRowid, entityLabel: String(name).trim(),
    after: { name: String(name).trim(), margin: marginNum, sort_order: sortNum },
  });

  const created = db.prepare('SELECT * FROM service_types WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...created, created_at_cdmx: formatDateTimeCDMX(created.created_at), updated_at_cdmx: formatDateTimeCDMX(created.updated_at) });
});

// PUT /api/service-quoter/service-types/:id - Update a service type (requires admin password)
app.put('/api/service-quoter/service-types/:id', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;
  if (!adminPassword) {
    return res.status(400).json({ message: 'Se requiere contraseña de administrador.' });
  }
  const adminUser = db.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
    logAuditEvent(db, { req, action: 'config_change_denied', module: 'serviceQuoter', entityType: 'service_type', entityId: Number(id), entityLabel: 'Intento fallido: contraseña incorrecta' });
    return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
  }

  const existing = db.prepare('SELECT * FROM service_types WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ message: 'Tipo de servicio no encontrado.' });
  }

  const { name, margin, active, sort_order } = req.body;
  const newName = name !== undefined ? String(name).trim() : existing.name;
  if (!newName) {
    return res.status(400).json({ message: 'Nombre del tipo de servicio es obligatorio.' });
  }

  let newMargin = existing.margin;
  if (margin !== undefined) {
    newMargin = Number(margin);
    if (Number.isNaN(newMargin) || newMargin < 0 || newMargin >= 1) {
      return res.status(400).json({ message: 'Margen debe ser un valor entre 0 y menor a 1 (ej: 0.60 para 60%).' });
    }
  }

  const newActive = active !== undefined ? (active ? 1 : 0) : existing.active;
  const newSort = sort_order !== undefined ? Number(sort_order) : existing.sort_order;
  const audit = updatedByFields(req);

  db.prepare(
    `UPDATE service_types SET name = ?, margin = ?, active = ?, sort_order = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?`,
  ).run(newName, newMargin, newActive, newSort, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, id);

  const action = active === false || active === 0 ? 'deactivate' : 'update';
  logAuditEvent(db, {
    req, action, module: 'serviceQuoter', entityType: 'service_type',
    entityId: Number(id), entityLabel: newName,
    before: { name: existing.name, margin: existing.margin, active: existing.active, sort_order: existing.sort_order },
    after: { name: newName, margin: newMargin, active: newActive, sort_order: newSort },
  });

  const updated = db.prepare('SELECT * FROM service_types WHERE id = ?').get(id);
  res.json({ ...updated, created_at_cdmx: formatDateTimeCDMX(updated.created_at), updated_at_cdmx: formatDateTimeCDMX(updated.updated_at) });
});

// GET /api/service-quoter/settings - Get all settings (for configure panel)
app.get('/api/service-quoter/settings', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const settings = db.prepare("SELECT key, value, label, category, updated_by_name, updated_at FROM service_quote_settings WHERE category != 'importacion' ORDER BY category, key").all();
  res.json(settings.map((s) => ({ ...s, updated_at_cdmx: formatDateTimeCDMX(s.updated_at) })));
});

// PUT /api/service-quoter/settings - Update settings (requires admin password)
app.put('/api/service-quoter/settings', requireAuth, requirePermission('serviceQuoter', 'configure'), (req, res) => {
  const { settings, adminPassword } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ message: 'Se requiere un objeto settings con las claves a actualizar.' });
  }
  if (!adminPassword) {
    return res.status(400).json({ message: 'Se requiere contraseña de administrador.' });
  }
  const adminUser = db.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
    logAuditEvent(db, { req, action: 'config_change_denied', module: 'serviceQuoter', entityType: 'service_quote_settings', entityLabel: 'Intento fallido: contraseña incorrecta' });
    return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
  }

  const audit = updatedByFields(req);
  const beforeSettings = {};
  const afterSettings = {};
  const existingRows = db.prepare("SELECT key, value FROM service_quote_settings WHERE category != 'importacion'").all();
  const existingMap = Object.fromEntries(existingRows.map((r) => [r.key, r.value]));

  const updateStmt = db.prepare(
    'UPDATE service_quote_settings SET value = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE key = ?',
  );

  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      if (existingMap[key] === undefined) continue;
      if (String(value) === existingMap[key]) continue;
      beforeSettings[key] = existingMap[key];
      afterSettings[key] = String(value);
      updateStmt.run(String(value), audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, key);
    }
  });

  updateAll();

  if (Object.keys(afterSettings).length > 0) {
    logAuditEvent(db, {
      req, action: 'update', module: 'serviceQuoter', entityType: 'service_quote_settings',
      entityLabel: 'Configuración del cotizador',
      before: beforeSettings,
      after: afterSettings,
    });
  }

  const updatedSettings = db.prepare("SELECT key, value, label, category, updated_by_name, updated_at FROM service_quote_settings WHERE category != 'importacion' ORDER BY category, key").all();
  res.json(updatedSettings.map((s) => ({ ...s, updated_at_cdmx: formatDateTimeCDMX(s.updated_at) })));
});

// ===================== END SERVICE QUOTER MODULE =====================

// ===================== BACKUP MODULE =====================

const {
  BACKUP_SCHEMA_VERSION,
  BACKUP_ENTITIES,
  EXCLUDED_ENTITIES,
  getIncludedEntities,
  buildCoverageManifest,
} = require('./backupRegistry');

app.get('/api/admin/backup', requireAuth, requirePermission('backups', 'backup'), (req, res) => {
  const entities = getIncludedEntities();
  const data = {};
  const recordCounts = {};
  const entityChecksums = {};
  const includedEntities = [];
  const warnings = [];

  for (const entity of entities) {
    try {
      const rows = db.prepare(entity.query).all();
      data[entity.key] = rows;
      recordCounts[entity.key] = rows.length;
      entityChecksums[entity.key] = String(rows.length);
      includedEntities.push(entity.key);
    } catch (err) {
      data[entity.key] = [];
      recordCounts[entity.key] = 0;
      warnings.push(`No se pudo respaldar ${entity.key}: ${err.message}`);
    }
  }

  for (const entity of entities) {
    if (recordCounts[entity.key] === undefined) {
      warnings.push(`Entidad ${entity.key} incluida sin recordCount.`);
    }
  }

  const backup = {
    backupMetadata: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appName: 'REVRAM Dashboard',
      exportedAt: new Date().toISOString(),
      exportedBy: req.session.username || 'admin',
      environment: process.env.NODE_ENV || 'development',
      recordCounts,
      entityChecksums,
      includedEntities,
      excludedEntities: EXCLUDED_ENTITIES.map((e) => e.key),
      warnings,
    },
    coverageManifest: buildCoverageManifest(includedEntities, warnings),
    data,
  };

  logAuditEvent(db, { req, action: 'backup_create', module: 'backup', entityType: 'backup', entityLabel: `Respaldo ${backup.backupMetadata.exportedAt}`, metadata: { recordCounts, warnings } });

  if (warnings.length > 0) {
    return res.status(207).json(backup);
  }

  res.json(backup);
});

app.post('/api/admin/backup/preview', requireAuth, requirePermission('backups', 'import'), (req, res) => {
  const backup = req.body;
  if (!backup || !backup.backupMetadata || !backup.data) {
    return res.status(400).json({ message: 'Archivo de respaldo invalido. Faltan backupMetadata o data.' });
  }

  if (!backup.backupMetadata.schemaVersion) {
    return res.status(400).json({ message: 'El respaldo no contiene schemaVersion.' });
  }

  const entities = getIncludedEntities();
  const preview = {};
  const conflicts = [];

  for (const entity of entities) {
    const backupRows = backup.data[entity.key] || [];
    let existingRows = [];
    try {
      existingRows = db.prepare(entity.query).all();
    } catch (e) {
      existingRows = [];
    }

    const newRecords = [];
    const duplicates = [];
    const entityConflicts = [];

    for (const row of backupRows) {
      const match = existingRows.find((existing) => {
        if (entity.stableKeys.length === 0) return existing.id === row.id;
        return entity.stableKeys.every((k) => existing[k] != null && String(existing[k]) === String(row[k]));
      });

      if (!match) {
        if (entity.key === 'projectPayments' || entity.key === 'projectCosts') {
          const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
          if (!parentExists) {
            entityConflicts.push({ row, reason: `Proyecto padre id=${row.project_id} no encontrado` });
            continue;
          }
        }
        if (entity.key === 'vacationRequests') {
          const parentExists = db.prepare('SELECT id FROM employees WHERE id = ?').get(row.employee_id);
          if (!parentExists) {
            entityConflicts.push({ row, reason: `Empleado padre id=${row.employee_id} no encontrado` });
            continue;
          }
        }
        if (entity.key === 'projectReports' || entity.key === 'reportsArchive') {
          const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
          if (!parentExists) {
            entityConflicts.push({ row, reason: `Proyecto padre id=${row.project_id} no encontrado` });
            continue;
          }
        }
        if (entity.key === 'ecovisPaymentAllocations') {
          const paymentExists = db.prepare('SELECT id FROM ecovis_payments WHERE id = ?').get(row.payment_id);
          if (!paymentExists) {
            entityConflicts.push({ row, reason: `Pago ECOVIS padre id=${row.payment_id} no encontrado` });
            continue;
          }
        }
        newRecords.push(row);
      } else {
        const hasChanges = Object.keys(row).some((k) => {
          if (k === 'id' || k === 'created_at' || k === 'updated_at') return false;
          if (entity.stableKeys.includes(k)) return false;
          return String(row[k] ?? '') !== String(match[k] ?? '');
        });
        if (hasChanges) {
          entityConflicts.push({ row, existing: match, reason: 'Datos difieren del registro existente' });
        } else {
          duplicates.push(row);
        }
      }
    }

    preview[entity.key] = {
      inBackup: backupRows.length,
      existing: existingRows.length,
      newToAdd: newRecords.length,
      duplicatesOmitted: duplicates.length,
      conflicts: entityConflicts.length,
    };

    if (entityConflicts.length > 0) {
      conflicts.push({ entity: entity.key, items: entityConflicts.slice(0, 20) });
    }
  }

  res.json({ preview, conflicts, schemaVersion: backup.backupMetadata.schemaVersion });
});

app.post('/api/admin/backup/import', requireAuth, requirePermission('backups', 'import'), (req, res) => {
  const backup = req.body;
  if (!backup || !backup.backupMetadata || !backup.data) {
    return res.status(400).json({ message: 'Archivo de respaldo invalido.' });
  }

  const importLog = {
    importedAt: new Date().toISOString(),
    importedBy: req.session.username || 'admin',
    fileName: backup.backupMetadata.appName || 'unknown',
    schemaVersion: backup.backupMetadata.schemaVersion || '0.0.0',
    backupExportedAt: backup.backupMetadata.exportedAt || null,
    status: 'completed',
    summary: {},
    conflicts: [],
    errors: [],
  };

  const entities = getIncludedEntities();

  const importInTransaction = db.transaction(() => {
    const orderedEntities = [
      'settings', 'usersSafe', 'userPermissions', 'projects', 'closedProjects',
      'projectPayments', 'projectCosts', 'employees', 'vacationRequests',
      'payrollAttendanceWeeks', 'payrollAttendanceEmployees', 'attendanceStatuses',
      'projectReports', 'reportsArchive', 'ecovisPurchaseOrders', 'ecovisProjects', 'ecovisPayments',
      'ecovisPaymentAllocations', 'ecovisLoans', 'ecovisMovements',
      'serviceTypes', 'serviceQuoteSettings',
      'loginAttempts', 'auditLogs', 'backupImportLogs',
    ];

    for (const entityKey of orderedEntities) {
      const entityDef = entities.find((e) => e.key === entityKey);
      if (!entityDef) continue;

      const backupRows = backup.data[entityKey] || [];
      let existingRows = [];
      try { existingRows = db.prepare(entityDef.query).all(); } catch (e) { existingRows = []; }

      let added = 0;
      let skipped = 0;
      const entityConflicts = [];

      for (const row of backupRows) {
        const match = existingRows.find((existing) => {
          if (entityDef.stableKeys.length === 0) return existing.id === row.id;
          return entityDef.stableKeys.every((k) => existing[k] != null && String(existing[k]) === String(row[k]));
        });

        if (match) {
          const hasChanges = Object.keys(row).some((k) => {
            if (k === 'id' || k === 'created_at' || k === 'updated_at') return false;
            if (entityDef.stableKeys.includes(k)) return false;
            return String(row[k] ?? '') !== String(match[k] ?? '');
          });
          if (hasChanges) entityConflicts.push({ backupId: row.id, existingId: match.id, reason: 'Datos difieren' });
          skipped++;
          continue;
        }

        if (entityKey === 'usersSafe' || entityKey === 'settings' || entityKey === 'auditLogs' || entityKey === 'loginAttempts' || entityKey === 'userPermissions' || entityKey === 'backupImportLogs') { skipped++; continue; }

        try {
          if (entityKey === 'projects' || entityKey === 'closedProjects') {
            const existing = db.prepare('SELECT id FROM projects WHERE quote_number = ?').get(row.quote_number);
            if (existing) { skipped++; continue; }
            const cols = ['quote_number', 'order_number', 'purchase_order_number', 'purchase_order_not_applicable', 'seller', 'client_name', 'project_description', 'expected_margin', 'total_invoiced', 'total_invoiced_currency', 'progress_percent', 'technician_name', 'promised_delivery_date', 'status', 'risk', 'observations', 'closed_at'];
            const vals = cols.map((c) => row[c] !== undefined ? row[c] : null);
            db.prepare(`INSERT INTO projects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
            added++;
          } else if (entityKey === 'projectPayments') {
            const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Proyecto padre no encontrado' }); continue; }
            db.prepare('INSERT INTO project_payments (project_id, amount, currency, payment_date, notes) VALUES (?, ?, ?, ?, ?)').run(row.project_id, row.amount, row.currency || 'MXN', row.payment_date, row.notes || null);
            added++;
          } else if (entityKey === 'projectCosts') {
            const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Proyecto padre no encontrado' }); continue; }
            db.prepare('INSERT INTO project_costs (project_id, category, description, amount, currency, cost_date) VALUES (?, ?, ?, ?, ?, ?)').run(row.project_id, row.category, row.description, row.amount, row.currency || 'MXN', row.cost_date);
            added++;
          } else if (entityKey === 'employees') {
            const existing = db.prepare('SELECT id FROM employees WHERE employee_number = ?').get(row.employee_number);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO employees (employee_number, full_name, hire_date, department, position, immediate_boss, active, termination_date, inactive_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.employee_number, row.full_name, row.hire_date, row.department || null, row.position || null, row.immediate_boss || null, row.active ?? 1, row.termination_date || null, row.inactive_reason || null);
            added++;
          } else if (entityKey === 'vacationRequests') {
            const parentExists = db.prepare('SELECT id FROM employees WHERE id = ?').get(row.employee_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Empleado padre no encontrado' }); continue; }
            db.prepare('INSERT INTO vacation_requests (employee_id, start_date, end_date, requested_days, vacation_exercise_year, status, is_first_vacation_of_exercise, include_vacation_bonus, created_by, authorized_by, hr_responsible, notes, creates_negative_balance, negative_days_generated, admin_override_reason, balance_after_request) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.employee_id, row.start_date, row.end_date, row.requested_days, row.vacation_exercise_year, row.status, row.is_first_vacation_of_exercise ?? 0, row.include_vacation_bonus ?? 1, row.created_by || null, row.authorized_by || null, row.hr_responsible || null, row.notes || null, row.creates_negative_balance ?? 0, row.negative_days_generated ?? 0, row.admin_override_reason || null, row.balance_after_request ?? null);
            added++;
          } else if (entityKey === 'payrollAttendanceWeeks') {
            const existingWeek = db.prepare("SELECT id FROM payroll_attendance_weeks WHERE year = ? AND week_number = ? AND deleted_at IS NULL AND status != 'cancelada'").get(row.year, row.week_number);
            if (existingWeek) { skipped++; continue; }
            db.prepare('INSERT INTO payroll_attendance_weeks (year, week_number, week_start_date, week_end_date, title, status, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at, closed_by_user_id, closed_by_name, closed_at, deleted_at, deleted_by_user_id, deleted_by_name, delete_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.year, row.week_number, row.week_start_date, row.week_end_date, row.title || null, row.status || 'borrador', row.created_by_user_id || null, row.created_by_name || null, row.created_at, row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at, row.closed_by_user_id || null, row.closed_by_name || null, row.closed_at || null, row.deleted_at || null, row.deleted_by_user_id || null, row.deleted_by_name || null, row.delete_reason || null);
            added++;
          } else if (entityKey === 'payrollAttendanceEmployees') {
            const parentWeek = db.prepare('SELECT id FROM payroll_attendance_weeks WHERE id = ?').get(row.payroll_attendance_week_id);
            if (!parentWeek) { entityConflicts.push({ backupId: row.id, reason: 'Nómina semanal padre no encontrada' }); continue; }
            db.prepare('INSERT INTO payroll_attendance_employees (payroll_attendance_week_id, employee_id, employee_number_snapshot, full_name_snapshot, position_snapshot, department_snapshot, monday_status, tuesday_status, wednesday_status, thursday_status, friday_status, saturday_status, sunday_status, project_location_text, extra_payment_amount, extra_payment_currency, notes, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.payroll_attendance_week_id, row.employee_id, row.employee_number_snapshot, row.full_name_snapshot, row.position_snapshot || null, row.department_snapshot || null, row.monday_status || 'A', row.tuesday_status || 'A', row.wednesday_status || 'A', row.thursday_status || 'A', row.friday_status || 'A', row.saturday_status || 'D', row.sunday_status || 'D', row.project_location_text || null, row.extra_payment_amount || null, row.extra_payment_currency || 'MXN', row.notes || null, row.created_by_user_id || null, row.created_by_name || null, row.created_at, row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at);
            added++;
          } else if (entityKey === 'attendanceStatuses') {
            skipped++;
          } else if (entityKey === 'projectReports' || entityKey === 'reportsArchive') {
            const parentExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(row.project_id);
            if (!parentExists) { entityConflicts.push({ backupId: row.id, reason: 'Proyecto padre no encontrado' }); continue; }
            const existing = db.prepare('SELECT id FROM project_reports WHERE report_folio = ?').get(row.report_folio);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO project_reports (project_id, report_folio, client_name, client_address, service_name, report_date, assigned_technicians, burner_model, equipment_model_serial, pumps_motors_model, fuel, voltage, gas_pressure_inh2o, liquid_fuel_pressure_psi, working_pressure, pump_amperage, fan_amperage, condensate_tank_temp_c, operating_output_temp_c, flue_gas_temp_c, safety_tests, comments, emissions_low_fire, emissions_high_fire, technician_name, plant_manager_name, created_by, updated_by, report_type, report_data, deleted_at, deleted_by, delete_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.project_id, row.report_folio, row.client_name, row.client_address || null, row.service_name, row.report_date, row.assigned_technicians || null, row.burner_model || null, row.equipment_model_serial || null, row.pumps_motors_model || null, row.fuel || null, row.voltage || null, row.gas_pressure_inh2o || null, row.liquid_fuel_pressure_psi || null, row.working_pressure || null, row.pump_amperage || null, row.fan_amperage || null, row.condensate_tank_temp_c || null, row.operating_output_temp_c || null, row.flue_gas_temp_c || null, row.safety_tests || null, row.comments || null, row.emissions_low_fire || null, row.emissions_high_fire || null, row.technician_name || null, row.plant_manager_name || null, row.created_by || null, row.updated_by || null, row.report_type || 'boiler_startup', row.report_data || null, row.deleted_at || null, row.deleted_by || null, row.delete_reason || null);
            added++;
          } else if (entityKey === 'ecovisPurchaseOrders') {
            const existingPo = db.prepare('SELECT id FROM ecovis_purchase_orders WHERE purchase_order_number = ?').get(row.purchase_order_number);
            if (existingPo) { skipped++; continue; }
            db.prepare('INSERT INTO ecovis_purchase_orders (purchase_order_number, project_name, client_name, order_date, total_amount, currency, status, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.purchase_order_number, row.project_name || null, row.client_name || 'ECOVIS', row.order_date, row.total_amount, row.currency || 'MXN', row.status || 'pendiente', row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null);
            added++;
          } else if (entityKey === 'ecovisProjects') {
            db.prepare('INSERT INTO ecovis_projects (project_name, client_name, quote_number, purchase_order_number, invoice_number, project_date, description, total_amount, currency, status, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.project_name, row.client_name || 'ECOVIS', row.quote_number || null, row.purchase_order_number || null, row.invoice_number || null, row.project_date, row.description || null, row.total_amount, row.currency || 'MXN', row.status || 'pendiente', row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null, row.updated_by || null);
            added++;
          } else if (entityKey === 'ecovisPayments') {
            db.prepare('INSERT INTO ecovis_payments (payment_date, amount, currency, payment_method, bank_reference, source_description, notes, unallocated_amount, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.payment_date, row.amount, row.currency || 'MXN', row.payment_method || null, row.bank_reference || null, row.source_description || null, row.notes || null, row.unallocated_amount ?? 0, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null, row.updated_by || null);
            added++;
          } else if (entityKey === 'ecovisPaymentAllocations') {
            const paymentExists = db.prepare('SELECT id FROM ecovis_payments WHERE id = ?').get(row.payment_id);
            if (!paymentExists) { entityConflicts.push({ backupId: row.id, reason: 'Pago ECOVIS padre no encontrado' }); continue; }
            db.prepare('INSERT INTO ecovis_payment_allocations (payment_id, ecovis_project_id, allocation_type, amount, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.payment_id, row.ecovis_project_id || null, row.allocation_type, row.amount, row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null);
            added++;
          } else if (entityKey === 'ecovisLoans' || entityKey === 'ecovisMovements') {
            db.prepare('INSERT INTO ecovis_movements (movement_date, movement_type, description, amount, currency, direction, reference, related_project_id, related_payment_id, payment_method, bank_reference, notes, is_cancelled, cancelled_at, cancelled_by, cancellation_reason, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.movement_date, row.movement_type, row.description, row.amount, row.currency || 'MXN', row.direction || 'neutral', row.reference || null, row.related_project_id || null, row.related_payment_id || null, row.payment_method || null, row.bank_reference || null, row.notes || null, row.is_cancelled ?? 0, row.cancelled_at || null, row.cancelled_by || null, row.cancellation_reason || null, row.created_by || null, row.updated_by || null);
            added++;
          } else if (entityKey === 'serviceTypes') {
            const existing = db.prepare('SELECT id FROM service_types WHERE name = ?').get(row.name);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO service_types (name, margin, active, sort_order, created_by_user_id, created_by_name, created_at, updated_by_user_id, updated_by_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.name, row.margin, row.active ?? 1, row.sort_order ?? 0, row.created_by_user_id || null, row.created_by_name || null, row.created_at || nowUtc(), row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at || nowUtc());
            added++;
          } else if (entityKey === 'serviceQuoteSettings') {
            const existing = db.prepare('SELECT key FROM service_quote_settings WHERE key = ?').get(row.key);
            if (existing) { skipped++; continue; }
            db.prepare('INSERT INTO service_quote_settings (key, value, label, category, updated_by_user_id, updated_by_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(row.key, row.value, row.label || null, row.category || 'general', row.updated_by_user_id || null, row.updated_by_name || null, row.updated_at || nowUtc());
            added++;
          } else if (entityKey === 'auditLogs') {
            db.prepare('INSERT INTO audit_logs (user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.user_id || null, row.user_name || null, row.action, row.module || null, row.entity_type || null, row.entity_id || null, row.entity_label || null, row.timestamp_utc, row.ip_address || null, row.user_agent || null, row.metadata_json || null, row.created_at || row.timestamp_utc);
            added++;
          }
        } catch (err) {
          importLog.errors.push({ entity: entityKey, rowId: row.id, error: err.message });
        }
      }

      importLog.summary[entityKey] = { added, skipped, conflicts: entityConflicts.length };
      if (entityConflicts.length > 0) {
        importLog.conflicts.push({ entity: entityKey, items: entityConflicts });
      }
    }
  });

  try {
    importInTransaction();
  } catch (err) {
    importLog.status = 'failed';
    importLog.errors.push({ critical: true, error: err.message });
    logAuditEvent(db, { req, action: 'backup_import', module: 'backup', entityType: 'backup', entityLabel: 'Import failed', metadata: { status: 'failed', error: err.message } });
    persistImportLog(importLog, null);
    return res.status(500).json({ message: 'Error critico durante importacion. Se realizo rollback.', importLog });
  }

  if (importLog.errors.length > 0) {
    importLog.status = 'completed_with_warnings';
  }

  const validation = validatePostImport();
  importLog.validation = validation;
  if (validation.errors.length > 0) {
    importLog.status = 'completed_with_warnings';
  }

  persistImportLog(importLog, validation);
  logAuditEvent(db, { req, action: 'backup_import', module: 'backup', entityType: 'backup', entityLabel: `Import ${importLog.status}`, metadata: { status: importLog.status, summary: importLog.summary } });
  res.json({ message: 'Importacion completada.', importLog });
});

function validatePostImport() {
  const errors = [];
  const warnings = [];

  const activeAdmin = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1").get();
  if (!activeAdmin || activeAdmin.count === 0) {
    errors.push('No existe un administrador activo en el sistema despues de la importacion.');
  }

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!totalUsers || totalUsers.count === 0) {
    errors.push('No existen usuarios en el sistema despues de la importacion.');
  }

  const orphanPayments = db.prepare('SELECT COUNT(*) as count FROM project_payments WHERE project_id NOT IN (SELECT id FROM projects)').get();
  if (orphanPayments && orphanPayments.count > 0) {
    warnings.push(`${orphanPayments.count} pagos sin proyecto padre valido.`);
  }

  const orphanCosts = db.prepare('SELECT COUNT(*) as count FROM project_costs WHERE project_id NOT IN (SELECT id FROM projects)').get();
  if (orphanCosts && orphanCosts.count > 0) {
    warnings.push(`${orphanCosts.count} costos sin proyecto padre valido.`);
  }

  const orphanPerms = db.prepare('SELECT COUNT(*) as count FROM user_permissions WHERE user_id NOT IN (SELECT id FROM users)').get();
  if (orphanPerms && orphanPerms.count > 0) {
    warnings.push(`${orphanPerms.count} permisos referenciando usuarios inexistentes.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function persistImportLog(importLog, validation) {
  try {
    db.prepare(
      `INSERT INTO backup_import_logs (imported_at, imported_by, schema_version, backup_exported_at, status, summary_json, conflicts_json, errors_json, validation_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      importLog.importedAt,
      importLog.importedBy,
      importLog.schemaVersion || null,
      importLog.backupExportedAt || null,
      importLog.status,
      JSON.stringify(importLog.summary),
      JSON.stringify(importLog.conflicts),
      JSON.stringify(importLog.errors),
      validation ? JSON.stringify(validation) : null,
    );
  } catch (err) {
    console.error('Failed to persist import log:', err.message);
  }
}

app.get('/api/admin/backup/logs', requireAuth, requirePermission('backups', 'view'), (req, res) => {
  const logs = db.prepare('SELECT * FROM backup_import_logs ORDER BY id DESC LIMIT 50').all();
  res.json({ data: logs.map((l) => ({ ...l, imported_at_cdmx: formatDateTimeCDMX(l.imported_at) })) });
});

// ===================== AUDIT LOGS =====================

app.get('/api/admin/audit-logs', requireAuth, requirePermission('backups', 'view'), (req, res) => {
  const { page, limit } = parsePaginationParams(req.query);
  const sorting = normalizeSort(req.query, {
    id: 'id',
    timestamp_utc: 'timestamp_utc',
    action: 'action',
    module: 'module',
    user_name: 'user_name',
  }, 'timestamp_utc DESC');

  const { whereClause, params, filters } = buildWhere({
    query: req.query,
    filters: {
      action: { type: 'text', column: 'action' },
      module: { type: 'text', column: 'module' },
      user_name: { type: 'text', column: 'user_name' },
      entity_type: { type: 'text', column: 'entity_type' },
    },
  });

  const result = paginateSqlList({
    tableSql: 'SELECT * FROM audit_logs',
    countSql: 'SELECT COUNT(*) as count FROM audit_logs',
    whereClause,
    params,
    page,
    limit,
    orderBy: sorting.orderBy,
    map: (row) => ({
      ...row,
      timestamp_cdmx: formatDateTimeCDMX(row.timestamp_utc),
      created_at_cdmx: formatDateTimeCDMX(row.created_at),
    }),
  });

  res.json(buildListResponse(result.data, result.pagination, sorting, filters));
});

// ===================== END BACKUP MODULE =====================

// ===================== FINANCIAL STATEMENTS MODULE =====================

const { calculateFinancialStatement, AP_CATEGORIES, CLASSIFICATION_TYPES, ADJUSTMENT_TYPES, roundMoney: roundMoneyFin, getFinancialWeekOfMonth } = require('./financial');

function requireAdminOnly(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Necesitas iniciar sesion.' });
  }
  if (req.session.role !== 'admin') {
    logAuditEvent(db, { req, action: 'access_denied', module: 'financial', metadata: { reason: 'admin_only', endpoint: req.originalUrl } });
    return res.status(403).json({ message: 'Acceso restringido. Solo el administrador puede consultar Estados Financieros.' });
  }
  return next();
}

// --- Admin Re-authentication ---

app.post('/api/financial/admin-reauth', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) throw badRequest('Contrasena requerida.');
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_active = 1").get(req.session.userId);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      logAuditEvent(db, { req, action: 'financial_reauth_failed', module: 'financial' });
      throw badRequest('Contrasena incorrecta o acceso no autorizado.');
    }
    req.session.financialReauthAt = Date.now();
    logAuditEvent(db, { req, action: 'financial_reauth_success', module: 'financial' });
    res.json({ success: true, expires_in_ms: 15 * 60 * 1000 });
  } catch (error) { next(error); }
});

app.get('/api/financial/reauth-status', requireAuth, requireAdminOnly, (req, res) => {
  const reauthAt = req.session.financialReauthAt || 0;
  const isValid = Date.now() - reauthAt < 15 * 60 * 1000;
  res.json({ authenticated: isValid });
});

// --- Financial Settings ---

app.get('/api/financial/settings', requireAuth, requireAdminOnly, (req, res) => {
  const settings = db.prepare('SELECT * FROM financial_settings WHERE id = 1').get();
  res.json(settings);
});

app.put('/api/financial/settings', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const { admin_password, estimated_isr_rate, ivan_commission_rate } = req.body;
    if (!admin_password) throw badRequest('Contrasena admin requerida.');
    const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' AND is_active = 1").get();
    if (!admin || !bcrypt.compareSync(admin_password, admin.password_hash)) {
      throw badRequest('Contrasena incorrecta.');
    }
    const isr = Number(estimated_isr_rate);
    const ivan = Number(ivan_commission_rate);
    if (isNaN(isr) || isr < 0) throw badRequest('ISR estimado debe ser >= 0.');
    if (isNaN(ivan) || ivan < 0) throw badRequest('Comision IVAN debe ser >= 0.');

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE financial_settings SET estimated_isr_rate = ?, ivan_commission_rate = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = 1`,
    ).run(isr, ivan, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at);

    logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'financial_settings', entityId: 1, entityLabel: 'Configuracion financiera', metadata: { estimated_isr_rate: isr, ivan_commission_rate: ivan } });
    res.json(db.prepare('SELECT * FROM financial_settings WHERE id = 1').get());
  } catch (error) { next(error); }
});

// --- Accounts Payable ---

app.get('/api/financial/accounts-payable', requireAuth, requireAdminOnly, (req, res) => {
  const { page, limit, search } = parsePaginationParams(req.query);
  const status = req.query.status || '';
  const year = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;

  let where = 'deleted_at IS NULL';
  const params = [];
  if (status && ['pendiente', 'pagada', 'cancelada'].includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (year) {
    where += " AND CAST(strftime('%Y', invoice_date) AS INTEGER) = ?";
    params.push(year);
  }
  if (month) {
    where += " AND CAST(strftime('%m', invoice_date) AS INTEGER) = ?";
    params.push(month);
  }
  if (search) {
    where += ' AND (supplier_name LIKE ? OR invoice_number LIKE ? OR category LIKE ? OR notes LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM accounts_payable WHERE ${where}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, total);
  const data = db.prepare(`SELECT * FROM accounts_payable WHERE ${where} ORDER BY invoice_date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, pag.limit, pag.offset);
  res.json({ data, pagination: pag, categories: AP_CATEGORIES });
});

app.post('/api/financial/accounts-payable', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const supplierName = requiredText(req.body, 'supplier_name', 'Proveedor');
    const invoiceNumber = requiredText(req.body, 'invoice_number', 'Numero de factura');
    const invoiceDate = requiredText(req.body, 'invoice_date', 'Fecha de factura');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const category = req.body.category || 'Otros';
    const dueDate = optionalText(req.body, 'due_date');
    const relatedProjectId = req.body.related_project_id || null;
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO accounts_payable (supplier_name, invoice_number, invoice_date, due_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn, category, related_project_id, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(supplierName, invoiceNumber, invoiceDate, dueDate, amountOriginal, currency, exchangeRate, amountMxn, category, relatedProjectId, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'accounts_payable', entityId: result.lastInsertRowid, entityLabel: `${supplierName} - ${invoiceNumber}` });
    res.status(201).json(db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

app.put('/api/financial/accounts-payable/:id', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const ap = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ap) throw badRequest('Cuenta por pagar no encontrada.');
    const supplierName = requiredText(req.body, 'supplier_name', 'Proveedor');
    const invoiceNumber = requiredText(req.body, 'invoice_number', 'Numero de factura');
    const invoiceDate = requiredText(req.body, 'invoice_date', 'Fecha de factura');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const category = req.body.category || 'Otros';
    const dueDate = optionalText(req.body, 'due_date');
    const relatedProjectId = req.body.related_project_id || null;
    const notes = optionalText(req.body, 'notes');
    const status = req.body.status || ap.status;
    const paidAt = req.body.paid_at || ap.paid_at;

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = updatedByFields(req);
    db.prepare(
      `UPDATE accounts_payable SET supplier_name=?, invoice_number=?, invoice_date=?, due_date=?, amount_original=?, currency=?, exchange_rate_to_mxn=?, amount_mxn=?, category=?, related_project_id=?, notes=?, status=?, paid_at=?, updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?`,
    ).run(supplierName, invoiceNumber, invoiceDate, dueDate, amountOriginal, currency, exchangeRate, amountMxn, category, relatedProjectId, notes, status, paidAt, audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);

    logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'accounts_payable', entityId: Number(req.params.id), entityLabel: `${supplierName} - ${invoiceNumber}`, before: ap });
    res.json(db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

app.post('/api/financial/accounts-payable/:id/cancel', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const ap = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ap) throw badRequest('Cuenta por pagar no encontrada.');
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
    const audit = updatedByFields(req);
    db.prepare(`UPDATE accounts_payable SET status='cancelada', deleted_at=?, deleted_by_user_id=?, deleted_by_name=?, delete_reason=?, updated_at=? WHERE id=?`)
      .run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, reason, audit.updated_at, req.params.id);
    logAuditEvent(db, { req, action: 'cancel', module: 'financial', entityType: 'accounts_payable', entityId: Number(req.params.id), entityLabel: `${ap.supplier_name} - ${ap.invoice_number}`, metadata: { reason } });
    res.json(db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// --- Accounts Payable Payments ---

app.get('/api/financial/accounts-payable/:id/payments', requireAuth, requireAdminOnly, (req, res) => {
  const payments = db.prepare('SELECT * FROM accounts_payable_payments WHERE accounts_payable_id = ? ORDER BY payment_date DESC').all(req.params.id);
  const totalPaid = roundMoneyFin(payments.reduce((s, p) => s + Number(p.amount_mxn || 0), 0));
  res.json({ data: payments, total_paid_mxn: totalPaid });
});

app.post('/api/financial/accounts-payable/:id/payments', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const ap = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ap) throw badRequest('Cuenta por pagar no encontrada.');

    const paymentDate = requiredText(req.body, 'payment_date', 'Fecha de pago');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const paymentMethod = optionalText(req.body, 'payment_method');
    const bankMovementId = req.body.bank_movement_id || null;
    const reference = optionalText(req.body, 'reference');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO accounts_payable_payments (accounts_payable_id, payment_date, amount_original, currency, exchange_rate_to_mxn, amount_mxn, payment_method, bank_movement_id, reference, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(ap.id, paymentDate, amountOriginal, currency, exchangeRate, amountMxn, paymentMethod, bankMovementId, reference, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    // Recalculate AP status
    const allPayments = db.prepare('SELECT * FROM accounts_payable_payments WHERE accounts_payable_id = ?').all(ap.id);
    const totalPaidMxn = roundMoneyFin(allPayments.reduce((s, p) => s + Number(p.amount_mxn || 0), 0));
    let newStatus = 'pendiente';
    if (totalPaidMxn >= Number(ap.amount_mxn) - 0.01) newStatus = 'pagada';
    else if (totalPaidMxn > 0) newStatus = 'parcial';
    const paidAt = newStatus === 'pagada' ? paymentDate : null;
    db.prepare('UPDATE accounts_payable SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, paidAt, ap.id);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'accounts_payable_payment', entityId: result.lastInsertRowid, entityLabel: `Pago a ${ap.supplier_name}` });
    res.status(201).json(db.prepare('SELECT * FROM accounts_payable_payments WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

// --- Project Omissions ---

app.get('/api/financial/project-omissions', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
  const omissions = db.prepare('SELECT * FROM financial_project_omissions WHERE year = ? AND month = ?').all(year, month);
  res.json({ data: omissions });
});

app.post('/api/financial/project-omissions', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const projectId = numberValue(req.body, 'project_id', 'Proyecto', { min: 1 });
    const reason = requiredText(req.body, 'reason', 'Motivo de omision');

    const audit = createdByFields(req);
    const existing = db.prepare('SELECT id FROM financial_project_omissions WHERE year = ? AND month = ? AND project_id = ?').get(year, month, projectId);
    if (existing) {
      db.prepare('UPDATE financial_project_omissions SET omit = 1, reason = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?')
        .run(reason, audit.created_by_user_id, audit.created_by_name, audit.created_at, existing.id);
      logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'financial_project_omission', entityId: existing.id, metadata: { project_id: projectId, reason } });
      res.json(db.prepare('SELECT * FROM financial_project_omissions WHERE id = ?').get(existing.id));
    } else {
      const result = db.prepare(
        `INSERT INTO financial_project_omissions (year, month, project_id, omit, reason, created_by_user_id, created_by_name, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      ).run(year, month, projectId, reason, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'financial_project_omission', entityId: result.lastInsertRowid, metadata: { project_id: projectId, reason } });
      res.status(201).json(db.prepare('SELECT * FROM financial_project_omissions WHERE id = ?').get(result.lastInsertRowid));
    }
  } catch (error) { next(error); }
});

app.delete('/api/financial/project-omissions/:id', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const omission = db.prepare('SELECT * FROM financial_project_omissions WHERE id = ?').get(req.params.id);
    if (!omission) throw badRequest('Omision no encontrada.');
    db.prepare('DELETE FROM financial_project_omissions WHERE id = ?').run(req.params.id);
    logAuditEvent(db, { req, action: 'delete', module: 'financial', entityType: 'financial_project_omission', entityId: Number(req.params.id), metadata: { project_id: omission.project_id } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- Manual Payroll ---

app.get('/api/financial/payroll', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  let where = 'year = ?';
  const params = [year];
  if (month) { where += ' AND month = ?'; params.push(month); }
  const data = db.prepare(`SELECT * FROM manual_payroll_expenses WHERE ${where} ORDER BY month, id`).all(...params);
  const total = roundMoneyFin(data.reduce((s, r) => s + Number(r.amount_mxn || 0), 0));
  res.json({ data, total_mxn: total });
});

app.post('/api/financial/payroll', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const concept = requiredText(req.body, 'concept', 'Concepto');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO manual_payroll_expenses (year, month, concept, amount_original, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(year, month, concept, amountOriginal, currency, exchangeRate, amountMxn, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'manual_payroll', entityId: result.lastInsertRowid, entityLabel: concept });
    res.status(201).json(db.prepare('SELECT * FROM manual_payroll_expenses WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

// --- Financial Adjustments ---

app.get('/api/financial/adjustments', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  let where = 'year = ? AND deleted_at IS NULL';
  const params = [year];
  if (month) { where += ' AND month = ?'; params.push(month); }
  const data = db.prepare(`SELECT * FROM financial_adjustments WHERE ${where} ORDER BY month, id`).all(...params);
  res.json({ data, types: ADJUSTMENT_TYPES });
});

app.post('/api/financial/adjustments', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const adjustmentType = requiredText(req.body, 'adjustment_type', 'Tipo de ajuste');
    if (!ADJUSTMENT_TYPES.includes(adjustmentType)) throw badRequest('Tipo de ajuste no valido.');
    const concept = requiredText(req.body, 'concept', 'Concepto');
    const amountOriginal = numberValue(req.body, 'amount_original', 'Monto', { min: 0.01 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);
    const amountMxn = roundMoneyFin(amountOriginal * exchangeRate);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO financial_adjustments (year, month, adjustment_type, concept, amount_original, currency, exchange_rate_to_mxn, amount_mxn, notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(year, month, adjustmentType, concept, amountOriginal, currency, exchangeRate, amountMxn, notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'financial_adjustment', entityId: result.lastInsertRowid, entityLabel: concept });
    res.status(201).json(db.prepare('SELECT * FROM financial_adjustments WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

app.post('/api/financial/adjustments/:id/cancel', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const adj = db.prepare('SELECT * FROM financial_adjustments WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!adj) throw badRequest('Ajuste no encontrado.');
    const reason = requiredText(req.body, 'reason', 'Motivo de cancelacion');
    const audit = updatedByFields(req);
    db.prepare(`UPDATE financial_adjustments SET status='cancelado', deleted_at=?, deleted_by_user_id=?, deleted_by_name=?, delete_reason=?, updated_at=? WHERE id=?`)
      .run(audit.updated_at, audit.updated_by_user_id, audit.updated_by_name, reason, audit.updated_at, req.params.id);
    logAuditEvent(db, { req, action: 'cancel', module: 'financial', entityType: 'financial_adjustment', entityId: Number(req.params.id), entityLabel: adj.concept, metadata: { reason } });
    res.json(db.prepare('SELECT * FROM financial_adjustments WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// --- Bank Statement Summaries ---

app.get('/api/financial/bank-summaries', requireAuth, requireAdminOnly, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  let where = 'year = ?';
  const params = [year];
  if (month) { where += ' AND month = ?'; params.push(month); }
  const data = db.prepare(`SELECT * FROM bank_statement_summaries WHERE ${where} ORDER BY month, bank_name`).all(...params);
  res.json({ data });
});

app.post('/api/financial/bank-summaries', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const bankName = requiredText(req.body, 'bank_name', 'Banco');
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });
    const currency = currencyValue(req.body, 'currency', 'Moneda');
    const accountMasked = optionalText(req.body, 'account_number_masked');
    const initialBalance = Number(req.body.initial_balance_original || 0);
    const deposits = Number(req.body.deposits_original || 0);
    const withdrawals = Number(req.body.withdrawals_original || 0);
    const commissions = Number(req.body.commissions_original || 0);
    const commissionsVat = Number(req.body.commissions_vat_original || 0);
    const finalBalance = Number(req.body.final_balance_original || 0);
    const notes = optionalText(req.body, 'notes');

    const rates = getExchangeRateMap();
    const exchangeRate = currency === 'MXN' ? 1 : (rates[currency] || 1);

    const audit = createdByFields(req);
    const result = db.prepare(
      `INSERT INTO bank_statement_summaries (bank_name, account_number_masked, currency, year, month,
        initial_balance_original, deposits_original, withdrawals_original, commissions_original, commissions_vat_original, final_balance_original,
        exchange_rate_to_mxn, initial_balance_mxn, deposits_mxn, withdrawals_mxn, commissions_mxn, commissions_vat_mxn, final_balance_mxn,
        notes, created_by_user_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(bankName, accountMasked, currency, year, month,
      initialBalance, deposits, withdrawals, commissions, commissionsVat, finalBalance,
      exchangeRate,
      roundMoneyFin(initialBalance * exchangeRate), roundMoneyFin(deposits * exchangeRate), roundMoneyFin(withdrawals * exchangeRate),
      roundMoneyFin(commissions * exchangeRate), roundMoneyFin(commissionsVat * exchangeRate), roundMoneyFin(finalBalance * exchangeRate),
      notes, audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);

    logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'bank_statement_summary', entityId: result.lastInsertRowid, entityLabel: `${bankName} ${year}-${month}` });
    res.status(201).json(db.prepare('SELECT * FROM bank_statement_summaries WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

// --- Bank Statement Movements ---

app.get('/api/financial/bank-movements', requireAuth, requireAdminOnly, (req, res) => {
  const summaryId = req.query.bank_statement_summary_id;
  const year = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;
  const classificationStatus = req.query.classification_status || '';
  const { page, limit } = parsePaginationParams(req.query);

  let where = '1=1';
  const params = [];

  if (summaryId) {
    where += ' AND m.bank_statement_summary_id = ?';
    params.push(summaryId);
  }
  if (year || month) {
    where += ' AND EXISTS (SELECT 1 FROM bank_statement_summaries s WHERE s.id = m.bank_statement_summary_id';
    if (year) { where += ' AND s.year = ?'; params.push(year); }
    if (month) { where += ' AND s.month = ?'; params.push(month); }
    where += ')';
  }
  if (classificationStatus && ['sin_clasificar', 'clasificado', 'ignorado'].includes(classificationStatus)) {
    where += ' AND m.classification_status = ?';
    params.push(classificationStatus);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM bank_statement_movements m WHERE ${where}`).get(...params).count;
  const pag = buildPaginationMeta(page, limit, total);
  const data = db.prepare(`SELECT m.* FROM bank_statement_movements m WHERE ${where} ORDER BY m.transaction_date DESC, m.id DESC LIMIT ? OFFSET ?`).all(...params, pag.limit, pag.offset);
  res.json({ data, pagination: pag, classification_types: CLASSIFICATION_TYPES });
});

app.post('/api/financial/bank-movements', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const summaryId = numberValue(req.body, 'bank_statement_summary_id', 'Estado de cuenta', { min: 1 });
    const summary = db.prepare('SELECT * FROM bank_statement_summaries WHERE id = ?').get(summaryId);
    if (!summary) throw badRequest('Estado de cuenta no encontrado.');

    const transactionDate = requiredText(req.body, 'transaction_date', 'Fecha de transaccion');
    const description = optionalText(req.body, 'description');
    const reference = optionalText(req.body, 'reference');
    const depositOriginal = Number(req.body.deposit_original || 0);
    const withdrawalOriginal = Number(req.body.withdrawal_original || 0);
    const balanceOriginal = req.body.balance_original != null ? Number(req.body.balance_original) : null;
    const notes = optionalText(req.body, 'notes');

    const rate = Number(summary.exchange_rate_to_mxn || 1);
    const result = db.prepare(
      `INSERT INTO bank_statement_movements (bank_statement_summary_id, transaction_date, description, reference,
        deposit_original, withdrawal_original, currency, exchange_rate_to_mxn, deposit_mxn, withdrawal_mxn,
        balance_original, balance_mxn, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(summaryId, transactionDate, description, reference,
      depositOriginal, withdrawalOriginal, summary.currency, rate,
      roundMoneyFin(depositOriginal * rate), roundMoneyFin(withdrawalOriginal * rate),
      balanceOriginal, balanceOriginal != null ? roundMoneyFin(balanceOriginal * rate) : null, notes);

    res.status(201).json(db.prepare('SELECT * FROM bank_statement_movements WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) { next(error); }
});

app.put('/api/financial/bank-movements/:id/classify', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const mov = db.prepare('SELECT * FROM bank_statement_movements WHERE id = ?').get(req.params.id);
    if (!mov) throw badRequest('Movimiento no encontrado.');

    const classificationType = req.body.classification_type || null;
    const classificationStatus = req.body.classification_status || 'clasificado';
    if (!['sin_clasificar', 'clasificado', 'ignorado'].includes(classificationStatus)) {
      throw badRequest('Estado de clasificacion no valido.');
    }
    if (classificationStatus === 'clasificado' && (!classificationType || !CLASSIFICATION_TYPES.includes(classificationType))) {
      throw badRequest('Tipo de clasificacion requerido.');
    }

    const relatedProjectId = req.body.related_project_id || null;
    const relatedAccountPayableId = req.body.related_account_payable_id || null;
    const notes = req.body.notes !== undefined ? req.body.notes : mov.notes;

    db.prepare(
      `UPDATE bank_statement_movements SET classification_status=?, classification_type=?, related_project_id=?, related_account_payable_id=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).run(classificationStatus, classificationType, relatedProjectId, relatedAccountPayableId, notes, req.params.id);

    logAuditEvent(db, { req, action: 'classify', module: 'financial', entityType: 'bank_movement', entityId: Number(req.params.id), metadata: { classification_type: classificationType, classification_status: classificationStatus } });
    res.json(db.prepare('SELECT * FROM bank_statement_movements WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// --- Accounts Receivable (from projects) ---

app.get('/api/financial/accounts-receivable', requireAuth, requireAdminOnly, (req, res) => {
  const rateMap = getExchangeRateMap();
  const projects = db.prepare("SELECT * FROM projects WHERE closed_at IS NULL AND deleted_at IS NULL").all();
  const today = new Date();
  const data = [];
  for (const p of projects) {
    const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ?').all(p.id);
    const totalCharged = payments.reduce((sum, pay) => {
      const rate = rateMap[pay.currency || 'MXN'] || 1;
      return sum + Number(pay.amount || 0) * rate;
    }, 0);
    const invoicedMxn = Number(p.total_invoiced || 0) * (rateMap[p.total_invoiced_currency || 'MXN'] || 1);
    const pendingMxn = roundMoneyFin(invoicedMxn - totalCharged);
    if (pendingMxn > 0.01) {
      const creditDays = p.credit_days_na ? null : (p.credit_days || null);
      const invoiceDate = p.invoice_date_na ? null : (p.invoice_date || null);
      let dueDate = p.due_date || null;
      if (!dueDate && invoiceDate && creditDays) {
        const d = new Date(invoiceDate + 'T12:00:00');
        d.setDate(d.getDate() + creditDays);
        dueDate = d.toISOString().split('T')[0];
      }
      let daysOverdue = 0;
      let status_color = 'gray';
      if (dueDate) {
        const due = new Date(dueDate + 'T23:59:59');
        daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
        status_color = daysOverdue > 0 ? 'red' : 'green';
      }
      data.push({
        project_id: p.id,
        client_name: p.client_name,
        project_description: p.project_description,
        quote_number: p.quote_number,
        order_number: p.order_number,
        invoice_number: p.invoice_number || null,
        project_date: p.created_at,
        total_invoiced: p.total_invoiced,
        total_invoiced_currency: p.total_invoiced_currency || 'MXN',
        total_charged_mxn: roundMoneyFin(totalCharged),
        pending_mxn: pendingMxn,
        credit_days: creditDays,
        credit_days_na: !!p.credit_days_na,
        invoice_date: invoiceDate,
        invoice_date_na: !!p.invoice_date_na,
        due_date: dueDate,
        days_overdue: daysOverdue,
        status_color,
      });
    }
  }
  const totalMxn = roundMoneyFin(data.reduce((s, r) => s + r.pending_mxn, 0));
  const notOverdue = roundMoneyFin(data.filter((r) => r.status_color === 'green' || r.status_color === 'gray').reduce((s, r) => s + r.pending_mxn, 0));
  const overdue = roundMoneyFin(data.filter((r) => r.status_color === 'red').reduce((s, r) => s + r.pending_mxn, 0));
  const d1_30 = roundMoneyFin(data.filter((r) => r.days_overdue >= 1 && r.days_overdue <= 30).reduce((s, r) => s + r.pending_mxn, 0));
  const d31_60 = roundMoneyFin(data.filter((r) => r.days_overdue >= 31 && r.days_overdue <= 60).reduce((s, r) => s + r.pending_mxn, 0));
  const d61_90 = roundMoneyFin(data.filter((r) => r.days_overdue >= 61 && r.days_overdue <= 90).reduce((s, r) => s + r.pending_mxn, 0));
  const d90plus = roundMoneyFin(data.filter((r) => r.days_overdue > 90).reduce((s, r) => s + r.pending_mxn, 0));

  res.json({ data, summary: { total_mxn: totalMxn, not_overdue: notOverdue, overdue, d1_30, d31_60, d61_90, d90plus } });
});

// --- Financial Statement Generation ---

app.get('/api/financial/statements', requireAuth, requireAdminOnly, (req, res) => {
  const data = db.prepare("SELECT * FROM financial_statements WHERE deleted_at IS NULL ORDER BY year DESC, month DESC").all();
  res.json({ data });
});

app.post('/api/financial/statements/generate', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const year = numberValue(req.body, 'year', 'Año', { min: 2020, max: 2100 });
    const month = numberValue(req.body, 'month', 'Mes', { min: 1, max: 12 });

    const existing = db.prepare("SELECT * FROM financial_statements WHERE year = ? AND month = ? AND status != 'cancelado' AND deleted_at IS NULL").get(year, month);
    if (existing && existing.status === 'cerrado') {
      throw badRequest('El estado financiero de este mes esta cerrado. Reabrelo primero para actualizar.');
    }

    const settings = db.prepare('SELECT * FROM financial_settings WHERE id = 1').get();
    const rateMap = getExchangeRateMap();

    // Gather data for the month
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Project omissions
    const omissions = db.prepare('SELECT project_id FROM financial_project_omissions WHERE year = ? AND month = ? AND omit = 1').all(year, month);
    const omittedProjectIds = omissions.map((o) => o.project_id);

    const projects = db.prepare("SELECT * FROM projects WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL").all(monthStart, nextMonth);
    const projectsWithMxn = projects.map((p) => ({
      ...p,
      amount_mxn: roundMoneyFin(Number(p.total_invoiced || 0) * (rateMap[p.total_invoiced_currency || 'MXN'] || 1)),
    }));

    const projectCosts = db.prepare("SELECT * FROM project_costs WHERE cost_date >= ? AND cost_date < ?").all(monthStart, nextMonth);

    const accountsPayable = db.prepare("SELECT * FROM accounts_payable WHERE invoice_date >= ? AND invoice_date < ? AND deleted_at IS NULL AND status != 'cancelada'").all(monthStart, nextMonth);

    const bankSummaries = db.prepare('SELECT * FROM bank_statement_summaries WHERE year = ? AND month = ?').all(year, month);
    const bankSummaryIds = bankSummaries.map((s) => s.id);
    let bankMovements = [];
    if (bankSummaryIds.length > 0) {
      bankMovements = db.prepare(`SELECT * FROM bank_statement_movements WHERE bank_statement_summary_id IN (${bankSummaryIds.map(() => '?').join(',')}) AND classification_status != 'ignorado'`).all(...bankSummaryIds);
    }

    const manualPayroll = db.prepare('SELECT * FROM manual_payroll_expenses WHERE year = ? AND month = ?').all(year, month);
    const adjustments = db.prepare("SELECT * FROM financial_adjustments WHERE year = ? AND month = ? AND status = 'activo' AND deleted_at IS NULL").all(year, month);

    // Accounts receivable
    const allProjects = db.prepare("SELECT * FROM projects WHERE closed_at IS NULL AND deleted_at IS NULL").all();
    const accountsReceivable = [];
    for (const p of allProjects) {
      const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ?').all(p.id);
      const totalCharged = payments.reduce((sum, pay) => sum + Number(pay.amount || 0) * (rateMap[pay.currency || 'MXN'] || 1), 0);
      const invoicedMxn = Number(p.total_invoiced || 0) * (rateMap[p.total_invoiced_currency || 'MXN'] || 1);
      const pendingMxn = roundMoneyFin(invoicedMxn - totalCharged);
      if (pendingMxn > 0.01) accountsReceivable.push({ pending_mxn: pendingMxn });
    }

    const calcData = {
      projects: projectsWithMxn,
      projectCosts,
      accountsPayable,
      bankSummaries,
      bankMovements,
      manualPayroll,
      adjustments,
      accountsReceivable,
      omittedProjectIds,
    };

    const result = calculateFinancialStatement(calcData, settings);
    const unclassified = bankMovements.filter((m) => m.classification_status === 'sin_clasificar').length;
    result.unclassified_movements_count = unclassified;

    const audit = existing ? updatedByFields(req) : createdByFields(req);

    if (existing) {
      db.prepare(
        `UPDATE financial_statements SET
          revenue_net_mxn=?, cost_of_sales_mxn=?, gross_profit_mxn=?, operating_expenses_mxn=?,
          net_administrative_profit_mxn=?, estimated_isr_mxn=?, profit_after_isr_mxn=?,
          ivan_commission_mxn=?, real_administrative_profit_mxn=?,
          accounts_receivable_mxn=?, accounts_payable_mxn=?,
          bank_initial_balance_mxn=?, bank_deposits_mxn=?, bank_withdrawals_mxn=?, bank_final_balance_mxn=?,
          unclassified_movements_count=?,
          configuration_snapshot_json=?,
          updated_by_user_id=?, updated_by_name=?, updated_at=?
        WHERE id=?`,
      ).run(
        result.revenue_net_mxn, result.cost_of_sales_mxn, result.gross_profit_mxn, result.operating_expenses_mxn,
        result.net_administrative_profit_mxn, result.estimated_isr_mxn, result.profit_after_isr_mxn,
        result.ivan_commission_mxn, result.real_administrative_profit_mxn,
        result.accounts_receivable_mxn, result.accounts_payable_mxn,
        result.bank_initial_balance_mxn, result.bank_deposits_mxn, result.bank_withdrawals_mxn, result.bank_final_balance_mxn,
        result.unclassified_movements_count,
        JSON.stringify(settings),
        audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, existing.id,
      );
      logAuditEvent(db, { req, action: 'update', module: 'financial', entityType: 'financial_statement', entityId: existing.id, entityLabel: `${year}-${month}` });
      res.json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(existing.id));
    } else {
      const ins = db.prepare(
        `INSERT INTO financial_statements (year, month, status,
          revenue_net_mxn, cost_of_sales_mxn, gross_profit_mxn, operating_expenses_mxn,
          net_administrative_profit_mxn, estimated_isr_mxn, profit_after_isr_mxn,
          ivan_commission_mxn, real_administrative_profit_mxn,
          accounts_receivable_mxn, accounts_payable_mxn,
          bank_initial_balance_mxn, bank_deposits_mxn, bank_withdrawals_mxn, bank_final_balance_mxn,
          unclassified_movements_count, configuration_snapshot_json,
          created_by_user_id, created_by_name, created_at, updated_at)
        VALUES (?, ?, 'borrador', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(year, month,
        result.revenue_net_mxn, result.cost_of_sales_mxn, result.gross_profit_mxn, result.operating_expenses_mxn,
        result.net_administrative_profit_mxn, result.estimated_isr_mxn, result.profit_after_isr_mxn,
        result.ivan_commission_mxn, result.real_administrative_profit_mxn,
        result.accounts_receivable_mxn, result.accounts_payable_mxn,
        result.bank_initial_balance_mxn, result.bank_deposits_mxn, result.bank_withdrawals_mxn, result.bank_final_balance_mxn,
        result.unclassified_movements_count, JSON.stringify(settings),
        audit.created_by_user_id, audit.created_by_name, audit.created_at, audit.created_at);
      logAuditEvent(db, { req, action: 'create', module: 'financial', entityType: 'financial_statement', entityId: ins.lastInsertRowid, entityLabel: `${year}-${month}` });
      res.status(201).json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(ins.lastInsertRowid));
    }
  } catch (error) { next(error); }
});

app.post('/api/financial/statements/:id/close', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const fs = db.prepare("SELECT * FROM financial_statements WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!fs) throw badRequest('Estado financiero no encontrado.');
    if (fs.status === 'cerrado') throw badRequest('Ya esta cerrado.');
    if (fs.status === 'cancelado') throw badRequest('No se puede cerrar un estado cancelado.');

    const audit = updatedByFields(req);
    db.prepare(`UPDATE financial_statements SET status='cerrado', data_snapshot_json=?, closed_by_user_id=?, closed_by_name=?, closed_at=?, updated_at=? WHERE id=?`)
      .run(JSON.stringify({ closed_with_data: true }), audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, audit.updated_at, req.params.id);

    logAuditEvent(db, { req, action: 'close', module: 'financial', entityType: 'financial_statement', entityId: Number(req.params.id), entityLabel: `${fs.year}-${fs.month}` });
    res.json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

app.post('/api/financial/statements/:id/reopen', requireAuth, requireAdminOnly, (req, res, next) => {
  try {
    const fs = db.prepare("SELECT * FROM financial_statements WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!fs) throw badRequest('Estado financiero no encontrado.');
    if (fs.status !== 'cerrado') throw badRequest('Solo se puede reabrir un estado cerrado.');

    const audit = updatedByFields(req);
    db.prepare(`UPDATE financial_statements SET status='borrador', updated_by_user_id=?, updated_by_name=?, updated_at=? WHERE id=?`)
      .run(audit.updated_by_user_id, audit.updated_by_name, audit.updated_at, req.params.id);

    logAuditEvent(db, { req, action: 'reopen', module: 'financial', entityType: 'financial_statement', entityId: Number(req.params.id), entityLabel: `${fs.year}-${fs.month}` });
    res.json(db.prepare('SELECT * FROM financial_statements WHERE id = ?').get(req.params.id));
  } catch (error) { next(error); }
});

// ===================== END FINANCIAL STATEMENTS MODULE =====================

registerNewModules(app, db, { requireAuth, requirePermission, badRequest, requiredText, optionalText, numberValue, enumValue, currencyValue, booleanValue, trim });
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    let message = 'El registro ya existe.';
    if (err.message.includes('users.username')) {
      message = 'El usuario ya existe.';
    } else if (err.message.includes('employees.employee_number')) {
      message = 'El numero de empleado ya existe.';
    } else if (err.message.includes('projects.quote_number')) {
      message = 'El numero de cotizacion ya existe.';
    }
    return res.status(400).json({ message });
  }

  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    console.error('Unhandled error:', err.message, err.stack);
  }
  const message = statusCode === 500 ? 'Ocurrio un error inesperado.' : err.message;
  return res.status(statusCode).json({ message });
});

app.listen(PORT, () => {
  console.log(`Aplicacion de proyectos disponible en http://localhost:${PORT}`);
});
