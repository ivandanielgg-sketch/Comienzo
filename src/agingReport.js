'use strict';

const { settingsToApi } = require('./kpis');
const { roundMoney } = require('./calculations');

function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T12:00:00`);
  const to = new Date(`${toIso}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function buildAgingBucketDefs(settings) {
  const api = settingsToApi(settings || {});
  const b1 = api.receivable_bucket1_days;
  const b2 = api.receivable_bucket2_days;
  const b3 = api.receivable_bucket3_days;
  return [
    { key: 'current', label: 'Al corriente', min: null, max: 0 },
    { key: 'b1', label: `1–${b1}`, min: 1, max: b1 },
    { key: 'b2', label: `${b1 + 1}–${b2}`, min: b1 + 1, max: b2 },
    { key: 'b3', label: `${b2 + 1}–${b3}`, min: b2 + 1, max: b3 },
    { key: 'b3plus', label: `+${b3}`, min: b3 + 1, max: null },
    { key: 'no_invoice_date', label: 'Sin fecha de factura', min: null, max: null, special: true },
  ];
}

function emptyBucketTotals(bucketDefs) {
  const totals = {};
  for (const def of bucketDefs) {
    totals[def.key] = { amount: 0, count: 0, label: def.label };
  }
  return totals;
}

function assignAgingBucket(project, todayIso, bucketDefs) {
  const invoiceDate = project.invoice_date_na ? null : (project.invoice_date || null);
  const dueDate = project.due_date || null;
  if (!invoiceDate && !dueDate) {
    return 'no_invoice_date';
  }
  if (!dueDate) {
    return 'no_invoice_date';
  }
  const daysOverdue = Math.max(0, daysBetween(dueDate, todayIso) || 0);
  if (daysOverdue <= 0) {
    return 'current';
  }
  for (const def of bucketDefs) {
    if (def.special || def.key === 'current') continue;
    const minOk = def.min == null || daysOverdue >= def.min;
    const maxOk = def.max == null || daysOverdue <= def.max;
    if (minOk && maxOk) return def.key;
  }
  return 'b3plus';
}

/**
 * Build aging report grouped by client.
 * @param {Array} projects - mapped projects with totals.pending_collection / pending_mxn
 * @param {object} settings - kpi_settings row
 * @param {string} todayIso - YYYY-MM-DD
 */
function buildAgingReport(projects, settings, todayIso) {
  const bucketDefs = buildAgingBucketDefs(settings);
  const byClient = new Map();
  const grand = emptyBucketTotals(bucketDefs);
  let grandTotal = 0;

  const rows = (projects || [])
    .map((p) => {
      const pending = Number(
        p.pending_mxn != null
          ? p.pending_mxn
          : (p.totals?.pending_collection ?? p.pending_collection ?? 0),
      );
      return { ...p, pending_mxn: roundMoney(pending) };
    })
    .filter((p) => p.pending_mxn > 0.01)
    .sort((a, b) => b.pending_mxn - a.pending_mxn);

  for (const p of rows) {
    const bucketKey = assignAgingBucket(p, todayIso, bucketDefs);
    const clientName = p.client_name || 'Sin cliente';
    if (!byClient.has(clientName)) {
      byClient.set(clientName, {
        client_name: clientName,
        projects: [],
        buckets: emptyBucketTotals(bucketDefs),
        total_pending_mxn: 0,
      });
    }
    const group = byClient.get(clientName);
    const invoiceDate = p.invoice_date_na ? null : (p.invoice_date || null);
    const dueDate = p.due_date || null;
    const daysOverdue = dueDate
      ? Math.max(0, daysBetween(dueDate, todayIso) || 0)
      : null;

    const item = {
      project_id: p.id || p.project_id,
      quote_number: p.quote_number || null,
      order_number: p.order_number || null,
      project_description: p.project_description || null,
      invoice_number: p.invoice_number || null,
      invoice_date: invoiceDate,
      invoice_date_na: !!p.invoice_date_na,
      credit_days: p.credit_days_na ? null : (p.credit_days ?? null),
      credit_days_na: !!p.credit_days_na,
      due_date: dueDate,
      days_overdue: daysOverdue,
      pending_mxn: p.pending_mxn,
      bucket: bucketKey,
      bucket_label: bucketDefs.find((b) => b.key === bucketKey)?.label || bucketKey,
      closed_at: p.closed_at || null,
    };
    group.projects.push(item);
    group.buckets[bucketKey].amount = roundMoney(group.buckets[bucketKey].amount + p.pending_mxn);
    group.buckets[bucketKey].count += 1;
    group.total_pending_mxn = roundMoney(group.total_pending_mxn + p.pending_mxn);

    grand[bucketKey].amount = roundMoney(grand[bucketKey].amount + p.pending_mxn);
    grand[bucketKey].count += 1;
    grandTotal = roundMoney(grandTotal + p.pending_mxn);
  }

  const clients = Array.from(byClient.values())
    .map((g) => ({
      ...g,
      projects: g.projects.sort((a, b) => b.pending_mxn - a.pending_mxn),
    }))
    .sort((a, b) => b.total_pending_mxn - a.total_pending_mxn);

  return {
    as_of: todayIso,
    buckets: bucketDefs.map((d) => ({ key: d.key, label: d.label })),
    clients,
    summary: {
      total_pending_mxn: grandTotal,
      buckets: grand,
      project_count: rows.length,
      client_count: clients.length,
    },
  };
}

function agingReportToCsv(report) {
  const headers = [
    'Cliente',
    'Proyecto ID',
    'Cotizacion',
    'Pedido',
    'Descripcion',
    'Factura',
    'Fecha factura',
    'Dias credito',
    'Vencimiento',
    'Dias vencido',
    'Bucket',
    'Saldo MXN',
  ];
  const lines = [headers.join(',')];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  for (const client of report.clients || []) {
    for (const p of client.projects || []) {
      lines.push([
        esc(client.client_name),
        esc(p.project_id),
        esc(p.quote_number),
        esc(p.order_number),
        esc(p.project_description),
        esc(p.invoice_number),
        esc(p.invoice_date_na ? 'N/A' : p.invoice_date),
        esc(p.credit_days_na ? 'N/A' : p.credit_days),
        esc(p.due_date),
        esc(p.days_overdue),
        esc(p.bucket_label),
        esc(p.pending_mxn),
      ].join(','));
    }
    const sub = [`TOTAL ${client.client_name}`, '', '', '', '', '', '', '', '', '', '', esc(client.total_pending_mxn)];
    lines.push(sub.map(esc).join(','));
  }

  const totalRow = ['TOTAL GENERAL', '', '', '', '', '', '', '', '', '', '', esc(report.summary?.total_pending_mxn || 0)];
  lines.push(totalRow.map(esc).join(','));

  // Bucket summary block
  lines.push('');
  lines.push(['Bucket', 'Monto MXN', 'Proyectos'].join(','));
  for (const b of report.buckets || []) {
    const t = report.summary?.buckets?.[b.key];
    lines.push([esc(b.label), esc(t?.amount || 0), esc(t?.count || 0)].join(','));
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildAgingBucketDefs,
  assignAgingBucket,
  buildAgingReport,
  agingReportToCsv,
  daysBetween,
};
