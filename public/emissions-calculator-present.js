'use strict';

/**
 * Capa de presentación — Calculadora de Emisiones.
 * Escala ahorros por periodo, formateo de moneda y ahorros de operación.
 * NO modifica el motor de combustión (combustion.*).
 */

/** Horas por periodo de consumo base (convención Autoflame) */
const EC_PERIOD_HOURS = {
  hour: 1,
  day: 24,
  week: 168,
  month: 730,
  quarter: 2190,
  year: 8760,
};

/** Constantes de conversión documentadas § iteración 3 */
const EC_HOURS_PER_YEAR = 8760;
const EC_HOURS_PER_MONTH = 730;
const EC_DAYS_PER_YEAR = 365;

/** Factor periodo base → tasa horaria: ahorro_por_hora = ahorro_base / horas_del_periodo_base */
function ecBasePeriodToHourFactor(basePeriod) {
  const hours = EC_PERIOD_HOURS[basePeriod] || EC_HOURS_PER_MONTH;
  return 1 / hours;
}

function ecRound(value, decimals) {
  const f = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * f) / f;
}

/** Formato monetario con etiqueta de moneda (sin conversión FX) */
function ecFormatMoney(amount, currency, lang) {
  if (amount == null || Number.isNaN(amount)) return '—';
  const cur = currency === 'USD' ? 'USD' : 'MXN';
  const locale = lang === 'en' ? 'en-US' : 'es-MX';
  const formatted = Number(amount).toLocaleString(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${cur}`;
}

/** Extrae ahorros base del periodo elegido por el usuario a partir del resultado del motor */
function ecExtractBaseSavings(result, input) {
  const co2KgExist = result.existing?.emissions?.CO2?.masa_kg || 0;
  const co2KgProj = result.projected?.emissions?.CO2?.masa_kg || 0;
  const unit = input?.consumption?.unit || 'm3';
  const unitLabel = unit === 'kWh' ? 'kWh' : 'm³';

  return {
    basePeriod: input?.consumption?.period || 'month',
    fuelVolume: Number(result.savings?.fuel_savings_volume || 0),
    fuelUnitLabel: unitLabel,
    fuelCost: Number(result.savings?.fuel_cost_savings || 0),
    co2Ton: ecRound((co2KgExist - co2KgProj) / 1000, 4),
  };
}

/** Ahorro anual de operación (mantenimiento + downtime) en moneda seleccionada */
function ecOperationAnnual(input) {
  const op = input?.operation || {};
  if (!op.enabled) {
    return { annual: 0, maintenance: 0, downtime: 0 };
  }
  const maintenance = Number(op.maintenance_annual || 0);
  const downtime = op.downtime_enabled ? Number(op.downtime_annual || 0) : 0;
  return {
    annual: maintenance + downtime,
    maintenance,
    downtime,
  };
}

/**
 * Escala ahorros de combustible/CO2/costo a Hora, Día, Mes, Año.
 * Ahorro operación anual se escala con los mismos factores temporales.
 */
function ecBuildPeriodSavings(result, input) {
  const base = ecExtractBaseSavings(result, input);
  const hourFactor = ecBasePeriodToHourFactor(base.basePeriod);
  const perHour = {
    fuelVolume: base.fuelVolume * hourFactor,
    fuelCost: base.fuelCost * hourFactor,
    co2Ton: base.co2Ton * hourFactor,
  };

  const opAnnual = ecOperationAnnual(input).annual;
  const opPerHour = opAnnual / EC_HOURS_PER_YEAR;

  const rows = [
    { key: 'hour', labelEs: 'Hora', labelEn: 'Hour', hours: 1 },
    { key: 'day', labelEs: 'Día', labelEn: 'Day', hours: EC_PERIOD_HOURS.day },
    { key: 'month', labelEs: 'Mes', labelEn: 'Month', hours: EC_HOURS_PER_MONTH },
    { key: 'year', labelEs: 'Año', labelEn: 'Year', hours: EC_HOURS_PER_YEAR },
  ];

  return rows.map((row) => {
    const fuelVolume = ecRound(perHour.fuelVolume * row.hours, row.key === 'hour' ? 4 : 2);
    const fuelCost = ecRound(perHour.fuelCost * row.hours, 2);
    const co2Ton = ecRound(perHour.co2Ton * row.hours, 4);
    const operationCost = ecRound(opPerHour * row.hours, 2);
    const totalCost = ecRound(fuelCost + operationCost, 2);
    return {
      ...row,
      fuelVolume,
      fuelUnitLabel: base.fuelUnitLabel,
      fuelCost,
      co2Ton,
      operationCost,
      totalCost,
      operationEnabled: Boolean(input?.operation?.enabled),
    };
  });
}

/** HTML tabla "Ahorros por periodo" */
function ecRenderPeriodSavingsTable(result, input, lang) {
  const rows = ecBuildPeriodSavings(result, input);
  const currency = input?.currency || 'MXN';
  const opEnabled = Boolean(input?.operation?.enabled);

  const headTotal = opEnabled
    ? (lang === 'en' ? 'Total savings' : 'Ahorro total')
    : '';

  const header = lang === 'en'
    ? `<tr>
        <th>Period</th>
        <th>Fuel saved</th>
        <th>Cost saving</th>
        <th>CO2 saving (ton)</th>
        ${opEnabled ? '<th>Total saving</th>' : ''}
      </tr>`
    : `<tr>
        <th>Periodo</th>
        <th>Combustible ahorrado</th>
        <th>Ahorro de costo</th>
        <th>Ahorro de CO2 (ton)</th>
        ${opEnabled ? '<th>Ahorro total</th>' : ''}
      </tr>`;

  const body = rows.map((r) => {
    const periodLabel = lang === 'en' ? r.labelEn : r.labelEs;
    const volCell = `${Number(r.fuelVolume).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', { maximumFractionDigits: 4 })} ${r.fuelUnitLabel}`;
    const costCell = ecFormatMoney(r.fuelCost, currency, lang);
    const co2Cell = Number(r.co2Ton).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
    const totalCell = opEnabled ? ecFormatMoney(r.totalCost, currency, lang) : '';
    return `<tr>
      <td>${periodLabel}</td>
      <td class="calc-cell">${volCell}</td>
      <td class="calc-cell">${costCell}</td>
      <td class="calc-cell">${co2Cell}</td>
      ${opEnabled ? `<td class="calc-cell"><strong>${totalCell}</strong></td>` : ''}
    </tr>`;
  }).join('');

  const title = lang === 'en' ? 'Savings by period' : 'Ahorros por periodo';
  const note = opEnabled
    ? (lang === 'en'
      ? 'Total savings include fuel cost savings plus estimated operation savings (maintenance/downtime).'
      : 'El ahorro total incluye costo de combustible más ahorros de operación estimados (mantenimiento/paros).')
    : '';

  return `
    <div class="panel ec-period-table-panel" style="margin-top:16px;">
      <div class="panel-header"><h3>${title}</h3></div>
      <div class="ec-table-scroll">
        <table class="emissions-table ec-period-savings-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${note ? `<p class="muted" style="margin-top:8px;font-size:0.85rem;">${note}</p>` : ''}
    </div>`;
}

if (typeof window !== 'undefined') {
  window.EmissionsCalculatorPresent = {
    EC_PERIOD_HOURS,
    EC_HOURS_PER_YEAR,
    EC_HOURS_PER_MONTH,
    EC_DAYS_PER_YEAR,
    ecBasePeriodToHourFactor,
    ecFormatMoney,
    ecExtractBaseSavings,
    ecOperationAnnual,
    ecBuildPeriodSavings,
    ecRenderPeriodSavingsTable,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EC_PERIOD_HOURS,
    EC_HOURS_PER_YEAR,
    EC_HOURS_PER_MONTH,
    EC_DAYS_PER_YEAR,
    ecBasePeriodToHourFactor,
    ecFormatMoney,
    ecExtractBaseSavings,
    ecOperationAnnual,
    ecBuildPeriodSavings,
    ecRenderPeriodSavingsTable,
  };
}
