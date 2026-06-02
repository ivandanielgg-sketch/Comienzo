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

function buildKpiExcelWorkbook(payload) {
  const meta = payload.meta || {};
  const worksheets = [];

  worksheets.push(buildWorksheet('Resumen', ['Indicador', 'Valor'], (payload.summary_cards || []).map((c) => [c.label, c.value])));

  worksheets.push(buildWorksheet('Ventas', ['Indicador', 'Valor'], Object.entries(payload.ventas || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Proyectos', ['Indicador', 'Valor'], Object.entries(payload.proyectos || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Reportes', ['Indicador', 'Valor'], Object.entries(payload.reportes || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Cobranza', ['Indicador', 'Valor'], Object.entries(payload.cobranza || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Facturacion', ['Indicador', 'Valor'], Object.entries(payload.facturacion || {}).map(([k, v]) => [k, kpiCellDisplay(v)])));

  worksheets.push(buildWorksheet('Empleados', ['Empleado', 'Departamento', 'Indicadores', 'Semaforo'], (payload.employees || []).map((e) => [
    e.employee,
    e.department,
    JSON.stringify(e.kpis || {}),
    e.traffic_light || '',
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
  buildKpiExcelWorkbook,
  escapeXml,
};
