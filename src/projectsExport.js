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

/** IVA estándar MX usado cuando el importe está etiquetado "con IVA" y no hay desglose. */
const DEFAULT_IVA_RATE = 0.16;

const SELLER_DETAIL_HEADERS = [
  'Proyecto',
  'Cotizacion',
  'Vendedor',
  'Fecha facturacion',
  'Facturado sin IVA',
  'Gastos sin IVA',
  'Utilidad sin IVA',
  'Margen %',
  'Fecha liquidacion',
  'Dias facturacion-liquidacion',
  'Estatus cobranza',
  'Nota IVA / criterio',
];

const SELLER_SUMMARY_HEADERS = [
  'Vendedor',
  'Facturado sin IVA',
  'Gastos sin IVA',
  'Utilidad sin IVA',
  'Margen %',
  'Proyectos',
];

function round2(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function amountWithoutIva(amountWithIva, ivaRate = DEFAULT_IVA_RATE) {
  if (amountWithIva == null || amountWithIva === '') return null;
  const gross = Number(amountWithIva);
  if (!Number.isFinite(gross)) return null;
  const rate = Number(ivaRate);
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) return null;
  return round2(gross / (1 + rate));
}

function calendarDaysBetween(from, to) {
  if (!isValidDateString(from) || !isValidDateString(to)) return null;
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
  return Math.floor((toMs - fromMs) / 86400000);
}

/**
 * Fecha del cobro con el que el acumulado alcanza el facturado (pagos ordenados).
 * Si sigue pendiente, date/days vacíos y status Pendiente.
 */
function resolveSettlementFromPayments({
  invoiceDate,
  invoicedMxn,
  payments = [],
  invoicePaymentStatus,
  resolvePaymentMxn,
  tolerance = 0.01,
}) {
  const status = invoicePaymentStatus === 'Pagada' ? 'Pagada' : 'Pendiente';
  const sorted = [...payments].sort((a, b) => {
    const da = String(a.payment_date || '');
    const db = String(b.payment_date || '');
    if (da !== db) return da.localeCompare(db);
    return Number(a.id || 0) - Number(b.id || 0);
  });

  let cumulative = 0;
  let settlementDate = null;
  for (const payment of sorted) {
    cumulative = round2(cumulative + Number(resolvePaymentMxn(payment) || 0)) || 0;
    if (invoicedMxn != null && cumulative + tolerance >= Number(invoicedMxn)) {
      settlementDate = payment.payment_date ? String(payment.payment_date).slice(0, 10) : null;
      break;
    }
  }

  if (status !== 'Pagada' || !settlementDate) {
    return {
      status: status === 'Pagada' && !settlementDate ? 'Pendiente' : status,
      settlementDate: null,
      days: null,
    };
  }

  return {
    status: 'Pagada',
    settlementDate,
    days: calendarDaysBetween(invoiceDate, settlementDate),
  };
}

/**
 * Construye filas de detalle/resumen para el reporte por vendedor.
 *
 * Criterios contables:
 * - Rango: projects.invoice_date (inclusive), excluye invoice_date_na / sin fecha.
 * - Un proyecto = una factura (no hay tabla de facturas múltiples).
 * - Gastos a nivel proyecto (no hay asignación gasto→factura).
 * - Facturado sin IVA = facturado MXN / 1.16 (UI: "Total facturado con IVA").
 * - Gastos: sin desglose de IVA en BD → se estima ÷1.16 y se marca incompleto/estimado.
 * - Utilidad = facturado sin IVA − gastos sin IVA.
 * - Margen % = utilidad / facturado sin IVA (vacío si facturado sin IVA = 0).
 * - Liquidación: fecha del pago que completa el saldo; si no, Pendiente.
 */
