'use strict';

/**
 * Migraciones idempotentes de comisiones en PostgreSQL (BD creadas antes del esquema actual).
 */
function migrateCommissionsPostgres(database) {
  const alters = [
    'ALTER TABLE sales_commission_agents ADD COLUMN IF NOT EXISTS employee_id INTEGER',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS final_margin_snapshot DOUBLE PRECISION',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT \'proyecto\'',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS reference TEXT',
    'ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS paid_at TEXT',
    'ALTER TABLE sales_commission_payments ADD COLUMN IF NOT EXISTS commission_id INTEGER',
  ];
  for (const sql of alters) {
    try {
      database.exec(sql);
    } catch (_) {
      /* tabla/columna puede no existir en despliegues parciales */
    }
  }

  try {
    database.exec('ALTER TABLE sales_commissions ALTER COLUMN project_id DROP NOT NULL');
  } catch (_) {
    /* ya nullable */
  }

  try {
    database.exec(`
      UPDATE sales_commissions
      SET commission_type = 'proyecto'
      WHERE commission_type IS NULL OR btrim(commission_type) = ''
    `);
  } catch (_) {}

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sales_commission_balance_adjustments (
        id SERIAL PRIMARY KEY,
        sales_agent_id INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('saldo_inicial', 'extraordinario')),
        amount_mxn DOUBLE PRECISION NOT NULL,
        description TEXT NOT NULL,
        reference TEXT,
        created_by_user_id INTEGER,
        created_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        deleted_by_user_id INTEGER,
        deleted_by_name TEXT,
        delete_reason TEXT,
        FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
      )
    `);
  } catch (_) {}

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commission_agents_employee_active
      ON sales_commission_agents (employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_project_active
      ON sales_commissions (project_id)
      WHERE deleted_at IS NULL AND status != 'cancelada' AND project_id IS NOT NULL`,
  ];
  for (const sql of indexes) {
    try {
      database.exec(sql);
    } catch (_) {}
  }
}

module.exports = { migrateCommissionsPostgres };
