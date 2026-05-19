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
  projectsPagination: { page: 1, limit: 15 },
  closedProjectsPagination: { page: 1, limit: 15 },
  employeesPagination: { page: 1, limit: 15 },
  vacationRequestsPagination: { page: 1, limit: 15 },
  reportsProjectsPagination: { page: 1, limit: 15 },
  reportListPagination: { page: 1, limit: 15 },
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

function renderPaginationControls(containerId, pagination, onPageChange, onLimitChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!pagination || pagination.totalRecords === 0) {
    container.innerHTML = '';
    return;
  }
  const { page, limit, totalRecords, totalPages, hasNextPage, hasPreviousPage } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalRecords);

  container.innerHTML = `
    <span class="pagination-info">Mostrando ${start}-${end} de ${totalRecords} registros</span>
    <div class="pagination-buttons">
      <button class="secondary" data-pg-action="first" ${!hasPreviousPage ? 'disabled' : ''} type="button">Primera</button>
      <button class="secondary" data-pg-action="prev" ${!hasPreviousPage ? 'disabled' : ''} type="button">Anterior</button>
      <span class="pagination-current">Pagina ${page} de ${totalPages}</span>
      <button class="secondary" data-pg-action="next" ${!hasNextPage ? 'disabled' : ''} type="button">Siguiente</button>
      <button class="secondary" data-pg-action="last" ${!hasNextPage ? 'disabled' : ''} type="button">Ultima</button>
    </div>
    <div class="pagination-limit">
      <span>Mostrar</span>
      <select data-pg-action="limit">
        <option value="15" ${limit === 15 ? 'selected' : ''}>15</option>
        <option value="30" ${limit === 30 ? 'selected' : ''}>30</option>
        <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
      </select>
    </div>
  `;

  container.onclick = (e) => {
    const btn = e.target.closest('[data-pg-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.pgAction;
    if (action === 'first') onPageChange(1);
    else if (action === 'prev') onPageChange(page - 1);
    else if (action === 'next') onPageChange(page + 1);
    else if (action === 'last') onPageChange(totalPages);
  };

  const limitSelect = container.querySelector('[data-pg-action="limit"]');
  if (limitSelect) {
    limitSelect.onchange = () => onLimitChange(Number(limitSelect.value));
  }
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
  const showingReports = viewName === 'reports';
  projectsView.classList.toggle('hidden', !showingProjects);
  closedProjectsView.classList.toggle('hidden', !showingClosedProjects);
  usersView.classList.toggle('hidden', !showingUsers);
  if (vacationsView) vacationsView.classList.toggle('hidden', !showingVacations);
  if (reportsView) reportsView.classList.toggle('hidden', !showingReports);
  projectsTab.classList.toggle('active', showingProjects);
  closedProjectsTab.classList.toggle('active', showingClosedProjects);
  usersTab.classList.toggle('active', showingUsers);
  if (vacationsTab) vacationsTab.classList.toggle('active', showingVacations);
  if (reportsTab) reportsTab.classList.toggle('active', showingReports);
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
  const pg = state.projectsPagination;
  const result = await api(`/api/projects?page=${pg.page}&limit=${pg.limit}`);
  state.projects = result.data;
  state.projectsTotals = result.totals;
  state.projectsPaginationMeta = result.pagination;
  renderProjects();

  if (state.selectedProjectId) {
    const current = state.projects.find((project) => project.id === state.selectedProjectId);
    if (!current) clearSelection();
  }
}

async function loadClosedProjects() {
  const pg = state.closedProjectsPagination;
  const result = await api(`/api/closed-projects?page=${pg.page}&limit=${pg.limit}`);
  state.closedProjects = result.data;
  state.closedProjectsPaginationMeta = result.pagination;
  renderClosedProjects();

  if (state.selectedClosedProjectId) {
    const current = state.closedProjects.find(
      (project) => project.id === state.selectedClosedProjectId,
    );
    if (!current) clearClosedSelection();
  }
}

