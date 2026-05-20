const state = {
  projects: [],
  closedProjects: [],
  users: [],
  employees: [],
  exchangeRates: { MXN: 1, USD: 17, EUR: 19 },
  exchangeUpdatedAt: null,
  selectedProjectId: null,
  selectedClosedProjectId: null,
  selectedUserId: null,
  selectedEmployeeId: null,
  adminVerified: false,
  userRole: null,
  reportsAllProjects: [],
  reportsProjectReports: [],
  currentReportProjectId: null,
};

state.projectsPag = { page: 1, limit: 15 };
state.projectsSearch = '';
state.closedPag = { page: 1, limit: 15 };
state.closedSearch = '';
state.employeesPag = { page: 1, limit: 15 };
state.employeesSearch = '';
state.employeesActiveFilter = 'all';
state.usersPag = { page: 1, limit: 15 };
state.vacReqPag = { page: 1, limit: 15 };
state.reportsProjPag = { page: 1, limit: 15 };
state.reportsProjSearch = '';
state.reportsProjStatus = '';
state.projReportsPag = { page: 1, limit: 15 };
state.ecovisProjectsPag = { page: 1, limit: 15 };
state.ecovisProjectsSearch = '';
state.ecovisPaymentsPag = { page: 1, limit: 15 };
state.ecovisLoansPag = { page: 1, limit: 15 };
state.ecovisMovementsPag = { page: 1, limit: 15 };
state.ecovisMovementsSearch = '';
state.ecovisMovementsTypeFilter = '';
state.selectedEcovisPaymentId = null;
state.tableSort = {};

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

