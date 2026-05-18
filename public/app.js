const state = {
  projects: [],
  closedProjects: [],
  employees: [],
  vacationRequests: [],
  users: [],
  exchangeRates: { MXN: 1, USD: 17, EUR: 19 },
  exchangeUpdatedAt: null,
  currentUser: null,
  selectedProjectId: null,
  selectedClosedProjectId: null,
  selectedEmployeeId: null,
  selectedUserId: null,
  adminVerified: false,
};

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const projectsView = document.querySelector('#projects-view');
const closedProjectsView = document.querySelector('#closed-projects-view');
const vacationsView = document.querySelector('#vacations-view');
const usersView = document.querySelector('#users-view');
const projectsTab = document.querySelector('#projects-tab');
const closedProjectsTab = document.querySelector('#closed-projects-tab');
const vacationsTab = document.querySelector('#vacations-tab');
const usersTab = document.querySelector('#users-tab');
const exchangeRateForm = document.querySelector('#exchange-rate-form');
const exchangeMessage = document.querySelector('#exchange-message');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const logoutButton = document.querySelector('#logout-button');
const projectForm = document.querySelector('#project-form');
const projectMessage = document.querySelector('#project-message');
const projectFormTitle = document.querySelector('#project-form-title');
const newProjectButton = document.querySelector('#new-project-button');
const exportProjectsButton = document.querySelector('#export-projects-button');
const exportClosedProjectsButton = document.querySelector('#export-closed-projects-button');
const projectsTable = document.querySelector('#projects-table');
const closedProjectsTable = document.querySelector('#closed-projects-table');
const detailPanel = document.querySelector('#detail-panel');
const closedDetailPanel = document.querySelector('#closed-detail-panel');
const paymentForm = document.querySelector('#payment-form');
const costForm = document.querySelector('#cost-form');
const paymentsList = document.querySelector('#payments-list');
const costsList = document.querySelector('#costs-list');
const closedPaymentsList = document.querySelector('#closed-payments-list');
const closedCostsList = document.querySelector('#closed-costs-list');
const employeeForm = document.querySelector('#employee-form');
const employeeFormTitle = document.querySelector('#employee-form-title');
const employeeMessage = document.querySelector('#employee-message');
const newEmployeeButton = document.querySelector('#new-employee-button');
const employeesTable = document.querySelector('#employees-table');
const vacationDetailPanel = document.querySelector('#vacation-detail-panel');
const vacationRequestForm = document.querySelector('#vacation-request-form');
const vacationRequestMessage = document.querySelector('#vacation-request-message');
const vacationRequestsTable = document.querySelector('#vacation-requests-table');
const savePrintVacationButton = document.querySelector('#save-print-vacation-button');
const userForm = document.querySelector('#user-form');
const userMessage = document.querySelector('#user-message');
const userFormTitle = document.querySelector('#user-form-title');
const newUserButton = document.querySelector('#new-user-button');
const usersTable = document.querySelector('#users-table');
const purchaseOrderInput = projectForm.elements.purchase_order_number;
const purchaseOrderNotApplicable = projectForm.elements.purchase_order_not_applicable;

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const currencyFormatters = {
  MXN: money,
  USD: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }),
  EUR: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'EUR' }),
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'La operacion no pudo completarse.');
  }

  return data;
}

function showLogin() {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
}

async function showApp(user = null) {
  if (user) {
    state.currentUser = user;
  }
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  setDefaultDates();
  resetUserForm();
  state.adminVerified = false;
  vacationsTab.classList.toggle('hidden', state.currentUser?.role !== 'admin');
  switchView('projects');
  await loadExchangeRates();
  await loadProjects();
}

function setMessage(element, message, isSuccess = false) {
  element.textContent = message || '';
  element.classList.toggle('success', Boolean(isSuccess));
}

function setDefaultDates() {
  if (!paymentForm.elements.payment_date.value) {
    paymentForm.elements.payment_date.value = today();
  }

  if (!costForm.elements.cost_date.value) {
    costForm.elements.cost_date.value = today();
  }
}

function projectPayload() {
  const formData = new FormData(projectForm);
  const payload = Object.fromEntries(formData.entries());
  payload.purchase_order_not_applicable = purchaseOrderNotApplicable.checked;
  if (purchaseOrderNotApplicable.checked) {
    payload.purchase_order_number = '';
  }

  return payload;
}

function simpleFormPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function employeePayload() {
  const payload = Object.fromEntries(new FormData(employeeForm).entries());
  payload.active = employeeForm.elements.active.checked;
  return payload;
}

function vacationRequestPayload() {
  const payload = Object.fromEntries(new FormData(vacationRequestForm).entries());
  payload.includeVacationBonus = payload.includeVacationBonus === 'true';
  delete payload.requestedDays;
  return payload;
}

function userPayload() {
  const payload = simpleFormPayload(userForm);
  if (!payload.password) {
    delete payload.password;
  }

  return payload;
}