function renderProjects() {
  const totals = state.projectsTotals || {};
  document.querySelector('#stat-projects').textContent = totals.count || state.projects.length;
  document.querySelector('#stat-charged').textContent = money.format(totals.total_charged || 0);
  document.querySelector('#stat-spent').textContent = money.format(totals.spent || 0);
  document.querySelector('#stat-pending').textContent = money.format(totals.pending_collection || 0);

  if (!state.projects.length) {
    projectsTable.innerHTML = `<tr><td colspan="10" class="muted">No hay proyectos registrados.</td></tr>`;
    renderPaginationControls('projects-pagination', null);
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

  renderPaginationControls('projects-pagination', state.projectsPaginationMeta,
    (p) => { state.projectsPagination.page = p; loadProjects(); },
    (l) => { state.projectsPagination.limit = l; state.projectsPagination.page = 1; loadProjects(); },
  );
}

function renderClosedProjects() {
  if (!state.closedProjects.length) {
    closedProjectsTable.innerHTML = `<tr><td colspan="9" class="muted">No hay proyectos cerrados.</td></tr>`;
    renderPaginationControls('closed-projects-pagination', null);
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

  renderPaginationControls('closed-projects-pagination', state.closedProjectsPaginationMeta,
    (p) => { state.closedProjectsPagination.page = p; loadClosedProjects(); },
    (l) => { state.closedProjectsPagination.limit = l; state.closedProjectsPagination.page = 1; loadClosedProjects(); },
  );
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

async function selectProject(projectId) {
  let project = state.projects.find((item) => item.id === Number(projectId));
  if (!project) {
    try {
      project = await api(`/api/projects/${projectId}`);
    } catch (_e) {
      return;
    }
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

  const cdrl = document.querySelector('#closed-detail-reports-list');
  if (cdrl && typeof renderDetailReports === 'function') {
    renderDetailReports(project.id, cdrl);
  }

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

  const drl = document.querySelector('#detail-reports-list');
  if (drl && typeof renderDetailReports === 'function') {
    renderDetailReports(project.id, drl);
  }

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
exportProjectsButton.addEventListener('click', async () => {
  const result = await api('/api/projects?page=1&limit=50');
  let allProjects = result.data;
  let pg = result.pagination;
  while (pg.hasNextPage) {
    const next = await api(`/api/projects?page=${pg.page + 1}&limit=50`);
    allProjects = allProjects.concat(next.data);
    pg = next.pagination;
  }
  exportProjectsToExcel(allProjects, 'proyectos');
});
exportClosedProjectsButton.addEventListener('click', async () => {
  const result = await api('/api/closed-projects?page=1&limit=50');
  let allProjects = result.data;
  let pg = result.pagination;
  while (pg.hasNextPage) {
    const next = await api(`/api/closed-projects?page=${pg.page + 1}&limit=50`);
    allProjects = allProjects.concat(next.data);
    pg = next.pagination;
  }
  exportProjectsToExcel(allProjects, 'proyectos-cerrados');
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
  const pg = state.employeesPagination;
  const result = await api(`/api/employees?page=${pg.page}&limit=${pg.limit}`);
  state.employees = result.data;
  state.employeesPaginationMeta = result.pagination;
  renderEmployees();
}

function renderEmployees() {
  if (!state.employees.length) {
    employeesTable.innerHTML = '<tr><td colspan="10" class="muted">No hay empleados registrados.</td></tr>';
    renderPaginationControls('employees-pagination', null);
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

  renderPaginationControls('employees-pagination', state.employeesPaginationMeta,
    (p) => { state.employeesPagination.page = p; loadEmployees(); },
    (l) => { state.employeesPagination.limit = l; state.employeesPagination.page = 1; loadEmployees(); },
  );
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
  state.vacationRequestsPagination = { page: 1, limit: 15 };
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
  const pg = state.vacationRequestsPagination;
  const result = await api(`/api/employees/${employeeId}/vacation-requests?page=${pg.page}&limit=${pg.limit}`);
  const requests = result.data;
  if (!requests.length) {
    vacationRequestsTable.innerHTML = '<tr><td colspan="8" class="muted">Este empleado aun no tiene vacaciones registradas.</td></tr>';
    renderPaginationControls('vacation-requests-pagination', null);
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

  renderPaginationControls('vacation-requests-pagination', result.pagination,
    (p) => { state.vacationRequestsPagination.page = p; loadVacationRequests(employeeId); },
    (l) => { state.vacationRequestsPagination.limit = l; state.vacationRequestsPagination.page = 1; loadVacationRequests(employeeId); },
  );
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

// ===================== REPORTS MODULE =====================

const reportsTab = document.querySelector('#reports-tab');
const reportsView = document.querySelector('#reports-view');
const reportsProjectsTable = document.querySelector('#reports-projects-table');
const reportFormPanel = document.querySelector('#report-form-panel');
const reportForm = document.querySelector('#report-form');
const reportFormTitle = document.querySelector('#report-form-title');
const reportFormSubtitle = document.querySelector('#report-form-subtitle');
const reportMessage = document.querySelector('#report-message');
const reportBackButton = document.querySelector('#report-back-button');
const reportListPanel = document.querySelector('#report-list-panel');
const reportListTitle = document.querySelector('#report-list-title');
const reportListSubtitle = document.querySelector('#report-list-subtitle');
const reportListTable = document.querySelector('#report-list-table');
const reportListNew = document.querySelector('#report-list-new');
const reportListBack = document.querySelector('#report-list-back');
const reportSearch = document.querySelector('#report-search');
const reportStatusFilter = document.querySelector('#report-status-filter');
const detailReportsList = document.querySelector('#detail-reports-list');
const detailNewReport = document.querySelector('#detail-new-report');
const closedDetailReportsList = document.querySelector('#closed-detail-reports-list');
const closedDetailNewReport = document.querySelector('#closed-detail-new-report');
const safetyOtrasCheckbox = document.querySelector('[name="safety_otras"]');
const safetyOtrasField = document.querySelector('#safety-otras-field');

state.reportsAllProjects = [];
state.reportsProjectReports = [];
state.currentReportProjectId = null;

if (safetyOtrasCheckbox) {
  safetyOtrasCheckbox.addEventListener('change', () => {
    safetyOtrasField.classList.toggle('hidden', !safetyOtrasCheckbox.checked);
  });
}

async function loadAllProjectsForReports() {
  const pg = state.reportsProjectsPagination;
  const search = (reportSearch ? reportSearch.value : '') || '';
  const statusFilter = (reportStatusFilter ? reportStatusFilter.value : '') || '';
  const result = await api(`/api/all-projects?page=${pg.page}&limit=${pg.limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(statusFilter)}`);
  state.reportsAllProjects = result.data;
  state.reportsProjectsPaginationMeta = result.pagination;
  renderReportsProjectsTable();
}

function renderReportsProjectsTable() {
  const projects = state.reportsAllProjects;

  if (!projects.length) {
    reportsProjectsTable.innerHTML = '<tr><td colspan="7" class="muted">No hay proyectos disponibles para generar reportes.</td></tr>';
    renderPaginationControls('reports-projects-pagination', null);
    return;
  }

  reportsProjectsTable.innerHTML = projects.map((p) => `
    <tr>
      <td>${p.id}</td>
      <td>${escapeHtml(p.quote_number)}</td>
      <td>${escapeHtml(p.client_name)}</td>
      <td>${escapeHtml(p.project_description || '')}</td>
      <td><span class="badge status">${escapeHtml(p.status)}</span></td>
      <td>${p.report_count || 0}</td>
      <td>
        <div class="row-actions">
          <button class="secondary" data-action="report-new" data-id="${p.id}" type="button">Generar reporte</button>
          <button class="secondary" data-action="report-list" data-id="${p.id}" type="button">Ver reportes</button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPaginationControls('reports-projects-pagination', state.reportsProjectsPaginationMeta,
    (p) => { state.reportsProjectsPagination.page = p; loadAllProjectsForReports(); },
    (l) => { state.reportsProjectsPagination.limit = l; state.reportsProjectsPagination.page = 1; loadAllProjectsForReports(); },
  );
}

function showReportsMainList() {
  reportFormPanel.classList.add('hidden');
  reportListPanel.classList.add('hidden');
  reportsProjectsTable.closest('.panel').classList.remove('hidden');
}

function openReportForm(projectId, reportData) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project && !reportData) return;

  state.currentReportProjectId = Number(projectId);
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportListPanel.classList.add('hidden');
  reportFormPanel.classList.remove('hidden');

  reportForm.reset();
  setMessage(reportMessage, '');

  if (reportData) {
    reportFormTitle.textContent = 'Editar reporte';
    reportFormSubtitle.textContent = `Folio: ${reportData.report_folio}`;
    reportForm.elements.id.value = reportData.id;
    reportForm.elements.project_id.value = reportData.project_id;
    reportForm.elements.report_folio.value = reportData.report_folio || '';
    reportForm.elements.report_date.value = reportData.report_date || '';
    reportForm.elements.client_name.value = reportData.client_name || '';
    reportForm.elements.client_address.value = reportData.client_address || '';
    reportForm.elements.service_name.value = reportData.service_name || '';
    reportForm.elements.assigned_technicians.value = reportData.assigned_technicians || '';
    reportForm.elements.burner_model.value = reportData.burner_model || '';
    reportForm.elements.equipment_model_serial.value = reportData.equipment_model_serial || '';
    reportForm.elements.pumps_motors_model.value = reportData.pumps_motors_model || '';
    reportForm.elements.fuel.value = reportData.fuel || '';
    reportForm.elements.voltage.value = reportData.voltage || '';
    reportForm.elements.gas_pressure_inh2o.value = reportData.gas_pressure_inh2o || '';
    reportForm.elements.liquid_fuel_pressure_psi.value = reportData.liquid_fuel_pressure_psi || '';
    reportForm.elements.working_pressure.value = reportData.working_pressure || '';
    reportForm.elements.pump_amperage.value = reportData.pump_amperage || '';
    reportForm.elements.fan_amperage.value = reportData.fan_amperage || '';
    reportForm.elements.condensate_tank_temp_c.value = reportData.condensate_tank_temp_c || '';
    reportForm.elements.operating_output_temp_c.value = reportData.operating_output_temp_c || '';
    reportForm.elements.flue_gas_temp_c.value = reportData.flue_gas_temp_c || '';
    reportForm.elements.comments.value = reportData.comments || '';
    reportForm.elements.technician_name.value = reportData.technician_name || '';
    reportForm.elements.plant_manager_name.value = reportData.plant_manager_name || '';

    const safety = reportData.safety_tests ? JSON.parse(reportData.safety_tests) : {};
    reportForm.elements.safety_alarmas.checked = Boolean(safety.alarmas);
    reportForm.elements.safety_alta_presion.checked = Boolean(safety.alta_presion);
    reportForm.elements.safety_paro_arranque.checked = Boolean(safety.paro_arranque);
    reportForm.elements.safety_paro_emergencia.checked = Boolean(safety.paro_emergencia);
    reportForm.elements.safety_switch_aire.checked = Boolean(safety.switch_aire);
    reportForm.elements.safety_cambio_fuego.checked = Boolean(safety.cambio_fuego);
    reportForm.elements.safety_baja_presion.checked = Boolean(safety.baja_presion);
    reportForm.elements.safety_switch_gas.checked = Boolean(safety.switch_gas);
    reportForm.elements.safety_otras.checked = Boolean(safety.otras);
    if (safety.otras) {
      safetyOtrasField.classList.remove('hidden');
      reportForm.elements.safety_otras_text.value = safety.otras_text || '';
    }

    const emLow = reportData.emissions_low_fire ? JSON.parse(reportData.emissions_low_fire) : {};
    const emHigh = reportData.emissions_high_fire ? JSON.parse(reportData.emissions_high_fire) : {};
    const emKeys = ['o2', 'co2', 'co', 'tgas', 'taire', 'perdidas', 'eficiencia', 'lambda'];
    emKeys.forEach((k) => {
      if (reportForm.elements['em_' + k + '_low']) reportForm.elements['em_' + k + '_low'].value = emLow[k] || '';
      if (reportForm.elements['em_' + k + '_high']) reportForm.elements['em_' + k + '_high'].value = emHigh[k] || '';
    });
  } else {
    reportFormTitle.textContent = 'FORMATO DE ARRANQUE DE CALDERA';
    reportFormSubtitle.textContent = `Proyecto #${project.id} - ${project.client_name}`;
    reportForm.elements.id.value = '';
    reportForm.elements.project_id.value = project.id;
    reportForm.elements.report_date.value = today();
    reportForm.elements.client_name.value = project.client_name || '';
    reportForm.elements.service_name.value = project.project_description || '';
    reportForm.elements.assigned_technicians.value = project.technician_name || '';
  }
}

function collectReportPayload() {
  const safetyTests = {
    alarmas: reportForm.elements.safety_alarmas.checked,
    alta_presion: reportForm.elements.safety_alta_presion.checked,
    paro_arranque: reportForm.elements.safety_paro_arranque.checked,
    paro_emergencia: reportForm.elements.safety_paro_emergencia.checked,
    switch_aire: reportForm.elements.safety_switch_aire.checked,
    cambio_fuego: reportForm.elements.safety_cambio_fuego.checked,
    baja_presion: reportForm.elements.safety_baja_presion.checked,
    switch_gas: reportForm.elements.safety_switch_gas.checked,
    otras: reportForm.elements.safety_otras.checked,
    otras_text: reportForm.elements.safety_otras_text ? reportForm.elements.safety_otras_text.value : '',
  };

  const emKeys = ['o2', 'co2', 'co', 'tgas', 'taire', 'perdidas', 'eficiencia', 'lambda'];
  const emLow = {};
  const emHigh = {};
  emKeys.forEach((k) => {
    emLow[k] = (reportForm.elements['em_' + k + '_low'] || {}).value || '';
    emHigh[k] = (reportForm.elements['em_' + k + '_high'] || {}).value || '';
  });

  return {
    project_id: Number(reportForm.elements.project_id.value),
    report_folio: reportForm.elements.report_folio.value || '',
    report_date: reportForm.elements.report_date.value,
    client_name: reportForm.elements.client_name.value,
    client_address: reportForm.elements.client_address.value,
    service_name: reportForm.elements.service_name.value,
    assigned_technicians: reportForm.elements.assigned_technicians.value,
    burner_model: reportForm.elements.burner_model.value,
    equipment_model_serial: reportForm.elements.equipment_model_serial.value,
    pumps_motors_model: reportForm.elements.pumps_motors_model.value,
    fuel: reportForm.elements.fuel.value,
    voltage: reportForm.elements.voltage.value,
    gas_pressure_inh2o: reportForm.elements.gas_pressure_inh2o.value,
    liquid_fuel_pressure_psi: reportForm.elements.liquid_fuel_pressure_psi.value,
    working_pressure: reportForm.elements.working_pressure.value,
    pump_amperage: reportForm.elements.pump_amperage.value,
    fan_amperage: reportForm.elements.fan_amperage.value,
    condensate_tank_temp_c: reportForm.elements.condensate_tank_temp_c.value,
    operating_output_temp_c: reportForm.elements.operating_output_temp_c.value,
    flue_gas_temp_c: reportForm.elements.flue_gas_temp_c.value,
    safety_tests: safetyTests,
    comments: reportForm.elements.comments.value,
    emissions_low_fire: emLow,
    emissions_high_fire: emHigh,
    technician_name: reportForm.elements.technician_name.value,
    plant_manager_name: reportForm.elements.plant_manager_name.value,
  };
}

async function openReportListForProject(projectId) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project) return;

  state.currentReportProjectId = Number(projectId);
  state.reportListPagination = { page: 1, limit: 15 };
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportFormPanel.classList.add('hidden');
  reportListPanel.classList.remove('hidden');

  reportListTitle.textContent = `Reportes - Proyecto #${project.id}`;
  reportListSubtitle.textContent = `${project.client_name} | ${project.project_description || ''}`;

  await loadReportListPage(projectId);
}

async function loadReportListPage(projectId) {
  const pid = projectId || state.currentReportProjectId;
  const pg = state.reportListPagination;
  try {
    const result = await api(`/api/projects/${pid}/reports?page=${pg.page}&limit=${pg.limit}`);
    state.reportsProjectReports = result.data;
    renderReportList(result.data, result.pagination);
  } catch (error) {
    reportListTable.innerHTML = '<tr><td colspan="5" class="muted">Error al cargar reportes.</td></tr>';
    renderPaginationControls('report-list-pagination', null);
  }
}

function renderReportList(reports, pagination) {
  if (!reports.length) {
    reportListTable.innerHTML = '<tr><td colspan="5" class="muted">Este proyecto aun no tiene reportes generados.</td></tr>';
    renderPaginationControls('report-list-pagination', null);
    return;
  }

  reportListTable.innerHTML = reports.map((r) => `
    <tr>
      <td>${escapeHtml(r.report_folio)}</td>
      <td>${escapeHtml(r.report_date)}</td>
      <td>${escapeHtml(r.service_name || '')}</td>
      <td>${escapeHtml(r.technician_name || '')}</td>
      <td>
        <div class="row-actions">
          <button class="secondary" data-action="report-edit" data-id="${r.id}" type="button">Editar</button>
          <button class="secondary" data-action="report-print" data-id="${r.id}" type="button">Imprimir</button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPaginationControls('report-list-pagination', pagination,
    (p) => { state.reportListPagination.page = p; loadReportListPage(); },
    (l) => { state.reportListPagination.limit = l; state.reportListPagination.page = 1; loadReportListPage(); },
  );
}

async function renderDetailReports(projectId, listElement) {
  try {
    const result = await api('/api/projects/' + projectId + '/reports?limit=50');
    const reports = result.data || result;
    if (!reports.length) {
      listElement.innerHTML = '<li class="muted">Sin reportes generados.</li>';
      return;
    }
    listElement.innerHTML = reports.map((r) => `
      <li>
        <div>
          <strong>${escapeHtml(r.report_folio)}</strong>
          <small>${escapeHtml(r.report_date)} - ${escapeHtml(r.service_name || '')} - ${escapeHtml(r.technician_name || '')}</small>
        </div>
        <div class="row-actions">
          <button class="secondary" data-action="detail-report-edit" data-id="${r.id}" data-project="${projectId}" type="button">Editar</button>
          <button class="secondary" data-action="detail-report-print" data-id="${r.id}" type="button">Imprimir</button>
        </div>
      </li>
    `).join('');
  } catch (_e) {
    listElement.innerHTML = '<li class="muted">Error al cargar reportes.</li>';
  }
}

if (reportsTab) {
  reportsTab.addEventListener('click', async () => {
    switchView('reports');
    showReportsMainList();
    await loadAllProjectsForReports();
  });
}

if (reportSearch) {
  reportSearch.addEventListener('input', () => {
    state.reportsProjectsPagination.page = 1;
    loadAllProjectsForReports();
  });
}
if (reportStatusFilter) {
  reportStatusFilter.addEventListener('change', () => {
    state.reportsProjectsPagination.page = 1;
    loadAllProjectsForReports();
  });
}

if (reportsProjectsTable) {
  reportsProjectsTable.addEventListener('click', (event) => {
    const newBtn = event.target.closest('[data-action="report-new"]');
    if (newBtn) {
      openReportForm(newBtn.dataset.id, null);
      return;
    }
    const listBtn = event.target.closest('[data-action="report-list"]');
    if (listBtn) {
      openReportListForProject(listBtn.dataset.id);
    }
  });
}

if (reportBackButton) {
  reportBackButton.addEventListener('click', () => {
    showReportsMainList();
  });
}

if (reportListBack) {
  reportListBack.addEventListener('click', () => {
    showReportsMainList();
  });
}

if (reportListNew) {
  reportListNew.addEventListener('click', () => {
    if (state.currentReportProjectId) {
      openReportForm(state.currentReportProjectId, null);
    }
  });
}

if (reportListTable) {
  reportListTable.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-action="report-edit"]');
    if (editBtn) {
      try {
        const reportData = await api('/api/reports/' + editBtn.dataset.id);
        openReportForm(reportData.project_id, reportData);
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const printBtn = event.target.closest('[data-action="report-print"]');
    if (printBtn) {
      window.open('/report-print.html?id=' + printBtn.dataset.id, '_blank');
    }
  });
}

if (reportForm) {
  reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(reportMessage, '');

    try {
      const payload = collectReportPayload();
      const id = reportForm.elements.id.value;
      const result = await api(id ? '/api/reports/' + id : '/api/reports', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(reportMessage, 'Reporte guardado correctamente.', true);
      setTimeout(() => {
        openReportListForProject(result.project_id);
      }, 800);
    } catch (error) {
      setMessage(reportMessage, error.message);
    }
  });
}

if (detailReportsList) {
  detailReportsList.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-action="detail-report-edit"]');
    if (editBtn) {
      try {
        const reportData = await api('/api/reports/' + editBtn.dataset.id);
        state.reportsAllProjects = state.projects;
        switchView('reports');
        openReportForm(reportData.project_id, reportData);
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const printBtn = event.target.closest('[data-action="detail-report-print"]');
    if (printBtn) {
      window.open('/report-print.html?id=' + printBtn.dataset.id, '_blank');
    }
  });
}

if (detailNewReport) {
  detailNewReport.addEventListener('click', async () => {
    if (!state.selectedProjectId) return;
    state.reportsAllProjects = state.projects;
    switchView('reports');
    openReportForm(state.selectedProjectId, null);
  });
}

if (closedDetailReportsList) {
  closedDetailReportsList.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-action="detail-report-edit"]');
    if (editBtn) {
      try {
        const reportData = await api('/api/reports/' + editBtn.dataset.id);
        state.reportsAllProjects = state.closedProjects;
        switchView('reports');
        openReportForm(reportData.project_id, reportData);
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const printBtn = event.target.closest('[data-action="detail-report-print"]');
    if (printBtn) {
      window.open('/report-print.html?id=' + printBtn.dataset.id, '_blank');
    }
  });
}

if (closedDetailNewReport) {
  closedDetailNewReport.addEventListener('click', async () => {
    if (!state.selectedClosedProjectId) return;
    state.reportsAllProjects = state.closedProjects;
    switchView('reports');
    openReportForm(state.selectedClosedProjectId, null);
  });
}

// ===================== END REPORTS MODULE =====================

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
