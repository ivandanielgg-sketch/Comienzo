'use strict';

const { logAuditEvent, nowUtc } = require('../audit');

/** Closed projects that still show status "En Proceso" (data fix). */
const CLOSED_EN_PROCESO_IDS = [7, 8, 35, 37, 38, 39, 46, 50, 59];

/**
 * Idempotent: only updates rows that still match
 * id IN (...) AND closed_at IS NOT NULL AND status = 'En Proceso'.
 * Records an audit event per updated project.
 */
function migrateClosedProjectsStatus(database) {
  const placeholders = CLOSED_EN_PROCESO_IDS.map(() => '?').join(', ');
  const candidates = database
    .prepare(
      `SELECT id, quote_number, status, closed_at
       FROM projects
       WHERE id IN (${placeholders})
         AND closed_at IS NOT NULL
         AND status = 'En Proceso'`,
    )
    .all(...CLOSED_EN_PROCESO_IDS);

  if (!candidates.length) {
    return { updated: 0, ids: [] };
  }

  const updatedAt = nowUtc();
  const updateStmt = database.prepare(
    `UPDATE projects
     SET status = 'Terminado', updated_at = ?
     WHERE id = ?
       AND closed_at IS NOT NULL
       AND status = 'En Proceso'`,
  );

  const updatedIds = [];
  for (const row of candidates) {
    const result = updateStmt.run(updatedAt, row.id);
    if (!result.changes) {
      continue;
    }
    updatedIds.push(row.id);
    logAuditEvent(database, {
      req: null,
      action: 'status_migration',
      module: 'projects',
      entityType: 'project',
      entityId: row.id,
      entityLabel: row.quote_number || `project-${row.id}`,
      before: { status: row.status, closed_at: row.closed_at },
      after: { status: 'Terminado', closed_at: row.closed_at },
      metadata: {
        reason: 'closed_projects_en_proceso_to_terminado',
        migration: 'closedProjectsStatusMigration',
      },
    });
  }

  return { updated: updatedIds.length, ids: updatedIds };
}

module.exports = {
  CLOSED_EN_PROCESO_IDS,
  migrateClosedProjectsStatus,
};
