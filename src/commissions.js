'use strict';

const { buildProjectTotals, roundMoney } = require('./calculations');
const { sqlYearExpr, sqlMonthExpr, sqlDateCompareGte, sqlDateCompareLte } = require('./db/dialect');

const PROJECT_COMMISSION_BASE_TYPES = ['facturado_1pct', 'facturado_3pct', 'monto_manual'];

function loadExchangeRates(db) {
  const rates = { MXN: 1 };
  db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all().forEach((row) => {
    rates[row.currency] = row.rate_to_mxn;
  });
  return rates;
}

function mapProjectForCommission(db, project, rates) {
  const payments = db.prepare('SELECT amount, currency FROM project_payments WHERE project_id = ?').all(project.id);
  const costs = db.prepare('SELECT amount, currency FROM project_costs WHERE project_id = ?').all(project.id);
  const totals = buildProjectTotals(project, payments, costs, rates);
  const totalCostsMxn = totals.spent;
  const totalSaleMxn = totals.total_invoiced_mxn;
  const grossProfitMxn = roundMoney(totalSaleMxn - totalCostsMxn);
  const finalMargin = totals.final_margin;
  const marginPercent =
    finalMargin != null ? roundMoney(finalMargin * 100) : totalSaleMxn > 0 ? roundMoney((grossProfitMxn / totalSaleMxn) * 100) : 0;
  return {
    id: project.id,
    quote_number: project.quote_number,
    order_number: project.order_number,
    client_name: project.client_name,
    project_description: project.project_description,
    closed_at: project.closed_at,
    seller: project.seller,
    total_sale_mxn: totalSaleMxn,
    total_costs_mxn: totalCostsMxn,
    gross_profit_mxn: grossProfitMxn,
    net_profit_mxn: grossProfitMxn,
    final_margin: finalMargin,
    margin: marginPercent,
  };
}

function calculateProjectCommission(baseType, totalSaleMxn, manualAmountMxn) {
  if (baseType === 'facturado_1pct') {
    return {
      commissionBaseMxn: totalSaleMxn,
      commissionPercentage: 1,
      commissionAmountMxn: roundMoney(totalSaleMxn * 0.01),
    };
  }
  if (baseType === 'facturado_3pct') {
    return {
      commissionBaseMxn: totalSaleMxn,
      commissionPercentage: 3,
      commissionAmountMxn: roundMoney(totalSaleMxn * 0.03),
    };
  }
  if (baseType === 'monto_manual') {
    const amount = roundMoney(manualAmountMxn);
    return {
      commissionBaseMxn: amount,
      commissionPercentage: 0,
      commissionAmountMxn: amount,
    };
  }
  return null;
}

function commissionBaseLabel(baseType) {
  const labels = {
    facturado_1pct: '1% sobre facturado',
    facturado_3pct: '3% sobre facturado',
    monto_manual: 'Monto manual',
    total_sale_mxn: 'Facturado (legacy)',
    gross_profit_mxn: 'Utilidad bruta (legacy)',
    net_profit_mxn: 'Utilidad neta (legacy)',
    no_aplica: 'No aplica (legacy)',
  };
  return labels[baseType] || baseType;
}

function mapCommissionListRow(row) {
  const finalMargin = row.final_margin_snapshot;
  const marginPercent =
    finalMargin != null ? roundMoney(Number(finalMargin) * 100) : row.total_sale_mxn_snapshot > 0
      ? roundMoney((row.gross_profit_mxn_snapshot / row.total_sale_mxn_snapshot) * 100)
      : null;
  const isExtra = row.commission_type === 'extraordinaria';
  return {
    ...row,
    final_margin: finalMargin,
    final_margin_percent: marginPercent,
    commission_base_label: commissionBaseLabel(row.commission_calculation_base_type),
    display_quote: isExtra ? 'Extraordinaria' : (row.quote_number || '—'),
    display_client: isExtra ? (row.notes || '—') : (row.client_name || '—'),
    display_order: isExtra ? '—' : (row.order_number || '—'),
  };
}

