require('dotenv').config();

const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { getDb } = require('./db');
const { buildProjectTotals, convertAmountToMxn, roundMoney } = require('./calculations');
const { createSqliteSessionStore } = require('./sessionStore');
const {
  calculateBusinessDays,
  calculateVacationEntitlement,
  calculateVacationSummary,
  validateVacationRequest,
} = require('./vacations');

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
const VALID_VACATION_STATUSES = ['programada', 'tomada', 'cancelada'];
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

function requireAdminRole(req, res, next) {
  const user = getUserOrFail(req.session.userId);
  if (user.role !== 'admin') {
    return res.status(403).json({
      message: 'Acceso restringido. Solo el administrador puede consultar y programar vacaciones.',
    });
  }

  req.session.role = user.role;
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

function normalizeEmployee(body) {
  return {
    employee_number: requiredText(body, 'employeeNumber', 'Numero de empleado'),
    full_name: requiredText(body, 'fullName', 'Nombre completo'),
    hire_date: requiredText(body, 'hireDate', 'Fecha de ingreso'),
    department: optionalText(body, 'department'),
    position: optionalText(body, 'position'),
    immediate_boss: optionalText(body, 'immediateBoss') || 'N/A',
    active: booleanValue(body, 'active'),
  };
}

function normalizeVacationRequest(body) {
  return {
    startDate: requiredText(body, 'startDate', 'Fecha inicial'),
    endDate: requiredText(body, 'endDate', 'Fecha final'),
    status: enumValue(body, 'status', 'Estatus', VALID_VACATION_STATUSES),
    includeVacationBonus: body.includeVacationBonus === true || body.includeVacationBonus === 'true',
    notes: optionalText(body, 'notes'),
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

function mapEmployee(row, requests = [], referenceDate = new Date()) {
  const employee = {
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    hireDate: row.hire_date,
    department: row.department || '',
    position: row.position || '',
    immediateBoss: row.immediate_boss || 'N/A',
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const summary = calculateVacationSummary(employee, requests, referenceDate);

  return {
    ...employee,
    ...summary,
  };
}

function mapVacationRequest(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    startDate: row.start_date,
    endDate: row.end_date,
    requestedDays: row.requested_days,
    vacationExerciseYear: row.vacation_exercise_year,
    status: row.status,
    isFirstVacationOfExercise: Boolean(row.is_first_vacation_of_exercise),
    includeVacationBonus: Boolean(row.include_vacation_bonus),
    createdBy: row.created_by,
    authorizedBy: row.authorized_by || 'Iván García',
    hrResponsible: row.hr_responsible || 'Alejandra Gonzalez',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getEmployeeOrFail(employeeId) {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!employee) {
    const error = new Error('Empleado no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return employee;
}

function getVacationRequestOrFail(requestId) {
  const request = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(requestId);
  if (!request) {
    const error = new Error('Solicitud de vacaciones no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  return request;
}

function getVacationRequestsForEmployee(employeeId) {
  return db
    .prepare(
      `SELECT * FROM vacation_requests
       WHERE employee_id = ?
       ORDER BY start_date DESC, id DESC`,
    )
    .all(employeeId)
    .map(mapVacationRequest);
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
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role || 'user',
    },
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
    return res.json({ user: { id: user.id, username: user.username, role: req.session.role } });
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

app.get('/api/vacations/employees', requireAuth, requireAdminRole, (req, res) => {
  const employees = db
    .prepare('SELECT * FROM employees ORDER BY active DESC, full_name ASC')
    .all()
    .map((employee) =>
      mapEmployee(employee, getVacationRequestsForEmployee(employee.id)),
    );
  res.json(employees);
});

app.post('/api/vacations/employees', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    const employee = normalizeEmployee(req.body);
    const result = db
      .prepare(
        `INSERT INTO employees (
          employee_number,
          full_name,
          hire_date,
          department,
          position,
          immediate_boss,
          active
        ) VALUES (
          @employee_number,
          @full_name,
          @hire_date,
          @department,
          @position,
          @immediate_boss,
          @active
        )`,
      )
      .run(employee);

    const savedEmployee = getEmployeeOrFail(result.lastInsertRowid);
    res.status(201).json(mapEmployee(savedEmployee, []));
  } catch (error) {
    next(error);
  }
});

app.put('/api/vacations/employees/:id', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    getEmployeeOrFail(req.params.id);
    const employee = normalizeEmployee(req.body);
    db.prepare(
      `UPDATE employees SET
        employee_number = @employee_number,
        full_name = @full_name,
        hire_date = @hire_date,
        department = @department,
        position = @position,
        immediate_boss = @immediate_boss,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id`,
    ).run({ ...employee, id: req.params.id });

    const savedEmployee = getEmployeeOrFail(req.params.id);
    res.json(mapEmployee(savedEmployee, getVacationRequestsForEmployee(savedEmployee.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/vacations/employees/:id/requests', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    const employee = getEmployeeOrFail(req.params.id);
    const requests = getVacationRequestsForEmployee(employee.id);
    res.json({
      employee: mapEmployee(employee, requests),
      requests,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/vacations/employees/:id/requests', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    const employeeRow = getEmployeeOrFail(req.params.id);
    const employee = mapEmployee(employeeRow, []);
    const existingRequests = getVacationRequestsForEmployee(employee.id);
    const request = normalizeVacationRequest(req.body);
    const validation = validateVacationRequest({
      employee,
      existingRequests,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
    });
    const hasExistingInExercise = existingRequests.some(
      (existingRequest) =>
        existingRequest.status !== 'cancelada' &&
        Number(existingRequest.vacationExerciseYear) === Number(validation.vacationExerciseYear),
    );
    const result = db
      .prepare(
        `INSERT INTO vacation_requests (
          employee_id,
          start_date,
          end_date,
          requested_days,
          vacation_exercise_year,
          status,
          is_first_vacation_of_exercise,
          include_vacation_bonus,
          created_by,
          authorized_by,
          hr_responsible,
          notes
        ) VALUES (
          @employee_id,
          @start_date,
          @end_date,
          @requested_days,
          @vacation_exercise_year,
          @status,
          @is_first_vacation_of_exercise,
          @include_vacation_bonus,
          @created_by,
          @authorized_by,
          @hr_responsible,
          @notes
        )`,
      )
      .run({
        employee_id: employee.id,
        start_date: request.startDate,
        end_date: request.endDate,
        requested_days: validation.requestedDays,
        vacation_exercise_year: validation.vacationExerciseYear,
        status: request.status,
        is_first_vacation_of_exercise: hasExistingInExercise ? 0 : 1,
        include_vacation_bonus: request.includeVacationBonus ? 1 : 0,
        created_by: req.session.userId,
        authorized_by: 'Iván García',
        hr_responsible: 'Alejandra Gonzalez',
        notes: request.notes,
      });

    res.status(201).json(mapVacationRequest(getVacationRequestOrFail(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/vacations/requests/:id', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    const existingRow = getVacationRequestOrFail(req.params.id);
    const existingRequest = mapVacationRequest(existingRow);
    const employeeRow = getEmployeeOrFail(existingRequest.employeeId);
    const employee = mapEmployee(employeeRow, []);
    const existingRequests = getVacationRequestsForEmployee(employee.id);
    const request = {
      startDate: trim(req.body.startDate) || existingRequest.startDate,
      endDate: trim(req.body.endDate) || existingRequest.endDate,
      status: trim(req.body.status) || existingRequest.status,
      includeVacationBonus:
        req.body.includeVacationBonus === undefined
          ? existingRequest.includeVacationBonus
          : req.body.includeVacationBonus === true || req.body.includeVacationBonus === 'true',
      notes: req.body.notes === undefined ? existingRequest.notes : optionalText(req.body, 'notes'),
    };
    const validation = validateVacationRequest({
      employee,
      existingRequests,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
      excludeRequestId: existingRequest.id,
    });
    db.prepare(
      `UPDATE vacation_requests SET
        start_date = @start_date,
        end_date = @end_date,
        requested_days = @requested_days,
        vacation_exercise_year = @vacation_exercise_year,
        status = @status,
        include_vacation_bonus = @include_vacation_bonus,
        notes = @notes,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id`,
    ).run({
      id: existingRequest.id,
      start_date: request.startDate,
      end_date: request.endDate,
      requested_days: validation.requestedDays,
      vacation_exercise_year: validation.vacationExerciseYear,
      status: request.status,
      include_vacation_bonus: request.includeVacationBonus ? 1 : 0,
      notes: request.notes,
    });

    res.json(mapVacationRequest(getVacationRequestOrFail(existingRequest.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/vacations/requests/:id', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    const request = mapVacationRequest(getVacationRequestOrFail(req.params.id));
    const employee = getEmployeeOrFail(request.employeeId);
    const requests = getVacationRequestsForEmployee(employee.id);
    res.json({
      employee: mapEmployee(employee, requests),
      request,
    });
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

app.get('/vacaciones/solicitud/:id/print', requireAuth, requireAdminRole, (req, res, next) => {
  try {
    const request = mapVacationRequest(getVacationRequestOrFail(req.params.id));
    const employeeRow = getEmployeeOrFail(request.employeeId);
    const requests = getVacationRequestsForEmployee(employeeRow.id);
    const employee = mapEmployee(employeeRow, requests);

    res.type('html').send(renderVacationPrintHtml(employee, request));
  } catch (error) {
    next(error);
  }
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderVacationPrintHtml(employee, request) {
  const generatedAt = new Date().toLocaleDateString('es-MX');
  const vacationBonus = request.includeVacationBonus ? 'Sí' : 'No';
  const immediateBoss =
    employee.immediateBoss && employee.immediateBoss !== 'N/A'
      ? employee.immediateBoss
      : 'Pendiente de asignar';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Solicitud de vacaciones ${request.id}</title>
    <style>
      @page { size: letter; margin: 14mm; }
      * { box-sizing: border-box; }
      body { color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 0; }
      .toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }
      button { border: 1px solid #111; background: #fff; border-radius: 4px; cursor: pointer; padding: 8px 12px; }
      .sheet { border: 1px solid #111; padding: 18px; }
      h1, h2, p { margin-top: 0; }
      h1 { font-size: 17px; letter-spacing: 0.04em; text-align: center; }
      h2 { font-size: 14px; margin-bottom: 6px; }
      .company { font-size: 18px; font-weight: 700; text-align: center; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
      table { border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; width: 100%; }
      th, td { border: 1px solid #333; padding: 7px; text-align: left; vertical-align: top; }
      th { background: #eee; font-weight: 700; }
      .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 34px; }
      .signature { border-top: 1px solid #111; padding-top: 8px; text-align: center; }
      .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; }
      @media print {
        .toolbar { display: none; }
        body { font-size: 11px; }
        .sheet { border: 0; padding: 0; }
        table, .signatures, .footer-grid { break-inside: avoid; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
      <button onclick="window.close()">Cerrar</button>
    </div>
    <main class="sheet">
      <p class="company">REVRAM</p>
      <h1>SOLICITUD DE VACACIONES O AUSENTISMOS</h1>
      <div class="meta">
        <div><strong>Folio interno de solicitud:</strong> ${escapeHtml(request.id)}</div>
        <div><strong>Fecha de generación:</strong> ${escapeHtml(generatedAt)}</div>
      </div>

      <h2>Datos del empleado</h2>
      <table>
        <tbody>
          <tr><th>Fecha de alta del empleado</th><td>${escapeHtml(employee.hireDate)}</td><th>Empleado</th><td>${escapeHtml(employee.fullName)}</td></tr>
          <tr><th>Fecha de registro</th><td>${escapeHtml(request.createdAt)}</td><th>Número de empleado</th><td>${escapeHtml(employee.employeeNumber)}</td></tr>
          <tr><th>Días solicitados</th><td>${escapeHtml(request.requestedDays)}</td><th>A partir del día</th><td>${escapeHtml(request.startDate)}</td></tr>
          <tr><th>Al día</th><td>${escapeHtml(request.endDate)}</td><th>Se considera como permiso</th><td>N/A</td></tr>
          <tr><th>Se paga como vacación</th><td>Sí</td><th>Se incluye prima vacacional</th><td>${escapeHtml(vacationBonus)}</td></tr>
          <tr><th>Correspondiente al ejercicio vacacional</th><td>${escapeHtml(request.vacationExerciseYear)}</td><th>Vacaciones tomadas hasta el momento</th><td>${escapeHtml(employee.takenDays)}</td></tr>
          <tr><th>Vacaciones pendientes del ejercicio</th><td>${escapeHtml(employee.pendingDays)}</td><th>Jefe inmediato</th><td>${escapeHtml(immediateBoss)}</td></tr>
        </tbody>
      </table>

      <div class="signatures">
        <div class="signature">Firma del solicitante</div>
        <div class="signature">Firma departamento RH</div>
        <div class="signature">Jefe inmediato</div>
        <div class="signature">Supervisor</div>
      </div>

      <div class="footer-grid">
        <table>
          <tbody>
            <tr><th>Elaboró</th><td>Alejandra Gonzalez</td></tr>
            <tr><th>Autorizó</th><td>Iván García</td></tr>
            <tr><th>Autorizó supervisor</th><td>N/A</td></tr>
          </tbody>
        </table>
        <table>
          <tbody>
            <tr><th>Cargo RH</th><td>Gerente RH</td></tr>
            <tr><th>Cargo jefe inmediato</th><td>Jefe inmediato</td></tr>
            <tr><th>Cargo supervisor</th><td>Supervisor</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  </body>
</html>`;
}

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    let message = 'El numero de cotizacion ya existe.';
    if (err.message.includes('users.username')) {
      message = 'El usuario ya existe.';
    }
    if (err.message.includes('employees.employee_number')) {
      message = 'Ya existe un empleado activo con ese numero.';
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
