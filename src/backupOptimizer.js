'use strict';

const zlib = require('node:zlib');
const { BACKUP_ENTITIES, EXCLUDED_ENTITIES, BACKUP_SCHEMA_VERSION, getIncludedEntities, buildCoverageManifest } = require('./backupRegistry');

const BACKUP_TYPES = {
  complete: 'complete',
  light: 'light',
  critical_only: 'critical_only',
};

const CRITICAL_ENTITIES = [
  'projects', 'closedProjects', 'projectPayments', 'projectCosts', 'projectReports', 'reportsArchive',
  'employees', 'vacationRequests', 'payrollAttendanceWeeks', 'payrollAttendanceEmployees', 'attendanceStatuses',
  'ecovisProjects', 'ecovisPayments', 'ecovisPurchaseOrders', 'ecovisPaymentAllocations', 'ecovisLoans', 'ecovisMovements',
  'settings', 'usersSafe', 'userPermissions', 'serviceTypes', 'serviceQuoteSettings',
  'financialStatements', 'financialSettings', 'accountsPayable', 'accountsPayablePayments',
  'bankStatementSummaries', 'manualPayrollExpenses', 'financialAdjustments', 'financialProjectOmissions',
  'salesCommissionAgents', 'salesCommissions', 'salesCommissionPayments',
  'userPreferences', 'rolePermissions',
];

const HEAVY_ENTITIES = ['auditLogs', 'loginAttempts', 'bankStatementMovements', 'backupImportLogs'];

const TEMPORAL_ENTITIES = ['userSessionActivities'];

const AUDIT_LOG_POLICIES = {
  last30Days: 30,
  last90Days: 90,
  last365Days: 365,
  full: null,
};

const ACTIVITY_POLICIES = {
  none: 0,
  last30Days: 30,
  last90Days: 90,
  full: null,
};

function getEntitiesForBackupType(backupType) {
  if (backupType === BACKUP_TYPES.critical_only) {
    return CRITICAL_ENTITIES;
  }
  if (backupType === BACKUP_TYPES.light) {
    return CRITICAL_ENTITIES.concat(['auditLogs', 'loginAttempts']);
  }
  return null;
}

function buildPolicyQuery(entity, policy, daysLimit) {
  if (!daysLimit) return entity.query;
  const cutoff = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000).toISOString();
  if (entity.key === 'auditLogs') {
    return `SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, metadata_json, created_at FROM audit_logs WHERE timestamp_utc >= '${cutoff}' ORDER BY id DESC`;
  }
  if (entity.key === 'loginAttempts') {
    return `SELECT id, user_identifier, user_id, ip_address, success, failure_reason, attempted_at, locked_until, created_at FROM login_attempts WHERE attempted_at >= '${cutoff}' ORDER BY id DESC`;
  }
  return entity.query;
}

