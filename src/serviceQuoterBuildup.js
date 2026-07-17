'use strict';

/**
 * Build-up de tarifas por rol — Cotizador Rápido de Servicios.
 * Pure calculation helpers (Node + browser via public/service-quoter-buildup.js mirror).
 */

const ROLE_IDS = ['programador', 'tecnico', 'ayudante'];

const ROLE_META = {
  programador: {
    id: 'programador',
    label: 'Programador',
    rateKey: 'tarifa_programador_hora',
    defaultRate: 300,
  },
  tecnico: {
    id: 'tecnico',
    label: 'Técnico/Encargado',
    rateKey: 'tarifa_tecnico_hora',
    defaultRate: 250,
  },
  ayudante: {
    id: 'ayudante',
    label: 'Ayudante',
    rateKey: 'tarifa_ayudante_hora',
    defaultRate: 175,
  },
};

const BUILDUP_FIELD_DEFAULTS = {
  programador: {
    sueldo_semanal: 5500,
    factor_prestaciones: 1.38,
    sobresueldo_diario: 500,
    horas_extra: 1,
    provision_garantia: 2.5,
    horas_jornada: 9,
  },
  tecnico: {
    sueldo_semanal: 5500,
    factor_prestaciones: 1.38,
    sobresueldo_diario: 500,
    horas_extra: 1,
    provision_garantia: 2.5,
    horas_jornada: 9,
  },
  ayudante: {
    sueldo_semanal: 5500,
    factor_prestaciones: 1.38,
    sobresueldo_diario: 250,
    horas_extra: 1,
    provision_garantia: 2.5,
    horas_jornada: 9,
  },
};

const BUILDUP_FIELD_KEYS = [
  'sueldo_semanal',
  'factor_prestaciones',
  'sobresueldo_diario',
  'horas_extra',
  'provision_garantia',
  'horas_jornada',
];

function buildupSettingKey(roleId, field) {
  return `buildup_${roleId}_${field}`;
}

/** Seed rows for service_quote_settings (category: buildup). */
function getBuildupSettingDefaults() {
  const rows = [];
  for (const roleId of ROLE_IDS) {
    const defaults = BUILDUP_FIELD_DEFAULTS[roleId];
    const labels = {
      sueldo_semanal: `Build-up ${ROLE_META[roleId].label}: sueldo semanal base (MXN)`,
      factor_prestaciones: `Build-up ${ROLE_META[roleId].label}: factor prestaciones`,
      sobresueldo_diario: `Build-up ${ROLE_META[roleId].label}: sobresueldo diario (MXN)`,
      horas_extra: `Build-up ${ROLE_META[roleId].label}: horas extra estimadas/día`,
      provision_garantia: `Build-up ${ROLE_META[roleId].label}: provisión garantía (%)`,
      horas_jornada: `Build-up ${ROLE_META[roleId].label}: horas jornada facturable`,
    };
    for (const field of BUILDUP_FIELD_KEYS) {
      rows.push({
        key: buildupSettingKey(roleId, field),
        value: String(defaults[field]),
        label: labels[field],
        category: 'buildup',
      });
    }
  }
  return rows;
}

function ceilToMultipleOf5(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 5) * 5;
}

function clampBuildupInputs(raw) {
  const sueldo = Math.max(0, Number(raw.sueldo_semanal) || 0);
  const factor = Math.max(1, Number(raw.factor_prestaciones) || 1);
  const sobresueldo = Math.max(0, Number(raw.sobresueldo_diario) || 0);
  const horasExtra = Math.max(0, Number(raw.horas_extra) || 0);
  let provision = Number(raw.provision_garantia);
  if (!Number.isFinite(provision)) provision = 0;
  provision = Math.min(15, Math.max(0, provision));
  const horasJornada = Math.max(0.01, Number(raw.horas_jornada) || 0.01);
  return {
    sueldo_semanal: sueldo,
    factor_prestaciones: factor,
    sobresueldo_diario: sobresueldo,
    horas_extra: horasExtra,
    provision_garantia: provision,
    horas_jornada: horasJornada,
  };
}

/**
 * Full build-up for one role.
 * @returns {{ inputs, costo_diario_base, costo_diario_cargado, tarifa_hora_extra,
 *   costo_extras_dia, subtotal_dia, provision_dia, costo_dia_hombre, tarifa_piso }}
 */
function calculateRoleBuildup(rawInputs) {
  const inputs = clampBuildupInputs(rawInputs || {});
  const costoDiarioBase = inputs.sueldo_semanal / 6;
  const costoDiarioCargado = costoDiarioBase * inputs.factor_prestaciones;
  const tarifaHoraExtra = (costoDiarioBase / 8) * 2;
  const costoExtrasDia = tarifaHoraExtra * inputs.horas_extra;
  const subtotalDia = costoDiarioCargado + inputs.sobresueldo_diario + costoExtrasDia;
  const provisionDia = subtotalDia * (inputs.provision_garantia / 100);
  const costoDiaHombre = subtotalDia + provisionDia;
  const tarifaPiso = ceilToMultipleOf5(costoDiaHombre / inputs.horas_jornada);

  return {
    inputs,
    costo_diario_base: costoDiarioBase,
    costo_diario_cargado: costoDiarioCargado,
    tarifa_hora_extra: tarifaHoraExtra,
    costo_extras_dia: costoExtrasDia,
    subtotal_dia: subtotalDia,
    provision_dia: provisionDia,
    costo_dia_hombre: costoDiaHombre,
    tarifa_piso: tarifaPiso,
  };
}

