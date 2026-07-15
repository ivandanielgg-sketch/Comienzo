'use strict';

const { TIMEZONE } = require('./dateHelper');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrencyMXN(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentCell(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  return `${Number(value)}%`;
}

function kpiCellDisplay(kpiObj) {
  if (!kpiObj) return '';
  if (typeof kpiObj === 'object' && kpiObj.display != null) return kpiObj.display;
  return String(kpiObj);
}

function buildWorksheet(name, headers, rows) {
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
  const dataRows = rows.map((row) => {
    const cells = row.map((cell) => {
      const type = typeof cell === 'number' ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet>`;
}

function pickKpis(obj, keys) {
  return keys.map(([label, key]) => [label, kpiCellDisplay(obj && obj[key])]);
}

function buildKpiExcelWorkbook(payload) {
  const meta = payload.meta || {};
  const worksheets = [];

  worksheets.push(buildWorksheet(
    'Resumen',
    ['Indicador', 'Valor', 'Unidad', 'Cambio % vs anterior'],
    (payload.summary_cards || []).map((c) => [
      c.label,
      c.value,
      c.unit || '',
      c.change_pct != null ? c.change_pct : '',
    ]),
  ));

  worksheets.push(buildWorksheet('Ventas', ['Indicador', 'Valor'], Object.entries(payload.ventas || {})
    .filter(([, v]) => v && typeof v === 'object' && 'display' in v)
    .map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet(
    'Rentabilidad',
    ['Indicador', 'Valor'],
    pickKpis(payload.proyectos, [
      ['Proyectos activos', 'active_projects'],
      ['Margen bruto promedio (%)', 'gross_margin_real'],
      ['Cumplimiento de entrega (%)', 'delivery_compliance'],
      ['Tasa de retrabajo (%)', 'rework_rate'],
      ['Proyectos margen rojo (cant.)', 'red_margin_projects'],
      ['Retrabajos (cant.)', 'reworks'],
      ['Cierre técnico pendiente', 'technical_close_pending'],
    ]),
  ));

  const redList = Array.isArray(payload.proyectos?.red_margin_list)
    ? payload.proyectos.red_margin_list.slice().sort((a, b) => (Number(a.margin_percent) || 0) - (Number(b.margin_percent) || 0))
    : [];
  worksheets.push(buildWorksheet(
    'Margen rojo',
    ['Cotizacion', 'Cliente', 'Margen %', 'Semaforo'],
    redList.map((r) => [r.quote_number || '', r.client_name || '', r.margin_percent ?? '', r.traffic_light || '']),
  ));

  worksheets.push(buildWorksheet(
    'Cobro y facturacion',
    ['Indicador', 'Valor'],
    [
      ...pickKpis(payload.facturacion, [
        ['Facturado en el periodo (MXN)', 'invoiced_amount_mxn'],
        ['Facturas emitidas', 'invoices_issued'],
        ['Tiempo facturacion (dias)', 'billing_time_days'],
        ['Facturas canceladas', 'cancelled_invoices'],
        ['Facturas con error', 'error_invoices'],
        ['Pendientes documentacion', 'pending_documentation'],
      ]),
      ...pickKpis(payload.cobranza, [
        ['Cobrado en el periodo (MXN)', 'collected_amount_mxn'],
        ['DSO / Dias promedio de cobro', 'avg_collection_days'],
        ['% cartera vencida', 'overdue_portfolio'],
        ['Monto cartera vencida (MXN)', 'overdue_amount_mxn'],
        ['Cuentas +120 dias', 'accounts_over_120_days'],
        ['Monto +120 dias (MXN)', 'accounts_over_120_amount_mxn'],
        ['Facturas vencidas sin gestion de cobro', 'invoices_without_contact'],
      ]),
      ['Nota administrativa', (payload.facturacion && payload.facturacion.billing_admin_note) || ''],
    ],
  ));

  worksheets.push(buildWorksheet(
    'Equipo',
    ['Indicador', 'Valor'],
    pickKpis(payload.reportes, [
      ['% reportes completos', 'complete_reports'],
      ['Reportes completos (#)', 'complete_count'],
      ['Evidencias completas (%)', 'complete_evidence'],
      ['Servicios sin reporte', 'services_without_report'],
    ]),
  ));

  worksheets.push(buildWorksheet('Empleados', [
    'Empleado', 'Departamento', 'Servicios realizados', 'Reportes completos (%)', 'Retrabajos', 'Semaforo',
  ], (payload.employees || []).map((e) => {
    const k = e.kpis || {};
    const isTec = /t[eé]cnico/i.test(e.department || '');
    return [
      e.employee,
      e.department,
      isTec ? (k.services_executed ?? k.assigned_services ?? '') : 'Ver Ventas / no aplica',
      isTec ? (k.complete_reports ?? '') : '',
      isTec ? (k.reworks ?? '') : '',
      e.traffic_light || '',
    ];
  })));

  worksheets.push(buildWorksheet('Departamentos', ['Departamento', 'Indicadores'], (payload.departments || []).map((d) => [
    d.department,
    JSON.stringify(d.kpis || {}),
  ])));

  worksheets.push(buildWorksheet('Formulas', ['KPI', 'Descripcion', 'Formula', 'Fuente', 'Modificable'], (payload.formulas || []).map((f) => [
    f.name,
    f.description,
    f.formula_text,
    f.data_source,
    f.editable ? 'Si' : 'No',
  ])));

  worksheets.push(buildWorksheet('Configuracion', ['Parametro', 'Valor'], (payload.settings_rows || []).map((r) => [r.label, r.value])));

  worksheets.push(buildWorksheet('Alertas', ['Severidad', 'Tipo', 'Responsable', 'Fecha', 'Accion'], (payload.alerts || []).map((a) => [
    a.severity,
    a.type,
    a.responsible || '',
    a.date || '',
    a.suggested_action || '',
  ])));

  const metaRows = [
    ['Periodo', meta.period_label || ''],
    ['Generado', meta.generated_at || ''],
    ['Generado por', meta.generated_by || ''],
    ['Zona horaria', TIMEZONE],
    ['Filtros', JSON.stringify(meta.filters || {})],
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Currency"><NumberFormat ss:Format="&quot;$&quot;#,##0.00"/></Style>
</Styles>
${buildWorksheet('Meta', ['Campo', 'Valor'], metaRows)}
${worksheets.join('\n')}
</Workbook>`;
}

module.exports = {
  formatCurrencyMXN,
  formatPercentCell,
  buildKpiExcelWorkbook,
  escapeXml,
};
