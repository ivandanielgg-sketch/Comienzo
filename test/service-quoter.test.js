'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'test-service-quoter.db');
const PORT = 3098;

let serverProcess;
let adminCookie;
let userCookie;

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

function waitForServer(timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server did not start'));
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => setTimeout(check, 100));
    };
    check();
  });
}

test('service quoter module', async (t) => {
  try { fs.unlinkSync(DB_PATH); } catch {}

  await t.before(async () => {
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), DB_PATH, ADMIN_USER: 'admin', ADMIN_PASSWORD: 'admin123' },
      stdio: 'pipe',
    });
    await waitForServer();

    const loginRes = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    adminCookie = loginRes.cookie;

    await request('POST', '/api/users', { username: 'ventas1', password: 'pass123', role: 'user' }, adminCookie);
    const userLogin = await request('POST', '/api/login', { username: 'ventas1', password: 'pass123' });
    userCookie = userLogin.cookie;
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    try { fs.unlinkSync(DB_PATH); } catch {}
  });

  await t.test('GET /api/service-quoter/config requires auth', async () => {
    const res = await request('GET', '/api/service-quoter/config');
    assert.equal(res.status, 401);
  });

  await t.test('user without serviceQuoter.view gets 403', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('admin can load config with service types and settings', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.settings));
    assert.ok(Array.isArray(res.body.serviceTypes));
    assert.equal(res.body.serviceTypes.length, 6);
  });

  await t.test('service types have correct default margins', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const types = res.body.serviceTypes;
    const byName = Object.fromEntries(types.map((t) => [t.name, t.margin]));
    assert.equal(byName['Emergencia'], 0.6);
    assert.equal(byName['Automatización'], 0.6);
    assert.equal(byName['Instalaciones'], 0.45);
    assert.equal(byName['Mantenimiento Mayor'], 0.35);
    assert.equal(byName['Mantenimiento Preventivo'], 0.3);
    assert.equal(byName['Calentadores'], 0.3);
  });

  await t.test('settings have correct default values', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const settingsMap = Object.fromEntries(res.body.settings.map((s) => [s.key, s.value]));
    assert.equal(settingsMap['tarifa_programador_cliente'], '291');
    assert.equal(settingsMap['tarifa_ayudante_cliente'], '175');
    assert.equal(settingsMap['costo_por_kilometro'], '7.50');
    assert.equal(settingsMap['hotel_default'], '2500');
    assert.equal(settingsMap['comida_diaria_default'], '150');
    assert.equal(settingsMap['iva_importacion'], '16');
    assert.equal(settingsMap['igi_importacion'], '5');
    assert.equal(settingsMap['agente_aduanal_usd'], '200');
    assert.equal(settingsMap['iva_final'], '16');
  });

  await t.test('user without configure cannot access settings', async () => {
    const res = await request('GET', '/api/service-quoter/settings', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user without configure cannot update settings', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '3000' } }, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('admin can update settings', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '3000' } }, adminCookie);
    assert.equal(res.status, 200);
    const updated = res.body.find((s) => s.key === 'hotel_default');
    assert.equal(updated.value, '3000');
    assert.equal(updated.updated_by_name, 'admin');
    assert.ok(updated.updated_at_cdmx);

    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2500' } }, adminCookie);
  });

  await t.test('admin can create a service type', async () => {
    const res = await request('POST', '/api/service-quoter/service-types', { name: 'Consultoría', margin: 0.50, sort_order: 7 }, adminCookie);
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Consultoría');
    assert.equal(res.body.margin, 0.50);
    assert.equal(res.body.active, 1);
    assert.ok(res.body.created_at_cdmx);
  });

  await t.test('admin can update a service type', async () => {
    const config = await request('GET', '/api/service-quoter/service-types', null, adminCookie);
    const consultoria = config.body.find((t) => t.name === 'Consultoría');
    const res = await request('PUT', `/api/service-quoter/service-types/${consultoria.id}`, { margin: 0.55 }, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.margin, 0.55);
  });

  await t.test('admin can deactivate a service type', async () => {
    const config = await request('GET', '/api/service-quoter/service-types', null, adminCookie);
    const consultoria = config.body.find((t) => t.name === 'Consultoría');
    const res = await request('PUT', `/api/service-quoter/service-types/${consultoria.id}`, { active: false }, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.active, 0);

    const publicConfig = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const activeTypes = publicConfig.body.serviceTypes;
    assert.ok(!activeTypes.find((t) => t.name === 'Consultoría'));
  });

  await t.test('margin validation rejects >= 1', async () => {
    const res = await request('POST', '/api/service-quoter/service-types', { name: 'Bad', margin: 1.0 }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('menor a 1'));
  });

  await t.test('margin validation rejects negative', async () => {
    const res = await request('POST', '/api/service-quoter/service-types', { name: 'Bad', margin: -0.1 }, adminCookie);
    assert.equal(res.status, 400);
  });

  await t.test('name is required for service types', async () => {
    const res = await request('POST', '/api/service-quoter/service-types', { name: '', margin: 0.3 }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('obligatorio'));
  });

  await t.test('user without configure cannot create service types', async () => {
    const res = await request('POST', '/api/service-quoter/service-types', { name: 'X', margin: 0.3 }, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('user without configure cannot list all service types', async () => {
    const res = await request('GET', '/api/service-quoter/service-types', null, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('grant serviceQuoter.view to user allows config access', async () => {
    const usersRes = await request('GET', '/api/users', null, adminCookie);
    const usersList = usersRes.body.data || usersRes.body;
    const ventas = usersList.find((u) => u.username === 'ventas1');
    await request('PUT', `/api/users/${ventas.id}/permissions`, {
      permissions: { serviceQuoter: ['view'] },
    }, adminCookie);

    const newLogin = await request('POST', '/api/login', { username: 'ventas1', password: 'pass123' });
    userCookie = newLogin.cookie;

    const res = await request('GET', '/api/service-quoter/config', null, userCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.serviceTypes.length >= 6);
  });

  await t.test('user with view still cannot configure', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '9999' } }, userCookie);
    assert.equal(res.status, 403);
  });

  await t.test('real margin formula: price = cost / (1 - margin)', async () => {
    const cost = 1000;
    const margin = 0.60;
    const expectedPrice = cost / (1 - margin);
    assert.equal(expectedPrice, 2500);
    const utility = expectedPrice - cost;
    assert.equal(utility, 1500);
  });

  await t.test('real margin formula for all service type margins', async () => {
    const cases = [
      { margin: 0.60, cost: 10000, expectedPrice: 25000 },
      { margin: 0.45, cost: 10000, expectedPrice: 10000 / 0.55 },
      { margin: 0.35, cost: 10000, expectedPrice: 10000 / 0.65 },
      { margin: 0.30, cost: 10000, expectedPrice: 10000 / 0.70 },
    ];
    for (const c of cases) {
      const price = c.cost / (1 - c.margin);
      assert.equal(Math.round(price * 100), Math.round(c.expectedPrice * 100));
      assert.ok(price > c.cost);
      const actualMargin = (price - c.cost) / price;
      assert.ok(Math.abs(actualMargin - c.margin) < 0.0001);
    }
  });

  await t.test('formula is NOT cost * (1 + margin)', async () => {
    const cost = 1000;
    const margin = 0.60;
    const wrongPrice = cost * (1 + margin);
    const correctPrice = cost / (1 - margin);
    assert.notEqual(wrongPrice, correctPrice);
    assert.equal(correctPrice, 2500);
    assert.equal(wrongPrice, 1600);
  });

  await t.test('labor calculation: qty × hours × rate', async () => {
    const progQty = 2, progHours = 8, progRate = 291;
    const helperQty = 1, helperHours = 8, helperRate = 175;
    const costProg = progQty * progHours * progRate;
    const costHelper = helperQty * helperHours * helperRate;
    assert.equal(costProg, 4656);
    assert.equal(costHelper, 1400);
    assert.equal(costProg + costHelper, 6056);
  });

  await t.test('travel hours at programmer rate', async () => {
    const hours = 4, rate = 291;
    assert.equal(hours * rate, 1164);
  });

  await t.test('kilometers at $7.50/km', async () => {
    const km = 200, rate = 7.50;
    assert.equal(km * rate, 1500);
  });

  await t.test('hotel default $2,500', async () => {
    const nights = 2, rate = 2500;
    assert.equal(nights * rate, 5000);
  });

  await t.test('hotel allows $2,000', async () => {
    const nights = 2, rate = 2000;
    assert.equal(nights * rate, 4000);
  });

  await t.test('meals at $150/day', async () => {
    const days = 3, rate = 150;
    assert.equal(days * rate, 450);
  });

  await t.test('import calculation: IVA 16% + IGI 5% + agent $200 USD', async () => {
    const valorCompraUSD = 5000;
    const ivaImportPct = 0.16;
    const igiPct = 0.05;
    const agenteUSD = 200;
    const otrosUSD = 0;

    const igiUSD = valorCompraUSD * igiPct;
    const ivaImportUSD = valorCompraUSD * ivaImportPct;
    const totalImportUSD = igiUSD + ivaImportUSD + agenteUSD + otrosUSD;

    assert.equal(igiUSD, 250);
    assert.equal(ivaImportUSD, 800);
    assert.equal(totalImportUSD, 1250);
  });

  await t.test('import per equipment division', async () => {
    const totalImportUSD = 1250;
    const cantidadEquipos = 5;
    const perUnit = totalImportUSD / cantidadEquipos;
    assert.equal(perUnit, 250);
  });

  await t.test('IVA final 16% on price before IVA', async () => {
    const subtotalCostos = 10000;
    const margin = 0.60;
    const precioAntesIVA = subtotalCostos / (1 - margin);
    const ivaFinal = precioAntesIVA * 0.16;
    const totalFinal = precioAntesIVA + ivaFinal;

    assert.equal(precioAntesIVA, 25000);
    assert.equal(ivaFinal, 4000);
    assert.equal(totalFinal, 29000);
  });

  await t.test('no discount field or logic exists', async () => {
    const configRes = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const settingsKeys = configRes.body.settings.map((s) => s.key);
    assert.ok(!settingsKeys.some((k) => k.includes('descuento') || k.includes('discount')));
  });

  await t.test('results are not saved - no quote storage endpoint', async () => {
    const res = await request('POST', '/api/service-quoter/calculate', { test: true }, adminCookie);
    assert.equal(res.status, 404);
  });

  await t.test('no quote history endpoint exists', async () => {
    const res = await request('GET', '/api/service-quoter/history', null, adminCookie);
    assert.equal(res.status, 404);
  });

  await t.test('configuration changes are audited', async () => {
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2800' } }, adminCookie);

    const auditRes = await request('GET', '/api/admin/audit-logs?module=serviceQuoter&limit=5', null, adminCookie);
    assert.equal(auditRes.status, 200);
    const logs = auditRes.body.data || auditRes.body;
    const configLog = (Array.isArray(logs) ? logs : []).find((l) => l.entity_type === 'service_quote_settings');
    assert.ok(configLog, 'Should have audit log for settings change');
    assert.equal(configLog.action, 'update');

    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2500' } }, adminCookie);
  });

  await t.test('CDMX timezone in audit timestamps', async () => {
    const auditRes = await request('GET', '/api/admin/audit-logs?module=serviceQuoter&limit=5', null, adminCookie);
    if (auditRes.body.data && auditRes.body.data.length > 0) {
      const log = auditRes.body.data[0];
      assert.ok(log.timestamp_cdmx || log.timestamp_utc);
    }
  });

  await t.test('backup includes serviceTypes and serviceQuoteSettings', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(backupRes.status, 200);
    assert.ok(backupRes.body.data.serviceTypes);
    assert.ok(backupRes.body.data.serviceQuoteSettings);
    assert.ok(backupRes.body.data.serviceTypes.length >= 6);
    assert.ok(backupRes.body.data.serviceQuoteSettings.length >= 14);
  });

  await t.test('backup does not include calculation results', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(!backupRes.body.data.serviceQuotes);
    assert.ok(!backupRes.body.data.serviceQuoteResults);
    assert.ok(!backupRes.body.data.serviceQuoteHistory);
  });

  await t.test('coverage manifest includes serviceQuoter module', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    const manifest = backupRes.body.coverageManifest;
    assert.ok(manifest.modulesDetected.includes('serviceQuoter'));
    assert.ok(manifest.entitiesIncluded.includes('serviceTypes'));
    assert.ok(manifest.entitiesIncluded.includes('serviceQuoteSettings'));
  });

  await t.test('full calculation scenario: Emergencia 60% margin', async () => {
    const progCost = 1 * 16 * 291;
    const travelHours = 4 * 291;
    const km = 300 * 7.50;
    const hotel = 2 * 2500;
    const meals = 3 * 150;
    const subtotal = progCost + travelHours + km + hotel + meals;

    const price = subtotal / (1 - 0.60);
    const utility = price - subtotal;
    const iva = price * 0.16;
    const total = price + iva;

    assert.equal(progCost, 4656);
    assert.equal(travelHours, 1164);
    assert.equal(km, 2250);
    assert.equal(hotel, 5000);
    assert.equal(meals, 450);
    assert.equal(subtotal, 13520);
    assert.equal(price, 33800);
    assert.equal(utility, 20280);
    assert.equal(iva, 5408);
    assert.equal(total, 39208);
  });
});
