'use strict';

const { nowUtc } = require('./dateHelper');

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'cookie',
  'secret',
  'session_secret',
  'sess',
];

function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function getAuditContext(req) {
  return {
    userId: req.session ? req.session.userId : null,
    userName: req.session ? req.session.username : null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get ? req.get('user-agent') || null : null,
  };
}

function createdByFields(req) {
  return {
    created_by_user_id: req.session ? req.session.userId : null,
    created_by_name: req.session ? req.session.username : null,
    created_at: nowUtc(),
  };
}

function updatedByFields(req) {
  return {
    updated_by_user_id: req.session ? req.session.userId : null,
    updated_by_name: req.session ? req.session.username : null,
    updated_at: nowUtc(),
  };
}

function deletedByFields(req) {
  return {
    deleted_by_user_id: req.session ? req.session.userId : null,
    deleted_by_name: req.session ? req.session.username : null,
    deleted_at: nowUtc(),
  };
}

/**
 * Logs an audit event to the audit_logs table.
 */
function logAuditEvent(db, { req, action, module, entityType, entityId, entityLabel, before, after, metadata }) {
  const ctx = req ? getAuditContext(req) : { userId: null, userName: null, ipAddress: null, userAgent: null };
  const timestamp = nowUtc();

  const beforeJson = before ? JSON.stringify(sanitizeForLog(before)) : null;
  const afterJson = after ? JSON.stringify(sanitizeForLog(after)) : null;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, module, entity_type, entity_id, entity_label, timestamp_utc, ip_address, user_agent, before_json, after_json, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ctx.userId,
      ctx.userName,
      action,
      module || null,
      entityType || null,
      entityId || null,
      entityLabel || null,
      timestamp,
      ctx.ipAddress,
      ctx.userAgent,
      beforeJson,
      afterJson,
      metadataJson,
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = {
  getAuditContext,
  createdByFields,
  updatedByFields,
  deletedByFields,
  logAuditEvent,
  sanitizeForLog,
  nowUtc,
};
