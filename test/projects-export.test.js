'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const {
  parseExportDateRange,
  daysBetweenInclusive,
  buildProjectsExcelWorkbook,
  MAX_RANGE_DAYS,
} = require('../src/projectsExport');

test('parseExportDateRange accepts valid year range', () => {
  const result = parseExportDateRange({ from: '2025-01-01', to: '2025-12-31' });
  assert.equal(result.from, '2025-01-01');
  assert.equal(result.to, '2025-12-31');
  assert.equal(result.days, 365);
});

test('parseExportDateRange allows leap-year span of 366 days', () => {
  const result = parseExportDateRange({ from: '2024-01-01', to: '2024-12-31' });
  assert.equal(result.days, 366);
});

test('parseExportDateRange rejects missing dates', () => {
  assert.throws(() => parseExportDateRange({}), (err) => err.statusCode === 400);
});

test('parseExportDateRange rejects inverted range', () => {
  assert.throws(
    () => parseExportDateRange({ from: '2025-06-01', to: '2025-01-01' }),
    (err) => err.statusCode === 400 && /desde/i.test(err.message),
  );
});

test('parseExportDateRange rejects ranges longer than one year', () => {
  assert.throws(
    () => parseExportDateRange({ from: '2024-01-01', to: '2025-01-01' }),
    (err) => err.statusCode === 400 && /año|anio|366/i.test(err.message),
  );
  assert.equal(daysBetweenInclusive('2024-01-01', '2024-12-31'), MAX_RANGE_DAYS);
  assert.doesNotThrow(() => parseExportDateRange({ from: '2024-01-01', to: '2024-12-31' }));
});

test('buildProjectsExcelWorkbook creates Activos and Cerrados sheets', () => {
  const xml = buildProjectsExcelWorkbook({
    from: '2025-01-01',
    to: '2025-12-31',
    generatedBy: 'admin',
    activeProjects: [{
      id: 1,
      quote_number: 'COT-1',
      order_number: 'PED-1',
      purchase_order_number: 'OC-1',
      client_name: 'Cliente A',
      project_description: 'Proyecto activo',
      status: 'En Proceso',
      risk: 'Medio',
      seller: 'Vendedor',
      technician_name: 'Tecnico',
      promised_delivery_date: '2025-06-01',
      fecha_vencimiento: '2025-07-01',
      invoice_number: 'F-1',
      invoice_date: '2025-05-01',
      invoice_payment_status: 'Pendiente',
      total_invoiced_mxn: 1000,
      total_charged: 400,
      spent: 200,
      pending_collection: 600,
      expected_margin: 30,
      final_margin: 0.8,
      progress_percent: 50,
      created_at: '2025-03-01T12:00:00.000Z',
    }],
    closedProjects: [{
      id: 2,
      quote_number: 'COT-2',
      order_number: 'PED-2',
      purchase_order_not_applicable: true,
      client_name: 'Cliente B',
      project_description: 'Proyecto cerrado',
      status: 'Terminado',
      risk: 'Bajo',
      closed_at: '2025-08-15T18:00:00.000Z',
      total_invoiced_mxn: 2000,
      total_charged: 2000,
      spent: 500,
      pending_collection: 0,
      expected_margin: 25,
      final_margin: 0.75,
      progress_percent: 100,
      created_at: '2025-02-01T12:00:00.000Z',
    }],
  });

  assert.match(xml, /ss:Name="Resumen"/);
  assert.match(xml, /ss:Name="Activos"/);
  assert.match(xml, /ss:Name="Cerrados"/);
  assert.match(xml, /COT-1/);
  assert.match(xml, /COT-2/);
  assert.match(xml, /Cliente A/);
  assert.match(xml, /Cliente B/);
  assert.match(xml, /No Aplica/);
  assert.match(xml, /Excel\.Sheet/);
});

const DB_PATH = path.join(__dirname, '..', 'data', 'test-projects-export.db');
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
        const newCookie = res.headers['set-cookie']
          ? res.headers['set-cookie'][0].split(';')[0]
          : null;
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data || '{}'),
            cookie: newCookie,
            raw: data,
            headers: res.headers,
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data,
            cookie: newCookie,
            raw: data,
            headers: res.headers,
          });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'));
      const req = http.get(`http://127.0.0.1:${PORT}/api/session`, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(tryConnect, 200));
    }
    tryConnect();
  });
}

test('projects excel export endpoint', async (t) => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  serverProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH,
      DATABASE_URL: '',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  serverProcess.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  t.after(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
    }
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  try {
    await waitForServer();
  } catch (err) {
    throw new Error(`Server failed to start: ${err.message}\n${stderr}`);
  }

  const login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
  assert.equal(login.status, 200);
  adminCookie = login.cookie;

  await t.test('rejects unauthenticated access', async () => {
    const res = await request('GET', '/api/projects/export/excel?from=2025-01-01&to=2025-12-31');
    assert.equal(res.status, 401);
  });

  await t.test('rejects missing date range', async () => {
    const res = await request('GET', '/api/projects/export/excel', null, adminCookie);
    assert.equal(res.status, 400);
  });

  await t.test('rejects range longer than one year', async () => {
    const res = await request(
      'GET',
      '/api/projects/export/excel?from=2024-01-01&to=2025-01-02',
      null,
      adminCookie,
    );
    assert.equal(res.status, 400);
  });

  await t.test('returns excel workbook for valid range', async () => {
    const employees = await request('GET', '/api/projects/assignable-employees', null, adminCookie);
    assert.equal(employees.status, 200);
    const tecnico = (employees.body.data || []).find((e) => /t[eé]cnico/i.test(e.department || e.position || '') )
      || (employees.body.data || [])[0];
    const vendedor = (employees.body.data || []).find((e) => e.id !== tecnico?.id)
      || tecnico;
    assert.ok(tecnico && vendedor, 'need employees to create project');

    const created = await request('POST', '/api/projects', {
      quote_number: 'COT-EXPORT-1',
      order_number: 'PED-EXPORT-1',
      purchase_order_not_applicable: true,
      tecnico_id: tecnico.id,
      vendedor_id: vendedor.id,
      client_name: 'Cliente Export',
      project_description: 'Proyecto para export excel',
      expected_margin: 20,
      total_invoiced: 1500,
      total_invoiced_currency: 'MXN',
      progress_percent: 10,
      fecha_vencimiento: '2026-12-31',
      promised_delivery_date: '2026-06-01',
      status: 'Pendiente',
      risk: 'Bajo',
    }, adminCookie);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const today = new Date();
    const toStr = today.toISOString().slice(0, 10);
    const fromDate = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()));
    fromDate.setUTCDate(fromDate.getUTCDate() + 1);
    const fromStr = fromDate.toISOString().slice(0, 10);

    const res = await request(
      'GET',
      `/api/projects/export/excel?from=${fromStr}&to=${toStr}`,
      null,
      adminCookie,
    );
    assert.equal(res.status, 200, typeof res.body === 'string' ? res.body.slice(0, 300) : JSON.stringify(res.body));
    assert.match(String(res.headers['content-type'] || ''), /excel|xml|octet/i);
    assert.match(String(res.headers['content-disposition'] || ''), /proyectos_.*\.xls/);
    assert.match(res.raw, /ss:Name="Activos"/);
    assert.match(res.raw, /ss:Name="Cerrados"/);
    assert.match(res.raw, /COT-EXPORT-1/);
  });
});
