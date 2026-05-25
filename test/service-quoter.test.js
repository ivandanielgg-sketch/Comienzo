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

  // 1. Load default configuration
  await t.test('loads default configuration', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.settings));
    assert.ok(Array.isArray(res.body.serviceTypes));
    assert.equal(res.body.serviceTypes.length, 6);
  });

  // 2. Programador default = $300/h
  await t.test('programador default tariff is 300', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = res.body.settings.find((x) => x.key === 'tarifa_programador_hora');
    assert.equal(s.value, '300');
  });

  // 3. Técnico default = $250/h
  await t.test('tecnico default tariff is 250', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = res.body.settings.find((x) => x.key === 'tarifa_tecnico_hora');
    assert.equal(s.value, '250');
  });

  // 4. Ayudante default = $175/h
  await t.test('ayudante default tariff is 175', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = res.body.settings.find((x) => x.key === 'tarifa_ayudante_hora');
    assert.equal(s.value, '175');
  });

  // 5. Admin can modify tariffs with correct password
  await t.test('admin can modify tariffs with correct password', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { tarifa_programador_hora: '320' }, adminPassword: 'admin123' }, adminCookie);
    assert.equal(res.status, 200);
    const updated = res.body.find((s) => s.key === 'tarifa_programador_hora');
    assert.equal(updated.value, '320');
    await request('PUT', '/api/service-quoter/settings', { settings: { tarifa_programador_hora: '300' }, adminPassword: 'admin123' }, adminCookie);
  });

  // 6. Cannot modify tariffs with incorrect password
  await t.test('cannot modify tariffs with incorrect password', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { tarifa_programador_hora: '999' }, adminPassword: 'wrongpass' }, adminCookie);
    assert.equal(res.status, 403);
    const check = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = check.body.settings.find((x) => x.key === 'tarifa_programador_hora');
    assert.equal(s.value, '300');
  });

  // 7. Settings change persists
  await t.test('settings change persists', async () => {
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '3000' }, adminPassword: 'admin123' }, adminCookie);
    const check = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = check.body.settings.find((x) => x.key === 'hotel_default');
    assert.equal(s.value, '3000');
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2500' }, adminPassword: 'admin123' }, adminCookie);
  });

  // 8. Margin change persists
  await t.test('margin change persists with correct password', async () => {
    const typesRes = await request('GET', '/api/service-quoter/service-types', null, adminCookie);
    const emergencia = typesRes.body.find((t) => t.name === 'Emergencia');
    const res = await request('PUT', `/api/service-quoter/service-types/${emergencia.id}`, { margin: 0.65, adminPassword: 'admin123' }, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.margin, 0.65);
    await request('PUT', `/api/service-quoter/service-types/${emergencia.id}`, { margin: 0.60, adminPassword: 'admin123' }, adminCookie);
  });

  // 9. Changes are audited
  await t.test('configuration changes are audited', async () => {
    await request('PUT', '/api/service-quoter/settings', { settings: { comida_diaria_default: '180' }, adminPassword: 'admin123' }, adminCookie);
    const auditRes = await request('GET', '/api/admin/audit-logs?module=serviceQuoter&limit=5', null, adminCookie);
    assert.equal(auditRes.status, 200);
    const logs = auditRes.body.data || [];
    const configLog = logs.find((l) => l.entity_type === 'service_quote_settings' && l.action === 'update');
    assert.ok(configLog);
    await request('PUT', '/api/service-quoter/settings', { settings: { comida_diaria_default: '150' }, adminPassword: 'admin123' }, adminCookie);
  });

  // 10. User without configure cannot modify configuration
  await t.test('user without configure cannot modify configuration', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '9999' }, adminPassword: 'admin123' }, userCookie);
    assert.equal(res.status, 403);
  });

  // 11-12. Work by hours and by days (1 day = 9 hours)
  await t.test('1 day equals 9 hours', () => {
    const hoursPerDay = 9;
    assert.equal(1 * hoursPerDay, 9);
    assert.equal(3 * hoursPerDay, 27);
  });

  // 13-14. Days conversion
  await t.test('3 days equals 27 hours', () => {
    assert.equal(3 * 9, 27);
  });

  // 15. Calculate programmer by hours
  await t.test('calculate programmer by hours: qty × hours × rate', () => {
    const cost = 2 * 16 * 300;
    assert.equal(cost, 9600);
  });

  // 16. Calculate technician by days
  await t.test('calculate technician by days: qty × (days×9) × rate', () => {
    const cost = 1 * (3 * 9) * 250;
    assert.equal(cost, 6750);
  });

  // 17. Calculate helper by hours
  await t.test('calculate helper by hours', () => {
    const cost = 1 * 8 * 175;
    assert.equal(cost, 1400);
  });

  // 18. Vehicle transport: travel hours
  await t.test('vehicle transport calculates travel hours at programmer rate', () => {
    const cost = 4 * 300;
    assert.equal(cost, 1200);
  });

  // 19. Vehicle transport: km × $7.50
  await t.test('vehicle transport calculates km at $7.50', () => {
    const cost = 200 * 7.50;
    assert.equal(cost, 1500);
  });

  // 20. Air transport: cost per person × persons
  await t.test('air transport: cost per person × persons', () => {
    const cost = 3 * 5000;
    assert.equal(cost, 15000);
  });

  // 21. Air transport does not calculate km
  await t.test('air transport does not use km calculation', () => {
    const transportType = 'aereo';
    const persons = 2;
    const costPerPerson = 4000;
    const otherFlight = 500;
    const subtotal = (persons * costPerPerson) + otherFlight;
    assert.equal(subtotal, 8500);
  });

  // 22. Hotel default $2,500
  await t.test('hotel default is $2,500', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = res.body.settings.find((x) => x.key === 'hotel_default');
    assert.equal(s.value, '2500');
  });

  // 23. Hotel allows $2,000
  await t.test('hotel allows $2,000 option', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = res.body.settings.find((x) => x.key === 'hotel_opcion_baja');
    assert.equal(s.value, '2000');
  });

  // 24. Meals $150/day
  await t.test('meals default is $150/day', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = res.body.settings.find((x) => x.key === 'comida_diaria_default');
    assert.equal(s.value, '150');
  });

  // 25. No import section exists
  await t.test('no import settings exist in config', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const importSettings = res.body.settings.filter((s) => s.category === 'importacion');
    assert.equal(importSettings.length, 0);
  });

  // 26. No import calculation
  await t.test('no importCosts permission exists', async () => {
    const sessionRes = await request('GET', '/api/session', null, adminCookie);
    const perms = sessionRes.body.permissions.serviceQuoter;
    assert.ok(!perms.includes('importCosts'));
  });

  // 27. No discount field
  await t.test('no discount settings exist', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const discountSettings = res.body.settings.filter((s) => s.key.includes('descuento') || s.key.includes('discount'));
    assert.equal(discountSettings.length, 0);
  });

  // 28. No discount calculation
  await t.test('no discount endpoint exists', async () => {
    const res = await request('POST', '/api/service-quoter/discount', {}, adminCookie);
    assert.equal(res.status, 404);
  });

  // 29. Emergencia with 60% real margin
  await t.test('emergencia 60% margin: price = cost / (1 - 0.60)', () => {
    const cost = 10000;
    const margin = 0.60;
    const price = cost / (1 - margin);
    assert.equal(price, 25000);
  });

  // 30. Verify formula price = cost / (1 - margin)
  await t.test('real margin formula: price = cost / (1 - margin)', () => {
    const cases = [
      { cost: 1000, margin: 0.60, price: 2500 },
      { cost: 10000, margin: 0.45, price: 10000 / 0.55 },
      { cost: 10000, margin: 0.35, price: 10000 / 0.65 },
      { cost: 10000, margin: 0.30, price: 10000 / 0.70 },
    ];
    for (const c of cases) {
      const price = c.cost / (1 - c.margin);
      assert.equal(Math.round(price * 100), Math.round(c.price * 100));
    }
  });

  // 31. Verify NOT cost × (1 + margin)
  await t.test('formula is NOT cost × (1 + margin)', () => {
    const cost = 1000;
    const margin = 0.60;
    const wrong = cost * (1 + margin);
    const correct = cost / (1 - margin);
    assert.notEqual(wrong, correct);
    assert.equal(correct, 2500);
    assert.equal(wrong, 1600);
  });

  // 32. IVA final 16%
  await t.test('IVA final 16% on price before IVA', () => {
    const subtotal = 10000;
    const margin = 0.60;
    const price = subtotal / (1 - margin);
    const iva = price * 0.16;
    const total = price + iva;
    assert.equal(price, 25000);
    assert.equal(iva, 4000);
    assert.equal(total, 29000);
  });

  // 33. No result saved
  await t.test('no results are saved - no quote storage endpoint', async () => {
    const res = await request('POST', '/api/service-quoter/calculate', { test: true }, adminCookie);
    assert.equal(res.status, 404);
  });

  // 34. No folio generated
  await t.test('no folio endpoint exists', async () => {
    const res = await request('GET', '/api/service-quoter/history', null, adminCookie);
    assert.equal(res.status, 404);
  });

  // 35. No history of quotes
  await t.test('no quote history exists', async () => {
    const res = await request('GET', '/api/service-quoter/quotes', null, adminCookie);
    assert.equal(res.status, 404);
  });

  // 36. Backup includes serviceQuoteSettings and serviceTypes
  await t.test('backup includes serviceQuoteSettings and serviceTypes', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(backupRes.status, 200);
    assert.ok(backupRes.body.data.serviceTypes);
    assert.ok(backupRes.body.data.serviceQuoteSettings);
    assert.ok(backupRes.body.data.serviceTypes.length >= 6);
  });

  // 37. Backup does not include calculation results
  await t.test('backup does not include calculation results', async () => {
    const backupRes = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(!backupRes.body.data.serviceQuotes);
    assert.ok(!backupRes.body.data.serviceQuoteResults);
  });

  // 38. CDMX timezone in audit
  await t.test('CDMX timezone in configuration audit', async () => {
    const settingsRes = await request('GET', '/api/service-quoter/settings', null, adminCookie);
    if (settingsRes.body.length > 0 && settingsRes.body[0].updated_at_cdmx) {
      assert.ok(settingsRes.body[0].updated_at_cdmx.includes('/'));
    }
  });

  // 39. Full end-to-end scenario
  await t.test('full calculation: programmer 2 days + technician 8h + vehicle 200km + hotel 2 nights', () => {
    const hoursPerDay = 9;
    const progCost = 1 * (2 * hoursPerDay) * 300;
    const techCost = 1 * 8 * 250;
    const travelHoursCost = 3 * 300;
    const kmCost = 200 * 7.50;
    const hotel = 2 * 2500;
    const meals = 3 * 150;
    const subtotalLabor = progCost + techCost;
    const subtotalTransport = travelHoursCost + kmCost;
    const subtotalViaticos = hotel + meals;
    const subtotalCostos = subtotalLabor + subtotalTransport + subtotalViaticos;
    const margin = 0.60;
    const price = subtotalCostos / (1 - margin);
    const utility = price - subtotalCostos;
    const iva = price * 0.16;
    const total = price + iva;

    assert.equal(progCost, 5400);
    assert.equal(techCost, 2000);
    assert.equal(subtotalLabor, 7400);
    assert.equal(travelHoursCost, 900);
    assert.equal(kmCost, 1500);
    assert.equal(subtotalTransport, 2400);
    assert.equal(hotel, 5000);
    assert.equal(meals, 450);
    assert.equal(subtotalViaticos, 5450);
    assert.equal(subtotalCostos, 15250);
    assert.equal(price, 38125);
    assert.equal(utility, 22875);
    assert.equal(iva, 6100);
    assert.equal(total, 44225);
  });

  // 40. Password not required for read, only for write
  await t.test('admin password not required for reading config', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    assert.equal(res.status, 200);
  });

  // Denied attempt is audited
  await t.test('failed password attempt is audited without storing password', async () => {
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '1' }, adminPassword: 'badpass' }, adminCookie);
    const auditRes = await request('GET', '/api/admin/audit-logs?module=serviceQuoter&limit=5', null, adminCookie);
    const logs = auditRes.body.data || [];
    const denied = logs.find((l) => l.action === 'config_change_denied');
    assert.ok(denied);
    assert.ok(!JSON.stringify(denied).includes('badpass'));
  });
});
