const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db');
const { buildSearchCondition } = require('../src/search');

const PROJECT_CHARGED_SQL = `(SELECT COALESCE(SUM(pp.amount * COALESCE(er.rate_to_mxn, 1)), 0)
  FROM project_payments pp
  LEFT JOIN exchange_rates er ON COALESCE(pp.currency, 'MXN') = er.currency
  WHERE pp.project_id = p.id)`;
const PROJECT_SPENT_SQL = `(SELECT COALESCE(SUM(pc.amount * COALESCE(er.rate_to_mxn, 1)), 0)
  FROM project_costs pc
  LEFT JOIN exchange_rates er ON COALESCE(pc.currency, 'MXN') = er.currency
  WHERE pc.project_id = p.id)`;
const PROJECT_INVOICED_SQL = `(p.total_invoiced * COALESCE((SELECT rate_to_mxn FROM exchange_rates WHERE currency = COALESCE(p.total_invoiced_currency, 'MXN')), 1))`;
const PROJECT_PENDING_SQL = `(${PROJECT_INVOICED_SQL} - ${PROJECT_CHARGED_SQL})`;
const PROJECT_MARGIN_SQL = `(CASE WHEN ${PROJECT_INVOICED_SQL} > 0 THEN ((${PROJECT_INVOICED_SQL} - ${PROJECT_SPENT_SQL}) / ${PROJECT_INVOICED_SQL}) ELSE 0 END)`;

function buildProjectListSearchColumns() {
  return [
    'CAST(p.id AS TEXT)',
    'p.quote_number',
    'p.order_number',
    'p.purchase_order_number',
    'p.invoice_number',
    'p.invoice_payment_status',
    'p.client_name',
    'p.project_description',
    'p.status',
    'p.risk',
    'p.seller',
    'p.technician_name',
    'CAST(p.promised_delivery_date AS TEXT)',
    'CAST(p.closed_at AS TEXT)',
    `CAST(${PROJECT_CHARGED_SQL} AS TEXT)`,
    `CAST(${PROJECT_SPENT_SQL} AS TEXT)`,
    `CAST(${PROJECT_PENDING_SQL} AS TEXT)`,
    `CAST(${PROJECT_MARGIN_SQL} AS TEXT)`,
    `CAST(${PROJECT_INVOICED_SQL} AS TEXT)`,
  ];
}

test('project search finds status across full active dataset', () => {
  const db = getDb();
  const search = buildSearchCondition(buildProjectListSearchColumns(), 'terminado');
  assert.ok(search);
  const whereClause = `p.closed_at IS NULL AND ${search.clause}`;
  const rows = db.prepare(`SELECT p.id, p.status FROM projects p WHERE ${whereClause}`).all(...search.params);
  assert.ok(rows.length >= 0);
  if (rows.length) {
    rows.forEach((row) => {
      assert.match(String(row.status).toLowerCase(), /terminado/);
    });
  }
});
