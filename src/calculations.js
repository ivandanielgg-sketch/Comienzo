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

function sumAmounts(items, exchangeRates = {}) {
  return roundMoney(
    items.reduce(
      (total, item) =>
        total + convertAmountToMxn(item.amount, item.currency || 'MXN', exchangeRates),
      0,
    ),
  );
}

function buildProjectTotals(project, payments = [], costs = [], exchangeRates = {}) {
  const totalCharged = sumAmounts(payments, exchangeRates);
  const spent = sumAmounts(costs, exchangeRates);
  const totalInvoicedMxn = convertAmountToMxn(
    project.total_invoiced,
    project.total_invoiced_currency || 'MXN',
    exchangeRates,
  );
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
};
