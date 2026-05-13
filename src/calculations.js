function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function sumAmounts(items) {
  return roundMoney(
    items.reduce((total, item) => total + Number(item.amount || 0), 0),
  );
}

function buildProjectTotals(project, payments = [], costs = []) {
  const totalCharged = sumAmounts(payments);
  const spent = sumAmounts(costs);
  const totalInvoiced = roundMoney(project.total_invoiced || 0);
  const pendingCollection = roundMoney(totalInvoiced - totalCharged);
  const finalMargin =
    totalInvoiced > 0 ? roundMoney(1 - spent / totalInvoiced) : null;

  return {
    total_charged: totalCharged,
    spent,
    total_invoiced: totalInvoiced,
    pending_collection: pendingCollection,
    final_margin: finalMargin,
  };
}

module.exports = {
  buildProjectTotals,
  roundMoney,
  sumAmounts,
};