const projectsSearchInput = document.querySelector('#projects-search');
const closedProjectsSearchInput = document.querySelector('#closed-projects-search');
const employeesSearchInput = document.querySelector('#employees-search');
const employeesActiveFilterSelect = document.querySelector('#employees-active-filter');

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

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const defaultPagination = {
  page: 1,
  limit: 15,
  totalRecords: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getTableSort(tableKey) {
  return state.tableSort[tableKey] || { sortBy: '', sortOrder: 'asc' };
}

function buildTableParams(tableKey) {
  const params = {};
  const sort = getTableSort(tableKey);
  if (sort.sortBy) {
    params.sortBy = sort.sortBy;
    params.sortOrder = sort.sortOrder || 'asc';
  }
  return params;
}

function resetTableControls(tableKey) {
  state.tableSort[tableKey] = { sortBy: '', sortOrder: 'asc' };
}

function renderDataTable({
  tableBody,
  tableKey,
  columns,
  data,
  pagination,
  paginationContainerId,
  emptyMessage,
  filteredEmptyMessage,
  isFiltered = false,
  onRefresh,
  pageState,
  renderActions,
  rowClass,
}) {
  const table = tableBody.closest('table');
  const thead = table.querySelector('thead');
  const sort = getTableSort(tableKey);
  const visibleColumns = columns.filter((column) => column.visible !== false);
  const hasActionColumn = true;

  thead.innerHTML = `
    <tr>
      ${visibleColumns.map((column) => {
        const isSorted = sort.sortBy === column.key;
        const sortIcon = !column.sortable ? '' : (!isSorted ? '↕' : (sort.sortOrder === 'desc' ? '↓' : '↑'));
        return `<th>
          <button class="datatable-sort" type="button" data-sort-key="${escapeHtml(column.key)}" ${column.sortable ? '' : 'disabled'}>
            ${escapeHtml(column.label)} <span>${sortIcon}</span>
          </button>
        </th>`;
      }).join('')}
      ${hasActionColumn ? '<th></th>' : ''}
    </tr>
  `;

  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="${visibleColumns.length + (hasActionColumn ? 1 : 0)}" class="muted">${isFiltered ? filteredEmptyMessage : emptyMessage}</td></tr>`;
  } else {
    tableBody.innerHTML = data.map((row) => {
      const cells = visibleColumns.map((column) => {
        const raw = row[column.key];
        const value = column.render ? column.render(row) : escapeHtml(raw ?? '');
        return `<td>${value}</td>`;
      }).join('');
      const actions = hasActionColumn ? `<td>${renderActions ? renderActions(row) : ''}</td>` : '';
      const cssClass = rowClass ? rowClass(row) : '';
      return `<tr class="${escapeHtml(cssClass)}">${cells}${actions}</tr>`;
    }).join('');
  }

  thead.querySelectorAll('[data-sort-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sortKey;
      const current = getTableSort(tableKey);
      if (current.sortBy === key && current.sortOrder === 'desc') {
        state.tableSort[tableKey] = { sortBy: key, sortOrder: 'asc' };
      } else {
        state.tableSort[tableKey] = { sortBy: key, sortOrder: 'desc' };
      }
      pageState.page = 1;
      onRefresh();
    });
  });

  renderPaginationControls(
    paginationContainerId,
    pagination || defaultPagination,
    (newPage) => { pageState.page = newPage; onRefresh(); },
    (newLimit) => { pageState.limit = newLimit; pageState.page = 1; onRefresh(); },
  );
}

const statusOptions = ['Pendiente', 'En Proceso', 'Terminado'].map((value) => ({ value, label: value }));
const riskOptions = ['Alto', 'Medio', 'Bajo'].map((value) => ({ value, label: value }));
const employeeStatusOptions = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
];
const vacationStatusOptions = [
  { value: 'programada', label: 'Programada' },
  { value: 'tomada', label: 'Tomada' },
  { value: 'cancelada', label: 'Cancelada' },
];
const ecovisStatusOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcialmente_pagado', label: 'Parcialmente pagado' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'cancelado', label: 'Cancelado' },
];
const ecovisPaymentStatusOptions = [
  { value: 'asignado', label: 'Asignado' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'cancelado', label: 'Cancelado' },
];
const ecovisMovementOptions = [
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'pago_recibido', label: 'Pago recibido' },
  { value: 'prestamo_ecovis_a_revram', label: 'Prestamo' },
  { value: 'aplicacion_a_proyecto', label: 'Aplicacion a proyecto' },
  { value: 'saldo_a_favor', label: 'Saldo a favor' },
  { value: 'devolucion', label: 'Devolucion' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'cancelacion', label: 'Cancelacion' },
];

const projectColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true },
  { key: 'order_number', label: 'Numero de pedido', type: 'text', sortable: true, render: (p) => escapeHtml(p.order_number || 'Sin pedido') },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true, render: (p) => escapeHtml(p.project_description || '') },
  { key: 'status', label: 'Estado', type: 'select', sortable: true, filterOptions: statusOptions, render: (p) => `<span class="badge status">${escapeHtml(p.status)}</span>` },
  { key: 'risk', label: 'Riesgo', type: 'select', sortable: true, filterOptions: riskOptions, render: (p) => `<span class="badge risk-${escapeHtml(String(p.risk || '').toLowerCase())}">${escapeHtml(p.risk)}</span>` },
  { key: 'promised_delivery_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'total_charged', label: 'Cobrado', type: 'currency', sortable: true, render: (p) => money.format(p.total_charged) },
  { key: 'spent', label: 'Gastado', type: 'currency', sortable: true, render: (p) => money.format(p.spent) },
  { key: 'pending_collection', label: 'Pendiente', type: 'currency', sortable: true, render: (p) => money.format(p.pending_collection) },
  { key: 'final_margin', label: 'Margen final', type: 'number', sortable: true, render: (p) => `<span class="badge margin-badge ${marginBadgeClass(p)}" title="Margen esperado: ${escapeHtml(p.expected_margin)}%">${formatPercentDecimal(p.final_margin)}</span>` },
];

const closedProjectColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true },
  { key: 'order_number', label: 'Numero de pedido', type: 'text', sortable: true, render: (p) => escapeHtml(p.order_number || 'Sin pedido') },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true, render: (p) => escapeHtml(p.project_description || '') },
  { key: 'closed_at', label: 'Cerrado', type: 'date', sortable: true },
  { key: 'total_invoiced_mxn', label: 'Facturado MXN', type: 'currency', sortable: true, render: (p) => money.format(p.total_invoiced_mxn) },
  { key: 'total_charged', label: 'Cobrado MXN', type: 'currency', sortable: true, render: (p) => money.format(p.total_charged) },
  { key: 'spent', label: 'Gastado MXN', type: 'currency', sortable: true, render: (p) => money.format(p.spent) },
  { key: 'final_margin', label: 'Margen final', type: 'number', sortable: true, render: (p) => `<span class="badge margin-badge ${marginBadgeClass(p)}">${formatPercentDecimal(p.final_margin)}</span>` },
];

const userColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'username', label: 'Usuario', type: 'text', sortable: true },
  { key: 'created_at', label: 'Creado', type: 'date', sortable: true },
];

const employeeColumns = [
  { key: 'employee_number', label: 'No. Empleado', type: 'text', sortable: true },
  { key: 'full_name', label: 'Nombre', type: 'text', sortable: true },
  { key: 'hire_date', label: 'Fecha ingreso', type: 'date', sortable: true },
  { key: 'seniority_years', label: 'Antiguedad', type: 'number', sortable: true, render: (emp) => `${emp.seniority_years} año${emp.seniority_years !== 1 ? 's' : ''}` },
  { key: 'active', label: 'Estatus', type: 'boolean', sortable: true, filterOptions: employeeStatusOptions, render: (emp) => !emp.active ? `<span class="badge badge-inactive">INACTIVO</span>${emp.termination_date ? `<br><small class="muted">${escapeHtml(emp.termination_date)}</small>` : ''}` : '<span class="badge badge-active">Activo</span>' },
  { key: 'termination_date', label: 'Fecha de baja', type: 'date', sortable: true, render: (emp) => escapeHtml(emp.termination_date || '') },
  { key: 'accrued_days', label: 'Dias generados acumulados', type: 'number', sortable: true },
  { key: 'days_taken', label: 'Tomados', type: 'number', sortable: true },
  { key: 'days_scheduled', label: 'Programados', type: 'number', sortable: true },
  { key: 'days_pending', label: 'Disponibles', type: 'number', sortable: true, render: (emp) => emp.days_pending < 0 ? `<span class="badge badge-negative">${emp.days_pending}</span><br><small class="text-negative">Saldo negativo</small>` : `${emp.days_pending}` },
];

const vacationRequestColumns = [
  { key: 'start_date', label: 'Fecha inicio', type: 'date', sortable: true },
  { key: 'end_date', label: 'Fecha fin', type: 'date', sortable: true },
  { key: 'requested_days', label: 'Dias', type: 'number', sortable: true },
  { key: 'vacation_exercise_year', label: 'Ejercicio', type: 'number', sortable: true },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: vacationStatusOptions, render: (req) => `<span class="badge status-${escapeHtml(req.status)}">${escapeHtml(req.status)}</span>` },
  { key: 'include_vacation_bonus', label: 'Prima', type: 'boolean', sortable: true, render: (req) => req.include_vacation_bonus ? 'Si' : 'No' },
  { key: 'notes', label: 'Notas', type: 'text', sortable: false, render: (req) => escapeHtml(req.notes || '') },
  { key: 'created_at', label: 'Registrado', type: 'date', sortable: true, render: (req) => escapeHtml((req.created_at || '').slice(0, 10)) },
];

const reportsProjectColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true },
  { key: 'order_number', label: 'Numero de pedido', type: 'text', sortable: true, render: (p) => escapeHtml(p.order_number || 'Sin pedido') },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true, render: (p) => escapeHtml(p.project_description || '') },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: statusOptions, render: (p) => `<span class="badge status">${escapeHtml(p.status)}</span>` },
  { key: 'report_count', label: 'Reportes', type: 'number', sortable: true, render: (p) => p.report_count || 0 },
];

const reportListColumns = [
  { key: 'report_folio', label: 'Folio', type: 'text', sortable: true },
  { key: 'report_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'service_name', label: 'Servicio', type: 'text', sortable: true, render: (r) => escapeHtml(r.service_name || '') },
  { key: 'technician_name', label: 'Tecnico', type: 'text', sortable: true, render: (r) => escapeHtml(r.technician_name || '') },
];

const ecovisProjectColumns = [
  { key: 'project_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'project_name', label: 'Proyecto', type: 'text', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true, render: (p) => escapeHtml(p.quote_number || '') },
  { key: 'purchase_order_number', label: 'OC', type: 'text', sortable: true, render: (p) => escapeHtml(p.purchase_order_number || '') },
  { key: 'invoice_number', label: 'Factura', type: 'text', sortable: true, render: (p) => escapeHtml(p.invoice_number || '') },
  { key: 'total_amount', label: 'Monto total', type: 'currency', sortable: true, render: (p) => money.format(Number(p.total_amount || 0)) },
  { key: 'paid_amount', label: 'Pagado', type: 'currency', sortable: true, render: (p) => money.format(Number(p.paid_amount || 0)) },
  { key: 'pending_amount', label: 'Pendiente', type: 'currency', sortable: true, render: (p) => money.format(Number(p.pending_amount || 0)) },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: ecovisStatusOptions, render: (p) => `<span class="badge ecovis-status-${escapeHtml(p.status || 'pendiente')}">${escapeHtml(p.status || 'pendiente')}</span>` },
];

const ecovisPaymentColumns = [
  { key: 'payment_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'amount', label: 'Monto', type: 'currency', sortable: true, render: (p) => money.format(Number(p.amount || 0)) },
  { key: 'currency', label: 'Moneda', type: 'select', sortable: true, filterOptions: ['MXN', 'USD', 'EUR'].map((value) => ({ value, label: value })) },
  { key: 'payment_method', label: 'Metodo', type: 'text', sortable: true, render: (p) => escapeHtml(p.payment_method || '') },
  { key: 'bank_reference', label: 'Referencia', type: 'text', sortable: true, render: (p) => escapeHtml(p.bank_reference || '') },
  { key: 'allocated_amount', label: 'Asignado', type: 'currency', sortable: true, render: (p) => money.format(Number(p.allocated_amount ?? (Number(p.amount || 0) - Number(p.unallocated_amount || 0)))) },
  { key: 'unallocated_amount', label: 'Sin asignar', type: 'currency', sortable: true, render: (p) => money.format(Number(p.unallocated_amount || 0)) },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: ecovisPaymentStatusOptions, render: (p) => {
    const statusLabel = p.is_cancelled ? 'cancelado' : (Number(p.unallocated_amount || 0) > 0 ? 'parcial' : 'asignado');
    return `<span class="badge ecovis-status-${p.is_cancelled ? 'cancelado' : 'pendiente'}">${escapeHtml(statusLabel)}</span>`;
  } },
];

const ecovisLoanColumns = [
  { key: 'movement_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'amount', label: 'Monto', type: 'currency', sortable: true, render: (l) => money.format(Number(l.amount || 0)) },
  { key: 'currency', label: 'Moneda', type: 'select', sortable: true, filterOptions: ['MXN', 'USD', 'EUR'].map((value) => ({ value, label: value })) },
  { key: 'reference', label: 'Referencia', type: 'text', sortable: true, render: (l) => escapeHtml(l.reference || '') },
  { key: 'description', label: 'Descripcion', type: 'text', sortable: true, render: (l) => escapeHtml(l.description || '') },
  { key: 'outstanding', label: 'Saldo', type: 'currency', sortable: true, render: (l) => money.format(Number(l.outstanding || 0)) },
];

const ecovisMovementColumns = [
  { key: 'movement_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'movement_type', label: 'Tipo', type: 'select', sortable: true, filterOptions: ecovisMovementOptions, render: (m) => escapeHtml(ECOVIS_MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type) },
  { key: 'description', label: 'Descripcion', type: 'text', sortable: true, render: (m) => escapeHtml(m.description || '') },
  { key: 'amount', label: 'Monto', type: 'currency', sortable: true, render: (m) => money.format(Number(m.amount || 0)) },
  { key: 'direction', label: 'Direccion', type: 'select', sortable: true, filterOptions: [
    { value: 'ecovis_debe_a_revram', label: 'ECOVIS debe' },
    { value: 'revram_debe_a_ecovis', label: 'REVRAM debe' },
    { value: 'neutral', label: 'Neutral' },
  ], render: (m) => escapeHtml(ECOVIS_DIRECTION_LABELS[m.direction] || m.direction) },
  { key: 'related_project_name', label: 'Proyecto relacionado', type: 'text', sortable: true, render: (m) => escapeHtml(m.related_project_name || m.reference || '') },
  { key: 'created_by', label: 'Usuario', type: 'text', sortable: true, render: (m) => escapeHtml(m.created_by || '') },
];

function renderPaginationControls(containerId, pagination, onPageChange, onLimitChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, limit, totalRecords, totalPages, hasNextPage, hasPreviousPage } = pagination;
  const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalRecords);

  container.innerHTML = `
    <div class="pagination-controls">
      <span class="pagination-info">Mostrando ${start}-${end} de ${totalRecords} registros</span>
      <div class="pagination-buttons">
        <button type="button" data-page="1" ${!hasPreviousPage ? 'disabled' : ''}>Primera</button>
        <button type="button" data-page="${page - 1}" ${!hasPreviousPage ? 'disabled' : ''}>Anterior</button>
        <span class="pagination-current">Pagina ${page} de ${totalPages}</span>
        <button type="button" data-page="${page + 1}" ${!hasNextPage ? 'disabled' : ''}>Siguiente</button>
        <button type="button" data-page="${totalPages}" ${!hasNextPage ? 'disabled' : ''}>Ultima</button>
      </div>
      <div class="pagination-limit">
        <label>Registros:
          <select data-limit-select>
            <option value="15" ${limit === 15 ? 'selected' : ''}>15</option>
            <option value="30" ${limit === 30 ? 'selected' : ''}>30</option>
            <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
          </select>
        </label>
      </div>
    </div>
  `;

  container.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newPage = Number(btn.dataset.page);
      if (newPage >= 1 && newPage <= totalPages) onPageChange(newPage);
    });
  });

  const limitSelect = container.querySelector('[data-limit-select]');
  if (limitSelect) {
    limitSelect.addEventListener('change', () => {
      onLimitChange(Number(limitSelect.value));
    });
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
  const showingEcovis = viewName === 'ecovis';
  projectsView.classList.toggle('hidden', !showingProjects);
  closedProjectsView.classList.toggle('hidden', !showingClosedProjects);
  usersView.classList.toggle('hidden', !showingUsers);
  if (vacationsView) vacationsView.classList.toggle('hidden', !showingVacations);
  if (reportsView) reportsView.classList.toggle('hidden', !showingReports);
  if (ecovisView) ecovisView.classList.toggle('hidden', !showingEcovis);
  projectsTab.classList.toggle('active', showingProjects);
  closedProjectsTab.classList.toggle('active', showingClosedProjects);
  usersTab.classList.toggle('active', showingUsers);
  if (vacationsTab) vacationsTab.classList.toggle('active', showingVacations);
  if (reportsTab) reportsTab.classList.toggle('active', showingReports);
  if (ecovisTab) ecovisTab.classList.toggle('active', showingEcovis);
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
  const params = new URLSearchParams({
    page: state.projectsPag.page,
    limit: state.projectsPag.limit,
    search: state.projectsSearch,
    ...buildTableParams('projects'),
  });
  const result = await api(`/api/projects?${params}`);
  state.projects = result.data;
  state.projectsSummary = result.summary;
  state.projectsPagination = result.pagination;
  renderProjects();

  if (state.selectedProjectId) {
    const current = state.projects.find((project) => project.id === state.selectedProjectId);
    current ? selectProject(current.id) : clearSelection();
  }
}

async function loadClosedProjects() {
  const params = new URLSearchParams({
    page: state.closedPag.page,
    limit: state.closedPag.limit,
    search: state.closedSearch,
    ...buildTableParams('closedProjects'),
  });
  const result = await api(`/api/closed-projects?${params}`);
  state.closedProjects = result.data;
  state.closedPagination = result.pagination;
  renderClosedProjects();

  if (state.selectedClosedProjectId) {
    const current = state.closedProjects.find((p) => p.id === state.selectedClosedProjectId);
    current ? selectClosedProject(current.id) : clearClosedSelection();
  }
}

function renderProjects() {
  const summary = state.projectsSummary || {};
  document.querySelector('#stat-projects').textContent = summary.totalProjects ?? 0;
  document.querySelector('#stat-charged').textContent = money.format(summary.totalCharged ?? 0);
  document.querySelector('#stat-spent').textContent = money.format(summary.totalSpent ?? 0);
  document.querySelector('#stat-pending').textContent = money.format(summary.totalPending ?? 0);

  renderDataTable({
    tableBody: projectsTable,
    tableKey: 'projects',
    columns: projectColumns,
    data: state.projects,
    pagination: state.projectsPagination || defaultPagination,
    paginationContainerId: 'projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.projectsSearch),
    onRefresh: loadProjects,
    pageState: state.projectsPag,
    renderActions: (project) => `
      <div class="row-actions">
        <button class="danger" data-action="delete-project" data-id="${project.id}" type="button">Eliminar</button>
        <button class="secondary" data-action="select" data-id="${project.id}" type="button">Abrir</button>
      </div>`,
  });
}

function renderClosedProjects() {
  renderDataTable({
    tableBody: closedProjectsTable,
    tableKey: 'closedProjects',
    columns: closedProjectColumns,
    data: state.closedProjects,
    pagination: state.closedPagination || defaultPagination,
    paginationContainerId: 'closed-projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.closedSearch),
    onRefresh: loadClosedProjects,
    pageState: state.closedPag,
    renderActions: (project) => `
      <div class="row-actions">
        <button class="danger" data-action="delete-closed-project" data-id="${project.id}" type="button">Borrar definitivo</button>
        <button class="secondary" data-action="select-closed-project" data-id="${project.id}" type="button">Historial</button>
      </div>`,
  });
}

async function loadUsers() {
  const params = new URLSearchParams({
    page: state.usersPag.page,
    limit: state.usersPag.limit,
    ...buildTableParams('users'),
  });
  const result = await api(`/api/users?${params}`);
  state.users = result.data;
  state.usersPagination = result.pagination;
  renderUsers();
}

function renderUsers() {
  renderDataTable({
    tableBody: usersTable,
    tableKey: 'users',
    columns: userColumns,
    data: state.users,
    pagination: state.usersPagination || defaultPagination,
    paginationContainerId: 'users-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: loadUsers,
    pageState: state.usersPag,
    renderActions: (user) => `<button class="secondary" data-action="select-user" data-id="${user.id}" type="button">Editar</button>`,
  });
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
    showEcovisTab();
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
  const all = await api('/api/projects?limit=9999');
  exportProjectsToExcel(all.data, 'proyectos');
});

exportClosedProjectsButton.addEventListener('click', async () => {
  const all = await api('/api/closed-projects?limit=9999');
  exportProjectsToExcel(all.data, 'proyectos-cerrados');
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

// ===================== SEARCH INPUTS =====================

if (projectsSearchInput) {
  projectsSearchInput.addEventListener('input', debounce(() => {
    state.projectsSearch = projectsSearchInput.value;
    state.projectsPag.page = 1;
    loadProjects();
  }));
}

if (closedProjectsSearchInput) {
  closedProjectsSearchInput.addEventListener('input', debounce(() => {
    state.closedSearch = closedProjectsSearchInput.value;
    state.closedPag.page = 1;
    loadClosedProjects();
  }));
}

if (employeesSearchInput) {
  employeesSearchInput.addEventListener('input', debounce(() => {
    state.employeesSearch = employeesSearchInput.value;
    state.employeesPag.page = 1;
    loadEmployees();
  }));
}

if (employeesActiveFilterSelect) {
  employeesActiveFilterSelect.addEventListener('change', () => {
    state.employeesActiveFilter = employeesActiveFilterSelect.value;
    state.employeesPag.page = 1;
    loadEmployees();
  });
}

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

function showVacationsTab() {
  if (state.userRole === 'admin') {
    vacationsTab.classList.remove('hidden');
  } else {
    vacationsTab.classList.add('hidden');
  }
}

async function loadEmployees() {
  const params = new URLSearchParams({
    page: state.employeesPag.page,
    limit: state.employeesPag.limit,
    search: state.employeesSearch,
    activeFilter: state.employeesActiveFilter,
    ...buildTableParams('employees'),
  });
  const result = await api(`/api/employees?${params}`);
  state.employees = result.data;
  state.employeesPagination = result.pagination;
  renderEmployees();
}

function renderEmployees() {
  renderDataTable({
    tableBody: employeesTable,
    tableKey: 'employees',
    columns: employeeColumns,
    data: state.employees,
    pagination: state.employeesPagination || defaultPagination,
    paginationContainerId: 'employees-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.employeesSearch || state.employeesActiveFilter !== 'all'),
    onRefresh: loadEmployees,
    pageState: state.employeesPag,
    rowClass: (emp) => (!emp.active ? 'row-inactive' : ''),
    renderActions: (emp) => `
      <div class="row-actions">
        <button class="secondary" data-action="edit-employee" data-id="${emp.id}" type="button">Editar</button>
        <button class="secondary" data-action="open-vacations" data-id="${emp.id}" type="button">Vacaciones programadas</button>
      </div>`,
  });
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
  resetTableControls('vacationRequests');
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
  state.vacReqPag = { page: 1, limit: 15 };
  await loadVacationRequests(emp.id);
}

async function loadVacationRequests(employeeId) {
  const params = new URLSearchParams({
    page: state.vacReqPag.page,
    limit: state.vacReqPag.limit,
    ...buildTableParams('vacationRequests'),
  });
  const result = await api(`/api/employees/${employeeId}/vacation-requests?${params}`);
  const requests = result.data;
  state.vacReqPagination = result.pagination;

  renderDataTable({
    tableBody: vacationRequestsTable,
    tableKey: 'vacationRequests',
    columns: vacationRequestColumns,
    data: requests,
    pagination: state.vacReqPagination || defaultPagination,
    paginationContainerId: 'vacation-requests-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: () => loadVacationRequests(employeeId),
    pageState: state.vacReqPag,
    renderActions: (req) => `
      <div class="row-actions">
        ${req.status !== 'cancelada' ? `<button class="danger" data-action="cancel-vacation" data-id="${req.id}" type="button">Cancelar</button>` : ''}
        ${req.status === 'programada' ? `<button class="secondary" data-action="mark-taken" data-id="${req.id}" type="button">Marcar tomada</button>` : ''}
        <button class="secondary" data-action="print-vacation" data-id="${req.id}" type="button">Formato</button>
      </div>`,
  });
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

if (safetyOtrasCheckbox) {
  safetyOtrasCheckbox.addEventListener('change', () => {
    safetyOtrasField.classList.toggle('hidden', !safetyOtrasCheckbox.checked);
  });
}

async function loadReportsProjects() {
  const params = new URLSearchParams({
    page: state.reportsProjPag.page,
    limit: state.reportsProjPag.limit,
    search: state.reportsProjSearch,
    status: state.reportsProjStatus,
    ...buildTableParams('reportsProjects'),
  });
  const result = await api(`/api/reports/projects?${params}`);
  state.reportsAllProjects = result.data;
  state.reportsProjPagination = result.pagination;
  renderReportsProjectsTable();
}

function renderReportsProjectsTable() {
  const projects = state.reportsAllProjects;

  renderDataTable({
    tableBody: reportsProjectsTable,
    tableKey: 'reportsProjects',
    columns: reportsProjectColumns,
    data: projects,
    pagination: state.reportsProjPagination || defaultPagination,
    paginationContainerId: 'reports-projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.reportsProjSearch || state.reportsProjStatus),
    onRefresh: loadReportsProjects,
    pageState: state.reportsProjPag,
    renderActions: (p) => `
      <div class="row-actions">
        <button class="secondary" data-action="report-new" data-id="${p.id}" type="button">Generar reporte</button>
        <button class="secondary" data-action="report-list" data-id="${p.id}" type="button">Ver reportes</button>
      </div>`,
  });
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
  state.projReportsPag = { page: 1, limit: 15 };
  resetTableControls('projectReports');
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportFormPanel.classList.add('hidden');
  reportListPanel.classList.remove('hidden');

  reportListTitle.textContent = `Reportes - Proyecto #${project.id}`;
  reportListSubtitle.textContent = `${project.client_name} | ${project.project_description || ''}`;

  await loadProjectReports(projectId);
}

async function loadProjectReports(projectId) {
  try {
    const params = new URLSearchParams({
      page: state.projReportsPag.page,
      limit: state.projReportsPag.limit,
      ...buildTableParams('projectReports'),
    });
    const result = await api(`/api/projects/${projectId}/reports?${params}`);
    state.reportsProjectReports = result.data;
    state.projReportsPagination = result.pagination;
    renderReportList(result.data, result.pagination, projectId);
  } catch (error) {
    reportListTable.innerHTML = '<tr><td colspan="5" class="muted">Error al cargar reportes.</td></tr>';
  }
}

function renderReportList(reports, pagination, projectId) {
  const pid = projectId || state.currentReportProjectId;
  renderDataTable({
    tableBody: reportListTable,
    tableKey: 'projectReports',
    columns: reportListColumns,
    data: reports,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'project-reports-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: () => loadProjectReports(pid),
    pageState: state.projReportsPag,
    renderActions: (r) => `
      <div class="row-actions">
        <button class="secondary" data-action="report-edit" data-id="${r.id}" type="button">Editar</button>
        <button class="secondary" data-action="report-print" data-id="${r.id}" type="button">Imprimir</button>
      </div>`,
  });
}

async function renderDetailReports(projectId, listElement) {
  try {
    const result = await api('/api/projects/' + projectId + '/reports?limit=50');
    const reports = result.data || [];
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
    state.reportsProjPag = { page: 1, limit: 15 };
    state.reportsProjSearch = '';
    state.reportsProjStatus = '';
    if (reportSearch) reportSearch.value = '';
    if (reportStatusFilter) reportStatusFilter.value = '';
    await loadReportsProjects();
  });
}