function exchangeRatePayload() {
  return Object.fromEntries(new FormData(exchangeRateForm).entries());
}

function switchView(viewName) {
  const showingProjects = viewName === 'projects';
  const showingClosedProjects = viewName === 'closed-projects';
  const showingVacations = viewName === 'vacations';
  const showingUsers = viewName === 'users';
  projectsView.classList.toggle('hidden', !showingProjects);
  closedProjectsView.classList.toggle('hidden', !showingClosedProjects);
  vacationsView.classList.toggle('hidden', !showingVacations);
  usersView.classList.toggle('hidden', !showingUsers);
  projectsTab.classList.toggle('active', showingProjects);
  closedProjectsTab.classList.toggle('active', showingClosedProjects);
  vacationsTab.classList.toggle('active', showingVacations);
  usersTab.classList.toggle('active', showingUsers);
}

async function requestAdminAuthorization(message = 'Ingresa la contrasena del admin:') {
  const password = window.prompt(message);
  if (!password) {
    return false;
  }

  await api('/api/admin/verify', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  state.adminVerified = true;
  return true;
}

async function loadExchangeRates() {
  const exchangeRateState = await api('/api/exchange-rates');
  state.exchangeRates = exchangeRateState.rates.reduce((rates, row) => {
    rates[row.currency] = Number(row.rate_to_mxn);
    return rates;
  }, {});
  state.exchangeUpdatedAt = exchangeRateState.last_updated_at;
  renderExchangeRates();
}

function renderExchangeRates() {
  exchangeRateForm.elements.USD.value = state.exchangeRates.USD || '';
  exchangeRateForm.elements.EUR.value = state.exchangeRates.EUR || '';
  document.querySelector('#exchange-updated-at').textContent = state.exchangeUpdatedAt
    ? new Date(state.exchangeUpdatedAt.replace(' ', 'T')).toLocaleString('es-MX')
    : 'Sin cambios';
}

async function loadProjects() {
  state.projects = await api('/api/projects');
  renderProjects();

  if (state.selectedProjectId) {
    const current = state.projects.find((project) => project.id === state.selectedProjectId);
    current ? selectProject(current.id) : clearSelection();
  }
}

async function loadClosedProjects() {
  state.closedProjects = await api('/api/closed-projects');
  renderClosedProjects();

  if (state.selectedClosedProjectId) {
    const current = state.closedProjects.find(
      (project) => project.id === state.selectedClosedProjectId,
    );
    current ? selectClosedProject(current.id) : clearClosedSelection();
  }
}

async function loadEmployees() {
  state.employees = await api('/api/vacations/employees');
  renderEmployees();

  if (state.selectedEmployeeId) {
    const current = state.employees.find((employee) => employee.id === state.selectedEmployeeId);
    current ? selectEmployee(current.id) : clearEmployeeSelection();
  }
}

function renderProjects() {
  document.querySelector('#stat-projects').textContent = state.projects.length;
  document.querySelector('#stat-charged').textContent = money.format(
    sum(state.projects, 'total_charged'),
  );
  document.querySelector('#stat-spent').textContent = money.format(sum(state.projects, 'spent'));
  document.querySelector('#stat-pending').textContent = money.format(
    sum(state.projects, 'pending_collection'),
  );

  if (!state.projects.length) {
    projectsTable.innerHTML = `<tr><td colspan="10" class="muted">No hay proyectos registrados.</td></tr>`;
    return;
  }

  projectsTable.innerHTML = state.projects
    .map(
      (project) => `
        <tr>
          <td>${project.id}</td>
          <td>${escapeHtml(project.quote_number)}</td>
          <td>${escapeHtml(project.client_name)}</td>
          <td><span class="badge status">${escapeHtml(project.status)}</span></td>
          <td><span class="badge risk-${project.risk.toLowerCase()}">${escapeHtml(project.risk)}</span></td>
          <td>${money.format(project.total_charged)}</td>
          <td>${money.format(project.spent)}</td>
          <td>${money.format(project.pending_collection)}</td>
          <td>
            <span class="badge margin-badge ${marginBadgeClass(project)}" title="Margen esperado: ${escapeHtml(project.expected_margin)}%">
              ${formatPercentDecimal(project.final_margin)}
            </span>
          </td>
          <td>
            <div class="row-actions">
              <button class="danger" data-action="delete-project" data-id="${project.id}" type="button">Eliminar</button>
              <button class="secondary" data-action="select" data-id="${project.id}" type="button">Abrir</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');
}

function renderClosedProjects() {
  if (!state.closedProjects.length) {
    closedProjectsTable.innerHTML = `<tr><td colspan="9" class="muted">No hay proyectos cerrados.</td></tr>`;
    return;
  }

  closedProjectsTable.innerHTML = state.closedProjects
    .map(
      (project) => `
        <tr>
          <td>${project.id}</td>
          <td>${escapeHtml(project.quote_number)}</td>
          <td>${escapeHtml(project.client_name)}</td>
          <td>${escapeHtml(project.closed_at || '')}</td>
          <td>${money.format(project.total_invoiced_mxn)}</td>
          <td>${money.format(project.total_charged)}</td>
          <td>${money.format(project.spent)}</td>
          <td>
            <span class="badge margin-badge ${marginBadgeClass(project)}" title="Margen esperado: ${escapeHtml(project.expected_margin)}%">
              ${formatPercentDecimal(project.final_margin)}
            </span>
          </td>
          <td>
            <div class="row-actions">
              <button class="danger" data-action="delete-closed-project" data-id="${project.id}" type="button">Borrar definitivo</button>
              <button class="secondary" data-action="select-closed-project" data-id="${project.id}" type="button">Historial</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');
}

function renderEmployees() {
  if (!state.employees.length) {
    employeesTable.innerHTML = `<tr><td colspan="10" class="muted">No hay empleados registrados.</td></tr>`;
    return;
  }

  employeesTable.innerHTML = state.employees
    .map(
      (employee) => `
        <tr>
          <td>${escapeHtml(employee.employeeNumber)}</td>
          <td>${escapeHtml(employee.fullName)}</td>
          <td>${escapeHtml(employee.hireDate)}</td>
          <td>${employee.completedYears} año(s)</td>
          <td>${employee.vacationExerciseYear}</td>
          <td>${employee.correspondingDays}</td>
          <td>${employee.takenDays}</td>
          <td>${employee.scheduledDays}</td>
          <td>${employee.pendingDays}</td>
          <td>
            <div class="row-actions">
              <button class="secondary" data-action="edit-employee" data-id="${employee.id}" type="button">Editar empleado</button>
              <button class="secondary" data-action="employee-vacations" data-id="${employee.id}" type="button">Vacaciones programadas</button>
              <button class="secondary" data-action="employee-history" data-id="${employee.id}" type="button">Ver historial</button>
              <button class="secondary" data-action="employee-format" data-id="${employee.id}" type="button">Generar formato</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');
}

async function loadUsers() {
  state.users = await api('/api/users');
  renderUsers();
}

function renderUsers() {
  if (!state.users.length) {
    usersTable.innerHTML = `<tr><td colspan="4" class="muted">No hay usuarios registrados.</td></tr>`;
    return;
  }

  usersTable.innerHTML = state.users
    .map(
      (user) => `
        <tr>
          <td>${user.id}</td>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.created_at)}</td>
          <td><button class="secondary" data-action="select-user" data-id="${user.id}" type="button">Editar</button></td>
        </tr>
      `,
    )
    .join('');
}

function exportProjectsToExcel(projects, filenamePrefix) {
  const generalColumns = [
    ['ID', (project) => project.id],
    ['Numero de cotizacion', (project) => project.quote_number],
    ['Numero de Pedido', (project) => project.order_number],
    ['Numero de Orden de Compra', (project) => project.purchase_order_display],
    ['Vendedor', (project) => project.seller],
    ['Cliente', (project) => project.client_name],
    ['Descripcion del proyecto', (project) => project.project_description || ''],
    ['Margen esperado de utilidad (%)', (project) => project.expected_margin],
    ['Total Cobrado MXN', (project) => project.total_charged],
    ['Gastado MXN', (project) => project.spent],
    ['Total Facturado Capturado', (project) =>
      formatCurrency(project.total_invoiced, project.total_invoiced_currency)],
    ['Total Facturado MXN', (project) => project.total_invoiced_mxn],
    ['Pendiente de cobro MXN', (project) => project.pending_collection],
    ['Porcentaje de Avance (%)', (project) => project.progress_percent],
    ['Tecnico Responsable', (project) => project.technician_name],
    ['Fecha Prometida de entrega', (project) => project.promised_delivery_date],
    ['Fecha de cierre', (project) => project.closed_at || ''],
    ['Estado', (project) => project.status],
    ['Riesgo', (project) => project.risk],
    ['Margen Final (%)', (project) =>
      project.final_margin === null ? '' : (Number(project.final_margin) * 100).toFixed(2)],
    ['Observaciones', (project) => project.observations || ''],
  ];
  const worksheets = [
    worksheetXml(
      'Listado',
      [
        generalColumns.map(([label]) => label),
        ...projects.map((project) => generalColumns.map(([, valueGetter]) => valueGetter(project))),
      ],
    ),
    ...projects.map(projectWorksheetXml),
  ];
  const workbookXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheets.join('')}
</Workbook>`;
  const blob = new Blob([workbookXml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filenamePrefix}-${today()}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function projectWorksheetXml(project) {
  return worksheetXml(`ID ${project.id}`, [
    [`Proyecto #${project.id}`],
    ['Cotizacion', project.quote_number],
    ['Cliente', project.client_name],
    ['Fecha de cierre', project.closed_at || ''],
    ['Descripcion', project.project_description || ''],
    ['Total facturado MXN', project.total_invoiced_mxn],
    ['Total cobrado MXN', project.total_charged],
    ['Gastado MXN', project.spent],
    ['Pendiente MXN', project.pending_collection],
    [],
    ['Pagos realizados'],
    ['Fecha', 'Importe capturado', 'Moneda', 'Importe MXN', 'Notas'],
    ...project.payments.map((payment) => [
      payment.payment_date,
      payment.amount,
      payment.currency,
      payment.amount_mxn,
      payment.notes || '',
    ]),
    [],
    ['Gastos registrados'],
    ['Fecha', 'Tipo', 'Descripcion', 'Importe capturado', 'Moneda', 'Importe MXN', 'Porcentaje vs facturado'],
    ...project.costs.map((cost) => [
      cost.cost_date,
      cost.category,
      cost.description,
      cost.amount,
      cost.currency,
      cost.amount_mxn,
      formatPercentDecimal(cost.invoice_cost_percentage),
    ]),
  ]);
}

function worksheetXml(name, rows) {
  return `<Worksheet ss:Name="${xmlEscape(worksheetName(name))}"><Table>${rows
    .map(
      (row) =>
        `<Row>${row.map((value) => `<Cell><Data ss:Type="${cellType(value)}">${xmlEscape(value)}</Data></Cell>`).join('')}</Row>`,
    )
    .join('')}</Table></Worksheet>`;
}

function worksheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Hoja';
}

function cellType(value) {
  return typeof value === 'number' && Number.isFinite(value) ? 'Number' : 'String';
}

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function formatCurrency(value, currency = 'MXN') {
  const formatter = currencyFormatters[currency] || money;
  return formatter.format(Number(value || 0));
}

function formatCapturedAndMxn(amount, currency, amountMxn) {
  const captured = formatCurrency(amount, currency);
  if (currency === 'MXN') {
    return captured;
  }

  return `${captured} (${money.format(amountMxn)} MXN)`;
}

function formatPercentDecimal(value) {
  if (value === null || value === undefined) {
    return 'Sin facturar';
  }

  return `${(Number(value) * 100).toFixed(2)}%`;
}

function marginBadgeClass(project) {
  if (project.final_margin === null || project.final_margin === undefined) {
    return 'margin-neutral';
  }

  const finalMarginPercent = Number(project.final_margin) * 100;
  const expectedMarginPercent = Number(project.expected_margin || 0);
  const deficit = expectedMarginPercent - finalMarginPercent;

  if (finalMarginPercent >= expectedMarginPercent) {
    return 'margin-good';
  }

  if (deficit >= 20) {
    return 'margin-danger';
  }

  if (deficit >= 5) {
    return 'margin-warning';
  }

  return 'margin-neutral';
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function calculateBusinessDaysClient(startDate, endDate) {
  if (!startDate || !endDate) {
    return '';
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return '';
  }

  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      days += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function selectProject(projectId) {
  const project = state.projects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  state.selectedProjectId = project.id;
  fillProjectForm(project);
  renderDetail(project);
}

function fillProjectForm(project) {
  projectFormTitle.textContent = `Editar proyecto #${project.id}`;
  projectForm.elements.id.value = project.id;
  projectForm.elements.quote_number.value = project.quote_number;
  projectForm.elements.order_number.value = project.order_number;
  projectForm.elements.purchase_order_number.value = project.purchase_order_number || '';
  projectForm.elements.purchase_order_not_applicable.checked = Boolean(
    project.purchase_order_not_applicable,
  );
  projectForm.elements.seller.value = project.seller;
  projectForm.elements.client_name.value = project.client_name;
  projectForm.elements.project_description.value = project.project_description || '';
  projectForm.elements.expected_margin.value = project.expected_margin;
  projectForm.elements.total_invoiced.value = project.total_invoiced;
  projectForm.elements.total_invoiced_currency.value = project.total_invoiced_currency || 'MXN';
  projectForm.elements.progress_percent.value = project.progress_percent;
  projectForm.elements.technician_name.value = project.technician_name;
  projectForm.elements.promised_delivery_date.value = project.promised_delivery_date;
  projectForm.elements.status.value = project.status;
  projectForm.elements.risk.value = project.risk;
  projectForm.elements.observations.value = project.observations || '';
  togglePurchaseOrder();
  setMessage(projectMessage, '');
}

function resetProjectForm() {
  projectForm.reset();
  projectFormTitle.textContent = 'Nuevo proyecto';
  projectForm.elements.id.value = '';
  projectForm.elements.expected_margin.value = 0;
  projectForm.elements.total_invoiced.value = 0;
  projectForm.elements.total_invoiced_currency.value = 'MXN';
  projectForm.elements.progress_percent.value = 0;
  togglePurchaseOrder();
  setMessage(projectMessage, '');
}

function clearSelection() {
  state.selectedProjectId = null;
  detailPanel.classList.add('hidden');
  resetProjectForm();
}

function clearClosedSelection() {
  state.selectedClosedProjectId = null;
  closedDetailPanel.classList.add('hidden');
}

function clearEmployeeSelection() {
  state.selectedEmployeeId = null;
  state.vacationRequests = [];
  vacationDetailPanel.classList.add('hidden');
  resetEmployeeForm();
  resetVacationRequestForm();
}

function fillEmployeeForm(employee) {
  employeeFormTitle.textContent = `Editar empleado #${employee.employeeNumber}`;
  employeeForm.elements.id.value = employee.id;
  employeeForm.elements.employeeNumber.value = employee.employeeNumber;
  employeeForm.elements.fullName.value = employee.fullName;
  employeeForm.elements.hireDate.value = employee.hireDate;
  employeeForm.elements.department.value = employee.department || '';
  employeeForm.elements.position.value = employee.position || '';
  employeeForm.elements.immediateBoss.value = employee.immediateBoss || '';
  employeeForm.elements.active.checked = Boolean(employee.active);
  setMessage(employeeMessage, '');
}

function resetEmployeeForm() {
  employeeForm.reset();
  employeeFormTitle.textContent = 'Agregar empleado';
  employeeForm.elements.id.value = '';
  employeeForm.elements.active.checked = true;
  setMessage(employeeMessage, '');
}

function resetVacationRequestForm() {
  vacationRequestForm.reset();
  vacationRequestForm.elements.id.value = '';
  vacationRequestForm.elements.status.value = 'programada';
  vacationRequestForm.elements.includeVacationBonus.value = 'true';
  vacationRequestForm.elements.requestedDays.value = '';
  setMessage(vacationRequestMessage, '');
}

async function selectEmployee(employeeId) {
  const response = await api(`/api/vacations/employees/${employeeId}/requests`);
  const employee = response.employee;
  state.selectedEmployeeId = employee.id;
  state.vacationRequests = response.requests;
  fillEmployeeForm(employee);
  renderVacationDetail(employee, response.requests);
}

function renderVacationDetail(employee, requests) {
  vacationDetailPanel.classList.remove('hidden');
  document.querySelector('#vacation-detail-title').textContent =
    `${employee.fullName} (${employee.employeeNumber})`;
  document.querySelector('#vacation-detail-summary').textContent =
    `Ingreso ${employee.hireDate} | Antigüedad ${employee.completedYears} año(s) | Ejercicio ${employee.vacationExerciseYear}`;
  document.querySelector('#vacation-days-corresponding').textContent = employee.correspondingDays;
  document.querySelector('#vacation-days-taken').textContent = employee.takenDays;
  document.querySelector('#vacation-days-scheduled').textContent = employee.scheduledDays;
  document.querySelector('#vacation-days-pending').textContent = employee.pendingDays;

  if (!requests.length) {
    vacationRequestsTable.innerHTML = `<tr><td colspan="8" class="muted">Este empleado aún no tiene vacaciones registradas.</td></tr>`;
    return;
  }

  vacationRequestsTable.innerHTML = requests
    .map(
      (request) => `
        <tr>
          <td>${escapeHtml(request.startDate)}</td>
          <td>${escapeHtml(request.endDate)}</td>
          <td>${request.requestedDays}</td>
          <td>${request.vacationExerciseYear}</td>
          <td><span class="badge status">${escapeHtml(request.status)}</span></td>
          <td>${escapeHtml(request.notes || '')}</td>
          <td>${escapeHtml(request.createdAt)}</td>
          <td>
            <div class="row-actions">
              <button class="secondary" data-action="edit-vacation-request" data-id="${request.id}" type="button">Editar</button>
              <button class="danger" data-action="cancel-vacation-request" data-id="${request.id}" type="button">Cancelar</button>
              <button class="secondary" data-action="print-vacation-request" data-id="${request.id}" type="button">Generar formato</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');
}

async function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  const confirmed = window.confirm(
    `Se cerrara el proyecto #${project.id} (${project.quote_number}) y se movera a Proyectos Cerrados.`,
  );
  if (!confirmed) {
    return;
  }

  const password = window.prompt('Ingresa la contrasena del admin para cerrar el proyecto:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/projects/${project.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });

    if (state.selectedProjectId === project.id) {
      clearSelection();
    }

    await loadProjects();
    await loadClosedProjects();
  } catch (error) {
    window.alert(error.message);
  }
}

async function deleteClosedProject(projectId) {
  const project = state.closedProjects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  const confirmed = window.confirm(
    `Se borrara definitivamente el proyecto cerrado #${project.id} (${project.quote_number}). Esta accion no se puede deshacer.`,
  );
  if (!confirmed) {
    return;
  }

  const password = window.prompt('Ingresa la contrasena del admin para borrar definitivamente:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/closed-projects/${project.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });

    if (state.selectedClosedProjectId === project.id) {
      clearClosedSelection();
    }

    await loadClosedProjects();
  } catch (error) {
    window.alert(error.message);
  }
}

function selectClosedProject(projectId) {
  const project = state.closedProjects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  state.selectedClosedProjectId = project.id;
  closedDetailPanel.classList.remove('hidden');
  document.querySelector('#closed-detail-title').textContent = `#${project.id} - ${project.client_name}`;
  document.querySelector('#closed-detail-subtitle').textContent =
    `Cotizacion ${project.quote_number} | Cerrado ${project.closed_at || ''}`;
  document.querySelector('#closed-detail-description').textContent =
    project.project_description || '';
  closedPaymentsList.innerHTML = renderEntries(
    project.payments,
    (payment) => `
      <li>
        <div>
          <strong>${formatCapturedAndMxn(payment.amount, payment.currency, payment.amount_mxn)}</strong>
          <small>${escapeHtml(payment.payment_date)} ${escapeHtml(payment.notes || '')}</small>
        </div>
      </li>
    `,
    'Sin pagos registrados.',
  );
  closedCostsList.innerHTML = renderEntries(
    project.costs,
    (cost) => `
      <li>
        <div>
          <strong>${escapeHtml(cost.category)}: ${formatCapturedAndMxn(cost.amount, cost.currency, cost.amount_mxn)}</strong>
          <small>${escapeHtml(cost.cost_date)} - ${escapeHtml(cost.description)}</small>
          <small>Porcentaje vs facturado: ${formatPercentDecimal(cost.invoice_cost_percentage)}</small>
        </div>
      </li>
    `,
    'Sin gastos registrados.',
  );
}

function selectUser(userId) {
  const user = state.users.find((item) => item.id === Number(userId));
  if (!user) {
    return;
  }

  state.selectedUserId = user.id;
  userFormTitle.textContent = `Editar usuario #${user.id}`;
  userForm.elements.id.value = user.id;
  userForm.elements.username.value = user.username;
  userForm.elements.password.value = '';
  userForm.elements.password.required = false;
  setMessage(userMessage, '');
}

function resetUserForm() {
  state.selectedUserId = null;
  userForm.reset();
  userFormTitle.textContent = 'Nuevo usuario';
  userForm.elements.id.value = '';
  userForm.elements.password.required = true;
  setMessage(userMessage, '');
}

function renderDetail(project) {
  detailPanel.classList.remove('hidden');
  document.querySelector('#detail-title').textContent = `#${project.id} - ${project.client_name}`;
  document.querySelector('#detail-subtitle').textContent =
    `Cotizacion ${project.quote_number} | Pedido ${project.order_number} | Tecnico ${project.technician_name}`;
  document.querySelector('#detail-description').textContent = project.project_description || '';
  document.querySelector('#detail-po').textContent = project.purchase_order_display;
  document.querySelector('#detail-invoiced').textContent = formatCapturedAndMxn(
    project.total_invoiced,
    project.total_invoiced_currency,
    project.total_invoiced_mxn,
  );
  document.querySelector('#detail-pending').textContent = money.format(project.pending_collection);
  document.querySelector('#detail-progress').textContent = formatPercent(project.progress_percent);

  paymentsList.innerHTML = renderEntries(
    project.payments,
    (payment) => `
      <li>
        <div>
          <strong>${formatCapturedAndMxn(payment.amount, payment.currency, payment.amount_mxn)}</strong>
          <small>${escapeHtml(payment.payment_date)} ${escapeHtml(payment.notes || '')}</small>
        </div>
        <button data-action="delete-payment" data-id="${payment.id}" type="button">Eliminar</button>
      </li>
    `,
    'Sin pagos registrados.',
  );

  costsList.innerHTML = renderEntries(
    project.costs,
    (cost) => `
      <li>
        <div>
          <strong>${escapeHtml(cost.category)}: ${formatCapturedAndMxn(cost.amount, cost.currency, cost.amount_mxn)}</strong>
          <small>${escapeHtml(cost.cost_date)} - ${escapeHtml(cost.description)}</small>
          <small>Porcentaje vs facturado: ${formatPercentDecimal(cost.invoice_cost_percentage)}</small>
        </div>
        <button data-action="delete-cost" data-id="${cost.id}" type="button">Eliminar</button>
      </li>
    `,
    'Sin compras, gastos o salarios registrados.',
  );
}

function renderEntries(entries, renderer, emptyMessage) {
  if (!entries.length) {
    return `<li class="muted">${emptyMessage}</li>`;
  }

  return entries.map(renderer).join('');
}

function togglePurchaseOrder() {
  const disabled = purchaseOrderNotApplicable.checked;
  purchaseOrderInput.disabled = disabled;
  purchaseOrderInput.required = !disabled;
  if (disabled) {
    purchaseOrderInput.value = '';
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(loginMessage, '');

  try {
    const loginResult = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(simpleFormPayload(loginForm)),
    });
    loginForm.reset();
    await showApp(loginResult.user);
  } catch (error) {
    setMessage(loginMessage, error.message);
  }
});

logoutButton.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  clearSelection();
  clearClosedSelection();
  clearEmployeeSelection();
  resetUserForm();
  state.adminVerified = false;
  state.currentUser = null;
  showLogin();
});

