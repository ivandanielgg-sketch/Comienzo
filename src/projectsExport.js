'use strict';

const { TIMEZONE, formatDateCDMX, formatDateTimeCDMX } = require('./dateHelper');

const MAX_RANGE_DAYS = 366;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function daysBetweenInclusive(from, to) {
  const fromMs = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const toMs = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  );
  return Math.floor((toMs - fromMs) / 86400000) + 1;
}

/**
 * Validates export date range. Throws Error with statusCode 400 on failure.
 * @returns {{ from: string, to: string, days: number }}
 */
function parseExportDateRange(query = {}) {
  const from = String(query.from || query.date_from || '').trim();
  const to = String(query.to || query.date_to || '').trim();

  if (!from || !to) {
    const error = new Error('Indica el rango de fechas (desde y hasta).');
    error.statusCode = 400;
    throw error;
  }
  if (!isValidDateString(from) || !isValidDateString(to)) {
    const error = new Error('Las fechas deben tener formato YYYY-MM-DD.');
    error.statusCode = 400;
    throw error;
  }
  if (from > to) {
    const error = new Error('La fecha "desde" no puede ser posterior a "hasta".');
    error.statusCode = 400;
    throw error;
  }

  const days = daysBetweenInclusive(from, to);
  if (days > MAX_RANGE_DAYS) {
    const error = new Error('El rango de fechas no puede exceder un año (366 dias).');
    error.statusCode = 400;
    throw error;
  }

  return { from, to, days };
}

function formatMoneyNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return Math.round((num * 100 + Number.EPSILON) * 100) / 100;
}

function formatDateCell(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDateCDMX(value) || value.slice(0, 10);
  }
  return formatDateCDMX(value) || '';
}

function formatDateTimeCell(value) {
  if (!value) return '';
  return formatDateTimeCDMX(value) || '';
}

function purchaseOrderDisplay(row) {
  if (row.purchase_order_not_applicable) return 'No Aplica';
  return row.purchase_order_number || '';
}

function buildWorksheet(name, headers, rows) {
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
  const dataRows = rows.map((row) => {
    const cells = row.map((cell) => {
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
      }
      return `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet>`;
}

const ACTIVE_HEADERS = [
  'ID',
  'Cotizacion',
  'N. Pedido',
  'Orden de compra',
  'Cliente',
  'Descripcion',
  'Estado',
  'Riesgo',
  'Vendedor',
  'Tecnico',
  'Fecha prometida',
  'Fecha vencimiento',
  'Factura',
  'Fecha factura',
  'Estatus pago factura',
  'Facturado MXN',
  'Cobrado MXN',
  'Gastado MXN',
  'Pendiente MXN',
  'Margen esperado %',
  'Margen final %',
  'Avance %',
  'Fecha creacion',
];

const CLOSED_HEADERS = [
  'ID',
  'Cotizacion',
  'N. Pedido',
  'Orden de compra',
  'Cliente',
  'Descripcion',
  'Estado',
  'Riesgo',
  'Vendedor',
  'Tecnico',
  'Fecha prometida',
  'Fecha cierre',
  'Factura',
  'Fecha factura',
  'Estatus pago factura',
  'Facturado MXN',
  'Cobrado MXN',
  'Gastado MXN',
  'Pendiente MXN',
  'Margen esperado %',
  'Margen final %',
  'Avance %',
  'Fecha creacion',
];

function mapActiveRow(row) {
  return [
    Number(row.id) || 0,
    row.quote_number || '',
    row.order_number || '',
    purchaseOrderDisplay(row),
    row.client_name || '',
    row.project_description || '',
    row.status || '',
    row.risk || '',
    row.vendedor_nombre || row.seller || '',
    row.tecnico_nombre || row.technician_name || '',
    formatDateCell(row.promised_delivery_date),
    formatDateCell(row.fecha_vencimiento),
    row.invoice_number || '',
    formatDateCell(row.invoice_date),
    row.invoice_payment_status || '',
    formatMoneyNumber(row.total_invoiced_mxn),
    formatMoneyNumber(row.total_charged),
    formatMoneyNumber(row.spent),
    formatMoneyNumber(row.pending_collection),
    formatMoneyNumber(row.expected_margin),
    formatPercent(row.final_margin),
    formatMoneyNumber(row.progress_percent),
    formatDateTimeCell(row.created_at),
  ];
}

function mapClosedRow(row) {
  return [
    Number(row.id) || 0,
    row.quote_number || '',
    row.order_number || '',
    purchaseOrderDisplay(row),
    row.client_name || '',
    row.project_description || '',
    row.status || '',
    row.risk || '',
    row.vendedor_nombre || row.seller || '',
    row.tecnico_nombre || row.technician_name || '',
    formatDateCell(row.promised_delivery_date),
    formatDateTimeCell(row.closed_at),
    row.invoice_number || '',
    formatDateCell(row.invoice_date),
    row.invoice_payment_status || '',
    formatMoneyNumber(row.total_invoiced_mxn),
    formatMoneyNumber(row.total_charged),
    formatMoneyNumber(row.spent),
    formatMoneyNumber(row.pending_collection),
    formatMoneyNumber(row.expected_margin),
    formatPercent(row.final_margin),
    formatMoneyNumber(row.progress_percent),
    formatDateTimeCell(row.created_at),
  ];
}

/**
 * @param {{ from: string, to: string, activeProjects: object[], closedProjects: object[], generatedBy?: string }} payload
 */
function buildProjectsExcelWorkbook(payload) {
  const { from, to, activeProjects = [], closedProjects = [], generatedBy = '' } = payload;
  const generatedAt = new Date().toLocaleString('es-MX', { timeZone: TIMEZONE });

  const metaRows = [
    ['Reporte', 'Exportacion de proyectos'],
    ['Desde', from],
    ['Hasta', to],
    ['Generado', generatedAt],
    ['Generado por', generatedBy],
    ['Zona horaria', TIMEZONE],
    ['Hoja Activos', 'Proyectos abiertos cuya fecha de creacion cae en el rango'],
    ['Hoja Cerrados', 'Proyectos cuya fecha de cierre cae en el rango'],
    ['Rango maximo', '366 dias (1 año)'],
    ['Total activos', activeProjects.length],
    ['Total cerrados', closedProjects.length],
    ['Montos', 'Todos los importes estan en MXN'],
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${buildWorksheet('Resumen', ['Campo', 'Valor'], metaRows)}
${buildWorksheet('Activos', ACTIVE_HEADERS, activeProjects.map(mapActiveRow))}
${buildWorksheet('Cerrados', CLOSED_HEADERS, closedProjects.map(mapClosedRow))}
</Workbook>`;
}

module.exports = {
  MAX_RANGE_DAYS,
  escapeXml,
  isValidDateString,
  daysBetweenInclusive,
  parseExportDateRange,
  buildProjectsExcelWorkbook,
  ACTIVE_HEADERS,
  CLOSED_HEADERS,
};