if (reportSearch) {
  reportSearch.addEventListener('input', debounce(() => {
    state.reportsProjSearch = reportSearch.value;
    state.reportsProjPag.page = 1;
    loadReportsProjects();
  }));
}
if (reportStatusFilter) {
  reportStatusFilter.addEventListener('change', () => {
    state.reportsProjStatus = reportStatusFilter.value;
    state.reportsProjPag.page = 1;
    loadReportsProjects();
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

// ===================== ECOVIS MODULE =====================

const ecovisTab = document.querySelector('#ecovis-tab');
const ecovisView = document.querySelector('#ecovis-view');
const ecovisProjectsTable = document.querySelector('#ecovis-projects-table');
const ecovisPaymentsTable = document.querySelector('#ecovis-payments-table');
const ecovisLoansTable = document.querySelector('#ecovis-loans-table');
const ecovisMovementsTable = document.querySelector('#ecovis-movements-table');
const ecovisProjectModal = document.querySelector('#ecovis-project-modal');
const ecovisProjectForm = document.querySelector('#ecovis-project-form');
const ecovisProjectFormTitle = document.querySelector('#ecovis-project-form-title');
const ecovisProjectMessage = document.querySelector('#ecovis-project-message');
const ecovisPaymentModal = document.querySelector('#ecovis-payment-modal');
const ecovisPaymentForm = document.querySelector('#ecovis-payment-form');
const ecovisPaymentMessage = document.querySelector('#ecovis-payment-message');
const ecovisAllocationModal = document.querySelector('#ecovis-allocation-modal');
const ecovisAllocationForm = document.querySelector('#ecovis-allocation-form');
const ecovisAllocationMessage = document.querySelector('#ecovis-allocation-message');
const ecovisAllocationSubtitle = document.querySelector('#ecovis-allocation-subtitle');
const ecovisAllocationSummary = document.querySelector('#ecovis-allocation-summary');
const ecovisAllocationsList = document.querySelector('#ecovis-allocations-list');
const ecovisAllocationProjectLabel = document.querySelector('#ecovis-allocation-project-label');
const ecovisAllocationProjectSelect = document.querySelector('#ecovis-allocation-project-select');
const ecovisLoanModal = document.querySelector('#ecovis-loan-modal');
const ecovisLoanForm = document.querySelector('#ecovis-loan-form');
const ecovisLoanFormTitle = document.querySelector('#ecovis-loan-form-title');
const ecovisLoanMessage = document.querySelector('#ecovis-loan-message');
const ecovisAdjustmentModal = document.querySelector('#ecovis-adjustment-modal');
const ecovisAdjustmentForm = document.querySelector('#ecovis-adjustment-form');
const ecovisAdjustmentMessage = document.querySelector('#ecovis-adjustment-message');
const ecovisApplyCreditModal = document.querySelector('#ecovis-apply-credit-modal');
const ecovisApplyCreditForm = document.querySelector('#ecovis-apply-credit-form');
const ecovisApplyCreditMessage = document.querySelector('#ecovis-apply-credit-message');
const ecovisCreditAvailable = document.querySelector('#ecovis-credit-available');
const ecovisCreditProjectSelect = document.querySelector('#ecovis-credit-project-select');
const ecovisProjectsSearchInput = document.querySelector('#ecovis-projects-search');
const ecovisMovementsSearchInput = document.querySelector('#ecovis-movements-search');
const ecovisMovementsTypeFilterSelect = document.querySelector('#ecovis-movements-type-filter');

const ECOVIS_MOVEMENT_TYPE_LABELS = {
  proyecto: 'Proyecto',
  pago_recibido: 'Pago recibido',
  prestamo_ecovis_a_revram: 'Préstamo',
  aplicacion_a_proyecto: 'Aplicación a proyecto',
  saldo_a_favor: 'Saldo a favor',
  devolucion: 'Devolución',
  ajuste: 'Ajuste',
  cancelacion: 'Cancelación',
};

const ECOVIS_DIRECTION_LABELS = {
  ecovis_debe_a_revram: 'ECOVIS debe a REVRAM',
  revram_debe_a_ecovis: 'REVRAM debe a ECOVIS',
  neutral: 'Neutral',
};

function showEcovisTab() {
  if (state.userRole === 'admin') {
    ecovisTab.classList.remove('hidden');
    document.getElementById('export-general-excel').classList.remove('hidden');
  } else {
    ecovisTab.classList.add('hidden');
    document.getElementById('export-general-excel').classList.add('hidden');
  }
}

function switchEcovisSubtab(name) {
  const sections = ['projects', 'payments', 'loans', 'movements'];
  sections.forEach((s) => {
    const section = document.getElementById('ecovis-' + s + '-section');
    const btn = document.getElementById('ecovis-subtab-' + s);
    if (section) section.classList.toggle('hidden', s !== name);
    if (btn) btn.classList.toggle('active', s === name);
  });
}

document.getElementById('ecovis-subtab-projects').addEventListener('click', () => {
  switchEcovisSubtab('projects');
  loadEcovisProjects();
});
document.getElementById('ecovis-subtab-payments').addEventListener('click', () => {
  switchEcovisSubtab('payments');
  loadEcovisPayments();
});
document.getElementById('ecovis-subtab-loans').addEventListener('click', () => {
  switchEcovisSubtab('loans');
  loadEcovisLoans();
});
document.getElementById('ecovis-subtab-movements').addEventListener('click', () => {
  switchEcovisSubtab('movements');
  loadEcovisMovements();
});

async function loadEcovisSummary() {
  try {
    const summary = await api('/api/ecovis/summary');
    document.getElementById('ecovis-stat-projects').textContent = money.format(summary.total_projected || 0);
    document.getElementById('ecovis-stat-paid').textContent = money.format(summary.total_paid_to_projects || 0);
    document.getElementById('ecovis-stat-pending').textContent = money.format(summary.pending_project_amount || 0);
    document.getElementById('ecovis-stat-loans').textContent = money.format(summary.outstanding_loans || 0);
    document.getElementById('ecovis-stat-credit').textContent = money.format(summary.credit_balance || 0);
    const unallocated = (summary.total_payments_received || 0) - (summary.total_allocated || 0);
    document.getElementById('ecovis-stat-unallocated').textContent = money.format(unallocated);
    document.getElementById('ecovis-stat-balance').textContent = money.format(summary.net_balance || 0);
    state.ecovisSummary = summary;
  } catch (error) {
    console.error('Error loading ECOVIS summary:', error);
  }
}

async function loadEcovisProjects() {
  const params = new URLSearchParams({
    page: state.ecovisProjectsPag.page,
    limit: state.ecovisProjectsPag.limit,
    search: state.ecovisProjectsSearch,
    ...buildTableParams('ecovisProjects'),
  });
  const result = await api('/api/ecovis/projects?' + params);
  renderEcovisProjects(result.data, result.pagination);
}

function renderEcovisProjects(projects, pagination) {
  renderDataTable({
    tableBody: ecovisProjectsTable,
    tableKey: 'ecovisProjects',
    columns: ecovisProjectColumns,
    data: projects,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.ecovisProjectsSearch),
    onRefresh: loadEcovisProjects,
    pageState: state.ecovisProjectsPag,
    renderActions: (p) => {
      const statusLabel = p.status || 'pendiente';
      return '<div class="row-actions">' +
        '<button class="secondary" data-action="ecovis-edit-project" data-id="' + p.id + '" type="button">Editar</button>' +
        (statusLabel !== 'cancelado'
          ? '<button class="danger" data-action="ecovis-cancel-project" data-id="' + p.id + '" type="button">Cancelar</button>'
          : '') +
        '<button class="secondary" data-action="ecovis-apply-credit" data-id="' + p.id + '" type="button">Saldo a favor</button>' +
      '</div>';
    },
  });
}

async function loadEcovisPayments() {
  const params = new URLSearchParams({
    page: state.ecovisPaymentsPag.page,
    limit: state.ecovisPaymentsPag.limit,
    ...buildTableParams('ecovisPayments'),
  });
  const result = await api('/api/ecovis/payments?' + params);
  renderEcovisPayments(result.data, result.pagination);
}

function renderEcovisPayments(payments, pagination) {
  renderDataTable({
    tableBody: ecovisPaymentsTable,
    tableKey: 'ecovisPayments',
    columns: ecovisPaymentColumns,
    data: payments,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-payments-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: loadEcovisPayments,
    pageState: state.ecovisPaymentsPag,
    renderActions: (p) => '<div class="row-actions"><button class="secondary" data-action="ecovis-allocate-payment" data-id="' + p.id + '" type="button">Asignar</button></div>',
  });
}

async function loadEcovisLoans() {
  const params = new URLSearchParams({
    page: state.ecovisLoansPag.page,
    limit: state.ecovisLoansPag.limit,
    ...buildTableParams('ecovisLoans'),
  });
  const result = await api('/api/ecovis/loans?' + params);
  renderEcovisLoans(result.data, result.pagination);
}

function renderEcovisLoans(loans, pagination) {
  renderDataTable({
    tableBody: ecovisLoansTable,
    tableKey: 'ecovisLoans',
    columns: ecovisLoanColumns,
    data: loans,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-loans-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: loadEcovisLoans,
    pageState: state.ecovisLoansPag,
    renderActions: (l) => '<div class="row-actions"><button class="secondary" data-action="ecovis-repay-loan" data-id="' + l.id + '" type="button">Devolucion</button></div>',
  });
}

async function loadEcovisMovements() {
  const params = new URLSearchParams({
    page: state.ecovisMovementsPag.page,
    limit: state.ecovisMovementsPag.limit,
    search: state.ecovisMovementsSearch,
    ...buildTableParams('ecovisMovements'),
  });
  if (state.ecovisMovementsTypeFilter) {
    params.set('type', state.ecovisMovementsTypeFilter);
  }
  const result = await api('/api/ecovis/movements?' + params);
  renderEcovisMovements(result.data, result.pagination);
}

function renderEcovisMovements(movements, pagination) {
  renderDataTable({
    tableBody: ecovisMovementsTable,
    tableKey: 'ecovisMovements',
    columns: ecovisMovementColumns,
    data: movements,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-movements-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.ecovisMovementsSearch || state.ecovisMovementsTypeFilter),
    onRefresh: loadEcovisMovements,
    pageState: state.ecovisMovementsPag,
  });
}

ecovisTab.addEventListener('click', async () => {
  if (state.userRole !== 'admin') {
    window.alert('Acceso restringido. Solo el administrador puede consultar la cuenta ECOVIS.');
    return;
  }
  switchView('ecovis');
  switchEcovisSubtab('projects');
  await loadEcovisSummary();
  await loadEcovisProjects();
});

document.getElementById('ecovis-new-project-btn').addEventListener('click', () => {
  ecovisProjectForm.reset();
  ecovisProjectForm.elements.id.value = '';
  ecovisProjectFormTitle.textContent = 'Agregar proyecto ECOVIS';
  ecovisProjectForm.elements.project_date.value = today();
  setMessage(ecovisProjectMessage, '');
  ecovisProjectModal.classList.remove('hidden');
});

ecovisProjectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisProjectMessage, '');
  const payload = simpleFormPayload(ecovisProjectForm);
  try {
    const id = ecovisProjectForm.elements.id.value;
    await api(id ? '/api/ecovis/projects/' + id : '/api/ecovis/projects', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisProjectMessage, 'Proyecto ECOVIS guardado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisProjects();
    setTimeout(() => { ecovisProjectModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisProjectMessage, error.message);
  }
});

ecovisProjectModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === ecovisProjectModal) {
    ecovisProjectModal.classList.add('hidden');
  }
});

ecovisProjectsTable.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('[data-action="ecovis-edit-project"]');
  if (editBtn) {
    try {
      const projects = (await api('/api/ecovis/projects?limit=9999')).data;
      const project = projects.find((p) => p.id === Number(editBtn.dataset.id));
      if (!project) return;
      ecovisProjectFormTitle.textContent = 'Editar proyecto ECOVIS #' + project.id;
      ecovisProjectForm.elements.id.value = project.id;
      ecovisProjectForm.elements.project_name.value = project.project_name || '';
      ecovisProjectForm.elements.project_date.value = project.project_date || '';
      ecovisProjectForm.elements.quote_number.value = project.quote_number || '';
      ecovisProjectForm.elements.purchase_order_number.value = project.purchase_order_number || '';
      ecovisProjectForm.elements.invoice_number.value = project.invoice_number || '';
      ecovisProjectForm.elements.total_amount.value = project.total_amount || '';
      ecovisProjectForm.elements.currency.value = project.currency || 'MXN';
      ecovisProjectForm.elements.description.value = project.description || '';
      ecovisProjectForm.elements.notes.value = project.notes || '';
      setMessage(ecovisProjectMessage, '');
      ecovisProjectModal.classList.remove('hidden');
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const cancelBtn = event.target.closest('[data-action="ecovis-cancel-project"]');
  if (cancelBtn) {
    const reason = window.prompt('Motivo de cancelacion del proyecto ECOVIS:');
    if (!reason) return;
    try {
      await api('/api/ecovis/projects/' + cancelBtn.dataset.id + '/cancel', {
        method: 'POST',
        body: JSON.stringify({ cancellation_reason: reason }),
      });
      await loadEcovisSummary();
      await loadEcovisProjects();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const creditBtn = event.target.closest('[data-action="ecovis-apply-credit"]');
  if (creditBtn) {
    openApplyCreditModal(creditBtn.dataset.id);
  }
});

document.getElementById('ecovis-new-payment-btn').addEventListener('click', () => {
  ecovisPaymentForm.reset();
  ecovisPaymentForm.elements.payment_date.value = today();
  setMessage(ecovisPaymentMessage, '');
  ecovisPaymentModal.classList.remove('hidden');
});

ecovisPaymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisPaymentMessage, '');
  const payload = simpleFormPayload(ecovisPaymentForm);
  try {
    await api('/api/ecovis/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisPaymentMessage, 'Pago registrado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisPayments();
    setTimeout(() => { ecovisPaymentModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisPaymentMessage, error.message);
  }
});

ecovisPaymentModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === ecovisPaymentModal) {
    ecovisPaymentModal.classList.add('hidden');
  }
});