projectsTab.addEventListener('click', () => switchView('projects'));
closedProjectsTab.addEventListener('click', async () => {
  switchView('closed-projects');
  await loadClosedProjects();
});
vacationsTab.addEventListener('click', async () => {
  if (state.currentUser?.role !== 'admin') {
    window.alert('Acceso restringido. Solo el administrador puede consultar y programar vacaciones.');
    return;
  }

  switchView('vacations');
  await loadEmployees();
});
usersTab.addEventListener('click', async () => {
  try {
    if (!state.adminVerified) {
      const authorized = await requestAdminAuthorization(
        'Ingresa la contrasena del admin para acceder a Usuarios:',
      );
      if (!authorized) {
        return;
      }
    }

    switchView('users');
    await loadUsers();
  } catch (error) {
    window.alert(error.message);
  }
});
exportProjectsButton.addEventListener('click', () =>
  exportProjectsToExcel(state.projects, 'proyectos'),
);
exportClosedProjectsButton.addEventListener('click', async () => {
  if (!state.closedProjects.length) {
    await loadClosedProjects();
  }

  exportProjectsToExcel(state.closedProjects, 'proyectos-cerrados');
});

exchangeRateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(exchangeMessage, '');

  try {
    const exchangeRateState = await api('/api/exchange-rates', {
      method: 'PUT',
      body: JSON.stringify(exchangeRatePayload()),
    });
    state.exchangeRates = exchangeRateState.rates.reduce((rates, row) => {
      rates[row.currency] = Number(row.rate_to_mxn);
      return rates;
    }, {});
    state.exchangeUpdatedAt = exchangeRateState.last_updated_at;
    renderExchangeRates();
    await loadProjects();
    setMessage(exchangeMessage, 'Tipo de cambio actualizado.', true);
  } catch (error) {
    setMessage(exchangeMessage, error.message);
  }
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(projectMessage, '');

  try {
    const id = projectForm.elements.id.value;
    const savedProject = await api(id ? `/api/projects/${id}` : '/api/projects', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(projectPayload()),
    });

    setMessage(projectMessage, 'Proyecto guardado correctamente.', true);
    await loadProjects();
    selectProject(savedProject.id);
  } catch (error) {
    setMessage(projectMessage, error.message);
  }
});

