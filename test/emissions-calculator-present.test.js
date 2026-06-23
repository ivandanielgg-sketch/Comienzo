const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ecBuildPeriodSavings,
  ecFormatMoney,
  ecBasePeriodToHourFactor,
  EC_HOURS_PER_MONTH,
  EC_HOURS_PER_YEAR,
} = require('../public/emissions-calculator-present');

const mockResult = {
  ok: true,
  savings: { fuel_savings_volume: 730, fuel_cost_savings: 3650 },
  existing: { emissions: { CO2: { masa_kg: 10000 } } },
  projected: { emissions: { CO2: { masa_kg: 9000 } } },
};

const mockInput = {
  consumption: { period: 'month', unit: 'm3' },
  currency: 'MXN',
  operation: { enabled: true, maintenance_annual: 8760, downtime_enabled: true, downtime_annual: 8760 },
};

test('ecBasePeriodToHourFactor month = 1/730', () => {
  assert.equal(ecBasePeriodToHourFactor('month'), 1 / EC_HOURS_PER_MONTH);
});

test('ecBuildPeriodSavings escala ahorro mensual base a hora/día/año', () => {
  const rows = ecBuildPeriodSavings(mockResult, { ...mockInput, operation: { enabled: false } });
  const month = rows.find((r) => r.key === 'month');
  const hour = rows.find((r) => r.key === 'hour');
  const year = rows.find((r) => r.key === 'year');

  assert.equal(month.fuelVolume, 730);
  assert.equal(month.fuelCost, 3650);
  assert.equal(month.co2Ton, 1);
  assert.ok(Math.abs(hour.fuelVolume - 730 / EC_HOURS_PER_MONTH) < 0.0001);
  assert.ok(Math.abs(year.fuelVolume - (730 / EC_HOURS_PER_MONTH) * EC_HOURS_PER_YEAR) < 0.01);
});

test('ecBuildPeriodSavings suma operación anual al ahorro total', () => {
  const rows = ecBuildPeriodSavings(mockResult, mockInput);
  const year = rows.find((r) => r.key === 'year');
  assert.equal(year.operationCost, 17520);
  assert.equal(year.totalCost, year.fuelCost + 17520);
});

test('ecFormatMoney incluye código de moneda sin conversión', () => {
  const s = ecFormatMoney(10467.42, 'MXN', 'es');
  assert.match(s, /MXN$/);
  assert.match(s, /10/);
});
