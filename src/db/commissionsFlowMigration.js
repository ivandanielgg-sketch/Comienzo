'use strict';

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateCommissionsFlow(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sales_commissions'")
    .get();
  if (!table) return;

  ensureColumn(database, 'sales_commission_payments', 'commission_id', 'INTEGER');
  ensureColumn(database, 'sales_commissions', 'commission_type', "TEXT NOT NULL DEFAULT 'proyecto'");
  ensureColumn(database, 'sales_commissions', 'reference', 'TEXT');
  ensureColumn(database, 'sales_commissions', 'paid_at', 'TEXT');

  const tableSql = table.sql || '';
  const projectCol = database.prepare('PRAGMA table_info(sales_commissions)').all().find((c) => c.name === 'project_id');
  const needsRebuild =
    (projectCol && projectCol.notnull === 1)
    || (tableSql.includes('no_aplica') && !tableSql.includes('facturado_1pct'));

  if (!needsRebuild) return;

  database.exec(`
    CREATE TABLE sales_commissions_flow_tmp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      closed_project_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      commission_type TEXT NOT NULL DEFAULT 'proyecto',
      commission_calculation_base_type TEXT NOT NULL,
      commission_base_mxn REAL NOT NULL DEFAULT 0,
      total_sale_mxn_snapshot REAL,
      gross_profit_mxn_snapshot REAL,
      net_profit_mxn_snapshot REAL,
      final_margin_snapshot REAL,
      commission_percentage REAL NOT NULL DEFAULT 0,
      commission_amount_mxn REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente',
      no_apply_reason TEXT,
      notes TEXT,
      reference TEXT,
      assigned_by_user_id INTEGER,
      assigned_by_name TEXT,
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );
    INSERT INTO sales_commissions_flow_tmp (
      id, project_id, closed_project_id, sales_agent_id, commission_type,
      commission_calculation_base_type, commission_base_mxn, total_sale_mxn_snapshot,
      gross_profit_mxn_snapshot, net_profit_mxn_snapshot, final_margin_snapshot,
      commission_percentage, commission_amount_mxn, status, no_apply_reason, notes, reference,
      assigned_by_user_id, assigned_by_name, assigned_at, paid_at,
      created_at, updated_at, deleted_at, deleted_by_user_id, deleted_by_name, delete_reason
    )
    SELECT
      id, project_id, closed_project_id, sales_agent_id, 'proyecto',
      commission_calculation_base_type, commission_base_mxn, total_sale_mxn_snapshot,
      gross_profit_mxn_snapshot, net_profit_mxn_snapshot, final_margin_snapshot,
      commission_percentage, commission_amount_mxn, status, no_apply_reason, notes, NULL,
      assigned_by_user_id, assigned_by_name, assigned_at, NULL,
      created_at, updated_at, deleted_at, deleted_by_user_id, deleted_by_name, delete_reason
    FROM sales_commissions;
    DROP TABLE sales_commissions;
    ALTER TABLE sales_commissions_flow_tmp RENAME TO sales_commissions;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_project_active
      ON sales_commissions (project_id)
      WHERE deleted_at IS NULL AND status != 'cancelada' AND project_id IS NOT NULL;
  `);
}

module.exports = { migrateCommissionsFlow };
