'use strict';

/** Cliente UI — Calculadora de Emisiones Autoflame */

const state = {
  lang: 'es',
  currency: 'MXN',
  unitSystem: 'metric',
  lastResult: null,
  fuels: [],
};

const I18N = {
  es: {
    title: 'Calculadora de Emisiones y Ahorro de Combustible',
    subtitle: 'Combustion Performance Data — Autoflame 2020',
    fuel: 'Combustible',
    cv: 'Poder Calorífico (MJ/kg)',
    sg: 'Gravedad Específica',
    ambient: 'Condiciones ambiente',
    temp: 'Temperatura (°C)',
    pressure: 'Presión (kPa)',
    consumption: 'Combustible usado',
    unitCost: 'Costo unitario',
    currency: 'Moneda',
    existing: 'Desempeño existente',
    projected: 'Desempeño proyectado',
    o2: 'O2 (%)',
    co2: 'CO2 (%)',
    flueTemp: 'Temp. gases escape (°C)',
    useCo2: 'Usar CO2 en lugar de O2',
    mm: 'Ahorro MM (%)',
    ega: 'Ahorro EGA (%)',
    calculate: 'Calcular',
    export: 'Exportar reporte',
    back: 'Volver al panel',
    co2Max: 'Max CO2 estequiométrico',
    results: 'Resultados',
    emissions: 'Emisiones',
    savings: 'Ahorros',
    gas: 'Gas',
    mass: 'Masa (kg)',
    volume: 'Volumen (m³)',
    errors: 'Errores de validación',
    operationSavings: 'Ahorros adicionales de operación',
    operationEnable: 'Incluir ahorros de mantenimiento y paros',
    maintenanceAnnual: 'Ahorro mantenimiento ($/año)',
    downtimeAnnual: 'Ahorro por reducción de paros ($/año)',
    downtimeEnable: 'Incluir ahorro por paros/downtime',
  },
  en: {
    title: 'Emissions & Fuel Savings Calculator',
    subtitle: 'Combustion Performance Data — Autoflame 2020',
    fuel: 'Fuel',
    cv: 'Calorific Value (MJ/kg)',
    sg: 'Specific Gravity',
    ambient: 'Ambient conditions',
    temp: 'Temperature (°C)',
    pressure: 'Pressure (kPa)',
    consumption: 'Fuel consumption',
    unitCost: 'Unit cost',
    currency: 'Currency',
    existing: 'Existing performance',
    projected: 'Projected performance',
    o2: 'O2 (%)',
    co2: 'CO2 (%)',
    flueTemp: 'Flue gas temp (°C)',
    useCo2: 'Use CO2 instead of O2',
    mm: 'MM savings (%)',
    ega: 'EGA savings (%)',
    calculate: 'Calculate',
    export: 'Export report',
    back: 'Back to panel',
    co2Max: 'Max stoichiometric CO2',
    results: 'Results',
    emissions: 'Emissions',
    savings: 'Savings',
    gas: 'Gas',
    mass: 'Mass (kg)',
    volume: 'Volume (m³)',
    errors: 'Validation errors',
    operationSavings: 'Additional operation savings',
    operationEnable: 'Include maintenance and downtime savings',
    maintenanceAnnual: 'Maintenance savings ($/year)',
    downtimeAnnual: 'Downtime reduction savings ($/year)',
    downtimeEnable: 'Include downtime savings',
  },
};

const P = () => window.EmissionsCalculatorPresent;

function t(key) {
  return I18N[state.lang][key] || key;
}

function $(sel) {
  return document.querySelector(sel);
}

function fmt(n, dec = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString(state.lang === 'es' ? 'es-MX' : 'en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtMoney(amount) {
  return P().ecFormatMoney(amount, state.currency, state.lang);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.errors?.join(' ') || 'Error de API');
  return data;
}