function buildSellerProfitabilityRows({
  projects = [],
  resolveInvoicedMxn,
  resolvePaymentMxn,
  resolveCostMxn,
  ivaRate = DEFAULT_IVA_RATE,
}) {
  const detail = [];

  for (const project of projects) {
    const invoiceDate = project.invoice_date_na
      ? null
      : (project.invoice_date ? String(project.invoice_date).slice(0, 10) : null);
    if (!invoiceDate || !isValidDateString(invoiceDate)) continue;

    const invoicedWithIva = round2(resolveInvoicedMxn(project));
    const costsWithIva = round2(
      (project.costs || []).reduce((sum, cost) => sum + Number(resolveCostMxn(cost) || 0), 0),
    );
    const invoicedNet = amountWithoutIva(invoicedWithIva, ivaRate);
    const costsNet = amountWithoutIva(costsWithIva, ivaRate);
    const utility = invoicedNet != null && costsNet != null
      ? round2(invoicedNet - costsNet)
      : null;
    const marginPct = invoicedNet != null && invoicedNet !== 0 && utility != null
      ? round2((utility / invoicedNet) * 100)
      : null;

    const settlement = resolveSettlementFromPayments({
      invoiceDate,
      invoicedMxn: invoicedWithIva,
      payments: project.payments || [],
      invoicePaymentStatus: project.invoice_payment_status,
      resolvePaymentMxn,
    });

    const notes = [
      'Fecha criterio: invoice_date (ambos extremos inclusive).',
      'Una factura por proyecto (campo projects.invoice_*).',
      'Gastos a nivel proyecto (sin prorrateo por factura).',
      'Facturado sin IVA = facturado con IVA / 1.16.',
      'Gastos sin IVA ESTIMADO (÷1.16): costos sin desglose de IVA en BD — dato incompleto para rigor fiscal.',
    ].join(' ');

    detail.push({
      projectId: Number(project.id) || 0,
      projectLabel: project.project_description || project.quote_number || `Proyecto ${project.id}`,
      quoteNumber: project.quote_number || '',
      seller: project.vendedor_nombre || project.seller || 'Sin vendedor',
      invoiceDate,
      invoicedWithoutIva: invoicedNet,
      costsWithoutIva: costsNet,
      utilityWithoutIva: utility,
      marginPercent: marginPct,
      settlementDate: settlement.settlementDate,
      settlementDays: settlement.days,
      collectionStatus: settlement.status,
      notes,
      costsIvaIncomplete: true,
    });
  }

  const bySeller = new Map();
  for (const row of detail) {
    const key = row.seller || 'Sin vendedor';
    if (!bySeller.has(key)) {
      bySeller.set(key, {
        seller: key,
        invoicedWithoutIva: 0,
        costsWithoutIva: 0,
        utilityWithoutIva: 0,
        projectCount: 0,
      });
    }
    const agg = bySeller.get(key);
    agg.invoicedWithoutIva = round2(agg.invoicedWithoutIva + (row.invoicedWithoutIva || 0));
    agg.costsWithoutIva = round2(agg.costsWithoutIva + (row.costsWithoutIva || 0));
    agg.utilityWithoutIva = round2(agg.utilityWithoutIva + (row.utilityWithoutIva || 0));
    agg.projectCount += 1;
  }

  const summary = [...bySeller.values()]
    .sort((a, b) => a.seller.localeCompare(b.seller, 'es'))
    .map((agg) => ({
      ...agg,
      marginPercent: agg.invoicedWithoutIva
        ? round2((agg.utilityWithoutIva / agg.invoicedWithoutIva) * 100)
        : null,
    }));

  const total = summary.reduce(
    (acc, row) => {
      acc.invoicedWithoutIva = round2(acc.invoicedWithoutIva + row.invoicedWithoutIva);
      acc.costsWithoutIva = round2(acc.costsWithoutIva + row.costsWithoutIva);
      acc.utilityWithoutIva = round2(acc.utilityWithoutIva + row.utilityWithoutIva);
      acc.projectCount += row.projectCount;
      return acc;
    },
    {
      seller: 'TOTAL GENERAL',
      invoicedWithoutIva: 0,
      costsWithoutIva: 0,
      utilityWithoutIva: 0,
      projectCount: 0,
      marginPercent: null,
    },
  );
  total.marginPercent = total.invoicedWithoutIva
    ? round2((total.utilityWithoutIva / total.invoicedWithoutIva) * 100)
    : null;

  return { detail, summary, total };
}