ecovisPaymentsTable.addEventListener('click', async (event) => {
  const allocBtn = event.target.closest('[data-action="ecovis-allocate-payment"]');
  if (allocBtn) {
    await openAllocationModal(allocBtn.dataset.id);
  }
});

async function openAllocationModal(paymentId) {
  state.selectedEcovisPaymentId = Number(paymentId);
  setMessage(ecovisAllocationMessage, '');
  ecovisAllocationForm.reset();
  ecovisAllocationModal.classList.remove('hidden');

  try {
    const payments = (await api('/api/ecovis/payments?limit=9999')).data;
    const payment = payments.find((p) => p.id === Number(paymentId));
    if (!payment) return;

    ecovisAllocationSubtitle.textContent = 'Pago #' + payment.id + ' — ' + money.format(Number(payment.amount || 0)) + ' (' + (payment.currency || 'MXN') + ')';
    ecovisAllocationSummary.innerHTML =
      '<article><span>Monto total</span><strong>' + money.format(Number(payment.amount || 0)) + '</strong></article>' +
      '<article><span>Asignado</span><strong>' + money.format(Number(payment.amount || 0) - Number(payment.unallocated_amount || 0)) + '</strong></article>' +
      '<article><span>Sin asignar</span><strong>' + money.format(Number(payment.unallocated_amount || 0)) + '</strong></article>';

    const allocations = payment.allocations || [];
    if (!allocations.length) {
      ecovisAllocationsList.innerHTML = '<tr><td colspan="4" class="muted">Sin asignaciones.</td></tr>';
    } else {
      ecovisAllocationsList.innerHTML = allocations.map((a) => {
        return '<tr>' +
          '<td>' + escapeHtml(a.allocation_type || '') + '</td>' +
          '<td>' + (a.ecovis_project_id || '-') + '</td>' +
          '<td>' + money.format(Number(a.amount || 0)) + '</td>' +
          '<td>' + escapeHtml(a.notes || '') + '</td>' +
        '</tr>';
      }).join('');
    }

    const projects = (await api('/api/ecovis/projects?limit=9999')).data;
    ecovisAllocationProjectSelect.innerHTML = projects
      .filter((p) => p.status !== 'cancelado')
      .map((p) => '<option value="' + p.id + '">' + escapeHtml(p.project_name) + ' (' + money.format(Number(p.total_amount || 0)) + ')</option>')
      .join('');

    toggleAllocationProjectField();
  } catch (error) {
    window.alert(error.message);
  }
}

