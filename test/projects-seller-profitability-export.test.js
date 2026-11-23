'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  amountWithoutIva,
  calendarDaysBetween,
  resolveSettlementFromPayments,
  buildSellerProfitabilityRows,
  buildSellerProfitabilityExcelWorkbook,
} = require('../src/projectsExport');

test('amountWithoutIva strips 16% IVA', () => {
  assert.equal(amountWithoutIva(1160), 1000);
  assert.equal(amountWithoutIva(0), 0);
  assert.equal(amountWithoutIva(null), null);
});

test('calendarDaysBetween counts natural days', () => {
  assert.equal(calendarDaysBetween('2026-01-01', '2026-01-01'), 0);
  assert.equal(calendarDaysBetween('2026-01-01', '2026-01-11'), 10);
});

test('resolveSettlementFromPayments uses completing payment date', () => {
  const result = resolveSettlementFromPayments({
    invoiceDate: '2026-01-01',
    invoicedMxn: 1000,
    invoicePaymentStatus: 'Pagada',
    payments: [
      { id: 1, payment_date: '2026-01-05', amount: 400 },
      { id: 2, payment_date: '2026-01-20', amount: 600 },
    ],
    resolvePaymentMxn: (p) => p.amount,
  });
  assert.equal(result.status, 'Pagada');
  assert.equal(result.settlementDate, '2026-01-20');
  assert.equal(result.days, 19);
});

test('resolveSettlementFromPayments leaves pending empty', () => {
  const result = resolveSettlementFromPayments({
    invoiceDate: '2026-01-01',
    invoicedMxn: 1000,
    invoicePaymentStatus: 'Pendiente',
    payments: [{ id: 1, payment_date: '2026-01-05', amount: 200 }],
    resolvePaymentMxn: (p) => p.amount,
  });
  assert.equal(result.status, 'Pendiente');
  assert.equal(result.settlementDate, null);
  assert.equal(result.days, null);
});

test('buildSellerProfitabilityRows aggregates sellers and marks zero-invoice margin empty', () => {
  const { detail, summary, total } = buildSellerProfitabilityRows({
    projects: [
      {
        id: 1,
        quote_number: 'A',
        project_description: 'Proyecto A',
        seller: 'Ana',
        invoice_date: '2026-02-01',
        invoice_payment_status: 'Pagada',
        payments: [{ id: 1, payment_date: '2026-02-10', amount: 1160 }],
        costs: [{ id: 1, amount: 232 }],
      },
      {
        id: 2,
        quote_number: 'B',
        project_description: 'Proyecto B',
        seller: 'Ana',
        invoice_date: '2026-02-15',
        invoice_payment_status: 'Pendiente',
        payments: [],
        costs: [],
      },
      {
        id: 3,
        quote_number: 'C',
        project_description: 'Proyecto C',
        seller: 'Bruno',
        invoice_date: '2026-02-28',
        invoice_payment_status: 'Pendiente',
        payments: [],
        costs: [{ id: 2, amount: 116 }],
        // facturado 0 via resolver
      },
    ],
    resolveInvoicedMxn: (p) => (p.id === 3 ? 0 : 1160),
    resolvePaymentMxn: (p) => p.amount,
    resolveCostMxn: (p) => p.amount,
  });

  assert.equal(detail.length, 3);
  assert.equal(detail[0].invoicedWithoutIva, 1000);
  assert.equal(detail[0].costsWithoutIva, 200);
  assert.equal(detail[0].utilityWithoutIva, 800);
  assert.equal(detail[0].marginPercent, 80);
  assert.equal(detail[0].settlementDate, '2026-02-10');
  assert.equal(detail[1].collectionStatus, 'Pendiente');
  assert.equal(detail[2].marginPercent, null);

  assert.equal(summary.length, 2);
  const ana = summary.find((s) => s.seller === 'Ana');
  assert.equal(ana.projectCount, 2);
  assert.equal(ana.invoicedWithoutIva, 2000);
  assert.equal(ana.costsWithoutIva, 200);
  assert.equal(ana.utilityWithoutIva, 1800);
  assert.equal(total.seller, 'TOTAL GENERAL');
  assert.equal(total.invoicedWithoutIva, ana.invoicedWithoutIva + summary.find((s) => s.seller === 'Bruno').invoicedWithoutIva);
  assert.equal(
    total.utilityWithoutIva,
    roundLike(detail.reduce((s, r) => s + (r.utilityWithoutIva || 0), 0)),
  );
});