function commercialCushion(tarifaVigente, tarifaPiso, horasJornada) {
  const vigente = Math.max(0, Number(tarifaVigente) || 0);
  const piso = Math.max(0, Number(tarifaPiso) || 0);
  const hours = Math.max(0.01, Number(horasJornada) || 9);
  const perHour = vigente - piso;
  return {
    per_hour: perHour,
    per_day: perHour * hours,
    is_above_or_equal: vigente >= piso,
    needs_correction: vigente < piso,
  };
}

/**
 * Only raise rates that are below floor. Never decreases a current rate.
 * @returns {{ changes: Array<{roleId,label,from,to,delta}>, unchanged: Array<{roleId,label,rate}> }}
 */
function planUnderfloorCorrections(roleStates) {
  const changes = [];
  const unchanged = [];
  for (const state of roleStates) {
    const from = Math.max(0, Number(state.tarifa_vigente) || 0);
    const to = Math.max(0, Number(state.tarifa_piso) || 0);
    if (from < to) {
      changes.push({
        roleId: state.roleId,
        label: state.label,
        rateKey: state.rateKey,
        from,
        to,
        delta: to - from,
      });
    } else {
      unchanged.push({
        roleId: state.roleId,
        label: state.label,
        rateKey: state.rateKey,
        rate: from,
      });
    }
  }
  return { changes, unchanged };
}

function formatCorrectionSummary(plan) {
  const parts = [];
  for (const c of plan.changes) {
    parts.push(`${c.label}: $${c.from} → $${c.to} (+$${c.delta}/h)`);
  }
  if (plan.unchanged.length) {
    const names = plan.unchanged.map((u) => u.label.split('/')[0]).join(' y ');
    parts.push(`${names}: sin cambios (colchón comercial positivo).`);
  }
  if (!plan.changes.length) {
    return 'Ninguna tarifa está bajo costo; no hay correcciones que aplicar.';
  }
  return parts.join(' ');
}

/** Reference crew: 1 prog + 1 tech + 2 helpers × 10 days × 9 h (+ costos para ≈3.2% Δ total). */
const REFERENCE_QUOTE = {
  progQty: 1,
  techQty: 1,
  helperQty: 2,
  hoursPerRole: 90,
  hotelNights: 9,
  hotelRate: 2500,
  mealDays: 10,
  mealRate: 150,
  mealsPerDay: 3,
  /** Calibrated so +$4,500 labor ≈ +3.2% on final total with default rates. */
  otherCosts: 19125,
  transport: 0,
  margin: 0.6,
};

function computeQuoteTotals({
  progQty, techQty, helperQty,
  progHours, techHours, helperHours,
  progRate, techRate, helperRate,
  transport = 0,
  viaticos = 0,
  otherCosts = 0,
  margin = 0.6,
}) {
  const labor =
    progQty * progHours * progRate +
    techQty * techHours * techRate +
    helperQty * helperHours * helperRate;
  const subtotal = labor + transport + viaticos + otherCosts;
  const m = Math.min(0.99, Math.max(0, Number(margin) || 0));
  const priceBeforeIva = subtotal / (1 - m);
  const iva = priceBeforeIva * 0.16;
  const total = priceBeforeIva + iva;
  return {
    labor,
    subtotal,
    priceBeforeIva,
    iva,
    total,
  };
}

function deltaPct(before, after) {
  if (!before) return after ? 100 : 0;
  return ((after - before) / before) * 100;
}

/**
 * Impact of applying rate corrections (only changed roles) on a quote scenario.
 */
function estimateCorrectionImpact(beforeRates, afterRates, scenario) {
  const before = computeQuoteTotals({ ...scenario, ...beforeRates });
  const after = computeQuoteTotals({ ...scenario, ...afterRates });
  return {
    before,
    after,
    deltaLabor: after.labor - before.labor,
    deltaLaborPct: deltaPct(before.labor, after.labor),
    deltaPrice: after.priceBeforeIva - before.priceBeforeIva,
    deltaPricePct: deltaPct(before.priceBeforeIva, after.priceBeforeIva),
    deltaTotal: after.total - before.total,
    deltaTotalPct: deltaPct(before.total, after.total),
  };
}

function parseBuildupInputsFromSettings(settingsMap, roleId) {
  const defaults = BUILDUP_FIELD_DEFAULTS[roleId];
  const out = {};
  for (const field of BUILDUP_FIELD_KEYS) {
    const key = buildupSettingKey(roleId, field);
    const raw = settingsMap[key];
    out[field] = raw !== undefined && raw !== '' ? Number(raw) : defaults[field];
  }
  return out;
}

module.exports = {
  ROLE_IDS,
  ROLE_META,
  BUILDUP_FIELD_DEFAULTS,
  BUILDUP_FIELD_KEYS,
  REFERENCE_QUOTE,
  buildupSettingKey,
  getBuildupSettingDefaults,
  ceilToMultipleOf5,
  clampBuildupInputs,
  calculateRoleBuildup,
  commercialCushion,
  planUnderfloorCorrections,
  formatCorrectionSummary,
  computeQuoteTotals,
  estimateCorrectionImpact,
  parseBuildupInputsFromSettings,
};