function readInput() {
  const fuelId = $('#ec-fuel-select').value;
  const custom = fuelId === 'custom';
  const fuelFromLib = state.fuels.find((f) => f.id === fuelId);

  const composition = custom
    ? {
        C: Number($('#ec-C').value),
        H: Number($('#ec-H').value),
        S: Number($('#ec-S').value),
        N: Number($('#ec-N').value),
        O: Number($('#ec-O').value),
        W: Number($('#ec-W').value),
      }
    : null;

  return {
    fuel: custom
      ? {
          CV_MJ_kg: Number($('#ec-cv').value),
          SG: Number($('#ec-sg').value),
          ...composition,
        }
      : { ...fuelFromLib, CV_MJ_kg: Number($('#ec-cv').value), SG: Number($('#ec-sg').value) },
    ambient: {
      temperature_c: Number($('#ec-temp').value),
      pressure_kpa: Number($('#ec-pressure').value),
    },
    consumption: {
      value: Number($('#ec-consumption').value),
      unit: $('#ec-consumption-unit').value,
      period: $('#ec-consumption-period').value,
      unit_cost: Number($('#ec-unit-cost').value),
    },
    currency: state.currency,
    existing: {
      o2_pct: Number($('#ec-o2-exist').value),
      flue_temp_c: Number($('#ec-flue-exist').value),
      use_co2: $('#ec-use-co2').checked,
      co2_pct: Number($('#ec-co2-exist').value),
    },
    projected: {
      o2_pct: Number($('#ec-o2-proj').value),
      flue_temp_c: Number($('#ec-flue-proj').value),
      co2_pct: Number($('#ec-co2-proj').value),
    },
    savings: {
      mm_enabled: $('#ec-mm-enabled').checked,
      mm_pct: Number($('#ec-mm').value),
      ega_enabled: $('#ec-ega-enabled').checked,
      ega_pct: Number($('#ec-ega').value),
    },
    operation: {
      enabled: $('#ec-operation-enabled').checked,
      maintenance_annual: Number($('#ec-maintenance-annual').value),
      downtime_enabled: $('#ec-downtime-enabled').checked,
      downtime_annual: Number($('#ec-downtime-annual').value),
    },
    report: {
      company: $('#ec-company').value,
      site: $('#ec-site').value,
      engineer: $('#ec-engineer').value,
    },
  };
}

function applyFuelSelection() {
  const fuelId = $('#ec-fuel-select').value;
  const custom = fuelId === 'custom';
  document.querySelectorAll('.ec-custom-comp').forEach((el) => {
    el.classList.toggle('hidden', !custom);
  });
  if (custom) return;
  const fuel = state.fuels.find((f) => f.id === fuelId);
  if (!fuel) return;
  $('#ec-cv').value = fuel.CV_MJ_kg;
  $('#ec-sg').value = fuel.SG;
  $('#ec-C').value = (fuel.C * 100).toFixed(3);
  $('#ec-H').value = (fuel.H * 100).toFixed(3);
  $('#ec-S').value = (fuel.S * 100).toFixed(3);
  $('#ec-N').value = (fuel.N * 100).toFixed(3);
  $('#ec-O').value = (fuel.O * 100).toFixed(3);
  $('#ec-W').value = (fuel.W * 100).toFixed(3);
}

function toggleOperationFields() {
  const on = $('#ec-operation-enabled').checked;
  document.querySelectorAll('.ec-operation-field').forEach((el) => {
    el.classList.toggle('hidden', !on);
  });
  if (on) {
    const dtOn = $('#ec-downtime-enabled').checked;
    $('#ec-downtime-annual-wrap')?.classList.toggle('hidden', !dtOn);
  }
}

