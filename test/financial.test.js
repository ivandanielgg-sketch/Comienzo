const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFinancialStatement } = require('../src/financial');

test('calculateFinancialStatement with empty data returns zeros', () => {
  const result = calculateFinancialStatement({}, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.equal(result.revenue_net_mxn, 0);
  assert.equal(result.cost_of_sales_mxn, 0);
  assert.equal(result.gross_profit_mxn, 0);
  assert.equal(result.operating_expenses_mxn, 0);
  assert.equal(result.net_administrative_profit_mxn, 0);
  assert.equal(result.estimated_isr_mxn, 0);
  assert.equal(result.ivan_commission_mxn, 0);
  assert.equal(result.real_administrative_profit_mxn, 0);
});

test('calculateFinancialStatement computes ISR at 10%', () => {
  const data = { projects: [{ amount_mxn: 100000 }] };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.equal(result.revenue_net_mxn, 100000);
  assert.equal(result.gross_profit_mxn, 100000);
  assert.equal(result.net_administrative_profit_mxn, 100000);
  assert.equal(result.estimated_isr_mxn, 10000);
  assert.equal(result.profit_after_isr_mxn, 90000);
  assert.equal(result.ivan_commission_mxn, 9000);
  assert.equal(result.real_administrative_profit_mxn, 81000);
});

test('calculateFinancialStatement does not call commission IVA', () => {
  const data = { projects: [{ amount_mxn: 50000 }] };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.ok(!('iva_10' in result));
  assert.ok('ivan_commission_mxn' in result);
});

test('calculateFinancialStatement includes payroll in operating expenses', () => {
  const data = {
    projects: [{ amount_mxn: 200000 }],
    manualPayroll: [{ amount_mxn: 30000 }, { amount_mxn: 20000 }],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.equal(result.operating_expenses_mxn, 50000);
  assert.equal(result.net_administrative_profit_mxn, 150000);
});

test('calculateFinancialStatement handles project costs as cost of sales', () => {
  const data = {
    projects: [{ amount_mxn: 100000 }],
    projectCosts: [{ amount: 20000, currency: 'MXN' }, { amount: 5000, currency: 'USD', exchange_rate_to_mxn: 17 }],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0 });
  assert.equal(result.cost_of_sales_mxn, 105000);
  assert.equal(result.gross_profit_mxn, -5000);
});

test('calculateFinancialStatement accounts payable with project = cost of sales', () => {
  const data = {
    projects: [{ amount_mxn: 500000 }],
    accountsPayable: [{ amount_mxn: 30000, category: 'Compra de materiales', related_project_id: 1, status: 'pendiente' }],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.equal(result.cost_of_sales_mxn, 30000);
  assert.equal(result.gross_profit_mxn, 470000);
});

test('calculateFinancialStatement bank operating classifications do not affect OpEx', () => {
  const data = {
    projects: [{ amount_mxn: 200000 }],
    bankMovements: [
      { classification_status: 'clasificado', classification_type: 'egreso_proyecto', withdrawal_mxn: 50000, deposit_mxn: 0 },
      { classification_status: 'clasificado', classification_type: 'gasto_operativo', withdrawal_mxn: 10000, deposit_mxn: 0 },
      { classification_status: 'sin_clasificar', classification_type: null, withdrawal_mxn: 5000, deposit_mxn: 0 },
    ],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0 });
  assert.equal(result.cost_of_sales_mxn, 50000);
  // Bank gasto_operativo is no longer counted in OpEx (captured ledger is source of truth)
  assert.equal(result.operating_expenses_mxn, 0);
  assert.equal(result.unclassified_movements_count, 1);
});

test('calculateFinancialStatement AP operating categories do not affect OpEx', () => {
  const data = {
    projects: [{ amount_mxn: 100000 }],
    accountsPayable: [
      { amount_mxn: 8000, category: 'Gasolina', related_project_id: null, status: 'pendiente' },
      { amount_mxn: 12000, category: 'Renta', related_project_id: null, status: 'pendiente' },
    ],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0, ivan_commission_rate: 0 });
  assert.equal(result.operating_expenses_mxn, 0);
  assert.equal(result.accounts_payable_mxn, 20000);
});

