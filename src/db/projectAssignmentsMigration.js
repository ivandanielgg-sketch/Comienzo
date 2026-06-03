'use strict';

function ensureColumnSqlite(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateProjectEmployeeAssignments(database, { postgres = false } = {}) {
  if (postgres) {
    const alters = [
      'ALTER TABLE projects ADD COLUMN IF NOT EXISTS fecha_vencimiento TEXT',
      'ALTER TABLE projects ADD COLUMN IF NOT EXISTS tecnico_id INTEGER',
      'ALTER TABLE projects ADD COLUMN IF NOT EXISTS vendedor_id INTEGER',
    ];
    for (const sql of alters) {
      try {
        database.exec(sql);
      } catch (_) {
        /* idempotent */
      }
    }
    try {
      database.exec(`
        UPDATE projects
        SET fecha_vencimiento = to_char(created_at::date + INTERVAL '30 days', 'YYYY-MM-DD')
        WHERE fecha_vencimiento IS NULL OR btrim(fecha_vencimiento) = ''
      `);
    } catch (_) {
      /* column may not exist yet on partial deploy */
    }
    const pending = database.prepare(
      'SELECT id, technician_name, seller FROM projects WHERE tecnico_id IS NULL OR vendedor_id IS NULL',
    ).all();
    for (const project of pending) {
      if (!project.tecnico_id && project.technician_name) {
        const tech = database.prepare(
          'SELECT id FROM employees WHERE active = 1 AND lower(full_name) = lower(?) LIMIT 1',
        ).get(project.technician_name.trim());
        if (tech) {
          database.prepare('UPDATE projects SET tecnico_id = ? WHERE id = ?').run(tech.id, project.id);
        }
      }
      if (!project.vendedor_id && project.seller) {
        const vend = database.prepare(
          'SELECT id FROM employees WHERE active = 1 AND lower(full_name) = lower(?) LIMIT 1',
        ).get(project.seller.trim());
        if (vend) {
          database.prepare('UPDATE projects SET vendedor_id = ? WHERE id = ?').run(vend.id, project.id);
        }
      }
    }
    return;
  }

  ensureColumnSqlite(database, 'projects', 'fecha_vencimiento', 'TEXT');
  ensureColumnSqlite(database, 'projects', 'tecnico_id', 'INTEGER');
  ensureColumnSqlite(database, 'projects', 'vendedor_id', 'INTEGER');

  database.exec(`
    UPDATE projects
    SET fecha_vencimiento = date(created_at, '+30 days')
    WHERE fecha_vencimiento IS NULL OR trim(fecha_vencimiento) = ''
  `);

  const pending = database.prepare(
    'SELECT id, technician_name, seller, tecnico_id, vendedor_id FROM projects',
  ).all();
  for (const project of pending) {
    if (!project.tecnico_id && project.technician_name) {
      const tech = database.prepare(
        "SELECT id FROM employees WHERE active = 1 AND full_name = ? COLLATE NOCASE LIMIT 1",
      ).get(project.technician_name.trim());
      if (tech) {
        database.prepare('UPDATE projects SET tecnico_id = ? WHERE id = ?').run(tech.id, project.id);
      }
    }
    if (!project.vendedor_id && project.seller) {
      const vend = database.prepare(
        "SELECT id FROM employees WHERE active = 1 AND full_name = ? COLLATE NOCASE LIMIT 1",
      ).get(project.seller.trim());
      if (vend) {
        database.prepare('UPDATE projects SET vendedor_id = ? WHERE id = ?').run(vend.id, project.id);
      }
    }
  }
}

module.exports = {
  migrateProjectEmployeeAssignments,
};
