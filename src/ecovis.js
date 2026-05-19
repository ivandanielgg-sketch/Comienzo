function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateProjectPaidAmount(allocations) {
  return roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );
}

function calculateProjectStatus(project, paidAmount) {
  if (project.is_cancelled) {
    return 'cancelado';
  }

  const total = Number(project.total_amount || 0);
  if (total <= 0) {
    return 'pendiente';
  }

  if (paidAmount >= total) {
    return 'pagado';
  }

  if (paidAmount > 0) {
    return 'parcialmente_pagado';
  }

  return 'pendiente';
}

function calculatePaymentUnallocated(payment, allocations) {
  const totalAllocated = roundMoney(
    allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );
  return roundMoney(Number(payment.amount || 0) - totalAllocated);
}

function calculateEcovisAccountSummary(projects, payments, allocations, movements) {
  const activeProjects = projects.filter((p) => !p.is_cancelled);

  const totalProjected = roundMoney(
    activeProjects.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
  );

  const totalPaidToProjects = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );

  const totalPaymentsReceived = roundMoney(
    payments
      .filter((p) => !p.is_cancelled)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  );

  const totalAllocated = roundMoney(
    allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );

  const creditBalance = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'saldo_a_favor')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0),
  );

  const totalLoans = roundMoney(
    movements
      .filter((m) => m.movement_type === 'prestamo_ecovis_a_revram')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0),
  );

  const totalRepayments = roundMoney(
    movements
      .filter((m) => m.movement_type === 'devolucion')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0),
  );

  const pendingProjectAmount = roundMoney(totalProjected - totalPaidToProjects);

  const creditFromMovements = roundMoney(
    movements
      .filter((m) => m.movement_type === 'saldo_a_favor' && m.direction === 'ecovis_debe_a_revram')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0),
  );

  const availableCredit = roundMoney(creditBalance - creditFromMovements);

  const adjustments = roundMoney(
    movements
      .filter((m) => m.movement_type === 'ajuste')
      .reduce((sum, m) => {
        if (m.direction === 'ecovis_debe_a_revram') {
          return sum + Number(m.amount || 0);
        }
        if (m.direction === 'revram_debe_a_ecovis') {
          return sum - Number(m.amount || 0);
        }
        return sum;
      }, 0),
  );

  const ecovisDebt = roundMoney(pendingProjectAmount + adjustments);
  const revramDebt = roundMoney(totalLoans - totalRepayments);
  const netBalance = roundMoney(ecovisDebt - revramDebt);

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
    active_projects: activeProjects.length,
    total_projects: projects.length,
  };
}

module.exports = {
  calculateEcovisAccountSummary,
  calculateProjectPaidAmount,
  calculateProjectStatus,
  calculatePaymentUnallocated,
};
