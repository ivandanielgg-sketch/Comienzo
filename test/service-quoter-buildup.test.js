'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('fs');

const {
  calculateRoleBuildup,
  commercialCushion,
  planUnderfloorCorrections,
  formatCorrectionSummary,
  estimateCorrectionImpact,
  ceilToMultipleOf5,
  BUILDUP_FIELD_DEFAULTS,
  ROLE_META,
  REFERENCE_QUOTE,
  getBuildupSettingDefaults,
} = require('../src/serviceQuoterBuildup');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-service-quoter-buildup.db');
const PORT = 3097;

let serverProcess;
let adminCookie;

function request(method, urlPath, body, cookie) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const newCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), cookie: newCookie });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: newCookie });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server did not start'));
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => { res.resume(); resolve(); });
      req.on('error', () => setTimeout(check, 100));
    };
    check();
  });
}

test('service quoter buildup calculations', async (t) => {
  await t.test('ceilToMultipleOf5', () => {
    assert.equal(ceilToMultipleOf5(198.64), 200);
    assert.equal(ceilToMultipleOf5(227.11), 230);
    assert.equal(ceilToMultipleOf5(230), 230);
    assert.equal(ceilToMultipleOf5(0), 0);
  });

  await t.test('defaults: encargado costo día ≈ 2045 and piso ≈ 230', () => {
    const calc = calculateRoleBuildup(BUILDUP_FIELD_DEFAULTS.tecnico);
    assert.ok(Math.abs(calc.costo_dia_hombre - 2045) <= 10, `got ${calc.costo_dia_hombre}`);
    assert.equal(calc.tarifa_piso, 230);
  });

  await t.test('defaults: ayudante costo día ≈ 1789 and piso ≈ 200', () => {
    const calc = calculateRoleBuildup(BUILDUP_FIELD_DEFAULTS.ayudante);
    assert.ok(Math.abs(calc.costo_dia_hombre - 1789) <= 10, `got ${calc.costo_dia_hombre}`);
    assert.equal(calc.tarifa_piso, 200);
  });

  await t.test('ayudante under floor is red; prog/tech green with cushion', () => {
    const tech = calculateRoleBuildup(BUILDUP_FIELD_DEFAULTS.tecnico);
    const prog = calculateRoleBuildup(BUILDUP_FIELD_DEFAULTS.programador);
    const helper = calculateRoleBuildup(BUILDUP_FIELD_DEFAULTS.ayudante);

    const cProg = commercialCushion(300, prog.tarifa_piso, prog.inputs.horas_jornada);
    const cTech = commercialCushion(250, tech.tarifa_piso, tech.inputs.horas_jornada);
    const cHelp = commercialCushion(175, helper.tarifa_piso, helper.inputs.horas_jornada);

    assert.equal(cProg.is_above_or_equal, true);
    assert.equal(cTech.is_above_or_equal, true);
    assert.equal(cHelp.needs_correction, true);
    assert.equal(cProg.per_hour, 300 - 230);
    assert.equal(cTech.per_hour, 250 - 230);
    assert.equal(cHelp.per_hour, 175 - 200);
    assert.equal(cProg.per_day, (300 - 230) * 9);
  });

  await t.test('planUnderfloorCorrections only raises ayudante', () => {
    const plan = planUnderfloorCorrections([
      { roleId: 'programador', label: ROLE_META.programador.label, rateKey: ROLE_META.programador.rateKey, tarifa_vigente: 300, tarifa_piso: 230 },
      { roleId: 'tecnico', label: ROLE_META.tecnico.label, rateKey: ROLE_META.tecnico.rateKey, tarifa_vigente: 250, tarifa_piso: 230 },
      { roleId: 'ayudante', label: ROLE_META.ayudante.label, rateKey: ROLE_META.ayudante.rateKey, tarifa_vigente: 175, tarifa_piso: 200 },
    ]);
    assert.equal(plan.changes.length, 1);
    assert.equal(plan.changes[0].roleId, 'ayudante');
    assert.equal(plan.changes[0].from, 175);
    assert.equal(plan.changes[0].to, 200);
    assert.equal(plan.unchanged.length, 2);
    const summary = formatCorrectionSummary(plan);
    assert.ok(summary.includes('Ayudante: $175 → $200'));
    assert.ok(summary.includes('sin cambios'));
  });

  await t.test('never plans a rate decrease even if floor is lower', () => {
    const plan = planUnderfloorCorrections([
      { roleId: 'programador', label: 'Programador', rateKey: 'tarifa_programador_hora', tarifa_vigente: 300, tarifa_piso: 100 },
    ]);
    assert.equal(plan.changes.length, 0);
    assert.equal(plan.unchanged[0].rate, 300);
  });

  await t.test('reference impact: +4500 labor and ≈ +3.2% total', () => {
    const beforeRates = { progRate: 300, techRate: 250, helperRate: 175 };
    const afterRates = { progRate: 300, techRate: 250, helperRate: 200 };
    const ref = REFERENCE_QUOTE;
    const persons = ref.progQty + ref.techQty + ref.helperQty;
    const viaticos = (ref.hotelNights * ref.hotelRate) + (ref.mealRate * persons * ref.mealDays * ref.mealsPerDay);
    const impact = estimateCorrectionImpact(beforeRates, afterRates, {
      progQty: ref.progQty,
      techQty: ref.techQty,
      helperQty: ref.helperQty,
      progHours: ref.hoursPerRole,
      techHours: ref.hoursPerRole,
      helperHours: ref.hoursPerRole,
      transport: ref.transport,
      viaticos,
      otherCosts: ref.otherCosts,
      margin: ref.margin,
    });
    assert.equal(impact.deltaLabor, 4500);
    assert.ok(Math.abs(impact.deltaTotalPct - 3.2) < 0.15, `got ${impact.deltaTotalPct}`);
  });

  await t.test('seed defaults include buildup keys', () => {
    const rows = getBuildupSettingDefaults();
    assert.equal(rows.length, 18);
    assert.ok(rows.every((r) => r.category === 'buildup'));
    assert.ok(rows.some((r) => r.key === 'buildup_ayudante_sobresueldo_diario' && r.value === '250'));
  });
});

