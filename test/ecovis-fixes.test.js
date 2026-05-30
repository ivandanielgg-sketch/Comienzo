const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

let cookie = '';
const suffix = Date.now().toString(36);

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: { 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}), Cookie: cookie },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); } catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('ECOVIS integrity fixes', () => {
  before(async () => {
    const r = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(r.status, 200);
    const sc = r.headers['set-cookie'];
    if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  });

  describe('PO duplicate control', () => {
    const poNum = `DUP-${suffix}`;
    it('creates PO successfully', async () => {
      const r = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: poNum, order_date: '2026-05-01', total_amount: 100000, currency: 'MXN' });
      assert.strictEqual(r.status, 201);
    });
    it('blocks exact duplicate', async () => {
      const r = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: poNum, order_date: '2026-05-02', total_amount: 50000, currency: 'MXN' });
      assert.strictEqual(r.status, 400);
    });
    it('blocks case-insensitive duplicate', async () => {
      const r = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: poNum.toLowerCase(), order_date: '2026-05-02', total_amount: 50000, currency: 'MXN' });
      assert.strictEqual(r.status, 400);
    });
    it('blocks duplicate with spaces', async () => {
      const r = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: '  ' + poNum + '  ', order_date: '2026-05-02', total_amount: 50000, currency: 'MXN' });
      assert.strictEqual(r.status, 400);
    });
    it('blocks duplicate via PUT on another PO', async () => {
      const r2 = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: `OTHER-${suffix}`, order_date: '2026-05-03', total_amount: 80000, currency: 'MXN' });
      assert.strictEqual(r2.status, 201);
      const edit = await request('PUT', '/api/ecovis/purchase-orders/' + r2.body.id, { purchase_order_number: poNum, order_date: '2026-05-03', total_amount: 80000, currency: 'MXN' });
      assert.strictEqual(edit.status, 400);
    });
  });

  describe('Critical amount edit blocking', () => {
    let projectId, poId, paymentId;
    before(async () => {
      const p = await request('POST', '/api/ecovis/projects', { project_name: `Proj-${suffix}`, project_date: '2026-05-01', total_amount: 200000, currency: 'MXN' });
      projectId = p.body.id;
      const po = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: `BLOCK-${suffix}`, order_date: '2026-05-01', total_amount: 150000, currency: 'MXN' });
      poId = po.body.id;
      const pay = await request('POST', '/api/ecovis/payments', { payment_date: '2026-05-15', amount: 50000, currency: 'MXN', source_description: 'Test' });
      paymentId = pay.body.id;
      await request('POST', '/api/ecovis/payments/' + paymentId + '/allocations', { allocation_type: 'proyecto', ecovis_project_id: projectId, amount: 30000 });
      await request('POST', '/api/ecovis/payments/' + paymentId + '/allocations', { allocation_type: 'orden_compra', ecovis_purchase_order_id: poId, amount: 20000 });
    });

    it('blocks project amount edit with allocations', async () => {
      const r = await request('PUT', '/api/ecovis/projects/' + projectId, { project_name: `Proj-${suffix}`, project_date: '2026-05-01', total_amount: 180000, currency: 'MXN' });
      assert.strictEqual(r.status, 400);
      assert.ok(r.body.message.includes('pagos aplicados'));
    });

    it('allows project non-amount edit', async () => {
      const r = await request('PUT', '/api/ecovis/projects/' + projectId, { project_name: `Proj-${suffix}-edited`, project_date: '2026-05-01', total_amount: 200000, currency: 'MXN' });
      assert.strictEqual(r.status, 200);
    });

    it('blocks PO amount edit with allocations', async () => {
      const r = await request('PUT', '/api/ecovis/purchase-orders/' + poId, { purchase_order_number: `BLOCK-${suffix}`, order_date: '2026-05-01', total_amount: 100000, currency: 'MXN' });
      assert.strictEqual(r.status, 400);
      assert.ok(r.body.message.includes('pagos aplicados'));
    });

    it('allows PO non-amount edit', async () => {
      const r = await request('PUT', '/api/ecovis/purchase-orders/' + poId, { purchase_order_number: `BLOCK-${suffix}`, order_date: '2026-05-02', total_amount: 150000, currency: 'MXN', notes: 'nota' });
      assert.strictEqual(r.status, 200);
    });
  });

  describe('Amount adjustment', () => {
    let projectId;
    before(async () => {
      const p = await request('POST', '/api/ecovis/projects', { project_name: `Adj-${suffix}`, project_date: '2026-05-01', total_amount: 100000, currency: 'MXN' });
      projectId = p.body.id;
    });

    it('creates adjustment with reason', async () => {
      const r = await request('POST', '/api/ecovis/amount-adjustment', { entity_type: 'project', entity_id: projectId, new_amount: 120000, new_currency: 'MXN', reason: 'Corrección' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.previous.amount, 100000);
      assert.strictEqual(r.body.current.amount, 120000);
      assert.strictEqual(r.body.difference_mxn, 20000);
    });

    it('requires reason', async () => {
      const r = await request('POST', '/api/ecovis/amount-adjustment', { entity_type: 'project', entity_id: projectId, new_amount: 130000, new_currency: 'MXN' });
      assert.strictEqual(r.status, 400);
    });

    it('works for purchase_order', async () => {
      const po = await request('POST', '/api/ecovis/purchase-orders', { purchase_order_number: `ADJ-${suffix}`, order_date: '2026-05-01', total_amount: 50000, currency: 'MXN' });
      const r = await request('POST', '/api/ecovis/amount-adjustment', { entity_type: 'purchase_order', entity_id: po.body.id, new_amount: 60000, new_currency: 'MXN', reason: 'Ajuste OC' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.current.amount, 60000);
    });

    it('works for payment', async () => {
      const pay = await request('POST', '/api/ecovis/payments', { payment_date: '2026-05-20', amount: 25000, currency: 'MXN', source_description: 'adj test' });
      const r = await request('POST', '/api/ecovis/amount-adjustment', { entity_type: 'payment', entity_id: pay.body.id, new_amount: 30000, new_currency: 'MXN', reason: 'Corrección pago' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.current.amount, 30000);
    });
  });
});