function toggleAllocationProjectField() {
  const type = ecovisAllocationForm.elements.allocation_type.value;
  ecovisAllocationProjectLabel.classList.toggle('hidden', type !== 'proyecto');
}

ecovisAllocationForm.elements.allocation_type.addEventListener('change', toggleAllocationProjectField);

ecovisAllocationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisAllocationMessage, '');
  const payload = simpleFormPayload(ecovisAllocationForm);
  if (payload.allocation_type !== 'proyecto') {
    delete payload.ecovis_project_id;
  }
  try {
    await api('/api/ecovis/payments/' + state.selectedEcovisPaymentId + '/allocations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisAllocationMessage, 'Asignacion registrada correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisPayments();
    await openAllocationModal(state.selectedEcovisPaymentId);
  } catch (error) {
    setMessage(ecovisAllocationMessage, error.message);
  }
});

ecovisAllocationModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === ecovisAllocationModal) {
    ecovisAllocationModal.classList.add('hidden');
    state.selectedEcovisPaymentId = null;
  }
});

document.getElementById('ecovis-new-loan-btn').addEventListener('click', () => {
  ecovisLoanForm.reset();
  ecovisLoanFormTitle.textContent = 'Registrar prestamo';
  ecovisLoanForm.elements.movement_date.value = today();
  setMessage(ecovisLoanMessage, '');
  ecovisLoanModal.classList.remove('hidden');
});

ecovisLoanForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisLoanMessage, '');
  const payload = simpleFormPayload(ecovisLoanForm);
  try {
    await api('/api/ecovis/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisLoanMessage, 'Prestamo registrado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisLoans();
    setTimeout(() => { ecovisLoanModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisLoanMessage, error.message);
  }
});

ecovisLoanModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === ecovisLoanModal) {
    ecovisLoanModal.classList.add('hidden');
  }
});

ecovisLoansTable.addEventListener('click', async (event) => {
  const repayBtn = event.target.closest('[data-action="ecovis-repay-loan"]');
  if (repayBtn) {
    const amountStr = window.prompt('Monto de devolucion:');
    if (!amountStr) return;
    const description = window.prompt('Descripcion de la devolucion:');
    if (!description) return;
    try {
      await api('/api/ecovis/loans/' + repayBtn.dataset.id + '/repayment', {
        method: 'POST',
        body: JSON.stringify({ amount: amountStr, description }),
      });
      await loadEcovisSummary();
      await loadEcovisLoans();
    } catch (error) {
      window.alert(error.message);
    }
  }
});

document.getElementById('ecovis-adjustment-btn').addEventListener('click', () => {
  ecovisAdjustmentForm.reset();
  ecovisAdjustmentForm.elements.movement_date.value = today();
  setMessage(ecovisAdjustmentMessage, '');
  ecovisAdjustmentModal.classList.remove('hidden');
});

ecovisAdjustmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisAdjustmentMessage, '');
  const payload = simpleFormPayload(ecovisAdjustmentForm);
  try {
    await api('/api/ecovis/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisAdjustmentMessage, 'Ajuste registrado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisMovements();
    setTimeout(() => { ecovisAdjustmentModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisAdjustmentMessage, error.message);
  }
});

ecovisAdjustmentModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === ecovisAdjustmentModal) {
    ecovisAdjustmentModal.classList.add('hidden');
  }
});

async function openApplyCreditModal(projectId) {
  ecovisApplyCreditForm.reset();
  ecovisApplyCreditForm.elements.movement_date.value = today();
  setMessage(ecovisApplyCreditMessage, '');

  try {
    const summary = await api('/api/ecovis/summary');
    ecovisCreditAvailable.textContent = 'Saldo a favor disponible: ' + money.format(summary.credit_balance || 0);

    const projects = (await api('/api/ecovis/projects?limit=9999')).data;
    ecovisCreditProjectSelect.innerHTML = projects
      .filter((p) => p.status !== 'cancelado')
      .map((p) => '<option value="' + p.id + '"' + (Number(p.id) === Number(projectId) ? ' selected' : '') + '>' +
        escapeHtml(p.project_name) + ' (' + money.format(Number(p.total_amount || 0)) + ')</option>')
      .join('');

    ecovisApplyCreditModal.classList.remove('hidden');
  } catch (error) {
    window.alert(error.message);
  }
}

ecovisApplyCreditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisApplyCreditMessage, '');
  const payload = simpleFormPayload(ecovisApplyCreditForm);
  try {
    await api('/api/ecovis/apply-credit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisApplyCreditMessage, 'Saldo a favor aplicado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisProjects();
    setTimeout(() => { ecovisApplyCreditModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisApplyCreditMessage, error.message);
  }
});

ecovisApplyCreditModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === ecovisApplyCreditModal) {
    ecovisApplyCreditModal.classList.add('hidden');
  }
});

if (ecovisProjectsSearchInput) {
  ecovisProjectsSearchInput.addEventListener('input', debounce(() => {
    state.ecovisProjectsSearch = ecovisProjectsSearchInput.value;
    state.ecovisProjectsPag.page = 1;
    loadEcovisProjects();
  }));
}

if (ecovisMovementsSearchInput) {
  ecovisMovementsSearchInput.addEventListener('input', debounce(() => {
    state.ecovisMovementsSearch = ecovisMovementsSearchInput.value;
    state.ecovisMovementsPag.page = 1;
    loadEcovisMovements();
  }));
}

if (ecovisMovementsTypeFilterSelect) {
  ecovisMovementsTypeFilterSelect.addEventListener('change', () => {
    state.ecovisMovementsTypeFilter = ecovisMovementsTypeFilterSelect.value;
    state.ecovisMovementsPag.page = 1;
    loadEcovisMovements();
  });
}

document.getElementById('export-general-excel').addEventListener('click', async () => {
  try {
    const data = await api('/api/admin/export-general-excel');
    generateGeneralExcel(data);
  } catch (error) {
    window.alert(error.message || 'No se pudo generar el Excel.');
  }
});

function generateGeneralExcel(data) {
  const projectColumns = [
    ['ID', (p) => p.id],
    ['Cotizacion', (p) => p.quote_number],
    ['Cliente', (p) => p.client_name],
    ['Estado', (p) => p.status],
    ['Facturado MXN', (p) => p.total_invoiced_mxn],
    ['Cobrado MXN', (p) => p.total_charged],
    ['Gastado MXN', (p) => p.spent],
    ['Pendiente MXN', (p) => p.pending_collection],
  ];

  const closedColumns = [
    ['ID', (p) => p.id],
    ['Cotizacion', (p) => p.quote_number],
    ['Cliente', (p) => p.client_name],
    ['Cerrado', (p) => p.closed_at || ''],
    ['Facturado MXN', (p) => p.total_invoiced_mxn],
    ['Cobrado MXN', (p) => p.total_charged],
    ['Gastado MXN', (p) => p.spent],
  ];

  const costColumns = [
    ['Proyecto ID', (c) => c.project_id],
    ['Fecha', (c) => c.cost_date],
    ['Tipo', (c) => c.category],
    ['Descripcion', (c) => c.description],
    ['Monto', (c) => c.amount],
    ['Moneda', (c) => c.currency],
    ['Monto MXN', (c) => c.amount_mxn],
  ];

  const employeeColumns = [
    ['No. Empleado', (e) => e.employee_number],
    ['Nombre', (e) => e.full_name],
    ['Ingreso', (e) => e.hire_date],
    ['Activo', (e) => e.active ? 'Si' : 'No'],
  ];

  const ecovisProjectColumns = [
    ['ID', (p) => p.id],
    ['Proyecto', (p) => p.project_name],
    ['Fecha', (p) => p.project_date],
    ['Monto', (p) => p.total_amount],
    ['Moneda', (p) => p.currency],
    ['Estado', (p) => p.status],
  ];

  const ecovisPaymentColumns = [
    ['ID', (p) => p.id],
    ['Fecha', (p) => p.payment_date],
    ['Monto', (p) => p.amount],
    ['Moneda', (p) => p.currency],
    ['Metodo', (p) => p.payment_method],
    ['Referencia', (p) => p.bank_reference],
    ['Sin asignar', (p) => p.unallocated_amount],
  ];

  const ecovisMovementColumns = [
    ['ID', (m) => m.id],
    ['Fecha', (m) => m.movement_date],
    ['Tipo', (m) => m.movement_type],
    ['Descripcion', (m) => m.description],
    ['Monto', (m) => m.amount],
    ['Moneda', (m) => m.currency],
    ['Direccion', (m) => m.direction],
    ['Usuario', (m) => m.created_by],
  ];

  const worksheets = [
    worksheetXml('Proyectos Activos', [
      projectColumns.map(([l]) => l),
      ...(data.projects || []).map((p) => projectColumns.map(([, fn]) => fn(p))),
    ]),
    worksheetXml('Proyectos Cerrados', [
      closedColumns.map(([l]) => l),
      ...(data.closedProjects || []).map((p) => closedColumns.map(([, fn]) => fn(p))),
    ]),
    worksheetXml('Costos', [
      costColumns.map(([l]) => l),
      ...(data.costs || []).map((c) => costColumns.map(([, fn]) => fn(c))),
    ]),
    worksheetXml('Empleados', [
      employeeColumns.map(([l]) => l),
      ...(data.employees || []).map((e) => employeeColumns.map(([, fn]) => fn(e))),
    ]),
    worksheetXml('ECOVIS Proyectos', [
      ecovisProjectColumns.map(([l]) => l),
      ...(data.ecovisProjects || []).map((p) => ecovisProjectColumns.map(([, fn]) => fn(p))),
    ]),
    worksheetXml('ECOVIS Pagos', [
      ecovisPaymentColumns.map(([l]) => l),
      ...(data.ecovisPayments || []).map((p) => ecovisPaymentColumns.map(([, fn]) => fn(p))),
    ]),
    worksheetXml('ECOVIS Movimientos', [
      ecovisMovementColumns.map(([l]) => l),
      ...(data.ecovisMovements || []).map((m) => ecovisMovementColumns.map(([, fn]) => fn(m))),
    ]),
  ];

  if (data.ecovisSummary) {
    const s = data.ecovisSummary;
    worksheets.push(worksheetXml('ECOVIS Resumen', [
      ['Concepto', 'Valor'],
      ['Total proyectos', s.total_projected],
      ['Pagado a proyectos', s.total_paid_to_projects],
      ['Pendiente proyectos', s.pending_project_amount],
      ['Pagos recibidos', s.total_payments_received],
      ['Asignado', s.total_allocated],
      ['Saldo a favor', s.credit_balance],
      ['Prestamos vigentes', s.outstanding_loans],
      ['Balance neto', s.net_balance],
    ]));
  }

  const workbookXml = '<?xml version="1.0"?>' +
    '<?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    worksheets.join('') +
    '</Workbook>';

  const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'reporte-general-' + today() + '.xls';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

// ===================== END ECOVIS MODULE =====================

api('/api/session')
  .then((session) => {
    if (session.authenticated) {
      state.userRole = session.user.role || 'user';
      showVacationsTab();
      showEcovisTab();
      showApp();
    } else {
      showLogin();
    }
  })
  .catch(showLogin);