function renderEmissionsTable(result) {
  const gases = ['O2', 'CO2', 'CO', 'SO2', 'NO', 'H2O', 'N2', 'total'];
  const rows = gases
    .map((gas) => {
      const e = result.existing.emissions[gas] || {};
      const p = result.projected.emissions[gas] || {};
      return `<tr>
        <td>${gas}</td>
        <td class="calc-cell ec-num-cell">${fmt(e.masa_kg)}</td>
        <td class="calc-cell ec-num-cell">${fmt(e.volumen_m3)}</td>
        <td class="calc-cell ec-num-cell">${fmt(p.masa_kg)}</td>
        <td class="calc-cell ec-num-cell">${fmt(p.volumen_m3)}</td>
      </tr>`;
    })
    .join('');

  const lang = state.lang;
  const hMassE = lang === 'en' ? 'Mass exist. (kg)' : 'Masa exist. (kg)';
  const hVolE = lang === 'en' ? 'Vol exist. (m³)' : 'Vol exist. (m³)';
  const hMassP = lang === 'en' ? 'Mass proj. (kg)' : 'Masa proy. (kg)';
  const hVolP = lang === 'en' ? 'Vol proj. (m³)' : 'Vol proy. (m³)';

  return `<div class="ec-table-scroll ec-emissions-table-wrap">
    <table class="emissions-table ec-results-table">
      <thead><tr>
        <th>${t('gas')}</th>
        <th class="ec-num-cell">${hMassE}</th>
        <th class="ec-num-cell">${hVolE}</th>
        <th class="ec-num-cell">${hMassP}</th>
        <th class="ec-num-cell">${hVolP}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderOperationSummary(input) {
  if (!input.operation?.enabled) return '';
  const op = P().ecOperationAnnual(input);
  const lang = state.lang;
  return `<div class="panel ec-results-block ec-operation-summary">
    <div class="panel-header"><h3>${t('operationSavings')}</h3></div>
    <div class="ec-table-scroll">
    <table class="emissions-table ec-results-table">
      <tbody>
        <tr><td>${t('maintenanceAnnual')}</td><td class="calc-cell">${fmtMoney(op.maintenance)}</td></tr>
        ${input.operation.downtime_enabled ? `<tr><td>${t('downtimeAnnual')}</td><td class="calc-cell">${fmtMoney(op.downtime)}</td></tr>` : ''}
        <tr><td><strong>${lang === 'en' ? 'Total operation (annual)' : 'Total operación (anual)'}</strong></td><td class="calc-cell"><strong>${fmtMoney(op.annual)}</strong></td></tr>
      </tbody>
    </table>
    </div>
  </div>`;
}

function renderResults(result, input) {
  const el = $('#ec-results');
  if (!result.ok) {
    el.innerHTML = `<div class="message error"><strong>${t('errors')}:</strong><ul>${result.errors.map((e) => `<li>${e}</li>`).join('')}</ul></div>`;
    return;
  }

  const currencyLabel = state.currency === 'USD' ? 'USD' : 'MXN';

  el.innerHTML = `
    <div class="ec-results-stack">
      <p class="muted ec-currency-badge ec-results-block">${state.lang === 'en' ? 'Currency' : 'Moneda'}: <strong>${currencyLabel}</strong></p>

      <section class="cards ec-kpi-cards ec-results-block">
        <article><span>${t('co2Max')}</span><strong>${fmt(result.fuel.CO2_max_pct)} %</strong></article>
        <article><span>${t('existing')} — Net/Gross</span><strong>${fmt(result.existing.efficiency.net_pct)} / ${fmt(result.existing.efficiency.gross_pct)} %</strong></article>
        <article><span>${t('projected')} — Net/Gross</span><strong>${fmt(result.projected.efficiency.net_pct)} / ${fmt(result.projected.efficiency.gross_pct)} %</strong></article>
        <article><span>${t('savings')} combustible</span><strong>${fmt(result.savings.fuel_savings_pct)} %</strong></article>
      </section>

      <div class="panel ec-results-block ec-emissions-panel">
        <div class="panel-header"><h3>${t('emissions')}</h3></div>
        ${renderEmissionsTable(result)}
        <p class="muted ec-emissions-footnote">${t('savings')} emisiones (volumétrica): <strong>${fmt(result.savings.emissions_savings_pct)} %</strong></p>
      </div>

      <div class="panel ec-results-block ec-savings-panel">
        <div class="panel-header"><h3>${t('savings')}</h3></div>
        <div class="ec-table-scroll">
          <table class="emissions-table ec-results-table">
            <tbody>
              <tr><td>${state.lang === 'en' ? 'Fuel saved' : 'Combustible ahorrado'}</td><td class="calc-cell ec-num-cell">${fmt(result.savings.fuel_savings_volume, 3)} m³</td></tr>
              <tr><td>${state.lang === 'en' ? 'Fuel cost saving' : 'Ahorro costo combustible'}</td><td class="calc-cell ec-num-cell">${fmtMoney(result.savings.fuel_cost_savings)}</td></tr>
              <tr><td>${state.lang === 'en' ? 'Net efficiency gain' : 'Mejora eficiencia neta'}</td><td class="calc-cell ec-num-cell">${fmt(result.savings.efficiency_improvement_net)} %</td></tr>
              <tr><td>${state.lang === 'en' ? 'Gross efficiency gain' : 'Mejora eficiencia bruta'}</td><td class="calc-cell ec-num-cell">${fmt(result.savings.efficiency_improvement_gross)} %</td></tr>
              <tr><td>${state.lang === 'en' ? 'Exhaust ΔT improvement' : 'Mejora ΔT escape'}</td><td class="calc-cell ec-num-cell">${fmt(result.savings.exhaust_delta_improvement_c, 1)} °C</td></tr>
              <tr><td>${state.lang === 'en' ? 'Stack heat loss saving' : 'Ahorro pérdida chimenea'}</td><td class="calc-cell ec-num-cell">${fmt(result.savings.stack_heat_loss_savings_MW, 3)} MW</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      ${P().ecRenderPeriodSavingsTable(result, input, state.lang)}
      ${renderOperationSummary(input)}
      <div id="ec-chart-bars" class="ec-bar-chart panel ec-results-block"></div>
    </div>
  `;

  renderBarChart(result);
}

function renderBarChart(result) {
  const container = $('#ec-chart-bars');
  if (!container) return;
  const items = [
    { label: 'CO2 vol', exist: result.existing.emissions.CO2?.volumen_m3, proj: result.projected.emissions.CO2?.volumen_m3 },
    { label: 'Total vol', exist: result.existing.emissions.total?.volumen_m3, proj: result.projected.emissions.total?.volumen_m3 },
    { label: 'Consumo m³', exist: result.existing.consumption, proj: result.projected.consumption },
  ];
  const max = Math.max(...items.flatMap((i) => [i.exist, i.proj]));
  container.innerHTML = `<div class="panel-header"><h3>Existing vs Projected</h3></div>
    ${items.map((item) => {
      const wE = max ? (item.exist / max) * 100 : 0;
      const wP = max ? (item.proj / max) * 100 : 0;
      return `<div class="ec-bar-row"><span>${item.label}</span>
        <div class="ec-bar-group"><div class="ec-bar exist" style="width:${wE}%"></div><span>${fmt(item.exist, 0)}</span></div>
        <div class="ec-bar-group"><div class="ec-bar proj" style="width:${wP}%"></div><span>${fmt(item.proj, 0)}</span></div>
      </div>`;
    }).join('')}`;
}

async function runCalculate() {
  $('#ec-message').textContent = '';
  try {
    const input = readInput();
    const result = await api('/api/emissions/calculate', { method: 'POST', body: JSON.stringify(input) });
    state.lastResult = { input, result };
    renderResults(result, input);
  } catch (err) {
    $('#ec-message').textContent = err.message;
    renderResults({ ok: false, errors: [err.message] }, readInput());
  }
}

function exportReport() {
  if (!state.lastResult) {
    $('#ec-message').textContent = state.lang === 'en' ? 'Calculate first before exporting.' : 'Calcule primero antes de exportar.';
    return;
  }
  try {
    sessionStorage.setItem('ec-report-payload', JSON.stringify(state.lastResult));
    window.open('/emissions-calculator-print.html', '_blank');
  } catch (err) {
    $('#ec-message').textContent = 'No se pudo exportar: ' + err.message;
  }
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (I18N[state.lang][key]) el.textContent = I18N[state.lang][key];
  });
  updateCurrencyHint();
}

function updateCurrencyHint() {
  const hint = $('#ec-currency-hint');
  if (hint) {
    hint.textContent = state.lang === 'en'
      ? `Unit cost is expressed in ${state.currency} (no FX conversion).`
      : `El costo unitario se expresa en ${state.currency} (sin conversión de tipo de cambio).`;
  }
}

async function init() {
  try {
    const session = await api('/api/session');
    if (!session.user) {
      window.location.href = '/?redirect=/calculadora-emisiones';
      return;
    }
    state.fuels = await api('/api/emissions/fuels');
    const sel = $('#ec-fuel-select');
    state.fuels.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = state.lang === 'es' ? f.nameEs : f.name;
      sel.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = state.lang === 'es' ? 'Composición manual' : 'Manual composition';
    sel.appendChild(customOpt);

    sel.addEventListener('change', applyFuelSelection);
    $('#ec-calculate-btn').addEventListener('click', runCalculate);
    $('#ec-export-btn').addEventListener('click', exportReport);
    $('#ec-lang').addEventListener('change', (e) => {
      state.lang = e.target.value;
      applyLang();
      if (state.lastResult) renderResults(state.lastResult.result, state.lastResult.input);
    });
    $('#ec-currency').addEventListener('change', (e) => {
      state.currency = e.target.value;
      updateCurrencyHint();
      if (state.lastResult) renderResults(state.lastResult.result, state.lastResult.input);
    });
    $('#ec-use-co2').addEventListener('change', (e) => {
      document.querySelectorAll('.ec-co2-field').forEach((el) => el.classList.toggle('hidden', !e.target.checked));
      document.querySelectorAll('.ec-o2-field').forEach((el) => el.classList.toggle('hidden', e.target.checked));
    });
    $('#ec-operation-enabled').addEventListener('change', toggleOperationFields);
    $('#ec-downtime-enabled').addEventListener('change', toggleOperationFields);

    applyFuelSelection();
    toggleOperationFields();
    applyLang();
  } catch {
    window.location.href = '/?redirect=/calculadora-emisiones';
  }
}

document.addEventListener('DOMContentLoaded', init);
