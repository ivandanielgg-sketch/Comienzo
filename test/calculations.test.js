const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildProjectTotals,
  convertAmountToMxn,
  roundMoney,
  sumAmounts,
} = require('../src/calculations');

test('sumAmounts totals entries and rounds money', () => {
  assert.equal(sumAmounts([{ amount: 10.105 }, { amount: '5.205' }]), 15.32);
});

test('buildProjectTotals calculates charged, spent, pending and final margin in MXN', () => {
  const project = { total_invoiced: 100, total_invoiced_currency: 'USD' };
  const payments = [{ amount: 200 }, { amount: 10, currency: 'USD' }];
  const costs = [{ amount: 350 }, { amount: 5, currency: 'EUR' }];
  const exchangeRates = { USD: 20, EUR: 22 };

  assert.deepEqual(buildProjectTotals(project, payments, costs, exchangeRates), {
    total_charged: 400,
    spent: 460,
    total_invoiced_mxn: 2000,
    pending_collection: 1600,
    final_margin: 0.77,
  });
});

test('buildProjectTotals leaves final margin empty when project has no invoice', () => {
  assert.equal(buildProjectTotals({ total_invoiced: 0 }).final_margin, null);
});

test('convertAmountToMxn converts currencies with provided exchange rates', () => {
  assert.equal(convertAmountToMxn(120, 'USD', { USD: 17.25 }), 2070);
});

test('roundMoney avoids common floating point pennies', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});
