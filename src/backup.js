const crypto = require('node:crypto');

const BACKUP_SCHEMA_VERSION = '1.0.0';
const BACKUP_APP_NAME = 'REVRAM Dashboard';
const MAX_CONFLICT_DETAILS = 50;

const IMPORT_ORDER = [
  'settings',
  'projects',
  'closedProjects',
  'projectPayments',
  'costs',
  'employees',
  'vacationRequests',
  'reports',
  'ecovisProjects',
  'ecovisPayments',
  'ecovisPaymentAllocations',
  'ecovisMovements',
  'users',
];

function backupError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const TABLES = {
  projects: 'projects',
  closedProjects: 'projects',
  projectPayments: 'project_payments',
  costs: 'project_costs',
  employees: 'employees',
  vacationRequests: 'vacation_requests',
  reports: 'project_reports',
  ecovisProjects: 'ecovis_projects',
  ecovisPayments: 'ecovis_payments',
  ecovisPaymentAllocations: 'ecovis_payment_allocations',
  ecovisMovements: 'ecovis_movements',
};

function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function stablePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stableKey(prefix, ...parts) {
  const cleaned = parts.map(stablePart).filter(Boolean);
  return cleaned.length ? `${prefix}:${cleaned.join('|')}` : '';
}

function numberPart(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

function projectKey(row) {
  return row.backupId || stableKey(
    'project',
    row.quote_number || row.quoteNumber,
    row.client_name || row.clientName,
    row.project_description || row.projectDescription,
    row.promised_delivery_date || row.promisedDeliveryDate,
    numberPart(row.total_invoiced || row.totalInvoiced),
  );
}

function employeeKey(row) {
  return row.backupId || stableKey(
    'employee',
    row.employee_number || row.employeeNumber,
    row.full_name || row.fullName,
    row.hire_date || row.hireDate,
  );
}

function ecovisProjectKey(row) {
  return row.backupId || stableKey(
    'ecovis_project',
    row.quote_number || row.purchase_order_number || row.project_name,
    row.project_date,
    numberPart(row.total_amount),
  );
}

function ecovisPaymentKey(row) {
  return row.backupId || stableKey(
    'ecovis_payment',
    row.payment_date,
    numberPart(row.amount),
    row.bank_reference || row.source_description,
  );
}

function withBackupFields(row, backupId, extra = {}) {
  return {
    ...row,
    originalId: row.id,
    backupId,
    ...extra,
  };
}

function getRows(db, sql) {
  return db.prepare(sql).all();
}

function buildBackupData(db) {
  const projects = getRows(db, 'SELECT * FROM projects WHERE closed_at IS NULL ORDER BY id ASC')
    .map((row) => withBackupFields(row, projectKey(row)));
  const closedProjects = getRows(db, 'SELECT * FROM projects WHERE closed_at IS NOT NULL ORDER BY id ASC')
    .map((row) => withBackupFields(row, projectKey(row)));
  const allProjects = [...projects, ...closedProjects];
  const projectById = new Map(allProjects.map((project) => [project.id, project]));

  const employees = getRows(db, 'SELECT * FROM employees ORDER BY id ASC')
    .map((row) => withBackupFields(row, employeeKey(row)));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const ecovisProjects = getRows(db, 'SELECT * FROM ecovis_projects ORDER BY id ASC')
    .map((row) => withBackupFields(row, ecovisProjectKey(row)));
  const ecovisProjectById = new Map(ecovisProjects.map((project) => [project.id, project]));

  const ecovisPayments = getRows(db, 'SELECT * FROM ecovis_payments ORDER BY id ASC')
    .map((row) => withBackupFields(row, ecovisPaymentKey(row)));
  const ecovisPaymentById = new Map(ecovisPayments.map((payment) => [payment.id, payment]));

  const projectPayments = getRows(db, 'SELECT * FROM project_payments ORDER BY id ASC')
    .map((row) => {
      const parent = projectById.get(row.project_id);
      const parentBackupId = parent ? parent.backupId : '';
      return withBackupFields(row, stableKey('project_payment', parentBackupId, row.payment_date, numberPart(row.amount), row.currency, row.notes), {
        projectBackupId: parentBackupId,
      });
    });

  const costs = getRows(db, 'SELECT * FROM project_costs ORDER BY id ASC')
    .map((row) => {
      const parent = projectById.get(row.project_id);
      const parentBackupId = parent ? parent.backupId : '';
      return withBackupFields(row, stableKey('project_cost', parentBackupId, row.category, row.description, numberPart(row.amount), row.currency, row.cost_date), {
        projectBackupId: parentBackupId,
      });
    });

  const vacationRequests = getRows(db, 'SELECT * FROM vacation_requests ORDER BY id ASC')
    .map((row) => {
      const parent = employeeById.get(row.employee_id);
      const parentBackupId = parent ? parent.backupId : '';
      return withBackupFields(row, stableKey('vacation_request', parentBackupId, row.start_date, row.end_date, row.requested_days, row.status), {
        employeeBackupId: parentBackupId,
      });
    });

  const reports = getRows(db, 'SELECT * FROM project_reports ORDER BY id ASC')
    .map((row) => {
      const parent = projectById.get(row.project_id);
      const parentBackupId = parent ? parent.backupId : '';
      return withBackupFields(row, row.report_folio ? stableKey('report', row.report_folio) : stableKey('report', parentBackupId, row.report_date, row.service_name), {
        projectBackupId: parentBackupId,
      });
    });

  const ecovisPaymentAllocations = getRows(db, 'SELECT * FROM ecovis_payment_allocations ORDER BY id ASC')
    .map((row) => {
      const payment = ecovisPaymentById.get(row.payment_id);
      const project = row.ecovis_project_id ? ecovisProjectById.get(row.ecovis_project_id) : null;
      const paymentBackupId = payment ? payment.backupId : '';
      const projectBackupId = project ? project.backupId : '';
      return withBackupFields(row, stableKey('ecovis_allocation', paymentBackupId, projectBackupId, row.allocation_type, numberPart(row.amount), row.notes), {
        paymentBackupId,
        ecovisProjectBackupId: projectBackupId,
      });
    });

  const ecovisMovements = getRows(db, 'SELECT * FROM ecovis_movements ORDER BY id ASC')
    .map((row) => {
      const project = row.related_project_id ? ecovisProjectById.get(row.related_project_id) : null;
      const payment = row.related_payment_id ? ecovisPaymentById.get(row.related_payment_id) : null;
      const relatedProjectBackupId = project ? project.backupId : '';
      const relatedPaymentBackupId = payment ? payment.backupId : '';
      return withBackupFields(row, stableKey('ecovis_movement', row.movement_type, row.movement_date, numberPart(row.amount), row.currency, row.direction, row.description, row.reference, relatedProjectBackupId, relatedPaymentBackupId), {
        relatedProjectBackupId,
        relatedPaymentBackupId,
      });
    });

  const users = getRows(db, 'SELECT id, username, role, created_at FROM users ORDER BY id ASC')
    .map((row) => withBackupFields(row, stableKey('user', row.username)));

  return {
    projects,
    closedProjects,
    projectPayments,
    costs,
    employees,
    vacationRequests,
    reports,
    ecovisProjects,
    ecovisPayments,
    ecovisPaymentAllocations,
    ecovisLoans: ecovisMovements.filter((movement) => movement.movement_type === 'prestamo_ecovis_a_revram'),
    ecovisMovements,
    settings: [
      {
        key: 'exchange_rates',
        records: getRows(db, 'SELECT * FROM exchange_rates ORDER BY currency ASC'),
      },
    ],
    users,
  };
}

function recordCounts(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.length : 0,
  ]));
}