function generateBackup(db, options = {}) {
  const {
    backupType = BACKUP_TYPES.complete,
    auditLogPolicy = 'full',
    activityPolicy = 'none',
    compress = false,
    username = 'admin',
  } = options;

  const allEntities = getIncludedEntities();
  const allowedKeys = getEntitiesForBackupType(backupType);
  const entities = allowedKeys ? allEntities.filter(e => allowedKeys.includes(e.key)) : allEntities;

  const data = {};
  const recordCounts = {};
  const entitySizes = {};
  const includedEntities = [];
  const excludedEntitiesList = [];
  const warnings = [];

  const auditDays = AUDIT_LOG_POLICIES[auditLogPolicy] || null;
  const activityDays = ACTIVITY_POLICIES[activityPolicy] || null;

  for (const entity of entities) {
    if (entity.key === 'userSessionActivities' && activityPolicy === 'none') {
      excludedEntitiesList.push({ name: entity.key, reason: 'Excluido por politica de actividad: none' });
      continue;
    }
    try {
      let query = entity.query;
      if (entity.key === 'auditLogs' && auditDays) {
        query = buildPolicyQuery(entity, 'audit', auditDays);
      } else if (entity.key === 'loginAttempts' && auditDays) {
        query = buildPolicyQuery(entity, 'login', auditDays);
      } else if (entity.key === 'userSessionActivities' && activityDays) {
        const cutoff = new Date(Date.now() - activityDays * 24 * 60 * 60 * 1000).toISOString();
        query = `SELECT * FROM user_session_activities WHERE login_at >= '${cutoff}' ORDER BY id DESC`;
      }
      const rows = db.prepare(query).all();
      data[entity.key] = rows;
      recordCounts[entity.key] = rows.length;
      const serialized = JSON.stringify(rows);
      entitySizes[entity.key] = serialized.length;
      includedEntities.push(entity.key);
    } catch (err) {
      data[entity.key] = [];
      recordCounts[entity.key] = 0;
      entitySizes[entity.key] = 2;
      warnings.push(`No se pudo respaldar ${entity.key}: ${err.message}`);
    }
  }

  for (const excl of EXCLUDED_ENTITIES) {
    excludedEntitiesList.push({ name: excl.key, reason: excl.reason });
  }
  if (backupType !== BACKUP_TYPES.complete) {
    const skipped = allEntities.filter(e => !includedEntities.includes(e.key) && !excludedEntitiesList.find(x => x.name === e.key));
    for (const s of skipped) {
      excludedEntitiesList.push({ name: s.key, reason: `Excluido por tipo de respaldo: ${backupType}` });
    }
  }

  const totalUncompressedSize = Object.values(entitySizes).reduce((s, v) => s + v, 0);

  const backup = {
    backupMetadata: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appName: 'REVRAM Dashboard',
      exportedAt: new Date().toISOString(),
      exportedBy: username,
      environment: process.env.NODE_ENV || 'development',
      backupType,
      compression: compress ? 'gzip' : 'none',
      recordCounts,
      entitySizes,
      totalUncompressedSize,
      includedEntities,
      excludedEntities: excludedEntitiesList.map(e => e.name),
      warnings,
      policiesUsed: { auditLogPolicy, activityPolicy },
    },
    coverageManifest: {
      ...buildCoverageManifest(includedEntities, warnings),
      backupType,
      excludedWithReasons: excludedEntitiesList,
      entitySizes,
      totalUncompressedSize,
    },
    data,
  };

  if (compress) {
    const jsonStr = JSON.stringify(backup);
    const compressed = zlib.gzipSync(jsonStr);
    backup.backupMetadata.totalCompressedSize = compressed.length;
    return { backup, compressed, contentType: 'application/gzip', extension: '.json.gz' };
  }

  return { backup, compressed: null, contentType: 'application/json', extension: '.json' };
}

function generateDiagnostic(db) {
  const entities = getIncludedEntities();
  const results = [];
  let totalSize = 0;

  for (const entity of entities) {
    try {
      const rows = db.prepare(entity.query).all();
      const serialized = JSON.stringify(rows);
      const size = serialized.length;
      totalSize += size;
      results.push({
        entity: entity.key,
        table: entity.table,
        module: entity.module,
        records: rows.length,
        sizeBytes: size,
        avgRecordBytes: rows.length > 0 ? Math.round(size / rows.length) : 0,
      });
    } catch (err) {
      results.push({ entity: entity.key, table: entity.table, module: entity.module, records: 0, sizeBytes: 0, avgRecordBytes: 0, error: err.message });
    }
  }

  results.sort((a, b) => b.sizeBytes - a.sizeBytes);

  for (const r of results) {
    r.percentage = totalSize > 0 ? Math.round((r.sizeBytes / totalSize) * 10000) / 100 : 0;
  }

  return {
    totalSizeBytes: totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    entityCount: results.length,
    totalRecords: results.reduce((s, r) => s + r.records, 0),
    topHeaviest: results.slice(0, 10),
    entities: results,
    hasBase64: false,
    hasLargeSnapshots: results.some(r => r.avgRecordBytes > 10000),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function decompressBackup(buffer) {
  try {
    const decompressed = zlib.gunzipSync(buffer);
    return JSON.parse(decompressed.toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  BACKUP_TYPES,
  CRITICAL_ENTITIES,
  HEAVY_ENTITIES,
  TEMPORAL_ENTITIES,
  AUDIT_LOG_POLICIES,
  ACTIVITY_POLICIES,
  generateBackup,
  generateDiagnostic,
  decompressBackup,
  formatBytes,
};
