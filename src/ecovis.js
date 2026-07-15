function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Normaliza número de OC: trim, mayúsculas, espacios colapsados. */
function normalizePurchaseOrderNumber(value) {
  if (value == null || value === '') return '';
  return String(value).trim().replace(/\s+/g, ' ').toUpperCase();
}

function amountsDiffer(a, b, tolerance = 0.005) {
  return Math.abs(Number(a || 0) - Number(b || 0)) > tolerance;
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

  const unallocatedPayments = roundMoney(totalPaymentsReceived - totalAllocated);

  const loanMovements = movements.filter(
    (m) => m.movement_type === 'prestamo_ecovis_a_revram' && !m.is_cancelled,
  );
  const activeLoansCount = loanMovements.filter((loan) => {
    const repaid = movements
      .filter((m) => m.movement_type === 'devolucion' && !m.is_cancelled && String(m.reference) === String(loan.id))
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0);
    return roundMoney(Number(loan.amount_mxn || loan.amount || 0) - repaid) > 0.01;
  }).length;

  return {
    total_projected: totalProjected,
    total_paid_to_projects: totalPaidToProjects,
    pending_project_amount: pendingProjectAmount,
    total_payments_received: totalPaymentsReceived,
    total_allocated: totalAllocated,
    unallocated_payments: unallocatedPayments,
    credit_balance: availableCredit,
    total_loans: totalLoans,
    total_repayments: totalRepayments,
    outstanding_loans: revramDebt,
    active_loans_count: activeLoansCount,
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

function calculateEcovisProjectBalance(project, allocations) {
  return calculateEcovisProjectPaymentStatus(project, allocations);
}

function calculateEcovisPurchaseOrderBalance(purchaseOrder, allocations) {
  return calculatePurchaseOrderBalance(purchaseOrder, allocations);
}

function calculateEcovisPaymentUnallocatedAmount(payment, allocations) {
  return {
    unallocated_amount: calculatePaymentUnallocated(payment, allocations),
    unallocated_amount_mxn: calculatePaymentUnallocatedMXN(payment, allocations),
  };
}

function calculateEcovisCreditBalance(allocations, movements) {
  const creditBalance = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'saldo_a_favor' && !a.is_cancelled)
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  const creditFromMovements = roundMoney(
    movements
      .filter((m) => m.movement_type === 'saldo_a_favor' && m.direction === 'ecovis_debe_a_revram' && !m.is_cancelled)
      .reduce((sum, m) => sum + Number(m.amount_mxn || m.amount || 0), 0),
  );
  return roundMoney(creditBalance - creditFromMovements);
}

const STATEMENT_TYPE_LABELS = {
  proyecto: 'Proyecto registrado',
  pago_recibido: 'Pago recibido',
  prestamo_ecovis_a_revram: 'Prestamo ECOVIS a REVRAM',
  aplicacion_a_proyecto: 'Aplicacion a proyecto',
  saldo_a_favor: 'Saldo a favor',
  devolucion: 'Devolucion de prestamo',
  ajuste: 'Ajuste',
  cancelacion: 'Cancelacion',
};

/**
 * Signed effect of a movement on net_balance (positive = ECOVIS debe a REVRAM).
 * Mirrors calculateEcovisAccountSummary — do not change independently.
 */
function classifyEcovisStatementEffect(movement, options = {}) {
  const cancelledProjectIds = options.cancelledProjectIds || new Set();
  const amount = roundMoney(Number(movement.amount_mxn || movement.amount || 0));
  const isCancelled = Boolean(Number(movement.is_cancelled));
  const type = movement.movement_type;
  const currency = movement.currency || 'MXN';
  const originalAmount = Number(movement.amount || 0);
  const label = STATEMENT_TYPE_LABELS[type] || type;

  const base = {
    movement_type: type,
    concept: movement.description || label,
    concept_label: label,
    reference: movement.reference
      || (movement.related_project_id ? `Proyecto #${movement.related_project_id}` : null)
      || (movement.related_payment_id ? `Pago #${movement.related_payment_id}` : null)
      || null,
    currency,
    original_amount: originalAmount,
    amount_mxn: amount,
    is_cancelled: isCancelled,
    cancellation_reason: movement.cancellation_reason || null,
    affects_balance: false,
    charge: 0,
    credit: 0,
    delta: 0,
    informational: false,
  };

  if (isCancelled) {
    return { ...base, informational: true };
  }

  switch (type) {
    case 'proyecto': {
      const projectCancelled = movement.related_project_id != null
        && cancelledProjectIds.has(Number(movement.related_project_id));
      if (projectCancelled) {
        return {
          ...base,
          charge: amount,
          informational: true,
          concept: `${base.concept} (proyecto cancelado)`,
        };
      }
      return { ...base, charge: amount, delta: amount, affects_balance: true };
    }
    case 'aplicacion_a_proyecto': {
      // Only project allocations reduce pending in the summary formula (not OC).
      if (movement.related_project_id == null) {
        return {
          ...base,
          credit: amount,
          informational: true,
          concept: `${base.concept} (OC / sin proyecto)`,
        };
      }
      return { ...base, credit: amount, delta: -amount, affects_balance: true };
    }
    case 'prestamo_ecovis_a_revram':
      return { ...base, credit: amount, delta: -amount, affects_balance: true };
    case 'devolucion':
      return { ...base, charge: amount, delta: amount, affects_balance: true };
    case 'ajuste': {
      if (movement.direction === 'ecovis_debe_a_revram') {
        return { ...base, charge: amount, delta: amount, affects_balance: true };
      }
      if (movement.direction === 'revram_debe_a_ecovis') {
        return { ...base, credit: amount, delta: -amount, affects_balance: true };
      }
      return { ...base, informational: true };
    }
    case 'cancelacion':
      return {
        ...base,
        credit: amount,
        informational: true,
        concept: movement.cancellation_reason
          ? `Cancelacion: ${movement.cancellation_reason}`
          : base.concept,
      };
    case 'pago_recibido':
      return {
        ...base,
        credit: amount,
        informational: true,
        concept: `${base.concept} (sin efecto en saldo hasta asignar)`,
      };
    case 'saldo_a_favor': {
      if (movement.direction === 'ecovis_debe_a_revram') {
        return {
          ...base,
          credit: amount,
          informational: true,
          concept: `${base.concept} (aplicacion de saldo a favor)`,
        };
      }
      return {
        ...base,
        credit: amount,
        informational: true,
        concept: `${base.concept} (credito disponible)`,
      };
    }
    default:
      return { ...base, informational: true };
  }
}