function createBackupPayload(db, { exportedBy = 'system', environment = process.env.NODE_ENV || 'development' } = {}) {
  const data = buildBackupData(db);
  const dataChecksum = checksum(data);
  return {
    backupMetadata: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appName: BACKUP_APP_NAME,
      exportedAt: new Date().toISOString(),
      exportedBy,
      environment,
      recordCounts: recordCounts(data),
      checksum: dataChecksum,
    },
    data,
  };
}

function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  return `REVRAM_BACKUP_${stamp}.json`;
}

function validateBackupPayload(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw backupError('El archivo seleccionado no corresponde a un respaldo valido de REVRAM.');
  }
  if (!backup.backupMetadata || !backup.data || typeof backup.data !== 'object') {
    throw backupError('El archivo seleccionado no corresponde a un respaldo valido de REVRAM.');
  }
  if (backup.backupMetadata.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw backupError('Este respaldo pertenece a una version no compatible. No se importaron datos.');
  }
  if (backup.backupMetadata.checksum && backup.backupMetadata.checksum !== checksum(backup.data)) {
    throw backupError('El archivo seleccionado no corresponde a un respaldo valido de REVRAM.');
  }
  return true;
}

function normalizeForCompare(row) {
  const ignored = new Set([
    'id',
    'originalId',
    'backupId',
    'projectBackupId',
    'employeeBackupId',
    'paymentBackupId',
    'ecovisProjectBackupId',
    'relatedProjectBackupId',
    'relatedPaymentBackupId',
    'created_at',
    'updated_at',
    'createdAt',
    'updatedAt',
    'project_id',
    'employee_id',
    'payment_id',
    'ecovis_project_id',
    'related_project_id',
    'related_payment_id',
  ]);
  return Object.fromEntries(Object.entries(row || {})
    .filter(([key]) => !ignored.has(key))
    .map(([key, value]) => [key, value === undefined ? null : value]));
}

