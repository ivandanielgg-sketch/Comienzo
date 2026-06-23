const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculate,
  calcCO2Max,
  calcCO2Actual,
  excessAirFromO2,
  volumenGas,
  rhoAire,
  rhoCombustible,
  heatInputMW,
  chachitosInput,
  PHYSICAL,
} = require('../src/lib/combustion');

const TOL = 0.005; // ±0.5 %

function assertNear(actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(rel <= TOL, `${label}: expected ${expected}, got ${actual} (rel ${(rel * 100).toFixed(3)}%)`);
}

test('excess_air = O2/(21-O2)*100 — VERIFICADO', () => {
  assertNear(excessAirFromO2(4.04), 23.82, 'O2=4.04');
  assertNear(excessAirFromO2(3.0), 16.67, 'O2=3.0');
  assertNear(excessAirFromO2(7.0), 50.0, 'O2=7.0');
});

test('CO2_actual = CO2_max*(1-O2/21) — VERIFICADO', () => {
  const co2max = 12.09;
  assertNear(calcCO2Actual(co2max, 7.0), 8.06, 'CO2 @ O2=7');
  assertNear(calcCO2Actual(co2max, 3.0), 10.36, 'CO2 @ O2=3');
});

test('CO2_max molar CHACHITOS ≈ 12.09 %', () => {
  const comp = { C: 0.757, H: 0.235, S: 0, N: 0.008, O: 0, W: 0 };
  assertNear(calcCO2Max(comp), 12.09, 'CO2_max');
});

test('volumen = masa·R·T/P — CO2 CHACHITOS', () => {
  const T = 25 + 273.15;
  const P = 101.325;
  const vol = volumenGas(74401.05, 'CO2', T, P);
  assertNear(vol, 41355.12, 'CO2 volume');
});

test('rho_comb = SG·rho_aire reproduce heat input 0.593 MW', () => {
  const T = 25 + 273.15;
  const P = 101.33;
  const rhoAir = rhoAire(T, P);
  assertNear(rhoAir, 1.184, 'rho_aire', 0.01);
  const rhoFuel = rhoCombustible(0.63, T, P);
  const heat = heatInputMW(49.192, rhoFuel, 58.13);
  assertNear(heat, 0.593, 'heat input MW');
});

test('CHACHITOS escenario completo §6', () => {
  const result = calculate(chachitosInput());
  assert.equal(result.ok, true, result.errors?.join('; '));

  assertNear(result.fuel.CO2_max_pct, 12.09, 'CO2_max');
  assertNear(result.existing.o2_pct, 7.0, 'O2 exist');
  assertNear(result.projected.o2_pct, 3.0, 'O2 proy');
  assertNear(result.existing.co2_pct, 8.06, 'CO2 exist');
  assertNear(result.projected.co2_pct, 10.36, 'CO2 proy');

  assertNear(result.existing.efficiency.net_pct, 92.85, 'eff net exist');
  assertNear(result.existing.efficiency.gross_pct, 82.82, 'eff gross exist');
  assertNear(result.projected.efficiency.net_pct, 95.07, 'eff net proy');
  assertNear(result.projected.efficiency.gross_pct, 85.2, 'eff gross proy');

  assertNear(result.existing.consumption, 35910, 'consumo exist');
  assertNear(result.projected.consumption, 33860.45, 'consumo proy');
  assertNear(result.existing.fuel_flow_m3h, 49.192, 'fuel flow exist');
  assertNear(result.projected.fuel_flow_m3h, 46.384, 'fuel flow proy');
  assertNear(result.existing.heat_input_MW, 0.593, 'heat exist');
  assertNear(result.projected.heat_input_MW, 0.576, 'heat proy');

  assertNear(result.existing.emissions.CO2.masa_kg, 74401.05, 'CO2 masa exist');
  assertNear(result.existing.emissions.CO2.volumen_m3, 41355.12, 'CO2 vol exist');
  assertNear(result.projected.emissions.CO2.masa_kg, 70154.65, 'CO2 masa proy');
  assertNear(result.projected.emissions.CO2.volumen_m3, 38994.79, 'CO2 vol proy');

  assertNear(result.existing.emissions.H2O.masa_kg, 56723.45, 'H2O masa exist');
  assertNear(result.existing.emissions.H2O.volumen_m3, 77028.75, 'H2O vol exist');
  assertNear(result.projected.emissions.H2O.masa_kg, 53485.98, 'H2O masa proy');
  assertNear(result.projected.emissions.H2O.volumen_m3, 72632.31, 'H2O vol proy');

  assertNear(result.existing.emissions.N2.masa_kg, 516271.6, 'N2 masa exist');
  assertNear(result.existing.emissions.N2.volumen_m3, 450879.3, 'N2 vol exist');
  assertNear(result.projected.emissions.N2.masa_kg, 378671.5, 'N2 masa proy');
  assertNear(result.projected.emissions.N2.volumen_m3, 330708.0, 'N2 vol proy');

  assertNear(result.existing.emissions.O2.masa_kg, 46974.57, 'O2 masa exist');
  assertNear(result.existing.emissions.O2.volumen_m3, 35910.39, 'O2 vol exist');
  assertNear(result.projected.emissions.O2.masa_kg, 14764.5, 'O2 masa proy');
  assertNear(result.projected.emissions.O2.volumen_m3, 11286.94, 'O2 vol proy');

  assertNear(result.existing.emissions.total.masa_kg, 694370.6, 'total masa exist');
  assertNear(result.existing.emissions.total.volumen_m3, 605173.5, 'total vol exist');
  assertNear(result.projected.emissions.total.masa_kg, 517076.6, 'total masa proy');
  assertNear(result.projected.emissions.total.volumen_m3, 453622.0, 'total vol proy');

  assertNear(result.existing.fuel_cost, 164108.70, 'cost exist');
  assertNear(result.projected.fuel_cost, 154742.30, 'cost proy');

  assertNear(result.savings.emissions_savings_pct, 25.04, 'emissions savings');
  assertNear(result.savings.fuel_savings_pct, 5.71, 'fuel savings pct');
  assertNear(result.savings.fuel_savings_volume, 2049.549, 'fuel savings vol');
  assertNear(result.savings.fuel_cost_savings, 9366.44, 'fuel cost savings');
  assertNear(result.savings.efficiency_improvement_gross, 2.38, 'eff improve gross');
  // Mejora neta: tolerancia absoluta ±0.4 pp (Autoflame redondea eficiencias antes de restar)
  assert.ok(Math.abs(result.savings.efficiency_improvement_net - 2.23) <= 0.4, `eff improve net: ${result.savings.efficiency_improvement_net}`);
  assertNear(result.savings.exhaust_delta_improvement_c, 27.0, 'exhaust delta');
  assertNear(result.savings.stack_heat_loss_savings_MW, 0.02, 'stack heat loss');
});

test('validateInput rechaza composición inválida', () => {
  const r = calculate({
    fuel: { C: 0.5, H: 0.2, S: 0, N: 0, O: 0, W: 0 },
    consumption: { value: 1000, unit: 'm3', period: 'month' },
    existing: { o2_pct: 7, flue_temp_c: 200 },
    projected: { o2_pct: 3, flue_temp_c: 180 },
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('validateInput rechaza O2 >= 21', () => {
  const base = chachitosInput();
  base.existing.o2_pct = 21;
  const r = calculate(base);
  assert.equal(r.ok, false);
});
