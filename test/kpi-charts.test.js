const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db');
const {
  computeKpiCharts,
  computeReceivableBuckets,
  resolveProjectDueDate,
  getPeriodRange,
  getVentasEmpleadosActivos,
  computeVentasChartData,
} = require('../src/kpis');

test('computeReceivableBuckets uses fecha_vencimiento por vencer y vencidos', () => {
  const projects = [
    {
      fecha_vencimiento: '2099-12-31',
      totals: { pending_collection: 1000 },
    },
    {
      fecha_vencimiento: '2020-01-01',
      totals: { pending_collection: 500 },
    },
  ];
  const buckets = computeReceivableBuckets(projects, {});
  assert.strictEqual(buckets.length, 2);
  assert.strictEqual(buckets[0].label, 'Por vencer');
  assert.strictEqual(buckets[1].label, 'Vencidos');
  assert.ok(buckets[0].amount >= 1000);
  assert.ok(buckets[1].amount >= 500);
});

test('computeKpiCharts returns chart payloads with filtered data', () => {
  const db = getDb();
  const period = getPeriodRange('current_year');
  const exchangeRates = { MXN: 1 };

  const suffix = Date.now();
  const tech = db.prepare(
    "INSERT INTO employees (employee_number, full_name, hire_date, active, kpi_area, kpi_eligible) VALUES (?, 'Tecnico Graficas', '2020-01-01', 1, 'Técnico', 1)",
  ).run('KPI-T-' + suffix);
  const vend = db.prepare(
    "INSERT INTO employees (employee_number, full_name, hire_date, active, primary_department, department, kpi_area, kpi_eligible) VALUES (?, 'Vendedor Graficas', '2020-01-01', 1, 'Ventas', 'Ventas', 'Ventas', 1)",
  ).run('KPI-V-' + suffix);

  const projectInsert = db.prepare(`
    INSERT INTO projects (
      quote_number, order_number, purchase_order_not_applicable,
      seller, client_name, project_description, expected_margin,
      total_invoiced, progress_percent, technician_name, promised_delivery_date,
      status, risk, created_at, updated_at, vendedor_id, tecnico_id, fecha_vencimiento
    ) VALUES (
      ?, 'PED-KPI', 1,
      'Vendedor Graficas', 'Cliente KPI', 'Proyecto KPI', 10,
      5000, 50, 'Tecnico Graficas', '2026-12-01',
      'En Proceso', 'Bajo', '2026-03-15 10:00:00', '2026-03-15 10:00:00', ?, ?, ?
    )
  `).run(`KPI-${suffix}`, vend.lastInsertRowid, tech.lastInsertRowid, '2026-06-30');
  const projectId = projectInsert.lastInsertRowid;

  db.prepare(
    `INSERT INTO kpi_manual_quote_captures (
      year, month, department, employee_id, employee_name_snapshot,
      quotes_sent_count, quoted_amount_original, currency, exchange_rate_to_mxn, quoted_amount_mxn,
      created_at, updated_at
    ) VALUES (2026, 3, 'Ventas', ?, 'Vendedor Graficas', 10, 100000, 'MXN', 1, 100000, datetime('now'), datetime('now'))`,
  ).run(vend.lastInsertRowid);

  db.prepare(
    `INSERT INTO project_reports (
      project_id, report_folio, report_type, client_name, service_name, report_date,
      executed_by_employee_id, technician_name, created_at, updated_at
    ) VALUES (?, ?, 'boiler_startup', 'Cliente KPI', 'Servicio', '2026-03-20', ?, 'Tecnico Graficas', datetime('now'), datetime('now'))`,
  ).run(projectId, `REP-KPI-${suffix}`, tech.lastInsertRowid);

  const projects = [{
    id: projectId,
    client_name: 'Cliente KPI',
    created_at: '2026-03-15 10:00:00',
    closed_at: '2026-03-20 12:00:00',
    vendedor_id: vend.lastInsertRowid,
    tecnico_id: tech.lastInsertRowid,
    fecha_vencimiento: '2026-06-30',
    expected_margin: 25,
    totals: { pending_collection: 2000, total_invoiced_mxn: 5000, final_margin: 0.3, total_charged: 3000 },
    payments: [{ amount: 3000, currency: 'MXN', payment_date: '2026-03-25' }],
  }];

  const reports = db.prepare('SELECT r.*, e.full_name AS executed_by_name FROM project_reports r LEFT JOIN employees e ON e.id = r.executed_by_employee_id WHERE r.project_id = ?').all(projectId);
  const ventasSellers = getVentasEmpleadosActivos(db);
  const employees = [
    { employeeId: tech.lastInsertRowid, fullName: 'Tecnico Graficas', kpiDepartment: 'Técnico', kpiEligible: true },
    { employeeId: vend.lastInsertRowid, fullName: 'Vendedor Graficas', kpiDepartment: 'Ventas', kpiEligible: true },
  ];
  const manualQuotes = db.prepare('SELECT * FROM kpi_manual_quote_captures WHERE employee_id = ?').all(vend.lastInsertRowid);

  const charts = computeKpiCharts(db, {
    projects,
    period,
    manualQuotes,
    exchangeRates,
    reports,
    employees,
    ventasSellers,
    filters: { department: null, employeeId: null, employee: null },
  });

  assert.ok(Array.isArray(charts.monthly_trend));
  assert.ok(charts.monthly_trend.length > 0);
  const marchTrend = charts.monthly_trend.find((t) => t.label === '03/2026');
  assert.ok(marchTrend);
  assert.ok(marchTrend.sold_amount_mxn >= 5000);
  assert.ok(charts.receivable_buckets.some((b) => b.label === 'Por vencer'));
  assert.ok(charts.seller_close_rates.length >= 1);
  assert.strictEqual(charts.employee_comparison.mode, 'seller_sold_amount');
  assert.ok(Array.isArray(ventasSellers));
  assert.ok(ventasSellers.length >= 1);

  const ventasCharts = computeVentasChartData({
    quoted_amount_mxn: { value: 100000 },
    sold_amount_mxn: { value: 50000 },
    collected_amount_mxn: { value: 30000 },
    sellers_table: [{
      full_name: 'Vendedor Graficas',
      sold_amount_mxn: 5000,
      quoted_amount_mxn: 100000,
      margin_gap_points: 2,
      has_sold_data: true,
      avg_desired_margin: 25,
    }],
  }, charts);
  assert.ok(ventasCharts.sales_funnel.stages.length >= 2);
  assert.ok(ventasCharts.seller_ranking.length >= 1);
  assert.ok(ventasCharts.margin_gap_by_seller.length >= 1);
  assert.ok(ventasCharts.monthly_trend.length > 0);
  assert.strictEqual(resolveProjectDueDate({ fecha_vencimiento: '2026-01-01' }), '2026-01-01');
});