function roundLike(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

test('buildSellerProfitabilityExcelWorkbook includes both required sheets and empty export', () => {
  const withData = buildSellerProfitabilityExcelWorkbook({
    from: '2026-01-01',
    to: '2026-12-31',
    sellerLabel: 'Todos',
    detailRows: [{
      projectLabel: 'P1',
      quoteNumber: 'Q1',
      seller: 'Ana',
      invoiceDate: '2026-01-01',
      invoicedWithoutIva: 1000,
      costsWithoutIva: 200,
      utilityWithoutIva: 800,
      marginPercent: 80,
      settlementDate: '2026-01-15',
      settlementDays: 14,
      collectionStatus: 'Pagada',
      notes: 'nota',
    }],
    summaryRows: [{
      seller: 'Ana',
      invoicedWithoutIva: 1000,
      costsWithoutIva: 200,
      utilityWithoutIva: 800,
      marginPercent: 80,
      projectCount: 1,
    }],
    totalRow: {
      seller: 'TOTAL GENERAL',
      invoicedWithoutIva: 1000,
      costsWithoutIva: 200,
      utilityWithoutIva: 800,
      marginPercent: 80,
      projectCount: 1,
    },
  });
  assert.match(withData, /ss:Name="Detalle por proyecto"/);
  assert.match(withData, /ss:Name="Resumen por vendedor"/);
  assert.match(withData, /Fecha de facturacion/);
  assert.match(withData, /TOTAL GENERAL/);
  assert.match(withData, /ss:Type="Number">1000/);

  const empty = buildSellerProfitabilityExcelWorkbook({
    from: '2026-01-01',
    to: '2026-01-31',
    detailRows: [],
    summaryRows: [],
    totalRow: {
      seller: 'TOTAL GENERAL',
      invoicedWithoutIva: 0,
      costsWithoutIva: 0,
      utilityWithoutIva: 0,
      marginPercent: null,
      projectCount: 0,
    },
  });
  assert.match(empty, /ss:Name="Detalle por proyecto"/);
  assert.match(empty, /ss:Name="Resumen por vendedor"/);
  assert.match(empty, /TOTAL GENERAL/);
});

const BASE = 'http://127.0.0.1:3000';
let cookie = '';

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers, raw: text };
}

function projectPayload(suffix, overrides = {}) {
  return {
    quote_number: `SEL-${suffix}`,
    order_number: `PED-SEL-${suffix}`,
    purchase_order_not_applicable: true,
    tecnico_id: 1,
    vendedor_id: overrides.vendedor_id || 2,
    client_name: `Cliente ${suffix}`,
    project_description: `Proyecto seller ${suffix}`,
    expected_margin: 20,
    total_invoiced: overrides.total_invoiced ?? 1160,
    total_invoiced_currency: 'MXN',
    progress_percent: 0,
    promised_delivery_date: '2026-12-01',
    status: 'En Proceso',
    risk: 'Medio',
    invoice_number: `F-${suffix}`,
    invoice_date: overrides.invoice_date,
    invoice_date_na: false,
    credit_days_na: true,
    credit_days_na_reason: 'N/A prueba export',
    invoice_payment_status: 'Pendiente',
    ...overrides,
  };
}

