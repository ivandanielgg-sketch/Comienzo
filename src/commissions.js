'use strict';

const { buildProjectTotals, roundMoney } = require('./calculations');

function loadExchangeRates(db) {
  const rates = { MXN: 1 };
  db.prepare('SELECT currency, rate_to_mxn FROM exchange_rates').all().forEach((row) => {
    rates[row.currency] = row.rate_to_mxn;
  });
  return rates;
}

function projectCostsMxn(db, projectId, rates) {
  return roundMoney(
    db
      .prepare(
        `SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN ? WHEN 'EUR' THEN ? ELSE 1 END), 0) as t
         FROM project_costs WHERE project_id = ?`,
      )
      .get(rates.USD || 17, rates.EUR || 19, projectId).t,
  );
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

function sumAgentBalanceAdjustments(db, agentId) {
  return roundMoney(
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_mxn), 0) as total
         FROM sales_commission_balance_adjustments
         WHERE sales_agent_id = ? AND deleted_at IS NULL`,
      )
      .get(agentId).total,
  );
}

module.exports = {
  loadExchangeRates,
  mapProjectForCommission,
  projectCostsMxn,
  sumAgentBalanceAdjustments,
};
