const state = {
  projects: [],
  closedProjects: [],
  users: [],
  exchangeRates: { MXN: 1, USD: 17, EUR: 19 },
  exchangeUpdatedAt: null,
  selectedProjectId: null,
  selectedClosedProjectId: null,
  selectedUserId: null,
  adminVerified: false,
};

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const projectsView = document.querySelector('#projects-view');
const closedProjectsView = document.querySelector('#closed-projects-view');
const usersView = document.querySelector('#users-view');
const projectsTab = document.querySelector('#projects-tab');
const closedProjectsTab = document.querySelector('#closed-projects-tab');
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

async function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  setDefaultDates();
  resetUserForm();
  state.adminVerified = false;
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
  const showingUsers = viewName === 'users';
  const showingVacations = viewName === 'vacations';
  projectsView.classList.toggle('hidden', !showingProjects);
  closedProjectsView.classList.toggle('hidden', !showingClosedProjects);
  usersView.classList.toggle('hidden', !showingUsers);
  if (vacationsView) vacationsView.classList.toggle('hidden', !showingVacations);
  projectsTab.classList.toggle('active', showingProjects);
  closedProjectsTab.classList.toggle('active', showingClosedProjects);
  usersTab.classList.toggle('active', showingUsers);
  if (vacationsTab) vacationsTab.classList.toggle('active', showingVacations);
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
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(simpleFormPayload(loginForm)),
    });
    state.userRole = result.role || 'user';
    showVacationsTab();
    loginForm.reset();
    await showApp();
  } catch (error) {
    setMessage(loginMessage, error.message);
  }
});

logoutButton.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  clearSelection();
  clearClosedSelection();
  resetUserForm();
  state.adminVerified = false;
  showLogin();
});