function excelCell(value) {
  if (value == null || value === '') {
    return `<Cell><Data ss:Type="String"></Data></Cell>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  // Fechas ISO se dejan como String YYYY-MM-DD (ordenables) para no depender de estilos.
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function buildTypedWorksheet(name, headers, rows) {
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
  const dataRows = rows
    .map((row) => `<Row>${row.map((cell) => excelCell(cell)).join('')}</Row>`)
    .join('');
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet>`;
}

function mapSellerDetailExcelRow(row) {
  return [
    row.projectLabel,
    row.quoteNumber,
    row.seller,
    row.invoiceDate || '',
    row.invoicedWithoutIva == null ? '' : row.invoicedWithoutIva,
    row.costsWithoutIva == null ? '' : row.costsWithoutIva,
    row.utilityWithoutIva == null ? '' : row.utilityWithoutIva,
    row.marginPercent == null ? '' : row.marginPercent,
    row.settlementDate || '',
    row.settlementDays == null ? '' : row.settlementDays,
    row.collectionStatus || '',
    row.notes || '',
  ];
}

function mapSellerSummaryExcelRow(row) {
  return [
    row.seller,
    row.invoicedWithoutIva == null ? '' : row.invoicedWithoutIva,
    row.costsWithoutIva == null ? '' : row.costsWithoutIva,
    row.utilityWithoutIva == null ? '' : row.utilityWithoutIva,
    row.marginPercent == null ? '' : row.marginPercent,
    row.projectCount == null ? '' : row.projectCount,
  ];
}

/**
 * @param {{ from: string, to: string, sellerLabel?: string, detailRows: object[], summaryRows: object[], totalRow?: object, generatedBy?: string }} payload
 */
function buildSellerProfitabilityExcelWorkbook(payload) {
  const {
    from,
    to,
    sellerLabel = 'Todos',
    detailRows = [],
    summaryRows = [],
    totalRow = null,
    generatedBy = '',
  } = payload;
  const generatedAt = new Date().toLocaleString('es-MX', { timeZone: TIMEZONE });

  const metaRows = [
    ['Reporte', 'Utilidad por proyecto / resumen por vendedor'],
    ['Criterio de fechas', 'Fecha de facturacion (projects.invoice_date), inclusive en ambos extremos'],
    ['Desde', from],
    ['Hasta', to],
    ['Vendedor', sellerLabel],
    ['Generado', generatedAt],
    ['Generado por', generatedBy],
    ['Zona horaria', TIMEZONE],
    ['IVA facturado', 'Total facturado con IVA / 1.16 (etiqueta UI del campo total_invoiced)'],
    ['IVA gastos', 'INCOMPLETO/ESTIMADO: costos sin desglose; se aplica /1.16 como proxy'],
    ['Facturas', 'Una factura por proyecto; no existe tabla de facturas multiples'],
    ['Gastos', 'Totales a nivel proyecto (sin asignacion gasto-factura)'],
    ['Liquidacion', 'Fecha del pago que completa el saldo facturado; si no, Pendiente'],
    ['Filas detalle', detailRows.length],
  ];

  const summaryExcelRows = summaryRows.map(mapSellerSummaryExcelRow);
  if (totalRow) summaryExcelRows.push(mapSellerSummaryExcelRow(totalRow));

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${buildTypedWorksheet('Criterios', ['Campo', 'Valor'], metaRows)}
${buildTypedWorksheet('Detalle por proyecto', SELLER_DETAIL_HEADERS, detailRows.map(mapSellerDetailExcelRow))}
${buildTypedWorksheet('Resumen por vendedor', SELLER_SUMMARY_HEADERS, summaryExcelRows)}
</Workbook>`;
}

module.exports = {
  MAX_RANGE_DAYS,
  DEFAULT_IVA_RATE,
  escapeXml,
  isValidDateString,
  daysBetweenInclusive,
  parseExportDateRange,
  buildProjectsExcelWorkbook,
  buildSellerProfitabilityRows,
  buildSellerProfitabilityExcelWorkbook,
  resolveSettlementFromPayments,
  amountWithoutIva,
  calendarDaysBetween,
  ACTIVE_HEADERS,
  CLOSED_HEADERS,
  SELLER_DETAIL_HEADERS,
  SELLER_SUMMARY_HEADERS,
};