const MONTH_LABELS = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function parseCommissionsPeriod(query = {}) {
  const year = query.year != null && query.year !== '' ? Number(query.year) : null;
  const month = query.month != null && query.month !== '' ? Number(query.month) : null;
  if (year && month >= 1 && month <= 12) {
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      filtered: true,
      year,
      month,
      period_label: `${MONTH_LABELS[month]} ${year}`,
      date_start: `${year}-${pad(month)}-01`,
      date_end: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }
  return { filtered: false, period_label: 'Acumulado (todos los meses)' };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildCommissionsDashboard(db, period) {
  const globalPending = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(commission_amount_mxn), 0) as total
       FROM sales_commissions
       WHERE deleted_at IS NULL AND status = 'pendiente'`,
    ).get().total,
  );

  let assignedWhere = "sc.deleted_at IS NULL AND sc.status != 'cancelada'";
  let assignedParams = [];
  let paidWhere = 'scp.deleted_at IS NULL';
  let paidParams = [];

  if (period.filtered) {
    assignedWhere += ` AND ${sqlDateCompareGte('sc.assigned_at')} AND ${sqlDateCompareLte('sc.assigned_at')}`;
    assignedParams = [period.date_start, period.date_end];
    paidWhere += ` AND ${sqlDateCompareGte('scp.payment_date')} AND ${sqlDateCompareLte('scp.payment_date')}`;
    paidParams = [period.date_start, period.date_end];
  }

  const soldMxn = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN sc.project_id IS NOT NULL THEN sc.total_sale_mxn_snapshot ELSE 0 END), 0) as total
       FROM sales_commissions sc WHERE ${assignedWhere}`,
    ).get(...assignedParams).total,
  );
  const commissionsGeneratedMxn = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(sc.commission_amount_mxn), 0) as total
       FROM sales_commissions sc WHERE ${assignedWhere}`,
    ).get(...assignedParams).total,
  );
  const commissionsPaidMxn = roundMoney(
    db.prepare(
      `SELECT COALESCE(SUM(scp.amount_mxn), 0) as total
       FROM sales_commission_payments scp WHERE ${paidWhere}`,
    ).get(...paidParams).total,
  );

  const assignedByMonth = db.prepare(
    `SELECT ${sqlYearExpr('sc.assigned_at')} as year,
            ${sqlMonthExpr('sc.assigned_at')} as month,
            COALESCE(SUM(CASE WHEN sc.project_id IS NOT NULL THEN sc.total_sale_mxn_snapshot ELSE 0 END), 0) as sold_mxn,
            COALESCE(SUM(sc.commission_amount_mxn), 0) as commissions_generated_mxn
     FROM sales_commissions sc
     WHERE sc.deleted_at IS NULL AND sc.status != 'cancelada'
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 DESC
     LIMIT 24`,
  ).all();

  const paidByMonth = db.prepare(
    `SELECT ${sqlYearExpr('scp.payment_date')} as year,
            ${sqlMonthExpr('scp.payment_date')} as month,
            COALESCE(SUM(scp.amount_mxn), 0) as commissions_paid_mxn
     FROM sales_commission_payments scp
     WHERE scp.deleted_at IS NULL
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 DESC
     LIMIT 24`,
  ).all();

  const paidMap = new Map(paidByMonth.map((r) => [monthKey(r.year, r.month), r.commissions_paid_mxn]));
  const monthlySeries = assignedByMonth.map((row) => ({
    year: row.year,
    month: row.month,
    month_label: `${MONTH_LABELS[row.month]} ${row.year}`,
    sold_mxn: roundMoney(row.sold_mxn),
    commissions_generated_mxn: roundMoney(row.commissions_generated_mxn),
    commissions_paid_mxn: roundMoney(paidMap.get(monthKey(row.year, row.month)) || 0),
  }));

  const agents = db.prepare(
    `SELECT sca.id, sca.name, sca.active, e.full_name as employee_name
     FROM sales_commission_agents sca
     LEFT JOIN employees e ON e.id = sca.employee_id
     WHERE sca.deleted_at IS NULL
     ORDER BY sca.name`,
  ).all();

  const agentsWithProjects = agents.map((agent) => {
    const pendingRow = db.prepare(
      `SELECT COALESCE(SUM(commission_amount_mxn), 0) as total, COUNT(*) as cnt
       FROM sales_commissions
       WHERE sales_agent_id = ? AND deleted_at IS NULL AND status = 'pendiente'`,
    ).get(agent.id);
    const assignments = db.prepare(
      `SELECT sc.id, sc.project_id, sc.commission_type, sc.status, sc.commission_amount_mxn,
              sc.total_sale_mxn_snapshot, sc.assigned_at, sc.commission_calculation_base_type, sc.notes,
              p.quote_number, p.client_name, p.order_number
       FROM sales_commissions sc
       LEFT JOIN projects p ON p.id = sc.project_id
       WHERE sc.sales_agent_id = ? AND sc.deleted_at IS NULL AND sc.status = 'pendiente'
       ORDER BY sc.assigned_at DESC`,
    ).all(agent.id);
    return {
      ...agent,
      pending_commissions_mxn: roundMoney(pendingRow.total),
      pending_commissions_count: pendingRow.cnt,
      assigned_projects: assignments.map((sc) => ({
        commission_id: sc.id,
        commission_type: sc.commission_type,
        status: sc.status,
        quote_number: sc.commission_type === 'extraordinaria' ? 'Extraordinaria' : (sc.quote_number || '—'),
        client_name: sc.commission_type === 'extraordinaria' ? (sc.notes || '—') : (sc.client_name || '—'),
        order_number: sc.order_number || '—',
        sold_mxn: roundMoney(sc.total_sale_mxn_snapshot || 0),
        commission_mxn: roundMoney(sc.commission_amount_mxn),
        commission_base_label: commissionBaseLabel(sc.commission_calculation_base_type),
        assigned_at: sc.assigned_at,
      })),
    };
  }).filter((a) => a.pending_commissions_count > 0);

  return {
    period,
    totals: {
      period_label: period.period_label,
      sold_mxn: soldMxn,
      commissions_generated_mxn: commissionsGeneratedMxn,
      commissions_paid_mxn: commissionsPaidMxn,
      commissions_pending_mxn: globalPending,
    },
    monthly_series: monthlySeries,
    agents_with_projects: agentsWithProjects,
  };
}

module.exports = {
  PROJECT_COMMISSION_BASE_TYPES,
  MONTH_LABELS,
  loadExchangeRates,
  mapProjectForCommission,
  calculateProjectCommission,
  commissionBaseLabel,
  mapCommissionListRow,
  parseCommissionsPeriod,
  buildCommissionsDashboard,
};