projectsTab.addEventListener('click', () => switchView('projects'));
closedProjectsTab.addEventListener('click', async () => {
  switchView('closed-projects');
  await loadClosedProjects();
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

// ===================== VACATION MODULE =====================

const vacationsTab = document.querySelector('#vacations-tab');
const vacationsView = document.querySelector('#vacations-view');
const employeesTable = document.querySelector('#employees-table');
const employeeModal = document.querySelector('#employee-modal');
const employeeForm = document.querySelector('#employee-form');
const employeeFormTitle = document.querySelector('#employee-form-title');
const employeeMessage = document.querySelector('#employee-message');
const newEmployeeButton = document.querySelector('#new-employee-button');
const vacationModal = document.querySelector('#vacation-modal');
const vacationModalTitle = document.querySelector('#vacation-modal-title');
const vacationModalSubtitle = document.querySelector('#vacation-modal-subtitle');
const vacationEmployeeSummary = document.querySelector('#vacation-employee-summary');
const vacationRequestsTable = document.querySelector('#vacation-requests-table');
const vacationRequestForm = document.querySelector('#vacation-request-form');
const vacationRequestMessage = document.querySelector('#vacation-request-message');
const saveAndPrintVacation = document.querySelector('#save-and-print-vacation');

state.employees = [];
state.selectedEmployeeId = null;
state.userRole = null;

function showVacationsTab() {
  if (state.userRole === 'admin') {
    vacationsTab.classList.remove('hidden');
  } else {
    vacationsTab.classList.add('hidden');
  }
}

async function loadEmployees() {
  state.employees = await api('/api/employees');
  renderEmployees();
}

function renderEmployees() {
  if (!state.employees.length) {
    employeesTable.innerHTML = '<tr><td colspan="10" class="muted">No hay empleados registrados.</td></tr>';
    return;
  }

  employeesTable.innerHTML = state.employees.map((emp) => {
    const isInactive = !emp.active;
    const rowClass = isInactive ? 'row-inactive' : '';
    const pendingClass = emp.days_pending < 0 ? 'negative-balance' : '';
    const pendingLabel = emp.days_pending < 0
      ? `<span class="badge badge-negative">${emp.days_pending}</span><br><small class="text-negative">Saldo negativo por vacaciones anticipadas</small>`
      : `${emp.days_pending}`;
    const statusBadge = isInactive
      ? `<span class="badge badge-inactive">INACTIVO</span>${emp.termination_date ? `<br><small class="muted">${escapeHtml(emp.termination_date)}</small>` : ''}`
      : '<span class="badge badge-active">Activo</span>';

    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(emp.employee_number)}</td>
        <td>${escapeHtml(emp.full_name)}</td>
        <td>${escapeHtml(emp.hire_date)}</td>
        <td>${emp.seniority_years} año${emp.seniority_years !== 1 ? 's' : ''}</td>
        <td>${statusBadge}</td>
        <td>${emp.accrued_days}</td>
        <td>${emp.days_taken}</td>
        <td>${emp.days_scheduled}</td>
        <td class="${pendingClass}">${pendingLabel}</td>
        <td>
          <div class="row-actions">
            <button class="secondary" data-action="edit-employee" data-id="${emp.id}" type="button">Editar</button>
            <button class="secondary" data-action="open-vacations" data-id="${emp.id}" type="button">Vacaciones programadas</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openEmployeeModal(employee) {
  employeeModal.classList.remove('hidden');
  setMessage(employeeMessage, '');
  if (employee) {
    employeeFormTitle.textContent = `Editar empleado #${employee.id}`;
    employeeForm.elements.id.value = employee.id;
    employeeForm.elements.employee_number.value = employee.employee_number;
    employeeForm.elements.full_name.value = employee.full_name;
    employeeForm.elements.hire_date.value = employee.hire_date;
    employeeForm.elements.department.value = employee.department || '';
    employeeForm.elements.position.value = employee.position || '';
    employeeForm.elements.immediate_boss.value = employee.immediate_boss || '';
    employeeForm.elements.active.checked = Boolean(employee.active);
    employeeForm.elements.termination_date.value = employee.termination_date || '';
    employeeForm.elements.inactive_reason.value = employee.inactive_reason || '';
  } else {
    employeeFormTitle.textContent = 'Agregar empleado';
    employeeForm.reset();
    employeeForm.elements.id.value = '';
    employeeForm.elements.active.checked = true;
  }
  toggleTerminationFields();
}

function toggleTerminationFields() {
  const terminationFields = document.getElementById('termination-fields');
  const isActive = employeeForm.elements.active.checked;
  terminationFields.classList.toggle('hidden', isActive);
  if (isActive) {
    employeeForm.elements.termination_date.value = '';
    employeeForm.elements.inactive_reason.value = '';
  }
}

function closeEmployeeModal() {
  employeeModal.classList.add('hidden');
  employeeForm.reset();
}

async function openVacationModal(employeeId) {
  const emp = state.employees.find((e) => e.id === Number(employeeId));
  if (!emp) return;

  state.selectedEmployeeId = emp.id;
  vacationModal.classList.remove('hidden');
  vacationModalTitle.textContent = `Vacaciones - ${emp.full_name}`;
  vacationModalSubtitle.textContent = `No. ${emp.employee_number} | Ingreso: ${emp.hire_date}`;

  const pendingClass = emp.days_pending < 0 ? 'summary-negative' : '';
  const negativeNote = emp.days_pending < 0
    ? '<p class="text-negative" style="grid-column:1/-1;margin:0;">Saldo negativo por vacaciones anticipadas. Se descontara del siguiente ejercicio vacacional.</p>'
    : '';
  const inactiveNote = !emp.active
    ? `<p class="text-negative" style="grid-column:1/-1;margin:0;">Empleado inactivo. Calculo realizado hasta la fecha de baja (${escapeHtml(emp.termination_date || '')}).</p>`
    : '';

  vacationEmployeeSummary.innerHTML = `
    <article><span>Antiguedad</span><strong>${emp.seniority_years} año${emp.seniority_years !== 1 ? 's' : ''}</strong></article>
    <article><span>Dias generados acumulados</span><strong>${emp.accrued_days}</strong></article>
    <article><span>Dias tomados</span><strong>${emp.days_taken}</strong></article>
    <article><span>Dias programados</span><strong>${emp.days_scheduled}</strong></article>
    <article class="${pendingClass}"><span>Dias disponibles</span><strong>${emp.days_pending}</strong></article>
    ${negativeNote}
    ${inactiveNote}
  `;

  setMessage(vacationRequestMessage, '');
  vacationRequestForm.reset();
  await loadVacationRequests(emp.id);
}

async function loadVacationRequests(employeeId) {
  const requests = await api(`/api/employees/${employeeId}/vacation-requests`);
  if (!requests.length) {
    vacationRequestsTable.innerHTML = '<tr><td colspan="8" class="muted">Este empleado aun no tiene vacaciones registradas.</td></tr>';
    return;
  }

  vacationRequestsTable.innerHTML = requests.map((req) => `
    <tr>
      <td>${escapeHtml(req.start_date)}</td>
      <td>${escapeHtml(req.end_date)}</td>
      <td>${req.requested_days}</td>
      <td>${req.vacation_exercise_year}</td>
      <td><span class="badge status-${req.status}">${escapeHtml(req.status)}</span></td>
      <td>${escapeHtml(req.notes || '')}</td>
      <td>${escapeHtml((req.created_at || '').slice(0, 10))}</td>
      <td>
        <div class="row-actions">
          ${req.status !== 'cancelada' ? `<button class="danger" data-action="cancel-vacation" data-id="${req.id}" type="button">Cancelar</button>` : ''}
          ${req.status === 'programada' ? `<button class="secondary" data-action="mark-taken" data-id="${req.id}" type="button">Marcar tomada</button>` : ''}
          <button class="secondary" data-action="print-vacation" data-id="${req.id}" type="button">Formato</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function closeVacationModal() {
  vacationModal.classList.add('hidden');
  state.selectedEmployeeId = null;
}

function calculateDisplayDays() {
  const startDate = vacationRequestForm.elements.start_date.value;
  const endDate = vacationRequestForm.elements.end_date.value;
  if (startDate && endDate && endDate >= startDate) {
    let count = 0;
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    vacationRequestForm.elements.requested_days_display.value = count;
  } else {
    vacationRequestForm.elements.requested_days_display.value = '';
  }
}

async function submitVacationRequest(andPrint) {
  if (!state.selectedEmployeeId) return;
  setMessage(vacationRequestMessage, '');

  const startDate = vacationRequestForm.elements.start_date.value;
  const endDate = vacationRequestForm.elements.end_date.value;
  const status = vacationRequestForm.elements.status.value;
  const includeBonus = vacationRequestForm.elements.include_vacation_bonus.checked;
  const notes = vacationRequestForm.elements.notes.value;

  if (!startDate || !endDate) {
    setMessage(vacationRequestMessage, 'Fecha inicial y final son obligatorias.');
    return;
  }

  const payload = {
    start_date: startDate,
    end_date: endDate,
    status,
    include_vacation_bonus: includeBonus,
    notes: notes || undefined,
  };

  try {
    const response = await fetch(`/api/employees/${state.selectedEmployeeId}/vacation-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.status === 409 && data.requires_confirmation) {
      const reason = window.prompt(
        `${data.message}\n\nDias disponibles: ${data.available_days}\nDias solicitados: ${data.requested_days}\nSaldo posterior: ${data.balance_after}\n\nIngresa el motivo de autorizacion para continuar:`,
        'Vacaciones anticipadas autorizadas por direccion.',
      );
      if (!reason) {
        setMessage(vacationRequestMessage, 'Solicitud cancelada por el usuario.');
        return;
      }

      payload.confirm_negative_balance = true;
      payload.admin_override_reason = reason;

      const confirmResult = await api(`/api/employees/${state.selectedEmployeeId}/vacation-requests`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(vacationRequestMessage, 'Solicitud con saldo negativo guardada correctamente.', true);
      vacationRequestForm.reset();
      await loadEmployees();
      await openVacationModal(state.selectedEmployeeId);
      if (andPrint) {
        window.open(`/vacation-print.html?id=${confirmResult.id}`, '_blank');
      }
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || 'La operacion no pudo completarse.');
    }

    setMessage(vacationRequestMessage, 'Solicitud guardada correctamente.', true);
    vacationRequestForm.reset();
    await loadEmployees();
    await openVacationModal(state.selectedEmployeeId);

    if (andPrint) {
      window.open(`/vacation-print.html?id=${data.id}`, '_blank');
    }
  } catch (error) {
    setMessage(vacationRequestMessage, error.message);
  }
}

newEmployeeButton.addEventListener('click', () => openEmployeeModal(null));
employeeForm.elements.active.addEventListener('change', toggleTerminationFields);

employeeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(employeeMessage, '');

  const isActive = employeeForm.elements.active.checked;
  if (!isActive && !employeeForm.elements.termination_date.value) {
    setMessage(employeeMessage, 'La fecha de baja es obligatoria para empleados inactivos.');
    return;
  }

  const id = employeeForm.elements.id.value;
  const payload = {
    employee_number: employeeForm.elements.employee_number.value,
    full_name: employeeForm.elements.full_name.value,
    hire_date: employeeForm.elements.hire_date.value,
    department: employeeForm.elements.department.value || undefined,
    position: employeeForm.elements.position.value || undefined,
    immediate_boss: employeeForm.elements.immediate_boss.value || undefined,
    active: isActive,
    termination_date: !isActive ? employeeForm.elements.termination_date.value : undefined,
    inactive_reason: !isActive ? (employeeForm.elements.inactive_reason.value || undefined) : undefined,
  };

  try {
    await api(id ? `/api/employees/${id}` : '/api/employees', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(employeeMessage, 'Empleado guardado correctamente.', true);
    await loadEmployees();
    setTimeout(closeEmployeeModal, 800);
  } catch (error) {
    setMessage(employeeMessage, error.message);
  }
});

employeeModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === employeeModal) {
    closeEmployeeModal();
  }
});

vacationModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === vacationModal) {
    closeVacationModal();
  }
});

vacationRequestForm.elements.start_date.addEventListener('change', calculateDisplayDays);
vacationRequestForm.elements.end_date.addEventListener('change', calculateDisplayDays);

vacationRequestForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitVacationRequest(false);
});

saveAndPrintVacation.addEventListener('click', () => {
  submitVacationRequest(true);
});

employeesTable.addEventListener('click', (event) => {
  const editBtn = event.target.closest('[data-action="edit-employee"]');
  if (editBtn) {
    const emp = state.employees.find((e) => e.id === Number(editBtn.dataset.id));
    if (emp) openEmployeeModal(emp);
    return;
  }

  const vacBtn = event.target.closest('[data-action="open-vacations"]');
  if (vacBtn) {
    openVacationModal(vacBtn.dataset.id);
    return;
  }

  const printBtn = event.target.closest('[data-action="print-format"]');
  if (printBtn) {
    openVacationModal(printBtn.dataset.id);
  }
});

vacationRequestsTable.addEventListener('click', async (event) => {
  const cancelBtn = event.target.closest('[data-action="cancel-vacation"]');
  if (cancelBtn) {
    if (!window.confirm('¿Cancelar esta solicitud de vacaciones?')) return;
    try {
      await api(`/api/vacation-requests/${cancelBtn.dataset.id}/cancel`, { method: 'PATCH' });
      await loadEmployees();
      await openVacationModal(state.selectedEmployeeId);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const takenBtn = event.target.closest('[data-action="mark-taken"]');
  if (takenBtn) {
    try {
      const reqData = await api(`/api/vacation-requests/${takenBtn.dataset.id}`);
      await api(`/api/vacation-requests/${takenBtn.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          start_date: reqData.start_date,
          end_date: reqData.end_date,
          status: 'tomada',
          include_vacation_bonus: Boolean(reqData.include_vacation_bonus),
          notes: reqData.notes || '',
        }),
      });
      await loadEmployees();
      await openVacationModal(state.selectedEmployeeId);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const printVacBtn = event.target.closest('[data-action="print-vacation"]');
  if (printVacBtn) {
    window.open(`/vacation-print.html?id=${printVacBtn.dataset.id}`, '_blank');
  }
});

vacationsTab.addEventListener('click', async () => {
  if (state.userRole !== 'admin') {
    window.alert('Acceso restringido. Solo el administrador puede consultar y programar vacaciones.');
    return;
  }
  switchView('vacations');
  await loadEmployees();
});

// ===================== END VACATION MODULE =====================

api('/api/session')
  .then((session) => {
    if (session.authenticated) {
      state.userRole = session.user.role || 'user';
      showVacationsTab();
      showApp();
    } else {
      showLogin();
    }
  })
  .catch(showLogin);
