'use strict';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function convertToMXN(amount, currency, exchangeRateToMXN) {
  if (!amount) return 0;
  const rate = currency === 'MXN' ? 1 : Number(exchangeRateToMXN || 1);
  return roundMoney(Number(amount) * rate);
}

function calculateFinancialStatement(data, settings) {
  const {
    projects = [],
    projectCosts = [],
    accountsPayable = [],
    bankMovements = [],
    manualPayroll = [],
    adjustments = [],
  } = data;

  const isrRate = Number(settings.estimated_isr_rate || 0.10);
  const ivanRate = Number(settings.ivan_commission_rate || 0.10);

  // Revenue: sum of project amounts in MXN
  const revenueNetMXN = roundMoney(
    projects.reduce((sum, p) => {
      const mxn = Number(p.amount_mxn || p.total_invoiced_mxn || p.total_invoiced || 0);
      return sum + mxn;
    }, 0),
  );

  // Cost of sales: direct project costs + classified bank egress to projects + AP classified as direct cost
  const directProjectCosts = roundMoney(
    projectCosts.reduce((sum, c) => sum + convertToMXN(c.amount, c.currency, c.exchange_rate_to_mxn || 1), 0),
  );

  const directCostCategories = ['Compra de materiales', 'Refacciones', 'Herramientas', 'Servicios externos', 'Fletes', 'Aduanales'];
  const apDirectCosts = roundMoney(
    accountsPayable
      .filter((ap) => directCostCategories.includes(ap.category) || ap.related_project_id)
      .reduce((sum, ap) => sum + Number(ap.amount_mxn || 0), 0),
  );

  const bankEgressToProjects = roundMoney(
    bankMovements
      .filter((m) => m.classification_status === 'clasificado' && (m.classification_type === 'egreso_proyecto') && m.withdrawal_mxn > 0)
      .reduce((sum, m) => sum + Number(m.withdrawal_mxn || 0), 0),
  );

  const costAdjustments = roundMoney(
    adjustments
      .filter((a) => a.adjustment_type === 'costo_de_venta' && a.status === 'activo')
      .reduce((sum, a) => sum + Number(a.amount_mxn || 0), 0),
  );

  const costOfSalesMXN = roundMoney(directProjectCosts + apDirectCosts + bankEgressToProjects + costAdjustments);

  // Gross profit
  const grossProfitMXN = roundMoney(revenueNetMXN - costOfSalesMXN);

  // Operating expenses
  const payrollTotal = roundMoney(
    manualPayroll.reduce((sum, p) => sum + Number(p.amount_mxn || 0), 0),
  );

  const operatingCategories = ['Hotel', 'Vuelos', 'Gasolina', 'Vehículo', 'Renta', 'Servicios', 'Nómina', 'Impuestos', 'Gastos bancarios', 'Otros'];
  const apOperating = roundMoney(
    accountsPayable
      .filter((ap) => operatingCategories.includes(ap.category) && !ap.related_project_id)
      .reduce((sum, ap) => sum + Number(ap.amount_mxn || 0), 0),
  );

  const bankOperatingExpenses = roundMoney(
    bankMovements
      .filter((m) => m.classification_status === 'clasificado' && ['nomina', 'gasto_operativo', 'gasto_bancario', 'impuesto'].includes(m.classification_type))
      .reduce((sum, m) => sum + Number(m.withdrawal_mxn || 0), 0),
  );

  const expenseAdjustments = roundMoney(
    adjustments
      .filter((a) => a.adjustment_type === 'gasto_operativo' && a.status === 'activo')
      .reduce((sum, a) => sum + Number(a.amount_mxn || 0), 0),
  );

  const operatingExpensesMXN = roundMoney(payrollTotal + apOperating + bankOperatingExpenses + expenseAdjustments);

  // Net administrative profit
  const netAdministrativeProfitMXN = roundMoney(grossProfitMXN - operatingExpensesMXN);

  // ISR estimated
  const estimatedISRMXN = netAdministrativeProfitMXN > 0 ? roundMoney(netAdministrativeProfitMXN * isrRate) : 0;

  // Profit after ISR
  const profitAfterISRMXN = roundMoney(netAdministrativeProfitMXN - estimatedISRMXN);

  // Ivan commission
  const ivanCommissionMXN = profitAfterISRMXN > 0 ? roundMoney(profitAfterISRMXN * ivanRate) : 0;

  // Real administrative profit
  const realAdministrativeProfitMXN = roundMoney(profitAfterISRMXN - ivanCommissionMXN);

  // Bank summary
  const bankInitialBalanceMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.initial_balance_mxn || 0), 0),
  );
  const bankDepositsMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.deposits_mxn || 0), 0),
  );
  const bankWithdrawalsMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.withdrawals_mxn || 0), 0),
  );
  const bankFinalBalanceMXN = roundMoney(
    (data.bankSummaries || []).reduce((sum, b) => sum + Number(b.final_balance_mxn || 0), 0),
  );

  // Unclassified movements count
  const unclassifiedCount = bankMovements.filter((m) => m.classification_status === 'sin_clasificar').length;

  // Accounts receivable (from project pending collection)
  const accountsReceivableMXN = roundMoney(
    (data.accountsReceivable || []).reduce((sum, ar) => sum + Number(ar.pending_mxn || 0), 0),
  );

  // Accounts payable total (pending only)
  const accountsPayableMXN = roundMoney(
    accountsPayable
      .filter((ap) => ap.status === 'pendiente')
      .reduce((sum, ap) => sum + Number(ap.amount_mxn || 0), 0),
  );

  // Income adjustments
  const incomeAdjustments = roundMoney(
    adjustments
      .filter((a) => a.adjustment_type === 'ingreso' && a.status === 'activo')
      .reduce((sum, a) => sum + Number(a.amount_mxn || 0), 0),
  );

  const finalRevenue = roundMoney(revenueNetMXN + incomeAdjustments);
  const finalGross = roundMoney(finalRevenue - costOfSalesMXN);
  const finalNet = roundMoney(finalGross - operatingExpensesMXN);
  const finalISR = finalNet > 0 ? roundMoney(finalNet * isrRate) : 0;
  const finalAfterISR = roundMoney(finalNet - finalISR);
  const finalIvan = finalAfterISR > 0 ? roundMoney(finalAfterISR * ivanRate) : 0;
  const finalReal = roundMoney(finalAfterISR - finalIvan);

  return {
    revenue_net_mxn: finalRevenue,
    cost_of_sales_mxn: costOfSalesMXN,
    gross_profit_mxn: finalGross,
    operating_expenses_mxn: operatingExpensesMXN,
    net_administrative_profit_mxn: finalNet,
    estimated_isr_mxn: finalISR,
    profit_after_isr_mxn: finalAfterISR,
    ivan_commission_mxn: finalIvan,
    real_administrative_profit_mxn: finalReal,
    accounts_receivable_mxn: accountsReceivableMXN,
    accounts_payable_mxn: accountsPayableMXN,
    bank_initial_balance_mxn: bankInitialBalanceMXN,
    bank_deposits_mxn: bankDepositsMXN,
    bank_withdrawals_mxn: bankWithdrawalsMXN,
    bank_final_balance_mxn: bankFinalBalanceMXN,
    unclassified_movements_count: unclassifiedCount,
  };
}

const AP_CATEGORIES = [
  'Compra de materiales',
  'Refacciones',
  'Herramientas',
  'Servicios externos',
  'Fletes',
  'Aduanales',
  'Hotel',
  'Vuelos',
  'Gasolina',
  'Vehículo',
  'Renta',
  'Servicios',
  'Nómina',
  'Impuestos',
  'Gastos bancarios',
  'Otros',
];

const CLASSIFICATION_TYPES = [
  'ingreso_proyecto',
  'egreso_proyecto',
  'nomina',
  'proveedor_cxp',
  'gasto_operativo',
  'gasto_bancario',
  'impuesto',
  'traspaso',
  'saldo_a_favor',
  'prestamo',
  'ajuste',
  'ignorar',
];

const ADJUSTMENT_TYPES = [
  'ingreso',
  'costo_de_venta',
  'gasto_operativo',
  'impuesto',
  'comision_ivan',
  'banco',
  'otro',
];

module.exports = {
  calculateFinancialStatement,
  convertToMXN,
  roundMoney,
  AP_CATEGORIES,
  CLASSIFICATION_TYPES,
  ADJUSTMENT_TYPES,
};
