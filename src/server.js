require('dotenv').config();

const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { getDb } = require('./db');
const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { createSqliteSessionStore } = require('./sessionStore');
const { calculateVacationEntitlement, calculateBusinessDays, getCompletedYears, getCurrentExerciseYear, calculateVacationBalance, calculateAccruedVacationDays } = require('./vacations');

const app = express();
const db = getDb();
const PORT = process.env.PORT || 3000;

const VALID_STATUSES = ['Pendiente', 'En Proceso', 'Terminado'];
const VALID_RISKS = ['Alto', 'Medio', 'Bajo'];
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
const SESSION_TTL_MS = 1000 * 60 * 60;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = isProduction || process.env.TRUST_PROXY === 'true';

if (trustProxy) {
  app.set('trust proxy', 1);
}

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
    created_at: row.created_at,
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

app.get('/api/session', (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: { id: req.session.userId, username: req.session.username, role: req.session.role || 'user' },
  });
});

app.post('/api/login', (req, res, next) => {
  try {
    const username = requiredText(req.body, 'username', 'Usuario');
    const password = requiredText(req.body, 'password', 'Contrasena');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw badRequest('Usuario o contrasena incorrectos.');
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role || 'user';
    return res.json({ username: user.username, role: user.role || 'user' });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
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

app.get('/api/users', requireAuth, requireAdminVerified, (req, res) => {
  const users = db
    .prepare('SELECT id, username, created_at FROM users ORDER BY username ASC')
    .all()
    .map(mapUser);
  res.json(users);
});

app.post('/api/users', requireAuth, requireAdminVerified, (req, res, next) => {
  try {
    const user = normalizeUser(req.body, { requirePassword: true });
    const passwordHash = bcrypt.hashSync(user.password, 12);
    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(user.username, passwordHash);

    res.status(201).json(mapUser(getUserOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/:id', requireAuth, requireAdminVerified, (req, res, next) => {
  try {
    getUserOrFail(req.params.id);
    const user = normalizeUser(req.body);

    if (user.password) {
      db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(
        user.username,
        bcrypt.hashSync(user.password, 12),
        req.params.id,
      );
    } else {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(user.username, req.params.id);
    }

    if (Number(req.session.userId) === Number(req.params.id)) {
      req.session.username = user.username;
    }

    res.json(mapUser(getUserOrFail(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/exchange-rates', requireAuth, (req, res) => {
  res.json(mapExchangeRateState());
});

app.put('/api/exchange-rates', requireAuth, (req, res, next) => {
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

app.get('/api/projects', requireAuth, (req, res) => {
  const exchangeRates = getExchangeRateMap();
  const projects = db
    .prepare('SELECT * FROM projects WHERE closed_at IS NULL ORDER BY promised_delivery_date ASC, id DESC')
    .all()
    .map((project) => mapProject(project, exchangeRates));
  res.json(projects);
});

app.get('/api/closed-projects', requireAuth, (req, res) => {
  const exchangeRates = getExchangeRateMap();
  const projects = db
    .prepare('SELECT * FROM projects WHERE closed_at IS NOT NULL ORDER BY closed_at DESC, id DESC')
    .all()
    .map((project) => mapProject(project, exchangeRates));
  res.json(projects);
});

app.get('/api/projects/:id', requireAuth, (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    res.json(mapProject(project, getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects', requireAuth, (req, res, next) => {
  try {
    const project = normalizeProject(req.body);
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
          observations
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
          @observations
        )`,
      )
      .run(project);

    res.status(201).json(mapProject(getProjectOrFail(result.lastInsertRowid), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.put('/api/projects/:id', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const project = normalizeProject(req.body);
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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id`,
    ).run({ ...project, id: req.params.id });

    res.json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:id', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    verifyAdminPassword(req.body);
    db.prepare(
      `UPDATE projects
       SET closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND closed_at IS NULL`,
    ).run(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/closed-projects/:id', requireAuth, (req, res, next) => {
  try {
    const project = getProjectOrFail(req.params.id);
    if (!project.closed_at) {
      throw badRequest('El proyecto aun no esta cerrado.');
    }

    verifyAdminPassword(req.body);
    db.prepare('DELETE FROM projects WHERE id = ? AND closed_at IS NOT NULL').run(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/payments', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const payment = normalizePayment(req.body);
    db.prepare(
      `INSERT INTO project_payments (project_id, amount, currency, payment_date, notes)
       VALUES (@project_id, @amount, @currency, @payment_date, @notes)`,
    ).run({ ...payment, project_id: req.params.id });

    res.status(201).json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId/payments/:paymentId', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.projectId);
    verifyAdminPassword(req.body);
    db.prepare('DELETE FROM project_payments WHERE id = ? AND project_id = ?').run(
      req.params.paymentId,
      req.params.projectId,
    );
    res.json(mapProject(getProjectOrFail(req.params.projectId), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/costs', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const cost = normalizeCost(req.body);
    db.prepare(
      `INSERT INTO project_costs (project_id, category, description, amount, currency, cost_date)
       VALUES (@project_id, @category, @description, @amount, @currency, @cost_date)`,
    ).run({ ...cost, project_id: req.params.id });

    res.status(201).json(mapProject(getProjectOrFail(req.params.id), getExchangeRateMap()));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId/costs/:costId', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.projectId);
    verifyAdminPassword(req.body);
    db.prepare('DELETE FROM project_costs WHERE id = ? AND project_id = ?').run(
      req.params.costId,
      req.params.projectId,
    );
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

app.get('/api/reports', requireAuth, (req, res) => {
  const reports = db.prepare(
    `SELECT r.*, p.quote_number, p.order_number, p.client_name AS project_client,
            p.project_description, p.status AS project_status, p.closed_at
     FROM project_reports r
     JOIN projects p ON r.project_id = p.id
     ORDER BY r.created_at DESC`,
  ).all();
  res.json(reports);
});

app.get('/api/projects/:id/reports', requireAuth, (req, res, next) => {
  try {
    getProjectOrFail(req.params.id);
    const reports = db.prepare(
      'SELECT * FROM project_reports WHERE project_id = ? ORDER BY created_at DESC',
    ).all(req.params.id);
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/:id', requireAuth, (req, res, next) => {
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

app.post('/api/reports', requireAuth, (req, res, next) => {
  try {
    const projectId = req.body.project_id;
    if (!projectId) {
      throw badRequest('El proyecto es obligatorio.');
    }
    getProjectOrFail(projectId);

    const clientName = requiredText(req.body, 'client_name', 'Cliente');
    const serviceName = requiredText(req.body, 'service_name', 'Nombre de servicio');
    const reportDate = requiredText(req.body, 'report_date', 'Fecha del reporte');

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

    const result = db.prepare(
      `INSERT INTO project_reports (
        project_id, report_folio, client_name, client_address, service_name,
        report_date, assigned_technicians, burner_model, equipment_model_serial,
        pumps_motors_model, fuel, voltage, gas_pressure_inh2o, liquid_fuel_pressure_psi,
        working_pressure, pump_amperage, fan_amperage, condensate_tank_temp_c,
        operating_output_temp_c, flue_gas_temp_c, safety_tests, comments,
        emissions_low_fire, emissions_high_fire, technician_name, plant_manager_name,
        created_by, updated_by
      ) VALUES (
        @project_id, @report_folio, @client_name, @client_address, @service_name,
        @report_date, @assigned_technicians, @burner_model, @equipment_model_serial,
        @pumps_motors_model, @fuel, @voltage, @gas_pressure_inh2o, @liquid_fuel_pressure_psi,
        @working_pressure, @pump_amperage, @fan_amperage, @condensate_tank_temp_c,
        @operating_output_temp_c, @flue_gas_temp_c, @safety_tests, @comments,
        @emissions_low_fire, @emissions_high_fire, @technician_name, @plant_manager_name,
        @created_by, @updated_by
      )`,
    ).run({
      project_id: projectId,
      report_folio: reportFolio,
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
      created_by: req.session.username,
      updated_by: req.session.username,
    });

    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

app.put('/api/reports/:id', requireAuth, (req, res, next) => {
  try {
    const report = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      const error = new Error('Reporte no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    const clientName = requiredText(req.body, 'client_name', 'Cliente');
    const serviceName = requiredText(req.body, 'service_name', 'Nombre de servicio');
    const reportDate = requiredText(req.body, 'report_date', 'Fecha del reporte');

    const safetyTests = req.body.safety_tests ? JSON.stringify(req.body.safety_tests) : null;
    const emissionsLow = req.body.emissions_low_fire ? JSON.stringify(req.body.emissions_low_fire) : null;
    const emissionsHigh = req.body.emissions_high_fire ? JSON.stringify(req.body.emissions_high_fire) : null;

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
        updated_by = @updated_by, updated_at = CURRENT_TIMESTAMP
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
      updated_by: req.session.username,
    });

    const updated = db.prepare('SELECT * FROM project_reports WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
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

app.get('/api/employees', requireAuth, requireAdmin, (req, res) => {
  const employees = db.prepare(
    'SELECT * FROM employees ORDER BY active DESC, full_name ASC',
  ).all();
  res.json(employees.map(mapEmployee));
});

app.get('/api/employees/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const employee = getEmployeeOrFail(req.params.id);
    res.json(mapEmployee(employee));
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees', requireAuth, requireAdmin, (req, res, next) => {
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

    const result = db.prepare(
      `INSERT INTO employees (employee_number, full_name, hire_date, department, position, immediate_boss, active, termination_date, inactive_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(employeeNumber, fullName, hireDate, department, position, immediateBoss, active, terminationDate, inactiveReason);

    res.status(201).json(mapEmployee(getEmployeeOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/employees/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    getEmployeeOrFail(req.params.id);
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

    db.prepare(
      `UPDATE employees SET
        employee_number = ?, full_name = ?, hire_date = ?, department = ?,
        position = ?, immediate_boss = ?, active = ?,
        termination_date = ?, inactive_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(employeeNumber, fullName, hireDate, department, position, immediateBoss, active, terminationDate, inactiveReason, req.params.id);

    res.json(mapEmployee(getEmployeeOrFail(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/employees/:id/vacation-requests', requireAuth, requireAdmin, (req, res, next) => {
  try {
    getEmployeeOrFail(req.params.id);
    const requests = db.prepare(
      'SELECT * FROM vacation_requests WHERE employee_id = ? ORDER BY start_date DESC',
    ).all(req.params.id);
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees/:id/vacation-requests', requireAuth, requireAdmin, (req, res, next) => {
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

    const result = db.prepare(
      `INSERT INTO vacation_requests
        (employee_id, start_date, end_date, requested_days, vacation_exercise_year,
         status, is_first_vacation_of_exercise, include_vacation_bonus,
         created_by, authorized_by, hr_responsible, notes,
         creates_negative_balance, negative_days_generated, admin_override_reason, balance_after_request)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      employee.id, startDate, endDate, requestedDays, exerciseYear,
      status,
      existingActiveRequests.length === 0 ? 1 : 0,
      includeVacationBonus,
      req.session.username,
      'Ivan Garcia',
      'Alejandra Gonzalez',
      notes,
      willCreateNegativeBalance ? 1 : 0,
      negativeDaysGenerated,
      adminOverrideReason,
      balanceAfterRequest,
    );

    const newRequest = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
});

app.put('/api/vacation-requests/:id', requireAuth, requireAdmin, (req, res, next) => {
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

    db.prepare(
      `UPDATE vacation_requests SET
        start_date = ?, end_date = ?, requested_days = ?, status = ?,
        include_vacation_bonus = ?, notes = ?,
        creates_negative_balance = ?, negative_days_generated = ?,
        admin_override_reason = ?, balance_after_request = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      startDate, endDate, requestedDays, status, includeVacationBonus, notes,
      willCreateNegativeBalance ? 1 : 0, negativeDaysGenerated,
      adminOverrideReason, balanceAfterRequest, request.id,
    );

    res.json(db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(request.id));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/vacation-requests/:id/cancel', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(req.params.id);
    if (!request) {
      throw badRequest('Solicitud no encontrada.');
    }

    db.prepare(
      "UPDATE vacation_requests SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(request.id);

    res.json(db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(request.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/vacation-requests/:id', requireAuth, requireAdmin, (req, res, next) => {
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
  const message = statusCode === 500 ? 'Ocurrio un error inesperado.' : err.message;
  return res.status(statusCode).json({ message });
});

app.listen(PORT, () => {
  console.log(`Aplicacion de proyectos disponible en http://localhost:${PORT}`);
});