test('seller profitability export endpoint integrates invoice range, sellers and empty results', async (t) => {
  const login = await api('POST', '/api/login', { username: 'admin', password: 'admin123' });
  assert.equal(login.status, 200);

  // Ensure a second seller employee exists (id 2 is default Vendedor).
  const employees = await api('GET', '/api/employees?limit=50');
  assert.equal(employees.status, 200);
  const sellers = (employees.data.data || employees.data || []).filter((e) => e.id);
  assert.ok(sellers.length >= 1);

  const stamp = Date.now();
  const boundaryFrom = await api('POST', '/api/projects', projectPayload(`FROM-${stamp}`, {
    invoice_date: '2026-03-01',
    vendedor_id: 2,
  }));
  assert.equal(boundaryFrom.status, 201, JSON.stringify(boundaryFrom.data));
  const boundaryTo = await api('POST', '/api/projects', projectPayload(`TO-${stamp}`, {
    invoice_date: '2026-03-31',
    vendedor_id: 2,
  }));
  assert.equal(boundaryTo.status, 201, JSON.stringify(boundaryTo.data));
  const outside = await api('POST', '/api/projects', projectPayload(`OUT-${stamp}`, {
    invoice_date: '2026-04-01',
    vendedor_id: 2,
  }));
  assert.equal(outside.status, 201);

  const partial = await api('POST', '/api/projects', projectPayload(`PART-${stamp}`, {
    invoice_date: '2026-03-15',
    vendedor_id: 2,
    total_invoiced: 1160,
  }));
  assert.equal(partial.status, 201);
  const pay1 = await api('POST', `/api/projects/${partial.data.id}/payments`, {
    amount: 400,
    currency: 'MXN',
    payment_date: '2026-03-16',
    notes: 'parcial 1',
  });
  assert.equal(pay1.status, 201, JSON.stringify(pay1.data));
  const pay2 = await api('POST', `/api/projects/${partial.data.id}/payments`, {
    amount: 760,
    currency: 'MXN',
    payment_date: '2026-03-25',
    notes: 'liquidacion',
  });
  assert.equal(pay2.status, 201);

  // Mark Pagada via settle so liquidacion aparece en el export.
  const settlePreview = await api('GET', `/api/projects/${partial.data.id}/settlement-preview`);
  assert.equal(settlePreview.status, 200, JSON.stringify(settlePreview.data));
  const settle = await api('POST', `/api/projects/${partial.data.id}/settle-invoice`, {
    confirm: true,
    invoice_paid_at: '2026-03-25',
    expected_pending_mxn: settlePreview.data.pending_collection_mxn,
    confirm_mxn_matches_real_payment: true,
  });
  assert.equal(settle.status, 200, JSON.stringify(settle.data));
  assert.equal(settle.data.project?.invoice_payment_status || settle.data.invoice_payment_status, 'Pagada');

  const pending = await api('POST', '/api/projects', projectPayload(`PEND-${stamp}`, {
    invoice_date: '2026-03-20',
    vendedor_id: 2,
  }));
  assert.equal(pending.status, 201);

  const costOnBoundary = await api('POST', `/api/projects/${boundaryFrom.data.id}/costs`, {
    category: 'Otros',
    description: 'gasto seller',
    amount: 232,
    currency: 'MXN',
    cost_date: '2026-03-02',
  });
  assert.equal(costOnBoundary.status, 201);

  await t.test('export includes boundary invoice dates and excludes outside', async () => {
    const res = await api('GET', '/api/projects/export/seller-profitability?from=2026-03-01&to=2026-03-31&vendedor_id=2');
    assert.equal(res.status, 200, typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data));
    assert.match(res.headers.get('content-type') || '', /excel|xml|octet/i);
    assert.match(res.raw, /Detalle por proyecto/);
    assert.match(res.raw, /Resumen por vendedor/);
    assert.match(res.raw, new RegExp(`SEL-FROM-${stamp}`));
    assert.match(res.raw, new RegExp(`SEL-TO-${stamp}`));
    assert.doesNotMatch(res.raw, new RegExp(`SEL-OUT-${stamp}`));
    assert.match(res.raw, /TOTAL GENERAL/);
    assert.match(res.raw, /invoice_date/);
  });

  await t.test('empty filter range still returns workbook', async () => {
    const res = await api('GET', '/api/projects/export/seller-profitability?from=2010-01-01&to=2010-01-31');
    assert.equal(res.status, 200);
    assert.match(res.raw, /Detalle por proyecto/);
    assert.match(res.raw, /Resumen por vendedor/);
    assert.match(res.raw, /TOTAL GENERAL/);
  });
});
