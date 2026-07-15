'use strict';

const { TIMEZONE } = require('./dateHelper');
const { escapeXml, formatCurrencyMXN } = require('./kpisExport');
const { STATEMENT_TYPE_LABELS } = require('./ecovis');

function buildWorksheet(name, headers, rows) {
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
  const dataRows = rows.map((row) => {
    const cells = row.map((cell) => {
      const type = typeof cell === 'number' && Number.isFinite(cell) ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet>`;
}

function buildEcovisStatementExcel(payload) {
  const meta = payload.meta || {};
  const header = payload.header || {};
  const statement = payload.statement || {};
  const equation = header.equation || {};

  const summaryRows = [
    ['Estado', header.label || ''],
    ['Saldo neto (MXN)', header.amount != null ? header.amount : ''],
    ['A favor de', header.favor_of || '—'],
    ['Nos deben por proyectos (A)', equation.pending_projects ?? ''],
    ['Ajustes (B)', equation.adjustments ?? ''],
    ['Les debemos por prestamos (C)', equation.outstanding_loans ?? ''],
    ['Saldo neto A+B-C', equation.net_balance ?? ''],
    ['Saldo inicial periodo', statement.opening_balance ?? ''],
    ['Saldo final periodo', statement.closing_balance ?? ''],
    ['Periodo desde', meta.from || 'Inicio'],
    ['Periodo hasta', meta.to || 'Hoy'],
    ['Generado', meta.generated_at || ''],
    ['Generado por', meta.generated_by || ''],
    ['Zona horaria', TIMEZONE],
  ];

  const ledgerRows = (statement.rows || []).map((row) => [
    row.movement_date || '',
    row.concept || '',
    STATEMENT_TYPE_LABELS[row.movement_type] || row.movement_type || '',
    row.reference || '',
    row.charge || 0,
    row.credit || 0,
    row.running_balance || 0,
    row.currency && row.currency !== 'MXN'
      ? `${row.original_amount} ${row.currency}`
      : '',
    row.is_cancelled ? 'Si' : '',
    row.cancellation_reason || '',
    row.informational ? 'Memo' : '',
  ]);

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${buildWorksheet('Resumen', ['Campo', 'Valor'], summaryRows)}
${buildWorksheet('Estado de cuenta', [
  'Fecha',
  'Concepto',
  'Tipo',
  'Referencia',
  'Cargo',
  'Abono',
  'Saldo corrido',
  'Moneda original',
  'Cancelado',
  'Motivo cancelacion',
  'Nota',
], ledgerRows)}
</Workbook>`;
}

module.exports = {
  buildEcovisStatementExcel,
  formatCurrencyMXN,
};
