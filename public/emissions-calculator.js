'use strict';

/** Cliente UI — Calculadora de Emisiones Autoflame */

const state = {
  lang: 'es',
  unitSystem: 'metric',
  lastResult: null,
  fuels: [],
};

const I18N = {
  es: {
    title: 'Calculadora de Emisiones y Ahorro de Combustible',
    subtitle: 'Combustion Performance Data — Autoflame 2020',
    fuel: 'Combustible',
    composition: 'Composición (% masa C/H/S/N/O/W)',
    cv: 'Poder Calorífico (MJ/kg)',
    sg: 'Gravedad Específica',
    ambient: 'Condiciones ambiente',
    temp: 'Temperatura (°C)',
    pressure: 'Presión (kPa)',
    consumption: 'Combustible usado',
    unitCost: 'Costo unitario',
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
  },
  en: {
    title: 'Emissions & Fuel Savings Calculator',
    subtitle: 'Combustion Performance Data — Autoflame 2020',
    fuel: 'Fuel',
    composition: 'Composition (% mass C/H/S/N/O/W)',
    cv: 'Calorific Value (MJ/kg)',
    sg: 'Specific Gravity',
    ambient: 'Ambient conditions',
    temp: 'Temperature (°C)',
    pressure: 'Pressure (kPa)',
    consumption: 'Fuel consumption',
    unitCost: 'Unit cost',
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
  },
};

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

function renderEmissionsTable(result) {
  const gases = ['O2', 'CO2', 'CO', 'SO2', 'NO', 'H2O', 'N2', 'total'];
  const rows = gases
    .map((gas) => {
      const e = result.existing.emissions[gas] || {};
      const p = result.projected.emissions[gas] || {};
      return `<tr>
        <td>${gas}</td>
        <td class="calc-cell">${fmt(e.masa_kg)}</td>
        <td class="calc-cell">${fmt(e.volumen_m3)}</td>
        <td class="calc-cell">${fmt(p.masa_kg)}</td>
        <td class="calc-cell">${fmt(p.volumen_m3)}</td>
      </tr>`;
    })
    .join('');

  return `<table class="emissions-table ec-results-table">
    <thead><tr>
      <th>${t('gas')}</th>
      <th colspan="2">${t('existing')} — ${t('mass')} / ${t('volume')}</th>
      <th colspan="2">${t('projected')} — ${t('mass')} / ${t('volume')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderResults(result) {
  const el = $('#ec-results');
  if (!result.ok) {
    el.innerHTML = `<div class="message error"><strong>${t('errors')}:</strong><ul>${result.errors.map((e) => `<li>${e}</li>`).join('')}</ul></div>`;
    return;
  }

  el.innerHTML = `
    <section class="cards">
      <article><span>${t('co2Max')}</span><strong>${fmt(result.fuel.CO2_max_pct)} %</strong></article>
      <article><span>${t('existing')} — Net/Gross</span><strong>${fmt(result.existing.efficiency.net_pct)} / ${fmt(result.existing.efficiency.gross_pct)} %</strong></article>
      <article><span>${t('projected')} — Net/Gross</span><strong>${fmt(result.projected.efficiency.net_pct)} / ${fmt(result.projected.efficiency.gross_pct)} %</strong></article>
      <article><span>${t('savings')} combustible</span><strong>${fmt(result.savings.fuel_savings_pct)} %</strong></article>
    </section>

    <div class="layout" style="margin-top:16px;">
      <div class="panel">
        <div class="panel-header"><h3>${t('emissions')}</h3></div>
        ${renderEmissionsTable(result)}
        <p class="muted">${t('savings')} emisiones (volumétrica): <strong>${fmt(result.savings.emissions_savings_pct)} %</strong></p>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>${t('savings')}</h3></div>
        <table class="emissions-table">
          <tbody>
            <tr><td>Combustible ahorrado</td><td class="calc-cell">${fmt(result.savings.fuel_savings_volume, 3)} m³</td></tr>
            <tr><td>Ahorro costo combustible</td><td class="calc-cell">$${fmt(result.savings.fuel_cost_savings)}</td></tr>
            <tr><td>Mejora eficiencia neta</td><td class="calc-cell">${fmt(result.savings.efficiency_improvement_net)} %</td></tr>
            <tr><td>Mejora eficiencia bruta</td><td class="calc-cell">${fmt(result.savings.efficiency_improvement_gross)} %</td></tr>
            <tr><td>Mejora ΔT escape</td><td class="calc-cell">${fmt(result.savings.exhaust_delta_improvement_c, 1)} °C</td></tr>
            <tr><td>Ahorro pérdida chimenea</td><td class="calc-cell">${fmt(result.savings.stack_heat_loss_savings_MW, 3)} MW</td></tr>
            <tr><td>Heat input existente / proyectado</td><td class="calc-cell">${fmt(result.existing.heat_input_MW, 3)} / ${fmt(result.projected.heat_input_MW, 3)} MW</td></tr>
            <tr><td>Flujo combustible exist. / proy.</td><td class="calc-cell">${fmt(result.existing.fuel_flow_m3h, 3)} / ${fmt(result.projected.fuel_flow_m3h, 3)} m³/h</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div id="ec-chart-bars" class="ec-bar-chart panel" style="margin-top:16px;"></div>
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
    renderResults(result);
  } catch (err) {
    $('#ec-message').textContent = err.message;
    renderResults({ ok: false, errors: [err.message] });
  }
}

function exportReport() {
  if (!state.lastResult) {
    $('#ec-message').textContent = 'Calcule primero antes de exportar.';
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
    $('#ec-lang').addEventListener('change', (e) => { state.lang = e.target.value; applyLang(); });
    $('#ec-use-co2').addEventListener('change', (e) => {
      document.querySelectorAll('.ec-co2-field').forEach((el) => el.classList.toggle('hidden', !e.target.checked));
      document.querySelectorAll('.ec-o2-field').forEach((el) => el.classList.toggle('hidden', e.target.checked));
    });

    applyFuelSelection();
    applyLang();
  } catch {
    window.location.href = '/?redirect=/calculadora-emisiones';
  }
}

document.addEventListener('DOMContentLoaded', init);
