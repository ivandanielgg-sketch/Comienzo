function calculateEcovisAccountSummary(projects, payments, allocations, movements) {
  const activeProjects = projects.filter(p => p.status !== 'cancelado' && !p.is_cancelled);

  const totalProjectsAmount = activeProjects.reduce((s, p) => s + p.total_amount, 0);

  const projectAllocations = allocations.filter(a => a.allocation_type === 'proyecto' && !a.is_cancelled);
  const totalPaidToProjects = projectAllocations.reduce((s, a) => s + a.amount, 0);

  const totalPendingProjects = Math.max(0, totalProjectsAmount - totalPaidToProjects);

  const loanMovements = movements.filter(m => m.movement_type === 'prestamo_ecovis_a_revram' && !m.is_cancelled);
  const loanRepayments = movements.filter(m => m.movement_type === 'devolucion' && !m.is_cancelled);
  const totalLoansFromEcovisToRevram = loanMovements.reduce((s, m) => s + m.amount, 0);
  const totalLoanRepayments = loanRepayments.reduce((s, m) => s + m.amount, 0);
  const outstandingLoans = Math.max(0, totalLoansFromEcovisToRevram - totalLoanRepayments);

  const totalUnallocatedPayments = payments
    .filter(p => !p.is_cancelled)
    .reduce((s, p) => s + (p.unallocated_amount || 0), 0);

  const saldoFavorAllocations = allocations.filter(a => a.allocation_type === 'saldo_a_favor' && !a.is_cancelled);
  const totalCreditAllocated = saldoFavorAllocations.reduce((s, a) => s + a.amount, 0);
  const saldoFavorApplied = movements.filter(m => m.movement_type === 'saldo_a_favor' && m.direction === 'ecovis_debe_a_revram' && !m.is_cancelled);
  const totalCreditApplied = saldoFavorApplied.reduce((s, m) => s + m.amount, 0);
  const ecovisCreditBalance = Math.max(0, totalCreditAllocated + totalUnallocatedPayments - totalCreditApplied);

  const revramPayableToEcovis = outstandingLoans;

  const ecovisOwesToRevram = totalPendingProjects;
  const netBalance = ecovisOwesToRevram - revramPayableToEcovis - ecovisCreditBalance;

  const projectsCount = activeProjects.length;
  const pendingProjectsCount = activeProjects.filter(p => p.status === 'pendiente' || p.status === 'parcialmente_pagado').length;
  const paidProjectsCount = activeProjects.filter(p => p.status === 'pagado').length;

  return {
    totalProjectsAmount: round2(totalProjectsAmount),
    totalPaidToProjects: round2(totalPaidToProjects),
    totalPendingProjects: round2(totalPendingProjects),
    totalLoansFromEcovisToRevram: round2(outstandingLoans),
    totalUnallocatedPayments: round2(totalUnallocatedPayments),
    ecovisCreditBalance: round2(ecovisCreditBalance),
    revramPayableToEcovis: round2(revramPayableToEcovis),
    netBalance: round2(netBalance),
    projectsCount,
    pendingProjectsCount,
    paidProjectsCount,
  };
}

function calculateProjectPaidAmount(projectId, allocations) {
  return round2(
    allocations
      .filter(a => a.ecovis_project_id === projectId && !a.is_cancelled)
      .reduce((s, a) => s + a.amount, 0)
  );
}

function calculateProjectStatus(totalAmount, paidAmount, currentStatus) {
  if (currentStatus === 'cancelado') return 'cancelado';
  if (paidAmount <= 0) return 'pendiente';
  if (paidAmount >= totalAmount) return 'pagado';
  return 'parcialmente_pagado';
}

function calculatePaymentUnallocated(payment, allocations) {
  const allocated = allocations
    .filter(a => a.payment_id === payment.id && !a.is_cancelled)
    .reduce((s, a) => s + a.amount, 0);
  return round2(Math.max(0, payment.amount - allocated));
}

function round2(val) {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  calculateEcovisAccountSummary,
  calculateProjectPaidAmount,
  calculateProjectStatus,
  calculatePaymentUnallocated,
  round2,
};
