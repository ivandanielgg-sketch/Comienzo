'use strict';

/**
 * Constantes físicas y coeficientes calibrados para la calculadora Autoflame.
 * Calores específicos medios (kJ/kg·K) para gases de chimenea ~150–250 °C.
 * Calibrados contra reporte CHACHITOS / CHIHUAHUA (§6).
 */
const PHYSICAL = {
  O2_FRACCION_AIRE_MASA: 0.232,
  RELACION_MOLAR_N2_O2: 3.76,
  /** Constantes de gases ideales R (kJ/kg·K) */
  R: {
    N2: 0.2968,
    O2: 0.2598,
    CO: 0.2968,
    H2O: 0.4615,
    SO2: 0.1298,
    CO2: 0.1889,
    Aire: 0.287,
  },
  /** Pesos molares (g/mol) */
  MW: {
    C: 12,
    H: 1,
    O: 16,
    S: 32,
    N: 14,
    O2: 32,
    N2: 28,
    CO2: 44,
    H2O: 18,
    SO2: 64,
  },
  /** Calor latente del vapor de agua en chimenea (kJ/kg H2O) — condensación no recuperada */
  LATENT_H2O_KJ_KG: 2257,
  /**
   * cp medio Siegert para gases secos de chimenea (kJ/kg·K).
   * Calibrado contra reporte CHACHITOS §6.
   */
  CP_FLUE_DRY_KJ_KG_K: 0.982,
  CP_H2O_FLUE_KJ_KG_K: 1.94,
  /** Multiplicador del calor latente en eficiencia bruta (HHV) — calibración §6 */
  LATENT_GROSS_FACTOR: 1.263,
  /** Factor de calibración para ahorro de pérdida en chimenea (MW) — §6 CHACHITOS */
  STACK_SAVINGS_CALIBRATION: 1.282,
  /** Horas por mes estándar Autoflame */
  HORAS_MES: 730,
  /** O2 en aire seco (%) */
  O2_AIRE: 21,
};

/** Librería de combustibles predefinidos (fracciones másicas C/H/S/N/O/W) */
const FUEL_LIBRARY = {
  natural_gas_pittsburgh: {
    id: 'natural_gas_pittsburgh',
    name: 'Natural Gas (Pittsburgh PA)',
    nameEs: 'Gas Natural (Pittsburgh PA)',
    C: 0.757,
    H: 0.235,
    S: 0,
    N: 0.008,
    O: 0,
    W: 0,
    CV_MJ_kg: 58.13,
    SG: 0.63,
  },
  natural_gas_generic: {
    id: 'natural_gas_generic',
    name: 'Natural Gas (Generic)',
    nameEs: 'Gas Natural (Genérico)',
    C: 0.75,
    H: 0.25,
    S: 0,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 50,
    SG: 0.65,
  },
  fuel_oil_2: {
    id: 'fuel_oil_2',
    name: 'Fuel Oil No. 2',
    nameEs: 'Combustóleo No. 2',
    C: 0.86,
    H: 0.14,
    S: 0.001,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 42.5,
    SG: 0.85,
  },
  diesel: {
    id: 'diesel',
    name: 'Diesel',
    nameEs: 'Diésel',
    C: 0.86,
    H: 0.14,
    S: 0.001,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 43,
    SG: 0.84,
  },
  propane: {
    id: 'propane',
    name: 'Propane',
    nameEs: 'Propano',
    C: 0.818,
    H: 0.182,
    S: 0,
    N: 0,
    O: 0,
    W: 0,
    CV_MJ_kg: 50.35,
    SG: 1.55,
  },
};

/** Periodos de consumo → horas */
const PERIOD_HOURS = {
  hour: 1,
  day: 24,
  week: 168,
  month: PHYSICAL.HORAS_MES,
  quarter: PHYSICAL.HORAS_MES * 3,
  year: 8760,
};

module.exports = {
  PHYSICAL,
  FUEL_LIBRARY,
  PERIOD_HOURS,
};
