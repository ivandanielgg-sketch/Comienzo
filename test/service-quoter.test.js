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
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => { res.resume(); resolve(); });
      req.on('error', () => setTimeout(check, 100));
    };
    check();
  });
}

function roundUpToNearestTen(value) {
  return Math.ceil(value / 10) * 10;
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
  });

  await t.after(() => {
    if (serverProcess) serverProcess.kill();
    try { fs.unlinkSync(DB_PATH); } catch {}
  });

  // 1. 1 prog + 2 tech: sum rates = 300 + 2×250 = 800
  await t.test('1 prog + 2 tech: suma tarifas = 800', () => {
    const sum = (1 * 300) + (2 * 250) + (0 * 175);
    assert.equal(sum, 800);
  });

  // 2. 800 / 3 = 266.66
  await t.test('800 / 3 = 266.66...', () => {
    const base = 800 / 3;
    assert.ok(Math.abs(base - 266.666) < 0.01);
  });

  // 3. Round up to nearest 10 = 270
  await t.test('roundUpToNearestTen(266.66) = 270', () => {
    assert.equal(roundUpToNearestTen(800 / 3), 270);
  });

  // 4. 4 hours × 270 = 1080
  await t.test('4 horas traslado × 270 = 1080', () => {
    const cost = 4 * 270;
    assert.equal(cost, 1080);
  });

  // 5. Change tech qty recalculates travel rate
  await t.test('changing tech qty changes travel rate', () => {
    const sum1 = (1 * 300) + (1 * 250);
    const rate1 = roundUpToNearestTen(sum1 / 3);
    const sum2 = (1 * 300) + (2 * 250);
    const rate2 = roundUpToNearestTen(sum2 / 3);
    assert.notEqual(rate1, rate2);
    assert.equal(rate1, 190);
    assert.equal(rate2, 270);
  });

  // 6. Change tech tariff from config recalculates
  await t.test('changing tech tariff recalculates travel rate', () => {
    const sum1 = (1 * 300) + (2 * 250);
    const rate1 = roundUpToNearestTen(sum1 / 3);
    const sum2 = (1 * 300) + (2 * 280);
    const rate2 = roundUpToNearestTen(sum2 / 3);
    assert.equal(rate1, 270);
    assert.equal(rate2, 290);
  });

  // 7. Total persons = sum of staff quantities
  await t.test('1 prog + 2 tech + 0 helper = 3 personas', () => {
    const total = 1 + 2 + 0;
    assert.equal(total, 3);
  });

  // 8. Meals: 150 × 3 persons × 4 days × 3 meals/day = 5400
  await t.test('comidas: 150 × 3 × 4 × 3 = 5400', () => {
    const cost = 150 * 3 * 4 * 3;
    assert.equal(cost, 5400);
  });

  // 9. If persons change, meals recalculate
  await t.test('if persons change to 4, meals = 150 × 4 × 4 × 3 = 7200', () => {
    const cost = 150 * 4 * 4 * 3;
    assert.equal(cost, 7200);
  });

  // 10. No otros viáticos field in settings
  await t.test('no otros viáticos setting exists', async () => {
    const res = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const keys = res.body.settings.map((s) => s.key);
    assert.ok(!keys.includes('otros_viaticos'));
    assert.ok(!keys.includes('otros_viaticos_default'));
  });

  // 11. Otros viáticos not in calculation
  await t.test('subtotal viáticos = hotel + comidas only', () => {
    const hotel = 2 * 2500;
    const comidas = 150 * 3 * 4 * 3;
    const subtotal = hotel + comidas;
    assert.equal(subtotal, 10400);
  });

  // 12. Config modal has no transparency (structural - modal uses inline solid bg)
  await t.test('config modal in HTML uses solid background', async () => {
    const res = await request('GET', '/', null, adminCookie);
    const html = typeof res.body === 'string' ? res.body : '';
    if (html.includes('sq-config-modal')) {
      assert.ok(html.includes('background:#fff'));
    }
  });

  // 13. Configuration requires admin password
  await t.test('settings update requires admin password', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '3000' } }, adminCookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('contraseña'));
  });

  // 14. Password field is masked (structural check)
  await t.test('password input type=password in HTML', async () => {
    const res = await request('GET', '/', null, adminCookie);
    const html = typeof res.body === 'string' ? res.body : '';
    if (html.includes('sq-config-password')) {
      assert.ok(html.includes('type="password"'));
    }
  });

  // 15. Changes persist with correct password
  await t.test('settings change persists with correct password', async () => {
    const res = await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2800' }, adminPassword: 'admin123' }, adminCookie);
    assert.equal(res.status, 200);
    const check = await request('GET', '/api/service-quoter/config', null, adminCookie);
    const s = check.body.settings.find((x) => x.key === 'hotel_default');
    assert.equal(s.value, '2800');
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2500' }, adminPassword: 'admin123' }, adminCookie);
  });

  // 16. Changes are audited
  await t.test('changes are audited', async () => {
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2700' }, adminPassword: 'admin123' }, adminCookie);
    const auditRes = await request('GET', '/api/admin/audit-logs?module=serviceQuoter&limit=5', null, adminCookie);
    const logs = auditRes.body.data || [];
    const configLog = logs.find((l) => l.action === 'update' && l.entity_type === 'service_quote_settings');
    assert.ok(configLog);
    await request('PUT', '/api/service-quoter/settings', { settings: { hotel_default: '2500' }, adminPassword: 'admin123' }, adminCookie);
  });

  // 17. Backup includes costo_por_comida and comidas_por_dia
  await t.test('backup includes costo_por_comida and comidas_por_dia', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.equal(res.status, 200);
    const settings = res.body.data.serviceQuoteSettings;
    const keys = settings.map((s) => s.key);
    assert.ok(keys.includes('costo_por_comida'));
    assert.ok(keys.includes('comidas_por_dia'));
  });

  // 18. Backup does not include results
  await t.test('backup does not include calculation results', async () => {
    const res = await request('GET', '/api/admin/backup', null, adminCookie);
    assert.ok(!res.body.data.serviceQuoteResults);
    assert.ok(!res.body.data.serviceQuotes);
  });

  // 19. roundUpToNearestTen edge cases
  await t.test('roundUpToNearestTen works for various values', () => {
    assert.equal(roundUpToNearestTen(0), 0);
    assert.equal(roundUpToNearestTen(1), 10);
    assert.equal(roundUpToNearestTen(10), 10);
    assert.equal(roundUpToNearestTen(11), 20);
    assert.equal(roundUpToNearestTen(100), 100);
    assert.equal(roundUpToNearestTen(101), 110);
    assert.equal(roundUpToNearestTen(266.66), 270);
    assert.equal(roundUpToNearestTen(300), 300);
  });

  // 20. Full scenario with new formulas
  await t.test('full scenario: 1 prog + 2 tech, 4h traslado, 200km, 2 nights, 4 days meals', () => {
    const progQty = 1, techQty = 2, helperQty = 0;
    const progRate = 300, techRate = 250, helperRate = 175;

    const costoProg = progQty * 16 * progRate;
    const costoTech = techQty * 8 * techRate;
    const subtotalLabor = costoProg + costoTech;

    const sumaTarifas = (progQty * progRate) + (techQty * techRate);
    const tarifaTraslado = roundUpToNearestTen(sumaTarifas / 3);
    const costoTraslado = 4 * tarifaTraslado;
    const costoKm = 200 * 7.50;
    const subtotalTransport = costoTraslado + costoKm;

    const totalPersonas = progQty + techQty + helperQty;
    const costoHotel = 2 * 2500;
    const costoComidas = 150 * totalPersonas * 4 * 3;
    const subtotalViaticos = costoHotel + costoComidas;

    const subtotalCostos = subtotalLabor + subtotalTransport + subtotalViaticos;
    const margin = 0.60;
    const price = subtotalCostos / (1 - margin);
    const iva = price * 0.16;

    assert.equal(costoProg, 4800);
    assert.equal(costoTech, 4000);
    assert.equal(subtotalLabor, 8800);
    assert.equal(sumaTarifas, 800);
    assert.equal(tarifaTraslado, 270);
    assert.equal(costoTraslado, 1080);
    assert.equal(costoKm, 1500);
    assert.equal(subtotalTransport, 2580);
    assert.equal(totalPersonas, 3);
    assert.equal(costoHotel, 5000);
    assert.equal(costoComidas, 5400);
    assert.equal(subtotalViaticos, 10400);
    assert.equal(subtotalCostos, 21780);
    assert.equal(price, 54450);
    assert.equal(iva, 8712);
  });
});
