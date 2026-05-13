const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProjectTotals, roundMoney, sumAmounts } = require('../src/calculations');

test('sumAmounts totals entries and rounds money', () => {
  assert.equal(sumAmounts([{ amount: 10.105 }, { amount: '5.205' }]), 15.31);
});

test('buildProjectTotals calculates charged, spent, pending and final margin', () => {
  const project = { total_invoiced: 1000 };
  const payments = [{ amount: 200 }, { amount: 125.5 }];
  const costs = [{ amount: 350 }, { amount: 100 }];

  assert.deepEqual(buildProjectTotals(project, payments, costs), {
    total_charged: 325.5,
    spent: 450,
    total_invoiced: 1000,
    pending_collection: 674.5,
    final_margin: 0.55,
  });
});

test('buildProjectTotals leaves final margin empty when project has no invoice', () => {
  assert.equal(buildProjectTotals({ total_invoiced: 0 }).final_margin, null);
});

test('roundMoney avoids common floating point pennies', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});