test('calculateFinancialStatement unclassified movements do not affect totals', () => {
  const data = {
    projects: [{ amount_mxn: 100000 }],
    bankMovements: [
      { classification_status: 'sin_clasificar', classification_type: null, withdrawal_mxn: 99999, deposit_mxn: 0 },
    ],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0, ivan_commission_rate: 0 });
  assert.equal(result.cost_of_sales_mxn, 0);
  assert.equal(result.operating_expenses_mxn, 0);
  assert.equal(result.net_administrative_profit_mxn, 100000);
  assert.equal(result.unclassified_movements_count, 1);
});

test('calculateFinancialStatement adjustments add to correct category', () => {
  const data = {
    projects: [{ amount_mxn: 100000 }],
    adjustments: [
      { adjustment_type: 'ingreso', amount_mxn: 20000, status: 'activo' },
      { adjustment_type: 'gasto_operativo', amount_mxn: 5000, status: 'activo' },
      { adjustment_type: 'costo_de_venta', amount_mxn: 10000, status: 'activo' },
      { adjustment_type: 'ingreso', amount_mxn: 3000, status: 'cancelado' },
    ],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0, ivan_commission_rate: 0 });
  assert.equal(result.revenue_net_mxn, 120000);
  assert.equal(result.cost_of_sales_mxn, 10000);
  assert.equal(result.operating_expenses_mxn, 5000);
  assert.equal(result.net_administrative_profit_mxn, 105000);
});

test('calculateFinancialStatement negative profit means no ISR and no Ivan', () => {
  const data = {
    projects: [{ amount_mxn: 50000 }],
    projectCosts: [{ amount: 80000, currency: 'MXN' }],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.equal(result.net_administrative_profit_mxn, -30000);
  assert.equal(result.estimated_isr_mxn, 0);
  assert.equal(result.ivan_commission_mxn, 0);
  assert.equal(result.real_administrative_profit_mxn, -30000);
});

test('July 2026 OpEx capture totals 785439.18 with breakdown', () => {
  const data = {
    projects: [{ amount_mxn: 2000000 }],
    manualPayroll: [
      { amount_mxn: 64193.33, week_number: 1 },
      { amount_mxn: 63450.00, week_number: 2 },
      { amount_mxn: 63450.00, week_number: 3 },
      { amount_mxn: 63450.00, week_number: 4 },
      { amount_mxn: 63450.00, week_number: 5 },
    ],
    operatingExpenses: [
      { category: 'IMSS/ISN', amount_mxn: 171672.00 },
      { category: 'Efectivo', amount_mxn: 187921.31 },
      { category: 'Servicios', amount_mxn: 2815.30 },
      { category: 'Renta', amount_mxn: 7400.00 },
      { category: 'Vehículo', amount_mxn: 9135.34 },
      { category: 'Mantenimiento', amount_mxn: 17465.52 },
      { category: 'Capacitación', amount_mxn: 53095.00 },
      { category: 'Gasolina', amount_mxn: 17941.38 },
    ],
  };
  const result = calculateFinancialStatement(data, { estimated_isr_rate: 0.10, ivan_commission_rate: 0.10 });
  assert.equal(result.operating_expenses_mxn, 785439.18);
  assert.equal(result.operating_expenses_breakdown.payroll_mxn, 317993.33);
  assert.equal(result.operating_expenses_breakdown.other_total_mxn, 467445.85);
  assert.equal(result.operating_expenses_breakdown.other_by_category['IMSS/ISN'], 171672);
  assert.equal(result.operating_expenses_breakdown.other_by_category.Efectivo, 187921.31);
  assert.equal(result.net_administrative_profit_mxn, 1214560.82);
});