newProjectButton.addEventListener('click', clearSelection);
purchaseOrderNotApplicable.addEventListener('change', togglePurchaseOrder);
newUserButton.addEventListener('click', resetUserForm);
newEmployeeButton.addEventListener('click', resetEmployeeForm);

employeeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(employeeMessage, '');

  try {
    const id = employeeForm.elements.id.value;
    await api(id ? `/api/vacations/employees/${id}` : '/api/vacations/employees', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(employeePayload()),
    });
    setMessage(employeeMessage, 'Empleado guardado correctamente.', true);
    await loadEmployees();
  } catch (error) {
    setMessage(employeeMessage, error.message);
  }
});

employeesTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) {
    return;
  }

  const employeeId = button.dataset.id;
  const employee = state.employees.find((item) => item.id === Number(employeeId));
  if (!employee) {
    return;
  }

  if (button.dataset.action === 'edit-employee') {
    fillEmployeeForm(employee);
    return;
  }

  if (button.dataset.action === 'employee-format') {
    const response = await api(`/api/vacations/employees/${employeeId}/requests`);
    const latestRequest = response.requests.find((request) => request.status !== 'cancelada');
    if (!latestRequest) {
      window.alert('Este empleado aún no tiene vacaciones registradas.');
      return;
    }
    window.open(`/vacaciones/solicitud/${latestRequest.id}/print`, '_blank');
    return;
  }

  await selectEmployee(employeeId);
});

