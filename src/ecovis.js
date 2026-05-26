function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function convertToMXN(amount, currency, exchangeRates) {
  const cur = currency || 'MXN';
  const rate = exchangeRates[cur];
  if (rate === undefined || rate === null) {
    return roundMoney(Number(amount || 0));
  }
  return roundMoney(Number(amount || 0) * Number(rate));
}

function calculateProjectPaidAmount(allocations) {
  return roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );
}

function calculateProjectPaidAmountMXN(allocations) {
  return roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
}

function calculateProjectStatus(project, paidAmountMxn) {
  if (project.is_cancelled) {
    return 'cancelado';
  }

  const totalMxn = Number(project.amount_mxn || project.total_amount || 0);
  if (totalMxn <= 0) {
    return 'pendiente';
  }

  if (paidAmountMxn >= totalMxn - 0.01) {
    return 'pagado';
  }

  if (paidAmountMxn > 0) {
    return 'parcialmente_pagado';
  }

  return 'pendiente';
}

function calculateEcovisProjectPaymentStatus(project, allocations) {
  const paidAmountMxn = calculateProjectPaidAmountMXN(allocations);
  const totalMxn = Number(project.amount_mxn || project.total_amount || 0);
  const pendingMxn = roundMoney(Math.max(0, totalMxn - paidAmountMxn));
  const isFullyPaid = paidAmountMxn >= totalMxn - 0.01 && paidAmountMxn > 0;
  const status = calculateProjectStatus(project, paidAmountMxn);

  return {
    total_amount_mxn: roundMoney(totalMxn),
    paid_amount_mxn: paidAmountMxn,
    pending_amount_mxn: pendingMxn,
    is_fully_paid: isFullyPaid,
    status,
  };
}

function calculatePaymentUnallocated(payment, allocations) {
  const totalAllocated = roundMoney(
    allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );
  return roundMoney(Number(payment.amount || 0) - totalAllocated);
}

function calculatePaymentUnallocatedMXN(payment, allocations) {
  const totalAllocatedMxn = roundMoney(
    allocations.reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  const paymentMxn = Number(payment.amount_mxn || payment.amount || 0);
  return roundMoney(paymentMxn - totalAllocatedMxn);
}

function calculateEcovisAccountSummary(projects, payments, allocations, movements) {
  const activeProjects = projects.filter((p) => !p.is_cancelled);
  const activeNonPaid = activeProjects.filter((p) => {
    const pendingMxn = Number(p.pending_amount_mxn ?? p.amount_mxn ?? p.total_amount ?? 0);
    const paidMxn = Number(p.paid_amount_mxn ?? 0);
    return pendingMxn > 0.01 || paidMxn === 0;
  });

  const totalProjected = roundMoney(
    activeProjects.reduce((sum, p) => sum + Number(p.amount_mxn || p.total_amount || 0), 0),
  );

  const totalPaidToProjects = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );

  const totalPaymentsReceived = roundMoney(
    payments
      .filter((p) => !p.is_cancelled)
      .reduce((sum, p) => sum + Number(p.amount_mxn || p.amount || 0), 0),
  );

  const totalAllocated = roundMoney(
    allocations
      .filter((a) => !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );

  const creditBalance = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'saldo_a_favor' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );

  const totalLoans = roundMoney(
    movements
      .filter((m) => m.movement_type === 'prestamo_ecovis_a_revram' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );

  const totalRepayments = roundMoney(
    movements
      .filter((m) => m.movement_type === 'devolucion' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );

  const pendingProjectAmount = roundMoney(totalProjected - totalPaidToProjects);

  const creditFromMovements = roundMoney(
    movements
      .filter((m) => m.movement_type === 'saldo_a_favor' && m.direction === 'ecovis_debe_a_revram' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );

  const availableCredit = roundMoney(creditBalance - creditFromMovements);

  const adjustments = roundMoney(
    movements
      .filter((m) => m.movement_type === 'ajuste' && !m.is_cancelled)
      .reduce((sum, m) => {
        const amt = Number(m.amount_mxn || m.amount || 0);
        if (m.direction === 'ecovis_debe_a_revram') {
          return sum + amt;
        }
        if (m.direction === 'revram_debe_a_ecovis') {
          return sum - amt;
        }
        return sum;
      }, 0),
  );

  const ecovisDebt = roundMoney(pendingProjectAmount + adjustments);
  const revramDebt = roundMoney(totalLoans - totalRepayments);
  const netBalance = roundMoney(ecovisDebt - revramDebt);

  const activeProjectsTotalMxn = roundMoney(
    activeNonPaid.reduce((sum, p) => sum + Number(p.amount_mxn || p.total_amount || 0), 0),
  );
  const activeProjectsPaidMxn = roundMoney(
    activeNonPaid.reduce((sum, p) => sum + Number(p.paid_amount_mxn || 0), 0),
  );
  const activeProjectsPendingMxn = roundMoney(activeProjectsTotalMxn - activeProjectsPaidMxn);

  return {
    total_projected: totalProjected,
    total_paid_to_projects: totalPaidToProjects,
    pending_project_amount: pendingProjectAmount,
    total_payments_received: totalPaymentsReceived,
    total_allocated: totalAllocated,
    credit_balance: availableCredit,
    total_loans: totalLoans,
    total_repayments: totalRepayments,
    outstanding_loans: revramDebt,
    adjustments,
    ecovis_owes_revram: ecovisDebt,
    revram_owes_ecovis: revramDebt,
    net_balance: netBalance,
    active_projects: activeNonPaid.length,
    total_projects: projects.length,
    active_projects_total_mxn: activeProjectsTotalMxn,
    active_projects_paid_mxn: activeProjectsPaidMxn,
    active_projects_pending_mxn: activeProjectsPendingMxn,
  };
}

function calculatePurchaseOrderBalance(purchaseOrder, allocations) {
  const totalAmountMxn = Number(purchaseOrder.amount_mxn || purchaseOrder.total_amount || 0);
  const totalAppliedMxn = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'orden_compra' && a.ecovis_purchase_order_id === purchaseOrder.id && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  const pendingBalance = roundMoney(Math.max(0, totalAmountMxn - totalAppliedMxn));

  let status = purchaseOrder.status;
  if (!purchaseOrder.is_cancelled) {
    if (totalAppliedMxn <= 0) status = 'pendiente';
    else if (pendingBalance <= 0.01) status = 'pagada';
    else status = 'parcialmente_pagada';
  } else {
    status = 'cancelada';
  }

  return {
    purchase_order_number: purchaseOrder.purchase_order_number,
    total_amount: Number(purchaseOrder.total_amount || 0),
    total_amount_mxn: totalAmountMxn,
    total_applied_payments: totalAppliedMxn,
    pending_balance: pendingBalance,
    status,
  };
}

module.exports = {
  calculateEcovisAccountSummary,
  calculateEcovisProjectPaymentStatus,
  calculateProjectPaidAmount,
  calculateProjectPaidAmountMXN,
  calculateProjectStatus,
  calculatePaymentUnallocated,
  calculatePaymentUnallocatedMXN,
  calculatePurchaseOrderBalance,
  convertToMXN,
  roundMoney,
};