function equivalent(existing, incoming) {
  return canonicalStringify(normalizeForCompare(existing)) === canonicalStringify(normalizeForCompare(incoming));
}

function buildIndex(rows) {
  const index = new Map();
  rows.forEach((row) => {
    if (row.backupId) index.set(row.backupId, row);
  });
  return index;
}

function emptyEntitySummary() {
  return {
    inBackup: 0,
    existing: 0,
    newRecords: 0,
    duplicates: 0,
    conflicts: 0,
    invalid: 0,
    added: 0,
  };
}

function pushIssue(issues, entity, backupId, reason) {
  if (issues.length < MAX_CONFLICT_DETAILS) {
    issues.push({ entity, backupId: backupId || null, reason });
  }
}

function incomingRows(backup, entity) {
  if (entity === 'settings') return Array.isArray(backup.data.settings) ? backup.data.settings : [];
  if (entity === 'ecovisMovements') return Array.isArray(backup.data.ecovisMovements) ? backup.data.ecovisMovements : [];
  return Array.isArray(backup.data[entity]) ? backup.data[entity] : [];
}

function analyzeBackup(db, backup) {
  validateBackupPayload(backup);
  const current = buildBackupData(db);
  const summary = {};
  const issues = [];

  IMPORT_ORDER.forEach((entity) => {
    const rows = incomingRows(backup, entity);
    const currentRows = incomingRows({ data: current }, entity);
    const currentIndex = buildIndex(currentRows);
    const entitySummary = emptyEntitySummary();
    entitySummary.inBackup = rows.length;
    entitySummary.existing = currentRows.length;

    rows.forEach((row) => {
      if (entity === 'settings') {
        const records = Array.isArray(row.records) ? row.records : [];
        entitySummary.inBackup += records.length ? records.length - 1 : 0;
        records.forEach((setting) => {
          const exists = current.settings
            .flatMap((group) => group.records || [])
            .some((currentSetting) => currentSetting.currency === setting.currency);
          exists ? entitySummary.duplicates += 1 : entitySummary.newRecords += 1;
        });
        return;
      }

      if (entity === 'users') {
        const existing = currentIndex.get(row.backupId || stableKey('user', row.username));
        if (existing) {
          entitySummary.duplicates += 1;
        } else {
          entitySummary.conflicts += 1;
          pushIssue(issues, entity, row.backupId, 'Los usuarios se respaldan sin contrasena y deben recrearse manualmente.');
        }
        return;
      }

      if (!row || !row.backupId) {
        entitySummary.invalid += 1;
        pushIssue(issues, entity, null, 'Registro sin identificador estable.');
        return;
      }
      const existing = currentIndex.get(row.backupId);
      if (!existing) {
        entitySummary.newRecords += 1;
      } else if (equivalent(existing, row)) {
        entitySummary.duplicates += 1;
      } else {
        entitySummary.conflicts += 1;
        pushIssue(issues, entity, row.backupId, 'Existe un registro con la misma clave estable pero datos diferentes.');
      }
    });

    summary[entity] = entitySummary;
  });

  return {
    metadata: backup.backupMetadata,
    summary,
    issues,
    warning: 'Esta importacion no reemplazara datos existentes. Solo agregara registros faltantes. Los conflictos seran omitidos o requeriran revision manual.',
  };
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function insertRow(db, table, row, overrides = {}) {
  const columns = tableColumns(db, table).filter((column) => column !== 'id');
  const payload = { ...row, ...overrides };
  const insertColumns = columns.filter((column) => Object.prototype.hasOwnProperty.call(payload, column));
  if (!insertColumns.length) return null;
  const placeholders = insertColumns.map((column) => `@${column}`).join(', ');
  const sql = `INSERT INTO ${table} (${insertColumns.join(', ')}) VALUES (${placeholders})`;
  const result = db.prepare(sql).run(Object.fromEntries(insertColumns.map((column) => [column, payload[column]])));
  return result.lastInsertRowid;
}

function mapExistingIds(rows) {
  return new Map(rows.filter((row) => row.backupId).map((row) => [row.backupId, row.id]));
}

function importEntity({ db, entity, table, rows, currentRows, idMap, parentMaps = {}, mapOverrides = () => ({}) }) {
  const summary = emptyEntitySummary();
  const issues = [];
  const currentIndex = buildIndex(currentRows);
  summary.inBackup = rows.length;
  summary.existing = currentRows.length;

  rows.forEach((row) => {
    if (!row || !row.backupId) {
      summary.invalid += 1;
      pushIssue(issues, entity, null, 'Registro sin identificador estable.');
      return;
    }
    const existing = currentIndex.get(row.backupId);
    if (existing) {
      if (equivalent(existing, row)) {
        summary.duplicates += 1;
        idMap.set(row.backupId, existing.id);
      } else {
        summary.conflicts += 1;
        pushIssue(issues, entity, row.backupId, 'Existe un registro con la misma clave estable pero datos diferentes.');
      }
      return;
    }

    const overrides = mapOverrides(row, parentMaps);
    if (overrides === null) {
      summary.conflicts += 1;
      pushIssue(issues, entity, row.backupId, 'No se encontro la relacion padre requerida.');
      return;
    }

    const insertedId = insertRow(db, table, row, overrides);
    idMap.set(row.backupId, insertedId);
    currentIndex.set(row.backupId, { ...row, id: insertedId, ...overrides });
    summary.newRecords += 1;
    summary.added += 1;
  });

  return { summary, issues };
}

function importBackup(db, backup, { importedBy = 'system', fileName = '' } = {}) {
  validateBackupPayload(backup);
  const current = buildBackupData(db);
  const allIssues = [];
  const summary = {};

  const runImport = db.transaction(() => {
    const projectRows = [...incomingRows(backup, 'projects'), ...incomingRows(backup, 'closedProjects')];
    const currentProjectRows = [...current.projects, ...current.closedProjects];
    const projectIds = mapExistingIds(currentProjectRows);
    const projectResult = importEntity({
      db,
      entity: 'projects',
      table: 'projects',
      rows: projectRows,
      currentRows: currentProjectRows,
      idMap: projectIds,
    });
    summary.projects = projectResult.summary;
    allIssues.push(...projectResult.issues);

    const employeeIds = mapExistingIds(current.employees);
    const employeeResult = importEntity({
      db,
      entity: 'employees',
      table: 'employees',
      rows: incomingRows(backup, 'employees'),
      currentRows: current.employees,
      idMap: employeeIds,
    });
    summary.employees = employeeResult.summary;
    allIssues.push(...employeeResult.issues);

    const ecovisProjectIds = mapExistingIds(current.ecovisProjects);
    const ecovisProjectResult = importEntity({
      db,
      entity: 'ecovisProjects',
      table: 'ecovis_projects',
      rows: incomingRows(backup, 'ecovisProjects'),
      currentRows: current.ecovisProjects,
      idMap: ecovisProjectIds,
    });
    summary.ecovisProjects = ecovisProjectResult.summary;
    allIssues.push(...ecovisProjectResult.issues);

    const ecovisPaymentIds = mapExistingIds(current.ecovisPayments);
    const ecovisPaymentResult = importEntity({
      db,
      entity: 'ecovisPayments',
      table: 'ecovis_payments',
      rows: incomingRows(backup, 'ecovisPayments'),
      currentRows: current.ecovisPayments,
      idMap: ecovisPaymentIds,
    });
    summary.ecovisPayments = ecovisPaymentResult.summary;
    allIssues.push(...ecovisPaymentResult.issues);

    const projectPaymentResult = importEntity({
      db,
      entity: 'projectPayments',
      table: 'project_payments',
      rows: incomingRows(backup, 'projectPayments'),
      currentRows: current.projectPayments,
      idMap: new Map(current.projectPayments.map((row) => [row.backupId, row.id])),
      parentMaps: { projectIds },
      mapOverrides: (row, maps) => {
        const projectId = maps.projectIds.get(row.projectBackupId);
        return projectId ? { project_id: projectId } : null;
      },
    });
    summary.projectPayments = projectPaymentResult.summary;
    allIssues.push(...projectPaymentResult.issues);

    const costResult = importEntity({
      db,
      entity: 'costs',
      table: 'project_costs',
      rows: incomingRows(backup, 'costs'),
      currentRows: current.costs,
      idMap: new Map(current.costs.map((row) => [row.backupId, row.id])),
      parentMaps: { projectIds },
      mapOverrides: (row, maps) => {
        const projectId = maps.projectIds.get(row.projectBackupId);
        return projectId ? { project_id: projectId } : null;
      },
    });
    summary.costs = costResult.summary;
    allIssues.push(...costResult.issues);

    const vacationResult = importEntity({
      db,
      entity: 'vacationRequests',
      table: 'vacation_requests',
      rows: incomingRows(backup, 'vacationRequests'),
      currentRows: current.vacationRequests,
      idMap: new Map(current.vacationRequests.map((row) => [row.backupId, row.id])),
      parentMaps: { employeeIds },
      mapOverrides: (row, maps) => {
        const employeeId = maps.employeeIds.get(row.employeeBackupId);
        return employeeId ? { employee_id: employeeId } : null;
      },
    });
    summary.vacationRequests = vacationResult.summary;
    allIssues.push(...vacationResult.issues);

    const reportResult = importEntity({
      db,
      entity: 'reports',
      table: 'project_reports',
      rows: incomingRows(backup, 'reports'),
      currentRows: current.reports,
      idMap: new Map(current.reports.map((row) => [row.backupId, row.id])),
      parentMaps: { projectIds },
      mapOverrides: (row, maps) => {
        const projectId = maps.projectIds.get(row.projectBackupId);
        return projectId ? { project_id: projectId } : null;
      },
    });
    summary.reports = reportResult.summary;
    allIssues.push(...reportResult.issues);

    const allocationResult = importEntity({
      db,
      entity: 'ecovisPaymentAllocations',
      table: 'ecovis_payment_allocations',
      rows: incomingRows(backup, 'ecovisPaymentAllocations'),
      currentRows: current.ecovisPaymentAllocations,
      idMap: new Map(current.ecovisPaymentAllocations.map((row) => [row.backupId, row.id])),
      parentMaps: { ecovisPaymentIds, ecovisProjectIds },
      mapOverrides: (row, maps) => {
        const paymentId = maps.ecovisPaymentIds.get(row.paymentBackupId);
        if (!paymentId) return null;
        const projectId = row.ecovisProjectBackupId ? maps.ecovisProjectIds.get(row.ecovisProjectBackupId) : null;
        if (row.ecovisProjectBackupId && !projectId) return null;
        return { payment_id: paymentId, ecovis_project_id: projectId };
      },
    });
    summary.ecovisPaymentAllocations = allocationResult.summary;
    allIssues.push(...allocationResult.issues);

    const movementIds = new Map(current.ecovisMovements.map((row) => [row.backupId, row.id]));
    const movementResult = importEntity({
      db,
      entity: 'ecovisMovements',
      table: 'ecovis_movements',
      rows: incomingRows(backup, 'ecovisMovements'),
      currentRows: current.ecovisMovements,
      idMap: movementIds,
      parentMaps: { ecovisPaymentIds, ecovisProjectIds },
      mapOverrides: (row, maps) => {
        const projectId = row.relatedProjectBackupId ? maps.ecovisProjectIds.get(row.relatedProjectBackupId) : null;
        const paymentId = row.relatedPaymentBackupId ? maps.ecovisPaymentIds.get(row.relatedPaymentBackupId) : null;
        if ((row.relatedProjectBackupId && !projectId) || (row.relatedPaymentBackupId && !paymentId)) return null;
        return { related_project_id: projectId, related_payment_id: paymentId };
      },
    });
    summary.ecovisMovements = movementResult.summary;
    allIssues.push(...movementResult.issues);

    const settingsSummary = emptyEntitySummary();
    const exchangeRows = (incomingRows(backup, 'settings').find((group) => group.key === 'exchange_rates') || {}).records || [];
    settingsSummary.inBackup = exchangeRows.length;
    settingsSummary.existing = current.settings.flatMap((group) => group.records || []).length;
    exchangeRows.forEach((rate) => {
      const exists = db.prepare('SELECT currency FROM exchange_rates WHERE currency = ?').get(rate.currency);
      if (exists) {
        settingsSummary.duplicates += 1;
      } else {
        insertRow(db, 'exchange_rates', rate);
        settingsSummary.newRecords += 1;
        settingsSummary.added += 1;
      }
    });
    summary.settings = settingsSummary;

    const userSummary = emptyEntitySummary();
    const users = incomingRows(backup, 'users');
    userSummary.inBackup = users.length;
    userSummary.existing = current.users.length;
    const currentUsers = buildIndex(current.users);
    users.forEach((user) => {
      if (currentUsers.has(user.backupId)) {
        userSummary.duplicates += 1;
      } else {
        userSummary.conflicts += 1;
        pushIssue(allIssues, 'users', user.backupId, 'Los usuarios se respaldan sin contrasena y deben recrearse manualmente.');
      }
    });
    summary.users = userSummary;

    const hasIssues = allIssues.length > 0 || Object.values(summary).some((item) => item.conflicts || item.invalid);
    const status = hasIssues ? 'completed_with_warnings' : 'completed';
    db.prepare(
      `INSERT INTO backup_import_logs (
        imported_by, file_name, schema_version, backup_exported_at, status, summary_json, errors_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      importedBy,
      fileName,
      backup.backupMetadata.schemaVersion,
      backup.backupMetadata.exportedAt,
      status,
      JSON.stringify(summary),
      JSON.stringify(allIssues),
    );

    return {
      status,
      metadata: backup.backupMetadata,
      summary,
      issues: allIssues,
    };
  });

  return runImport();
}

module.exports = {
  BACKUP_SCHEMA_VERSION,
  BACKUP_APP_NAME,
  createBackupPayload,
  backupFileName,
  validateBackupPayload,
  analyzeBackup,
  importBackup,
  checksum,
};
