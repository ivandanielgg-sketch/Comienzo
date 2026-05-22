'use strict';

const BACKUP_SCHEMA_VERSION = '2.0.0';

const ENTITY_STATUS = {
  INCLUDED: 'included',
  EXCLUDED: 'excluded',
  PLANNED: 'planned',
};

const BACKUP_ENTITIES = [
  {
    key: 'projects',
    table: 'projects',
    query: 'SELECT * FROM projects WHERE closed_at IS NULL ORDER BY id',
    stableKeys: ['quote_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'projects',
  },
  {
    key: 'closedProjects',
    table: 'projects',
    query: 'SELECT * FROM projects WHERE closed_at IS NOT NULL ORDER BY id',
    stableKeys: ['quote_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'projects',
  },
  {
    key: 'projectPayments',
    table: 'project_payments',
    query: 'SELECT * FROM project_payments ORDER BY id',
    stableKeys: ['project_id', 'payment_date', 'amount', 'currency'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'payments',
  },
  {
    key: 'projectCosts',
    table: 'project_costs',
    query: 'SELECT * FROM project_costs ORDER BY id',
    stableKeys: ['project_id', 'cost_date', 'amount', 'category', 'description'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'costs',
  },
  {
    key: 'projectReports',
    table: 'project_reports',
    query: 'SELECT * FROM project_reports WHERE deleted_at IS NULL ORDER BY id',
    stableKeys: ['report_folio'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'reports',
  },
  {
    key: 'reportsArchive',
    table: 'project_reports',
    query: 'SELECT * FROM project_reports WHERE deleted_at IS NOT NULL ORDER BY id',
    stableKeys: ['report_folio'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'reports',
  },
  {
    key: 'employees',
    table: 'employees',
    query: 'SELECT * FROM employees ORDER BY id',
    stableKeys: ['employee_number'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'vacations',
  },
  {
    key: 'vacationRequests',
    table: 'vacation_requests',
    query: 'SELECT * FROM vacation_requests ORDER BY id',
    stableKeys: ['employee_id', 'start_date', 'end_date', 'requested_days'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'vacations',
  },
  {
    key: 'ecovisProjects',
    table: 'ecovis_projects',
    query: 'SELECT * FROM ecovis_projects ORDER BY id',
    stableKeys: ['project_name', 'project_date', 'total_amount'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisPayments',
    table: 'ecovis_payments',
    query: 'SELECT * FROM ecovis_payments ORDER BY id',
    stableKeys: ['payment_date', 'amount', 'bank_reference'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisPaymentAllocations',
    table: 'ecovis_payment_allocations',
    query: 'SELECT * FROM ecovis_payment_allocations ORDER BY id',
    stableKeys: ['payment_id', 'amount', 'allocation_type'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisLoans',
    table: 'ecovis_movements',
    query: "SELECT * FROM ecovis_movements WHERE movement_type = 'prestamo_ecovis_a_revram' ORDER BY id",
    stableKeys: ['movement_date', 'amount', 'description'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'ecovisMovements',
    table: 'ecovis_movements',
    query: "SELECT * FROM ecovis_movements WHERE movement_type != 'prestamo_ecovis_a_revram' ORDER BY id",
    stableKeys: ['movement_date', 'movement_type', 'amount', 'description'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'ecovis',
  },
  {
    key: 'settings',
    table: 'exchange_rates',
    query: 'SELECT * FROM exchange_rates ORDER BY currency',
    stableKeys: ['currency'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'settings',
  },
  {
    key: 'usersSafe',
    table: 'users',
    query: 'SELECT id, username, role, is_active, created_at FROM users ORDER BY id',
    stableKeys: ['username'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'users',
  },
  {
    key: 'userPermissions',
    table: 'user_permissions',
    query: 'SELECT id, user_id, permissions_json, created_at, updated_at FROM user_permissions ORDER BY id',
    stableKeys: ['user_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'users',
  },
  {
    key: 'loginAttempts',
    table: 'login_attempts',
    query: 'SELECT id, user_identifier, user_id, ip_address, success, failure_reason, attempted_at, locked_until, created_at FROM login_attempts ORDER BY id',
    stableKeys: ['user_identifier', 'attempted_at'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'auth',
    note: 'user_agent excluded from backup to reduce size',
  },
  {
    key: 'auditLogs',
    table: 'audit_logs',
    query: 'SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, metadata_json, created_at FROM audit_logs ORDER BY id',
    stableKeys: ['timestamp_utc', 'user_id', 'action', 'entity_type', 'entity_id'],
    status: ENTITY_STATUS.INCLUDED,
    module: 'audit',
    note: 'before_json and after_json excluded from backup to reduce size',
  },
];

const EXCLUDED_ENTITIES = [
  {
    key: 'sessions',
    table: 'sessions',
    reason: 'Datos sensibles de sesion activa - tokens y cookies',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'passwordHashes',
    table: 'users',
    reason: 'Credenciales sensibles - password_hash excluido por seguridad',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'mfaSecrets',
    table: 'users',
    reason: 'Secretos MFA no se respaldan por seguridad',
    status: ENTITY_STATUS.EXCLUDED,
  },
  {
    key: 'environmentVariables',
    table: null,
    reason: 'Variables de entorno, secretos y credenciales del servidor',
    status: ENTITY_STATUS.EXCLUDED,
  },
];

const PLANNED_ENTITIES = [
  { key: 'roles', table: 'roles', reason: 'Pendiente implementacion de sistema de roles granular', status: ENTITY_STATUS.PLANNED },
  { key: 'permissions', table: 'permissions', reason: 'Pendiente implementacion de permisos definidos como tabla', status: ENTITY_STATUS.PLANNED },
  { key: 'securitySettings', table: 'security_settings', reason: 'Pendiente configuracion de seguridad', status: ENTITY_STATUS.PLANNED },
  { key: 'backupImportLogs', table: 'backup_import_logs', reason: 'Pendiente registro persistente de importaciones', status: ENTITY_STATUS.PLANNED },
];

const DETECTED_ROUTES = [
  '/projects',
  '/closed-projects',
  '/reports',
  '/reports/archive',
  '/vacations',
  '/ecovis',
  '/users',
  '/admin/backup',
];

const DETECTED_MODULES = [
  'projects',
  'closedProjects',
  'payments',
  'costs',
  'reports',
  'reportsArchive',
  'employees',
  'vacations',
  'ecovis',
  'settings',
  'users',
  'auth',
  'backup',
  'audit',
];

function getIncludedEntities() {
  return BACKUP_ENTITIES.filter((e) => e.status === ENTITY_STATUS.INCLUDED);
}

function getAllEntityKeys() {
  return [
    ...BACKUP_ENTITIES.map((e) => e.key),
    ...EXCLUDED_ENTITIES.map((e) => e.key),
    ...PLANNED_ENTITIES.map((e) => e.key),
  ];
}

function buildCoverageManifest(includedKeys, warnings) {
  const allDetected = BACKUP_ENTITIES.map((e) => e.key);
  const excluded = EXCLUDED_ENTITIES.map((e) => ({ entity: e.key, reason: e.reason }));
  const planned = PLANNED_ENTITIES.map((e) => ({ entity: e.key, reason: e.reason }));

  let coverageStatus = 'complete';
  if (warnings && warnings.length > 0) {
    coverageStatus = 'incomplete';
  }

  return {
    routesDetected: DETECTED_ROUTES,
    modulesDetected: DETECTED_MODULES,
    entitiesDetected: allDetected,
    entitiesIncluded: includedKeys,
    entitiesExcluded: excluded,
    entitiesPlanned: planned,
    coverageStatus,
  };
}

module.exports = {
  BACKUP_SCHEMA_VERSION,
  BACKUP_ENTITIES,
  EXCLUDED_ENTITIES,
  PLANNED_ENTITIES,
  ENTITY_STATUS,
  DETECTED_ROUTES,
  DETECTED_MODULES,
  getIncludedEntities,
  getAllEntityKeys,
  buildCoverageManifest,
};
