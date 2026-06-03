const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

let cookie = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: "localhost", port: 3000, path, method, headers: { "Content-Type": "application/json", ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}), Cookie: cookie } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('New modules integration', () => {
  before(async () => {
    const loginRes = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(loginRes.status, 200);
    const setCookie = loginRes.headers['set-cookie'];
    if (setCookie) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  });

  describe('Session with theme', () => {
    it('GET /api/session returns theme field', async () => {
      const res = await request('GET', '/api/session');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.authenticated, true);
      assert.ok(res.body.theme);
      assert.ok(res.body.permissions.commissions);
      assert.ok(res.body.permissions.activityMonitor);
    });
  });

  describe('Theme preferences', () => {
    it('PUT /api/preferences/theme sets dark theme', async () => {
      const res = await request('PUT', '/api/preferences/theme', { theme: 'dark' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.theme, 'dark');
    });

    it('GET /api/preferences/theme returns persisted theme', async () => {
      const res = await request('GET', '/api/preferences/theme');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.theme, 'dark');
    });

    it('invalid theme returns 400', async () => {
      const res = await request('PUT', '/api/preferences/theme', { theme: 'neon_pink' });
      assert.strictEqual(res.status, 400);
    });

    it('reset to default', async () => {
      const res = await request('PUT', '/api/preferences/theme', { theme: 'default' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.theme, 'default');
    });
  });

  describe('Role permissions config', () => {
    it('GET /api/admin/role-permissions returns roles and modules', async () => {
      const res = await request('GET', '/api/admin/role-permissions');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.roles);
      assert.ok(res.body.roles.admin);
      assert.ok(res.body.roles.user);
      assert.ok(res.body.roles.tecnico);
      assert.ok(res.body.modules);
    });

    it('cannot enable admin-only module for user role', async () => {
      const res = await request('PUT', '/api/admin/role-permissions/user', {
        permissions: { activityMonitor: ['view'], projects: ['view'] }
      });
      assert.strictEqual(res.status, 400);
    });

    it('can update non-admin modules for user role', async () => {
      const res = await request('PUT', '/api/admin/role-permissions/user', {
        permissions: { projects: ['view', 'create', 'edit'], closedProjects: ['view'], reports: ['view', 'create', 'edit', 'print'] }
      });
      assert.strictEqual(res.status, 200);
    });

    it('cannot modify admin role', async () => {
      const res = await request('PUT', '/api/admin/role-permissions/admin', { permissions: {} });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('Commissions - Agents', () => {
    it('GET /api/commissions/active-employees lists vacation actives', async () => {
      const res = await request('GET', '/api/commissions/active-employees');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.some((e) => e.active === 1));
    });

    it('POST /api/commissions/agents creates agent', async () => {
      const res = await request('POST', '/api/commissions/agents', { name: 'Ana Garcia', start_date: '2025-06-01' });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.name, 'Ana Garcia');
      assert.strictEqual(res.body.active, 1);
    });

    it('POST /api/commissions/agents links active employee', async () => {
      const emps = await request('GET', '/api/commissions/active-employees');
      const agents = await request('GET', '/api/commissions/agents');
      const used = new Set((agents.body || []).map((a) => a.employee_id).filter(Boolean));
      let employee = emps.body.find((e) => !used.has(e.id));
      if (!employee) {
        const suffix = Date.now().toString(36);
        const created = await request('POST', '/api/employees', {
          employee_number: `EMP-COMM-${suffix}`,
          full_name: `Vendedora Comm ${suffix}`,
          hire_date: '2024-01-01',
          department: 'Ventas',
          active: true,
        });
        assert.strictEqual(created.status, 201);
        employee = { id: created.body.id };
      }
      const res = await request('POST', '/api/commissions/agents', { employee_id: employee.id, start_date: '2025-06-01' });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.employee_id, employee.id);
      assert.ok(res.body.name.length > 0);
    });

    it('GET /api/commissions/agents lists agents', async () => {
      const res = await request('GET', '/api/commissions/agents');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 1);
    });

    it('PUT /api/commissions/agents/:id deactivates agent', async () => {
      const res = await request('PUT', '/api/commissions/agents/1', { name: 'Ana Garcia', active: false, start_date: '2025-06-01' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.active, 0);
    });

    it('reactivate agent', async () => {
      const res = await request('PUT', '/api/commissions/agents/1', { name: 'Ana Garcia', active: true, start_date: '2025-06-01' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.active, 1);
    });
  });

  describe('Commissions - Assignment', () => {
    const suffix = Date.now().toString(36);
    let projectId;

    before(async () => {
      const projRes = await request('POST', '/api/projects', {
        quote_number: `COMM-${suffix}-001`, order_number: `ORD-${suffix}-001`, purchase_order_not_applicable: true,
        tecnico_id: 1, vendedor_id: 2, client_name: 'Cliente Comision', project_description: 'Test',
        fecha_vencimiento: '2026-12-01', expected_margin: 0.3, total_invoiced: 200000, progress_percent: 100,
        promised_delivery_date: '2026-12-01', status: 'Terminado', risk: 'Bajo',
      });
      projectId = projRes.body.id;
      await request('DELETE', `/api/projects/${projectId}`, { password: 'admin123' });
    });

    it('available projects lists project without requiring closed_at', async () => {
      const res = await request('GET', '/api/commissions/available-projects');
      assert.strictEqual(res.status, 200);
      const p = res.body.find(x => x.quote_number === `COMM-${suffix}-001`);
      assert.ok(p, 'Project should be available');
      assert.strictEqual(p.total_sale_mxn, 200000);
      assert.ok('final_margin' in p);
    });

    it('open project appears in available list', async () => {
      const openRes = await request('POST', '/api/projects', {
        quote_number: `COMM-${suffix}-OPEN`, order_number: `ORD-${suffix}-OPEN`, purchase_order_not_applicable: true,
        tecnico_id: 1, vendedor_id: 2, client_name: 'Cliente Abierto', project_description: 'Test',
        fecha_vencimiento: '2026-12-01', expected_margin: 0.3, total_invoiced: 10000, progress_percent: 50,
        promised_delivery_date: '2026-12-01', status: 'En Proceso', risk: 'Bajo',
      });
      const res = await request('GET', '/api/commissions/available-projects');
      assert.ok(res.body.find((x) => x.quote_number === `COMM-${suffix}-OPEN`));
      await request('DELETE', `/api/projects/${openRes.body.id}`, { password: 'admin123' });
    });

    it('assign commission 1% on invoiced amount', async () => {
      const res = await request('POST', '/api/commissions', {
        project_id: projectId, sales_agent_id: 1,
        commission_calculation_base_type: 'facturado_1pct',
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'pendiente');
      assert.strictEqual(res.body.commission_percentage, 1);
      assert.strictEqual(res.body.commission_amount_mxn, 2000);
      assert.strictEqual(res.body.commission_type, 'proyecto');
    });

    it('assigned project disappears from available list', async () => {
      const res = await request('GET', '/api/commissions/available-projects');
      assert.ok(!res.body.find((x) => x.quote_number === `COMM-${suffix}-001`));
    });

    it('cannot assign duplicate commission', async () => {
      const res = await request('POST', '/api/commissions', {
        project_id: projectId, sales_agent_id: 1,
        commission_calculation_base_type: 'facturado_3pct',
      });
      assert.strictEqual(res.status, 400);
    });

    it('manual amount commission on second project', async () => {
      const projRes = await request('POST', '/api/projects', {
        quote_number: `COMM-${suffix}-002`, order_number: `ORD-${suffix}-002`, purchase_order_not_applicable: true,
        tecnico_id: 1, vendedor_id: 2, client_name: 'C2', project_description: 'T',
        fecha_vencimiento: '2026-12-01', expected_margin: 0.2, total_invoiced: 50000, progress_percent: 100,
        promised_delivery_date: '2026-12-01', status: 'Terminado', risk: 'Bajo',
      });
      await request('DELETE', `/api/projects/${projRes.body.id}`, { password: 'admin123' });
      const res = await request('POST', '/api/commissions', {
        project_id: projRes.body.id, sales_agent_id: 1,
        commission_calculation_base_type: 'monto_manual', commission_amount_mxn: 7500,
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.commission_amount_mxn, 7500);
    });

    it('rejects invalid commission base type', async () => {
      const projRes = await request('POST', '/api/projects', {
        quote_number: `COMM-${suffix}-003`, order_number: `ORD-${suffix}-003`, purchase_order_not_applicable: true,
        tecnico_id: 1, vendedor_id: 2, client_name: 'C3', project_description: 'T',
        fecha_vencimiento: '2026-12-01', expected_margin: 0.1, total_invoiced: 30000, progress_percent: 100,
        promised_delivery_date: '2026-12-01', status: 'Terminado', risk: 'Bajo',
      });
      await request('DELETE', `/api/projects/${projRes.body.id}`, { password: 'admin123' });
      const res = await request('POST', '/api/commissions', {
        project_id: projRes.body.id, sales_agent_id: 1,
        commission_calculation_base_type: 'gross_profit_mxn',
      });
      assert.strictEqual(res.status, 400);
    });

    it('cancel commission works', async () => {
      const list = await request('GET', '/api/commissions');
      const c = list.body[0];
      const res = await request('POST', `/api/commissions/${c.id}/cancel`, { reason: 'Test cancel' });
      assert.strictEqual(res.status, 200);
    });
  });

  describe('Commissions - Payments', () => {
    before(async () => {
      await request('POST', '/api/commissions/agents', { name: 'Laura Fernandez', start_date: '2025-01-01' });
    });

    it('creates extraordinary commission as pending', async () => {
      const res = await request('POST', '/api/commissions/extraordinary', {
        sales_agent_id: 1,
        commission_amount_mxn: 3200,
        description: 'Premio cambio de proveedor',
        reference: 'EXT-001',
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.commission_type, 'extraordinaria');
      assert.strictEqual(res.body.status, 'pendiente');
      assert.strictEqual(res.body.commission_amount_mxn, 3200);
    });

    it('register payment on assigned commission', async () => {
      const pending = await request('GET', '/api/commissions');
      const target = pending.body.find((c) => c.status === 'pendiente');
      assert.ok(target, 'Debe existir comision pendiente');
      const res = await request('POST', `/api/commissions/${target.id}/pay`, {
        payment_date: '2026-05-28', amount_original: target.commission_amount_mxn, currency: 'MXN', reference: 'PAY-001',
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.commission.status, 'pagada');
      assert.strictEqual(res.body.payment.amount_mxn, target.commission_amount_mxn);
    });

    it('list payments', async () => {
      const res = await request('GET', '/api/commissions/payments');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.length >= 1);
    });

    it('summary shows totals', async () => {
      const res = await request('GET', '/api/commissions/summary');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.total_paid_mxn >= 5000);
      assert.ok(res.body.active_agents >= 1);
    });

    it('active commissions list hides pagada', async () => {
      const res = await request('GET', '/api/commissions');
      assert.strictEqual(res.status, 200);
      assert.ok(!res.body.some((c) => c.status === 'pagada'));
    });

    it('archived search requires filter', async () => {
      const res = await request('GET', '/api/commissions?paid=1');
      assert.strictEqual(res.status, 400);
    });

    it('history search returns paid commissions with filter', async () => {
      const res = await request('GET', '/api/commissions?paid=1&date_from=2020-01-01');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.some((c) => c.status === 'pagada'));
    });
  });

  describe('Activity Monitor', () => {
    it('GET /api/activity-monitor/sessions returns active sessions', async () => {
      const res = await request('GET', '/api/activity-monitor/sessions');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });

    it('GET /api/activity-monitor/weekly-report returns report', async () => {
      const res = await request('GET', '/api/activity-monitor/weekly-report');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.year);
      assert.ok(res.body.week);
      assert.ok(Array.isArray(res.body.users));
    });
  });

  describe('Permission enforcement for non-admin', () => {
    let userCookie = '';

    before(async () => {
      await request('POST', '/api/users', { username: 'testuser', password: 'test123', role: 'user' });
      const loginRes = await request('POST', '/api/login', { username: 'testuser', password: 'test123' });
      const setCookie = loginRes.headers['set-cookie'];
      if (setCookie) userCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    });

    function userReq(method, path, body) {
      return new Promise((resolve, reject) => {
        const opts = { hostname: 'localhost', port: 3000, path, method, headers: { 'Content-Type': 'application/json', Cookie: userCookie } };
        const req = http.request(opts, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
            catch { resolve({ status: res.statusCode, body: data }); }
          });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }

    it('user cannot access commissions', async () => {
      const res = await userReq('GET', '/api/commissions/agents');
      assert.ok(res.status === 403 || res.status === 401, "Expected 401 or 403, got " + res.status);
    });

    it('user cannot access activity monitor', async () => {
      const res = await userReq('GET', '/api/activity-monitor/sessions');
      assert.ok(res.status === 403 || res.status === 401, "Expected 401 or 403, got " + res.status);
    });

    it('user cannot access role permissions', async () => {
      const res = await userReq('GET', '/api/admin/role-permissions');
      assert.ok(res.status === 403 || res.status === 401, "Expected 401 or 403, got " + res.status);
    });

    it('user can change their own theme', async () => {
      const res = await userReq('PUT', '/api/preferences/theme', { theme: 'corporate' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.theme, 'corporate');
    });

    it('tecnico cannot access commissions', async () => {
      await request('POST', '/api/users', { username: 'testtec', password: 'test123', role: 'tecnico' });
      const loginRes = await new Promise((resolve, reject) => {
        const opts = { hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST', headers: { 'Content-Type': 'application/json' } };
        const req = http.request(opts, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
            catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
          });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ username: 'testtec', password: 'test123' }));
        req.end();
      });
      let tecCookie = '';
      const setCookie = loginRes.headers['set-cookie'];
      if (setCookie) tecCookie = setCookie.map((c) => c.split(';')[0]).join('; ');

      const res = await new Promise((resolve, reject) => {
        const opts = { hostname: 'localhost', port: 3000, path: '/api/commissions/agents', method: 'GET', headers: { Cookie: tecCookie } };
        const req = http.request(opts, (res2) => {
          let data = '';
          res2.on('data', (chunk) => { data += chunk; });
          res2.on('end', () => {
            try { resolve({ status: res2.statusCode, body: JSON.parse(data) }); }
            catch { resolve({ status: res2.statusCode, body: data }); }
          });
        });
        req.on('error', reject);
        req.end();
      });
      assert.ok(res.status === 403 || res.status === 401, "Expected 401 or 403, got " + res.status);
    });
  });
});