function updateRequestedDaysPreview() {
  vacationRequestForm.elements.requestedDays.value = calculateBusinessDaysClient(
    vacationRequestForm.elements.startDate.value,
    vacationRequestForm.elements.endDate.value,
  );
}

vacationRequestForm.elements.startDate.addEventListener('change', updateRequestedDaysPreview);
vacationRequestForm.elements.endDate.addEventListener('change', updateRequestedDaysPreview);

async function saveVacationRequest({ printAfterSave = false } = {}) {
  if (!state.selectedEmployeeId) {
    setMessage(vacationRequestMessage, 'Selecciona un empleado primero.');
    return;
  }

  setMessage(vacationRequestMessage, '');
  try {
    const id = vacationRequestForm.elements.id.value;
    const request = await api(
      id
        ? `/api/vacations/requests/${id}`
        : `/api/vacations/employees/${state.selectedEmployeeId}/requests`,
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(vacationRequestPayload()),
      },
    );
    resetVacationRequestForm();
    await loadEmployees();
    await selectEmployee(state.selectedEmployeeId);
    setMessage(vacationRequestMessage, 'Solicitud guardada correctamente.', true);
    if (printAfterSave) {
      window.open(`/vacaciones/solicitud/${request.id}/print`, '_blank');
    }
  } catch (error) {
    setMessage(vacationRequestMessage, error.message);
  }
}

vacationRequestForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveVacationRequest();
});

savePrintVacationButton.addEventListener('click', () => {
  saveVacationRequest({ printAfterSave: true });
});

vacationRequestsTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) {
    return;
  }

  const request = state.vacationRequests.find((item) => item.id === Number(button.dataset.id));
  if (!request) {
    return;
  }

  if (button.dataset.action === 'print-vacation-request') {
    window.open(`/vacaciones/solicitud/${request.id}/print`, '_blank');
    return;
  }

  if (button.dataset.action === 'edit-vacation-request') {
    vacationRequestForm.elements.id.value = request.id;
    vacationRequestForm.elements.startDate.value = request.startDate;
    vacationRequestForm.elements.endDate.value = request.endDate;
    vacationRequestForm.elements.requestedDays.value = request.requestedDays;
    vacationRequestForm.elements.status.value = request.status === 'cancelada' ? 'programada' : request.status;
    vacationRequestForm.elements.includeVacationBonus.value = String(request.includeVacationBonus);
    vacationRequestForm.elements.notes.value = request.notes || '';
    return;
  }

  if (button.dataset.action === 'cancel-vacation-request') {
    const confirmed = window.confirm('Se cancelara la solicitud y los dias volveran al saldo pendiente.');
    if (!confirmed) {
      return;
    }

    await api(`/api/vacations/requests/${request.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        startDate: request.startDate,
        endDate: request.endDate,
        status: 'cancelada',
        includeVacationBonus: request.includeVacationBonus,
        notes: request.notes,
      }),
    });
    await loadEmployees();
    await selectEmployee(state.selectedEmployeeId);
  }
});

projectsTable.addEventListener('click', (event) => {
  const selectButton = event.target.closest('button[data-action="select"]');
  if (selectButton) {
    selectProject(selectButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest('button[data-action="delete-project"]');
  if (deleteButton) {
    deleteProject(deleteButton.dataset.id);
  }
});

closedProjectsTable.addEventListener('click', (event) => {
  const selectButton = event.target.closest('button[data-action="select-closed-project"]');
  if (selectButton) {
    selectClosedProject(selectButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest('button[data-action="delete-closed-project"]');
  if (deleteButton) {
    deleteClosedProject(deleteButton.dataset.id);
  }
});

usersTable.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="select-user"]');
  if (button) {
    selectUser(button.dataset.id);
  }
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(userMessage, '');

  try {
    const id = userForm.elements.id.value;
    const savedUser = await api(id ? `/api/users/${id}` : '/api/users', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(userPayload()),
    });

    setMessage(userMessage, 'Usuario guardado correctamente.', true);
    await loadUsers();
    selectUser(savedUser.id);
  } catch (error) {
    setMessage(userMessage, error.message);
  }
});

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) {
    return;
  }

  await api(`/api/projects/${state.selectedProjectId}/payments`, {
    method: 'POST',
    body: JSON.stringify(simpleFormPayload(paymentForm)),
  });
  paymentForm.reset();
  setDefaultDates();
  await loadProjects();
});

costForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) {
    return;
  }

  await api(`/api/projects/${state.selectedProjectId}/costs`, {
    method: 'POST',
    body: JSON.stringify(simpleFormPayload(costForm)),
  });
  costForm.reset();
  setDefaultDates();
  await loadProjects();
});

paymentsList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete-payment"]');
  if (!button || !state.selectedProjectId) {
    return;
  }

  const password = window.prompt('Ingresa la contrasena del admin para eliminar el pago:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/projects/${state.selectedProjectId}/payments/${button.dataset.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    await loadProjects();
  } catch (error) {
    window.alert(error.message);
  }
});

costsList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete-cost"]');
  if (!button || !state.selectedProjectId) {
    return;
  }

  const password = window.prompt('Ingresa la contrasena del admin para eliminar el costo:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/projects/${state.selectedProjectId}/costs/${button.dataset.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    await loadProjects();
  } catch (error) {
    window.alert(error.message);
  }
});

api('/api/session')
  .then((session) => (session.authenticated ? showApp(session.user) : showLogin()))
  .catch(showLogin);
