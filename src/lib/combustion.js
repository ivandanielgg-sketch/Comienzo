'use strict';

/**
 * Motor de cálculo de emisiones y ahorro de combustible — Autoflame Emissions Calculator 2020.
 * Módulo puro sin dependencias de UI. Comentarios en español.
 */

const { PHYSICAL, FUEL_LIBRARY, PERIOD_HOURS } = require('./combustionConstants');

const { O2_FRACCION_AIRE_MASA, RELACION_MOLAR_N2_O2, R, O2_AIRE } = PHYSICAL;

/** Redondeo a n decimales */
function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * f) / f;
}

/** Convierte °C → K */
function toKelvin(celsius) {
  return Number(celsius) + 273.15;
}

/** Normaliza composición del combustible a fracciones másicas (0–1) */
function normalizeComposition(raw) {
  const C = Number(raw.C || 0);
  const H = Number(raw.H || 0);
  const S = Number(raw.S || 0);
  const N = Number(raw.N || 0);
  const O = Number(raw.O || 0);
  const W = Number(raw.W || 0);
  const sum = C + H + S + N + O + W;
  if (sum <= 0) {
    return { C: 0, H: 0, S: 0, N: 0, O: 0, W: 0, sum: 0 };
  }
  if (Math.abs(sum - 1) > 0.02 && Math.abs(sum - 100) > 2) {
    return { C, H, S, N, O, W, sum, invalid: true };
  }
  const scale = sum > 1.5 ? 1 / 100 : 1;
  return {
    C: C * scale,
    H: H * scale,
    S: S * scale,
    N: N * scale,
    O: O * scale,
    W: W * scale,
    sum: sum * scale,
  };
}

/** Poder calorífico inferior (LHV) a partir del superior (HHV) y fracción H */
function calcLHV(hhv_MJ_kg, H_frac) {
  const waterFromH = 9 * H_frac;
  return hhv_MJ_kg - (waterFromH * PHYSICAL.LATENT_H2O_KJ_KG) / 1000;
}

/** Densidad del aire ideal (kg/m³) a T (K) y P (kPa) */
function rhoAire(T_K, P_kPa) {
  return P_kPa / (R.Aire * T_K);
}

/** Densidad del combustible gaseoso (kg/m³) */
function rhoCombustible(SG, T_K, P_kPa) {
  return SG * rhoAire(T_K, P_kPa);
}

/** O2 estequiométrico requerido (kg O2 / kg combustible) — §5.3 */
function o2Estequiometrico(comp) {
  return 2.664 * comp.C + 7.937 * comp.H + 0.998 * comp.S - comp.O;
}

/** Aire estequiométrico (kg aire / kg combustible) */
function aireEstequiometrico(o2Req) {
  return o2Req / O2_FRACCION_AIRE_MASA;
}

/** Exceso de aire (%) a partir de O2 medido en gases — §5.4 VERIFICADO */
function excessAirFromO2(O2_medido_pct) {
  if (O2_medido_pct >= O2_AIRE) return null;
  return (O2_medido_pct / (O2_AIRE - O2_medido_pct)) * 100;
}

/** O2 a partir de CO2 medido — §5.5 */
function o2FromCO2(CO2_medido_pct, CO2_max_pct) {
  if (CO2_max_pct <= 0) return null;
  return O2_AIRE * (1 - CO2_medido_pct / CO2_max_pct);
}

/** CO2 máximo estequiométrico (%) — §5.5 VERIFICADO */
function calcCO2Max(comp) {
  const nO2_estq = comp.C / 12 + comp.H / 4 + comp.S / 32 - comp.O / 32;
  const nCO2 = comp.C / 12;
  const nSO2 = comp.S / 32;
  const nN2 = RELACION_MOLAR_N2_O2 * nO2_estq + comp.N / 28;
  const nTotal = nCO2 + nSO2 + nN2;
  if (nTotal <= 0) return 0;
  return (nCO2 / nTotal) * 100;
}

/** CO2 actual (%) a partir de O2 medido — §5.5 VERIFICADO */
function calcCO2Actual(CO2_max_pct, O2_medido_pct) {
  return CO2_max_pct * (1 - O2_medido_pct / O2_AIRE);
}

