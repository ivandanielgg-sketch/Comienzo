'use strict';

const { buildProjectTotals, roundMoney } = require('./calculations');

const PENDING_TOLERANCE_MXN = 0.01;
const SETTLEMENT_PAYMENT_NOTES = 'Liquidacion automatica al marcar Pagada';

/**
 * Plan de liquidacion a partir de totales vigentes (sin efectos de BD).
 * No altera formulas financieras: reutiliza buildProjectTotals.
 */
function buildSettlementPlan(project, payments = [], costs = [], exchangeRates = {}) {
  const invoiceCurrency = project.total_invoiced_currency || 'MXN';
  const totals = buildProjectTotals(project, payments, costs, exchangeRates);
  const pendingMxn = roundMoney(totals.pending_collection);
  const rates = normalizeRateMap(exchangeRates);
  const invoiceRate = Number(rates[invoiceCurrency] ?? 1);

  let settlementAction = 'create_payment';
  let canAutoSettle = true;
  let blockReason = null;

  if (pendingMxn < -PENDING_TOLERANCE_MXN) {
    settlementAction = 'blocked_overpayment';
    canAutoSettle = false;
    blockReason =
      'Existe sobrepago (saldo pendiente negativo). Corrija los pagos manualmente antes de marcar Pagada.';
  } else if (Math.abs(pendingMxn) <= PENDING_TOLERANCE_MXN) {
    settlementAction = 'status_only';
  }

  const requiresMxnConfirmation =
    settlementAction === 'create_payment' && invoiceCurrency !== 'MXN';

  const proposedPayment =
    settlementAction === 'create_payment'
      ? {
          amount: pendingMxn,
          currency: 'MXN',
          amount_mxn: pendingMxn,
          notes: SETTLEMENT_PAYMENT_NOTES,
        }
      : null;

  return {
    invoice_currency: invoiceCurrency,
    total_invoiced: Number(project.total_invoiced || 0),
    total_invoiced_mxn: totals.total_invoiced_mxn,
    total_charged_mxn: totals.total_charged,
    pending_collection_mxn: pendingMxn,
    exchange_rates: rates,
    rate_applied: {
      currency: invoiceCurrency,
      rate_to_mxn: invoiceRate,
    },
    settlement_action: settlementAction,
    proposed_payment: proposedPayment,
    requires_mxn_confirmation: requiresMxnConfirmation,
    can_auto_settle: canAutoSettle,
    block_reason: blockReason,
    already_paid: (project.invoice_payment_status || null) === 'Pagada',
    tolerance_mxn: PENDING_TOLERANCE_MXN,
  };
}

function normalizeRateMap(exchangeRates = {}) {
  if (Array.isArray(exchangeRates)) {
    return exchangeRates.reduce(
      (rates, row) => {
        rates[row.currency] = Number(row.rate_to_mxn);
        return rates;
      },
      { MXN: 1 },
    );
  }
  return Object.entries(exchangeRates).reduce(
    (rates, [currency, value]) => {
      rates[currency] = Number(value?.rate_to_mxn ?? value);
      return rates;
    },
    { MXN: 1 },
  );
}

function amountsMatchWithinTolerance(expected, actual, tolerance = PENDING_TOLERANCE_MXN) {
  return Math.abs(roundMoney(Number(expected)) - roundMoney(Number(actual))) <= tolerance;
}

module.exports = {
  PENDING_TOLERANCE_MXN,
  SETTLEMENT_PAYMENT_NOTES,
  buildSettlementPlan,
  amountsMatchWithinTolerance,
};