test('service quoter buildup persistence API', async (t) => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }

  await t.before(async () => {
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, ADMIN_USER: 'admin', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();
    const loginRes = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = loginRes.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  });

  await t.test('config includes buildup settings after seed', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    assert.equal(res.status, 200);
    const keys = res.body.settings.map((s) => s.key);
    assert.ok(keys.includes('buildup_programador_sueldo_semanal'));
    assert.ok(keys.includes('buildup_ayudante_sobresueldo_diario'));
  });

  await t.test('buildup settings persist with admin password', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', {
      settings: { buildup_ayudante_sueldo_semanal: '5600' },
      adminPassword: 'admin123',
    }, adminCookie);
    assert.equal(res.status, 200);
    const check = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const row = check.body.settings.find((s) => s.key === 'buildup_ayudante_sueldo_semanal');
    assert.equal(row.value, '5600');
    await request('PUT', '/api/service-quoter/settings', {
      settings: { buildup_ayudante_sueldo_semanal: '5500' },
      adminPassword: 'admin123',
    }, adminCookie);
  });

  await t.test('HTML config section and correct button exist; no auto-lower action', async () => {
    const res = await request('GET', '/', null, adminCookie);
    const html = typeof res.body === 'string' ? res.body : '';
    assert.ok(html.includes('Build-up de tarifas por rol'));
    assert.ok(html.includes('sq-buildup-correct-btn'));
    assert.ok(html.includes('Corregir tarifas bajo costo'));
    assert.ok(!html.includes('Aplicar tarifas al cotizador'));
    assert.ok(html.includes('service-quoter-buildup.js'));
  });
});