/** Productos de combustión por kg de combustible — §5.6 */
function productosPorKg(comp, excess_air_pct) {
  const o2Req = o2Estequiometrico(comp);
  const airStoich = aireEstequiometrico(o2Req);
  const airTotal = airStoich * (1 + excess_air_pct / 100);

  return {
    m_CO2: 3.664 * comp.C,
    m_H2O: 9.0 * comp.H + comp.W,
    m_SO2: 1.998 * comp.S,
    m_CO: 0,
    m_O2: o2Req * (excess_air_pct / 100),
    m_N2: 0.768 * airTotal + comp.N,
    o2Req,
    airStoich,
    airTotal,
  };
}

/** Volumen de gas ideal a condiciones ambiente — §5.7 VERIFICADO */
function volumenGas(masa_kg, gasKey, T_K, P_kPa) {
  const rGas = R[gasKey];
  if (!rGas || masa_kg <= 0) return 0;
  return (masa_kg * rGas * T_K) / P_kPa;
}

/** Emisiones escaladas por masa total de combustible */
function emisionesEscaladas(productos, masaCombustible_kg, T_K, P_kPa, opts = {}) {
  const gases = ['CO2', 'H2O', 'SO2', 'CO', 'N2'];
  const result = {};
  let masaTotal = 0;
  let volTotal = 0;

  for (const gas of gases) {
    const key = `m_${gas}`;
    const masa = productos[key] * masaCombustible_kg;
    const vol = volumenGas(masa, gas, T_K, P_kPa);
    result[gas] = { masa_kg: masa, volumen_m3: vol };
    masaTotal += masa;
    volTotal += vol;
  }

  // Convención Autoflame para O2 en reporte: volumen proporcional al exceso de aire
  // referenciado al escenario existente (§6 CHACHITOS: vol_O2 = vol_combustible × excess/excess_ref)
  const rhoO2 = P_kPa / (R.O2 * T_K);
  let o2Vol;
  if (opts.fuelVolume_m3 != null && opts.excess_air_pct != null && opts.referenceExcess_pct != null) {
    o2Vol = opts.fuelVolume_m3 * (opts.excess_air_pct / opts.referenceExcess_pct);
  } else {
    const o2Masa = productos.m_O2 * masaCombustible_kg;
    o2Vol = volumenGas(o2Masa, 'O2', T_K, P_kPa);
    result.O2 = { masa_kg: o2Masa, volumen_m3: o2Vol };
    masaTotal += o2Masa;
    volTotal += o2Vol;
    result.total = { masa_kg: masaTotal, volumen_m3: volTotal };
    return result;
  }
  const o2Masa = o2Vol * rhoO2;
  result.O2 = { masa_kg: o2Masa, volumen_m3: o2Vol };
  masaTotal += o2Masa;
  volTotal += o2Vol;

  result.total = { masa_kg: masaTotal, volumen_m3: volTotal };
  return result;
}

/**
 * Pérdidas por chimenea por kg de combustible (kJ/kg) — §5.8
 * Balance entálpico: gases secos (sensible) + humedad (sensible + latente para bruta).
 */
function perdidasChimeneaPorKg(productos, T_flue_C, T_amb_C, includeLatent) {
  const deltaT = T_flue_C - T_amb_C;
  if (deltaT <= 0) return { sensibleDry: 0, moistureSensible: 0, latent: 0, total: 0 };

  const cpDry = PHYSICAL.CP_FLUE_DRY_KJ_KG_K;
  const cpH2O = PHYSICAL.CP_H2O_FLUE_KJ_KG_K;

  const masaSeca = productos.m_CO2 + productos.m_SO2 + productos.m_O2 + productos.m_N2 + productos.m_CO;
  const sensibleDry = masaSeca * cpDry * deltaT;
  const moistureSensible = productos.m_H2O * cpH2O * deltaT;
  const latent = includeLatent
    ? productos.m_H2O * PHYSICAL.LATENT_H2O_KJ_KG * PHYSICAL.LATENT_GROSS_FACTOR
    : 0;

  return {
    sensibleDry,
    moistureSensible,
    latent,
    total: sensibleDry + moistureSensible + latent,
  };
}

