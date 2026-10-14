function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeExchangeRates(exchangeRates = {}) {
  if (Array.isArray(exchangeRates)) {
    return exchangeRates.reduce((rates, row) => {
      rates[row.currency] = Number(row.rate_to_mxn);
      return rates;
    }, { MXN: 1 });
  }

  return Object.entries(exchangeRates).reduce(
    (rates, [currency, value]) => {
      rates[currency] = Number(value.rate_to_mxn ?? value);
      return rates;
    },
    { MXN: 1 },
  );
}

function convertAmountToMxn(amount, currency = 'MXN', exchangeRates = {}) {
  const rates = normalizeExchangeRates(exchangeRates);
  const rate = rates[currency] ?? 1;
  return roundMoney(Number(amount || 0) * rate);
}

function hasHistoricalAmountMxn(item) {
  return item != null && item.amount_mxn != null && item.amount_mxn !== '';
}

/**
 * MXN de un pago/costo: usa snapshot histórico si existe; si no, estimación con tasas vivas
 * (solo operativa; no se presenta como histórico confirmado en la API).
 */
function resolveEntryAmountMxn(item, exchangeRates = {}) {
  if (hasHistoricalAmountMxn(item)) {
    return roundMoney(Number(item.amount_mxn));
  }
  return convertAmountToMxn(item.amount, item.currency || 'MXN', exchangeRates);
}

function sumAmounts(items, exchangeRates = {}) {
  return roundMoney(
    items.reduce((total, item) => total + resolveEntryAmountMxn(item, exchangeRates), 0),
  );
}

/**
 * Facturado MXN: snapshot de liquidación si existe; si no, conversión viva.
 */
function resolveInvoicedAmountMxn(project, exchangeRates = {}) {
  if (project != null && project.invoiced_amount_mxn != null && project.invoiced_amount_mxn !== '') {
    return roundMoney(Number(project.invoiced_amount_mxn));
  }
  return convertAmountToMxn(
    project?.total_invoiced,
    project?.total_invoiced_currency || 'MXN',
    exchangeRates,
  );
}

function capturePaymentFxSnapshot(amount, currency = 'MXN', exchangeRates = {}) {
  const rates = normalizeExchangeRates(exchangeRates);
  const cur = currency || 'MXN';
  const rate = cur === 'MXN' ? 1 : Number(rates[cur] ?? 1);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return {
    exchange_rate_to_mxn: safeRate,
    amount_mxn: roundMoney(Number(amount || 0) * safeRate),
  };
}

function missingCostExchangeRateError(currency) {
  const error = new Error(
    `No hay un tipo de cambio valido para ${currency}. El costo no se guardo.`,
  );
  error.code = 'MISSING_EXCHANGE_RATE';
  error.statusCode = 400;
  return error;
}

/**
 * Snapshot de un costo nuevo o de un costo cuyo importe o moneda cambiaron.
 * MXN queda en 1. USD/EUR exigen una tasa presente y mayor que cero.
 * No sustituye una tasa ausente por 1. Una tasa explicita de 1 si se conserva.
 */
function captureCostFxSnapshot(amount, currency = 'MXN', exchangeRates = {}) {
  const cur = currency || 'MXN';
  const numericAmount = Number(amount || 0);
  if (cur === 'MXN') {
    return {
      exchange_rate_to_mxn: 1,
      amount_mxn: roundMoney(numericAmount),
    };
  }
  const rates = normalizeExchangeRates(exchangeRates);
  const rate = Number(rates[cur]);
  if (!Object.prototype.hasOwnProperty.call(rates, cur) || !Number.isFinite(rate) || rate <= 0) {
    throw missingCostExchangeRateError(cur);
  }
  return {
    exchange_rate_to_mxn: rate,
    amount_mxn: roundMoney(numericAmount * rate),
  };
}

function sameMoney(left, right) {
  return roundMoney(left) === roundMoney(right);
}

/**
 * Politica de edicion de costos:
 * - Descripcion, categoria y cost_date no cambian el snapshot, aunque sea NULL.
 * - Importe o moneda distintos reemplazan el snapshot con la tasa vigente.
 * - Nunca se conserva un amount_mxn de un importe que ya no es el actual.
 * - Un costo antiguo con snapshot NULL no se vuelve historico si el importe no cambia.
 */
function resolveCostSnapshot(existing, next, exchangeRates = {}) {
  const amountUnchanged = existing != null && sameMoney(existing.amount, next.amount);
  const currencyUnchanged = existing != null
    && String(existing.currency || 'MXN') === String(next.currency || 'MXN');
  if (amountUnchanged && currencyUnchanged) {
    const hasRate = existing.exchange_rate_to_mxn != null && existing.exchange_rate_to_mxn !== '';
    const hasAmount = hasHistoricalAmountMxn(existing);
    return {
      exchange_rate_to_mxn: hasRate ? Number(existing.exchange_rate_to_mxn) : null,
      amount_mxn: hasAmount ? roundMoney(Number(existing.amount_mxn)) : null,
    };
  }
  return captureCostFxSnapshot(next.amount, next.currency, exchangeRates);
}

function buildProjectTotals(project, payments = [], costs = [], exchangeRates = {}) {
  const totalCharged = sumAmounts(payments, exchangeRates);
  const spent = sumAmounts(costs, exchangeRates);
  const totalInvoicedMxn = resolveInvoicedAmountMxn(project, exchangeRates);
  const pendingCollection = roundMoney(totalInvoicedMxn - totalCharged);
  const finalMargin =
    totalInvoicedMxn > 0 ? roundMoney(1 - spent / totalInvoicedMxn) : null;

  return {
    total_charged: totalCharged,
    spent,
    total_invoiced_mxn: totalInvoicedMxn,
    pending_collection: pendingCollection,
    final_margin: finalMargin,
  };
}

module.exports = {
  buildProjectTotals,
  convertAmountToMxn,
  normalizeExchangeRates,
  roundMoney,
  sumAmounts,
  resolveEntryAmountMxn,
  resolveInvoicedAmountMxn,
  capturePaymentFxSnapshot,
  captureCostFxSnapshot,
  resolveCostSnapshot,
  hasHistoricalAmountMxn,
};
