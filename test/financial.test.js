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

test('calculateFinancialStatement bank classified movements affect results', () => {
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
  assert.equal(result.operating_expenses_mxn, 10000);
  assert.equal(result.unclassified_movements_count, 1);
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