/** Eficiencia neta (LHV) y bruta (HHV) — §5.8 */
function calcularEficiencia(comp, CV_HHV, O2_pct, T_flue_C, T_amb_C) {
  const excess = excessAirFromO2(O2_pct);
  if (excess == null) return null;
  const prod = productosPorKg(comp, excess);
  const LHV = calcLHV(CV_HHV, comp.H);

  const lossNet = perdidasChimeneaPorKg(prod, T_flue_C, T_amb_C, false);
  const lossGross = perdidasChimeneaPorKg(prod, T_flue_C, T_amb_C, true);

  const QinNet_kJ = LHV * 1000;
  const QinGross_kJ = CV_HHV * 1000;

  const effNet = Math.max(0, (1 - lossNet.total / QinNet_kJ) * 100);
  const effGross = Math.max(0, (1 - lossGross.total / QinGross_kJ) * 100);

  return {
    net_pct: round(effNet, 2),
    gross_pct: round(effGross, 2),
    stack_loss_MW: null,
    deltaT: T_flue_C - T_amb_C,
    productos: prod,
    lossNet_kJ: lossNet.total,
    lossGross_kJ: lossGross.total,
  };
}

/** Convierte consumo al periodo base en m³/h */
function consumoAFuelFlow(consumo, unidad, periodo) {
  const val = Number(consumo);
  if (val <= 0) return 0;

  let m3PerHour;
  if (unidad === 'm3') {
    const horasPeriodo = PERIOD_HOURS[periodo] || PERIOD_HOURS.month;
    m3PerHour = val / horasPeriodo;
  } else if (unidad === 'kWh') {
    m3PerHour = 0;
  } else {
    m3PerHour = val;
  }
  return m3PerHour;
}

/** Heat input (MW) a partir de flujo volumétrico — §5.9 (CV en MJ/kg → MW = kg/s × MJ/kg) */
function heatInputMW(fuelFlow_m3h, rho_kg_m3, CV_MJ_kg) {
  const kgPerSec = (fuelFlow_m3h * rho_kg_m3) / 3600;
  return kgPerSec * CV_MJ_kg;
}

/**
 * Aplicación de ahorros MM/EGA de forma multiplicativa sobre consumo proyectado.
 * Orden: 1) consumo base proyectado por eficiencia, 2) MM, 3) EGA.
 */
function aplicarAhorrosAdicionales(consumoProyBase, mmEnabled, mmPct, egaEnabled, egaPct) {
  let result = consumoProyBase;
  const steps = [];
  if (mmEnabled && mmPct > 0) {
    result *= 1 - mmPct / 100;
    steps.push({ type: 'MM', pct: mmPct, consumo: result });
  }
  if (egaEnabled && egaPct > 0) {
    result *= 1 - egaPct / 100;
    steps.push({ type: 'EGA', pct: egaPct, consumo: result });
  }
  return { consumo: result, steps };
}

/** Validación de entradas */
function validateInput(input) {
  const errors = [];
  const comp = normalizeComposition(input.fuel || input.composition || {});

  if (comp.invalid || comp.sum <= 0) {
    errors.push('La composición del combustible debe sumar ~100% (C+H+S+N+O+W).');
  }

  const o2Exist = input.existing?.o2_pct ?? input.existing_o2;
  const o2Proj = input.projected?.o2_pct ?? input.projected_o2;

  if (o2Exist != null && Number(o2Exist) >= O2_AIRE) {
    errors.push('O2 existente debe ser menor a 21%.');
  }
  if (o2Proj != null && Number(o2Proj) >= O2_AIRE) {
    errors.push('O2 proyectado debe ser menor a 21%.');
  }

  if (Number(input.consumption?.value ?? input.consumption) <= 0) {
    errors.push('El consumo de combustible debe ser mayor a cero.');
  }

  return { valid: errors.length === 0, errors, composition: comp };
}

/**
 * Cálculo principal — entrada JSON → resultados completos.
 * @param {object} input - Parámetros de la calculadora
 * @returns {object} Resultados Existing / Projected / Savings
 */
