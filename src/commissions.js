'use strict';

const { buildProjectTotals, roundMoney } = require('./calculations');

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

module.exports = {
  PROJECT_COMMISSION_BASE_TYPES,
  loadExchangeRates,
  mapProjectForCommission,
  calculateProjectCommission,
  commissionBaseLabel,
  mapCommissionListRow,
};