function compareStatementChronology(a, b) {
  const dateA = String(a.movement_date || '');
  const dateB = String(b.movement_date || '');
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  const idA = Number(a.id || 0);
  const idB = Number(b.id || 0);
  return idA - idB;
}

/**
 * Builds chronological ledger with running balance.
 * Running balance is computed ascending; callers may reverse for display.
 * Final running_balance equals net_balance when options include all movements
 * and cancelledProjectIds matches projects used by calculateEcovisAccountSummary.
 */
function buildEcovisStatementLedger(movements, options = {}) {
  const cancelledProjectIds = options.cancelledProjectIds instanceof Set
    ? options.cancelledProjectIds
    : new Set((options.cancelledProjectIds || []).map(Number));
  const from = options.from || null;
  const to = options.to || null;

  const sorted = [...movements].sort(compareStatementChronology);
  let running = 0;
  let openingBalance = 0;
  const rows = [];

  for (const movement of sorted) {
    const effect = classifyEcovisStatementEffect(movement, { cancelledProjectIds });
    const date = String(movement.movement_date || '');

    if (from && date < from) {
      if (effect.affects_balance) {
        running = roundMoney(running + effect.delta);
      }
      continue;
    }
    if (to && date > to) {
      continue;
    }

    if (from && rows.length === 0) {
      openingBalance = running;
    }

    if (effect.affects_balance) {
      running = roundMoney(running + effect.delta);
    }

    rows.push({
      id: movement.id,
      movement_date: movement.movement_date,
      movement_type: effect.movement_type,
      concept: effect.concept,
      concept_label: effect.concept_label,
      reference: effect.reference,
      currency: effect.currency,
      original_amount: effect.original_amount,
      amount_mxn: effect.amount_mxn,
      charge: effect.charge,
      credit: effect.credit,
      delta: effect.affects_balance ? effect.delta : 0,
      running_balance: running,
      affects_balance: effect.affects_balance,
      informational: effect.informational,
      is_cancelled: effect.is_cancelled,
      cancellation_reason: effect.cancellation_reason,
      direction: movement.direction || null,
      related_project_id: movement.related_project_id || null,
      related_payment_id: movement.related_payment_id || null,
      created_by: movement.created_by || null,
    });
  }

  if (!from) {
    openingBalance = 0;
  }

  const closingBalance = rows.length
    ? rows[rows.length - 1].running_balance
    : openingBalance;

  return {
    opening_balance: roundMoney(openingBalance),
    closing_balance: roundMoney(closingBalance),
    rows,
  };
}

function describeEcovisNetBalance(netBalance) {
  const amount = roundMoney(Math.abs(Number(netBalance) || 0));
  if (Math.abs(Number(netBalance) || 0) < 0.005) {
    return {
      status: 'settled',
      label: 'Cuenta saldada',
      favor_of: null,
      amount: 0,
      display_amount: amount,
    };
  }
  if (Number(netBalance) > 0) {
    return {
      status: 'ecovis_owes',
      label: 'ECOVIS debe a REVRAM',
      favor_of: 'REVRAM',
      amount: Number(netBalance),
      display_amount: amount,
    };
  }
  return {
    status: 'revram_owes',
    label: 'REVRAM debe a ECOVIS',
    favor_of: 'ECOVIS',
    amount: Number(netBalance),
    display_amount: amount,
  };
}

function buildEcovisAccountHeader(summary) {
  const net = Number(summary.net_balance || 0);
  const pending = Number(summary.pending_project_amount || 0);
  const adjustments = Number(summary.adjustments || 0);
  const loans = Number(summary.outstanding_loans || 0);
  const described = describeEcovisNetBalance(net);
  return {
    ...described,
    equation: {
      pending_projects: pending,
      adjustments,
      outstanding_loans: loans,
      net_balance: roundMoney(pending + adjustments - loans),
    },
  };
}

module.exports = {
  calculateEcovisAccountSummary,
  calculateEcovisProjectPaymentStatus,
  calculateEcovisProjectBalance,
  calculateEcovisPurchaseOrderBalance,
  calculateEcovisPaymentUnallocatedAmount,
  calculateEcovisCreditBalance,
  calculateProjectPaidAmount,
  calculateProjectPaidAmountMXN,
  calculateProjectStatus,
  calculatePaymentUnallocated,
  calculatePaymentUnallocatedMXN,
  calculatePurchaseOrderBalance,
  convertToMXN,
  normalizePurchaseOrderNumber,
  amountsDiffer,
  roundMoney,
  classifyEcovisStatementEffect,
  buildEcovisStatementLedger,
  describeEcovisNetBalance,
  buildEcovisAccountHeader,
  STATEMENT_TYPE_LABELS,
};