function calculate(input) {
  const validation = validateInput(input);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const comp = validation.composition;
  const CV = Number(input.fuel?.CV_MJ_kg ?? input.cv_mj_kg ?? 50);
  const SG = Number(input.fuel?.SG ?? input.sg ?? 0.65);

  const T_amb_C = Number(input.ambient?.temperature_c ?? input.temp_c ?? 25);
  const P_kPa = Number(input.ambient?.pressure_kpa ?? input.pressure_kpa ?? 101.325);
  const T_K = toKelvin(T_amb_C);

  const rhoAir = rhoAire(T_K, P_kPa);
  const rhoFuel = rhoCombustible(SG, T_K, P_kPa);

  const CO2_max = calcCO2Max(comp);

  const useCO2 = input.existing?.use_co2 ?? false;
  let O2_exist = Number(input.existing?.o2_pct ?? input.existing_o2 ?? 7);
  let O2_proj = Number(input.projected?.o2_pct ?? input.projected_o2 ?? 3);

  if (useCO2) {
    const co2e = Number(input.existing?.co2_pct);
    const co2p = Number(input.projected?.co2_pct);
    if (co2e != null) O2_exist = o2FromCO2(co2e, CO2_max);
    if (co2p != null) O2_proj = o2FromCO2(co2p, CO2_max);
  }

  const T_flue_exist = Number(input.existing?.flue_temp_c ?? input.existing_flue_temp ?? 200);
  const T_flue_proj = Number(input.projected?.flue_temp_c ?? input.projected_flue_temp ?? 180);

  const consumoVal = Number(input.consumption?.value ?? input.consumption ?? 0);
  const consumoUnidad = input.consumption?.unit ?? input.consumption_unit ?? 'm3';
  const consumoPeriodo = input.consumption?.period ?? input.consumption_period ?? 'month';
  const costoUnit = Number(input.consumption?.unit_cost ?? input.unit_cost ?? 0);

  const mmEnabled = Boolean(input.savings?.mm_enabled ?? input.mm_enabled);
  const mmPct = Number(input.savings?.mm_pct ?? input.mm_pct ?? 0);
  const egaEnabled = Boolean(input.savings?.ega_enabled ?? input.ega_enabled);
  const egaPct = Number(input.savings?.ega_pct ?? input.ega_pct ?? 0);

  const excessExist = excessAirFromO2(O2_exist);
  const excessProj = excessAirFromO2(O2_proj);
  const CO2_exist = calcCO2Actual(CO2_max, O2_exist);
  const CO2_proj = calcCO2Actual(CO2_max, O2_proj);

  const effExist = calcularEficiencia(comp, CV, O2_exist, T_flue_exist, T_amb_C);
  const effProj = calcularEficiencia(comp, CV, O2_proj, T_flue_proj, T_amb_C);

  const fuelFlowExist = consumoAFuelFlow(consumoVal, consumoUnidad, consumoPeriodo);
  const horasPeriodo = PERIOD_HOURS[consumoPeriodo] || PERIOD_HOURS.month;

  const heatExist = heatInputMW(fuelFlowExist, rhoFuel, CV);
  const masaCombExist = consumoVal * rhoFuel;

  const prodExist = productosPorKg(comp, excessExist);
  const emExist = emisionesEscaladas(prodExist, masaCombExist, T_K, P_kPa, {
    fuelVolume_m3: consumoVal,
    excess_air_pct: excessExist,
    referenceExcess_pct: excessExist,
  });

  const fuelSavingRatio = effExist.gross_pct / effProj.gross_pct;
  const consumoProyBase = consumoVal * fuelSavingRatio;
  const { consumo: consumoProyFinal, steps: mmEgaSteps } = aplicarAhorrosAdicionales(
    consumoProyBase,
    mmEnabled,
    mmPct,
    egaEnabled,
    egaPct,
  );

  const fuelFlowProj = consumoProyFinal / horasPeriodo;
  // Heat input proyectado a carga útil constante (convención Autoflame)
  const heatProj = heatExist * (effExist.net_pct / effProj.net_pct);
  const masaCombProj = consumoProyFinal * rhoFuel;

  const prodProj = productosPorKg(comp, excessProj);
  const emProj = emisionesEscaladas(prodProj, masaCombProj, T_K, P_kPa, {
    fuelVolume_m3: consumoProyFinal,
    excess_air_pct: excessProj,
    referenceExcess_pct: excessExist,
  });

  const costExist = consumoVal * costoUnit;
  const costProj = consumoProyFinal * costoUnit;

  const fuelSavingVol = consumoVal - consumoProyFinal;
  const fuelSavingPct = consumoVal > 0 ? (fuelSavingVol / consumoVal) * 100 : 0;
  const fuelCostSaving = costExist - costProj;

  const volExist = emExist.total.volumen_m3;
  const volProj = emProj.total.volumen_m3;
  const emissionsSavingPct = volExist > 0 ? ((volExist - volProj) / volExist) * 100 : 0;

  const stackLossExistMW = (effExist.lossNet_kJ * fuelFlowExist * rhoFuel) / 3600 / 1000;
  const stackLossProjMW = (effProj.lossNet_kJ * fuelFlowProj * rhoFuel) / 3600 / 1000;
  const stackHeatLossSavingMW = (stackLossExistMW - stackLossProjMW) * PHYSICAL.STACK_SAVINGS_CALIBRATION;

  const deltaExist = T_flue_exist - T_amb_C;
  const deltaProj = T_flue_proj - T_amb_C;
  const exhaustDeltaImprove = deltaExist - deltaProj;

  return {
    ok: true,
    fuel: { composition: comp, CV_MJ_kg: CV, SG, CO2_max_pct: round(CO2_max, 2) },
    ambient: { temperature_c: T_amb_C, pressure_kpa: P_kPa, rho_air: round(rhoAir, 4), rho_fuel: round(rhoFuel, 4) },
    existing: {
      o2_pct: round(O2_exist, 2),
      co2_pct: round(CO2_exist, 2),
      excess_air_pct: round(excessExist, 2),
      flue_temp_c: T_flue_exist,
      delta_t_c: round(deltaExist, 1),
      efficiency: { net_pct: effExist.net_pct, gross_pct: effExist.gross_pct },
      consumption: round(consumoVal, 2),
      fuel_flow_m3h: round(fuelFlowExist, 3),
      heat_input_MW: round(heatExist, 3),
      emissions: formatEmissions(emExist),
      fuel_cost: round(costExist, 2),
    },
    projected: {
      o2_pct: round(O2_proj, 2),
      co2_pct: round(CO2_proj, 2),
      excess_air_pct: round(excessProj, 2),
      flue_temp_c: T_flue_proj,
      delta_t_c: round(deltaProj, 1),
      efficiency: { net_pct: effProj.net_pct, gross_pct: effProj.gross_pct },
      consumption: round(consumoProyFinal, 2),
      consumption_base: round(consumoProyBase, 2),
      fuel_flow_m3h: round(fuelFlowProj, 3),
      heat_input_MW: round(heatProj, 3),
      emissions: formatEmissions(emProj),
      fuel_cost: round(costProj, 2),
      mm_ega_steps: mmEgaSteps,
    },
    savings: {
      emissions_savings_pct: round(emissionsSavingPct, 2),
      fuel_savings_pct: round(fuelSavingPct, 2),
      fuel_savings_volume: round(fuelSavingVol, 3),
      fuel_cost_savings: round(fuelCostSaving, 2),
      efficiency_improvement_net: round(effProj.net_pct - effExist.net_pct, 2),
      efficiency_improvement_gross: round(effProj.gross_pct - effExist.gross_pct, 2),
      exhaust_delta_improvement_c: round(exhaustDeltaImprove, 1),
      stack_heat_loss_savings_MW: round(stackHeatLossSavingMW, 3),
      mm_pct: mmEnabled ? mmPct : 0,
      ega_pct: egaEnabled ? egaPct : 0,
    },
  };
}

function formatEmissions(em) {
  const out = {};
  for (const gas of ['O2', 'CO2', 'CO', 'SO2', 'NO', 'H2O', 'N2', 'total']) {
    if (em[gas]) {
      out[gas] = {
        masa_kg: round(em[gas].masa_kg, 2),
        volumen_m3: round(em[gas].volumen_m3, 2),
      };
    }
  }
  return out;
}

/** Entrada estándar CHACHITOS para tests §6 */
function chachitosInput(overrides = {}) {
  return {
    fuel: { ...FUEL_LIBRARY.natural_gas_pittsburgh },
    ambient: { temperature_c: 25, pressure_kpa: 101.33 },
    consumption: { value: 35910, unit: 'm3', period: 'month', unit_cost: 4.57 },
    existing: { o2_pct: 7.0, flue_temp_c: 169 },
    projected: { o2_pct: 3.0, flue_temp_c: 142 },
    savings: { mm_enabled: true, mm_pct: 3.0, ega_enabled: false, ega_pct: 0 },
    ...overrides,
  };
}

module.exports = {
  calculate,
  validateInput,
  normalizeComposition,
  calcCO2Max,
  calcCO2Actual,
  excessAirFromO2,
  o2FromCO2,
  volumenGas,
  rhoAire,
  rhoCombustible,
  heatInputMW,
  productosPorKg,
  calcLHV,
  calcularEficiencia,
  aplicarAhorrosAdicionales,
  chachitosInput,
  FUEL_LIBRARY,
  PERIOD_HOURS,
  PHYSICAL,
};
