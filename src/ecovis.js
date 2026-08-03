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

  // Allocations to cancelled/missing projects must not reduce pending
  // (otherwise pending can go negative after cancel while movements linger).
  const activeProjectIds = new Set(activeProjects.map((p) => Number(p.id)));
  const totalPaidToProjects = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .filter((a) => {
        if (a.ecovis_project_id == null) return true; // legacy rows without FK
        return activeProjectIds.has(Number(a.ecovis_project_id));
      })
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

const GENERIC_MOVEMENT_DESCRIPTIONS = new Set([
  '',
  'proyecto',
  'pago_recibido',
  'prestamo_ecovis_a_revram',
  'aplicacion_a_proyecto',
  'saldo_a_favor',
  'devolucion',
  'ajuste',
  'cancelacion',
  'orden_compra',
  'prestamo',
]);

/**
 * Prefer structured labels + related project name over raw description.
 * Raw notes were sometimes browser-autofilled with the admin password into
 * allocation forms (input name="notes") / project_name.
 */
function resolveStatementConcept(movement, projectById = {}) {
  const type = movement.movement_type;
  const label = STATEMENT_TYPE_LABELS[type] || type;
  const project = movement.related_project_id != null
    ? projectById[Number(movement.related_project_id)]
    : null;
  const projectName = project && project.project_name
    ? String(project.project_name).trim()
    : '';
  const raw = String(movement.description || '').trim();
  const isGeneric = GENERIC_MOVEMENT_DESCRIPTIONS.has(raw);

  switch (type) {
    case 'proyecto':
      return projectName || (isGeneric ? label : raw) || label;
    case 'aplicacion_a_proyecto':
      if (projectName) return `Aplicacion a ${projectName}`;
      if (movement.related_project_id == null) return 'Aplicacion a orden de compra';
      return isGeneric ? label : raw;
    case 'saldo_a_favor':
      if (movement.direction === 'ecovis_debe_a_revram') {
        return projectName
          ? `Aplicacion de saldo a favor a ${projectName}`
          : 'Aplicacion de saldo a favor';
      }
      return isGeneric ? 'Saldo a favor (credito disponible)' : raw;
    case 'cancelacion': {
      const reason = String(movement.cancellation_reason || raw || '').trim();
      return reason ? `Cancelacion: ${reason}` : label;
    }
    case 'pago_recibido':
      return (!isGeneric && raw)
        ? `${raw} (sin efecto en saldo hasta asignar)`
        : 'Pago recibido (sin efecto en saldo hasta asignar)';
    case 'prestamo_ecovis_a_revram':
    case 'devolucion':
    case 'ajuste':
      return (!isGeneric && raw) ? raw : label;
    default:
      return raw || label;
  }
}

function isInactiveProjectMovement(movement, options = {}) {
  if (Number(movement.is_cancelled)) return true;
  const pid = movement.related_project_id;
  if (pid == null) return false;
  const id = Number(pid);
  const cancelledProjectIds = options.cancelledProjectIds || new Set();
  const activeProjectIds = options.activeProjectIds || null;
  if (cancelledProjectIds.has(id)) return true;
  if (activeProjectIds && !activeProjectIds.has(id)) return true;
  return false;
}

/**
 * Signed effect of a movement on net_balance (positive = ECOVIS debe a REVRAM).
 * Mirrors calculateEcovisAccountSummary — do not change independently.
 */
function classifyEcovisStatementEffect(movement, options = {}) {
  const amount = roundMoney(Number(movement.amount_mxn || movement.amount || 0));
  const isCancelled = Boolean(Number(movement.is_cancelled));
  const type = movement.movement_type;
  const currency = movement.currency || 'MXN';
  const originalAmount = Number(movement.amount || 0);
  const label = STATEMENT_TYPE_LABELS[type] || type;
  const projectById = options.projectById || {};
  const concept = resolveStatementConcept(movement, projectById);

  const base = {
    movement_type: type,
    concept,
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
    omit: false,
  };

  if (isCancelled || isInactiveProjectMovement(movement, options)) {
    return { ...base, informational: true, omit: true };
  }

  switch (type) {
    case 'proyecto':
      return { ...base, charge: amount, delta: amount, affects_balance: true };
    case 'aplicacion_a_proyecto': {
      // Only project allocations reduce pending in the summary formula (not OC).
      if (movement.related_project_id == null) {
        return {
          ...base,
          credit: amount,
          informational: true,
          concept: 'Aplicacion a orden de compra',
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
      return { ...base, credit: amount, informational: true, omit: true };
    case 'pago_recibido':
      return { ...base, credit: amount, informational: true };
    case 'saldo_a_favor':
      return { ...base, credit: amount, informational: true };
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
 * Movements linked to cancelled/missing projects are omitted from the listing
 * and do not affect the running balance (aligned with summary pending formula).
 */
function buildEcovisStatementLedger(movements, options = {}) {
  const cancelledProjectIds = options.cancelledProjectIds instanceof Set
    ? options.cancelledProjectIds
    : new Set((options.cancelledProjectIds || []).map(Number));
  const activeProjectIds = options.activeProjectIds instanceof Set
    ? options.activeProjectIds
    : (options.activeProjectIds
      ? new Set([...options.activeProjectIds].map(Number))
      : null);
  const projectById = options.projectById || {};
  const from = options.from || null;
  const to = options.to || null;
  const classifyOpts = { cancelledProjectIds, activeProjectIds, projectById };

  const sorted = [...movements].sort(compareStatementChronology);
  let running = 0;
  let openingBalance = 0;
  const rows = [];

  for (const movement of sorted) {
    const effect = classifyEcovisStatementEffect(movement, classifyOpts);
    const date = String(movement.movement_date || '');

    if (effect.omit) {
      continue;
    }

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

function isEcovisTruthy(value) {
  return value === true || value === 1 || value === '1';
}

function movementAmountMxn(movement) {
  return roundMoney(Number(movement.amount_mxn ?? movement.amount ?? 0));
}

function projectTotalMxn(project) {
  return roundMoney(Number(project.amount_mxn ?? project.total_amount ?? 0));
}

function compareMovementsOldestFirst(a, b) {
  const dateA = String(a.created_at || a.movement_date || '');
  const dateB = String(b.created_at || b.movement_date || '');
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return Number(a.id) - Number(b.id);
}

function summarizeCargoMovement(movement) {
  return {
    id: Number(movement.id),
    movement_type: movement.movement_type,
    movement_date: movement.movement_date,
    created_at: movement.created_at || null,
    amount: Number(movement.amount || 0),
    amount_mxn: movementAmountMxn(movement),
    currency: movement.currency || 'MXN',
    direction: movement.direction,
    description: movement.description || '',
    related_project_id: movement.related_project_id == null ? null : Number(movement.related_project_id),
  };
}

/**
 * Read-only integrity diagnostic for ECOVIS cargos / orphans / balance drift.
 * Does not mutate data. Phase-1 cleanup candidates are proposed only.
 */
function generateEcovisIntegrityDiagnostic(projects, movements) {
  const projectById = new Map(projects.map((p) => [Number(p.id), p]));
  const activeProjects = projects.filter((p) => !isEcovisTruthy(p.is_cancelled) && p.status !== 'cancelado');
  const cancelledProjects = projects.filter((p) => isEcovisTruthy(p.is_cancelled) || p.status === 'cancelado');
  const cancelledProjectIds = new Set(cancelledProjects.map((p) => Number(p.id)));

  const activeCargoMovements = movements.filter(
    (m) => !isEcovisTruthy(m.is_cancelled) && m.direction === 'ecovis_debe_a_revram',
  );

  const activeProyectoCargos = activeCargoMovements.filter((m) => m.movement_type === 'proyecto');

  const duplicateProjectReports = [];
  for (const project of activeProjects) {
    const projectId = Number(project.id);
    const cargos = activeProyectoCargos
      .filter((m) => Number(m.related_project_id) === projectId)
      .slice()
      .sort(compareMovementsOldestFirst);

    if (cargos.length <= 1) {
      if (cargos.length === 1) {
        const only = cargos[0];
        const matches = !amountsDiffer(movementAmountMxn(only), projectTotalMxn(project));
        duplicateProjectReports.push({
          project_id: projectId,
          project_name: project.project_name || '',
          project_status: project.status || null,
          project_amount_mxn: projectTotalMxn(project),
          active_cargo_count: 1,
          keep_movement_id: Number(only.id),
          cancel_movement_ids: [],
          needs_manual_review: !matches,
          review_reason: matches ? null : 'El unico cargo activo no coincide con el monto del proyecto.',
          keep_movement: summarizeCargoMovement(only),
          cancel_movements: [],
        });
      }
      continue;
    }

    const matching = cargos.filter((m) => !amountsDiffer(movementAmountMxn(m), projectTotalMxn(project)));
    const keep = matching.length > 0 ? matching[0] : cargos[0];
    const cancelList = cargos.filter((m) => Number(m.id) !== Number(keep.id));
    const needsManualReview = matching.length === 0;

    duplicateProjectReports.push({
      project_id: projectId,
      project_name: project.project_name || '',
      project_status: project.status || null,
      project_amount_mxn: projectTotalMxn(project),
      active_cargo_count: cargos.length,
      keep_movement_id: Number(keep.id),
      cancel_movement_ids: cancelList.map((m) => Number(m.id)),
      needs_manual_review: needsManualReview,
      review_reason: needsManualReview
        ? 'Ningun cargo activo coincide con el monto del proyecto; se conserva el mas antiguo.'
        : null,
      keep_movement: summarizeCargoMovement(keep),
      cancel_movements: cancelList.map(summarizeCargoMovement),
    });
  }

  const projectsWithDuplicates = duplicateProjectReports.filter((r) => r.active_cargo_count > 1);
  const projectsNeedingReview = duplicateProjectReports.filter((r) => r.needs_manual_review);

  const orphanCargos = activeCargoMovements
    .filter((m) => m.related_project_id != null && cancelledProjectIds.has(Number(m.related_project_id)))
    .slice()
    .sort(compareMovementsOldestFirst)
    .map((m) => {
      const project = projectById.get(Number(m.related_project_id));
      return {
        ...summarizeCargoMovement(m),
        project_name: project?.project_name || '',
        project_status: project?.status || 'cancelado',
        project_cancelled_at: project?.cancelled_at || null,
        proposed_cancellation_reason: 'Limpieza 2026-08: proyecto cancelado',
      };
    });

  const projectsWithBalance = activeProjects
    .map((p) => {
      const total = projectTotalMxn(p);
      const paid = roundMoney(Number(p.paid_amount_mxn ?? 0));
      const pending = roundMoney(Number(p.pending_amount_mxn ?? Math.max(0, total - paid)));
      return {
        project_id: Number(p.id),
        project_name: p.project_name || '',
        status: p.status || null,
        total_amount_mxn: total,
        paid_amount_mxn: paid,
        pending_amount_mxn: pending,
      };
    })
    .filter((p) => p.pending_amount_mxn > 0.005)
    .sort((a, b) => a.project_id - b.project_id);

  const balanceFromProjects = roundMoney(
    projectsWithBalance.reduce((sum, p) => sum + p.pending_amount_mxn, 0),
  );

  // Naive movement-based saldo: active cargos (does not decrease on payments with direction=neutral).
  const balanceFromMovements = roundMoney(
    activeCargoMovements.reduce((sum, m) => sum + movementAmountMxn(m), 0),
  );

  const activeProyectoCargoSum = roundMoney(
    activeProyectoCargos.reduce((sum, m) => sum + movementAmountMxn(m), 0),
  );
  const activeProjectsTotalMxn = roundMoney(
    activeProjects.reduce((sum, p) => sum + projectTotalMxn(p), 0),
  );

  const neutralPayments = movements.filter(
    (m) => !isEcovisTruthy(m.is_cancelled)
      && m.movement_type === 'pago_recibido'
      && m.direction === 'neutral',
  );

  const proposedDuplicateCancelIds = projectsWithDuplicates.flatMap((r) => r.cancel_movement_ids);
  const proposedOrphanCancelIds = orphanCargos.map((m) => m.id);

  return {
    generated_at: new Date().toISOString(),
    read_only: true,
    notes: [
      'Diagnostico de solo lectura. No modifica datos.',
      'Cargos = movimientos activos con direction=ecovis_debe_a_revram.',
      'Duplicados se evaluan sobre movement_type=proyecto ligados a proyectos no cancelados.',
      'Conservar: el cargo mas antiguo cuyo amount_mxn coincide con el total del proyecto; si ninguno coincide, el mas antiguo (needs_manual_review).',
      'Saldo por proyectos = suma de pending_amount_mxn de proyectos no cancelados con pendiente > 0.',
      'Saldo por movimientos = suma de amount_mxn de cargos activos (los pago_recibido con direction=neutral no restan).',
    ],
    duplicates: {
      projects_analyzed: activeProjects.length,
      projects_with_duplicate_cargos: projectsWithDuplicates.length,
      projects_needing_manual_review: projectsNeedingReview.length,
      proposed_cancel_count: proposedDuplicateCancelIds.length,
      proposed_cancellation_reason: 'Limpieza 2026-08: cargo duplicado',
      proposed_cancel_movement_ids: proposedDuplicateCancelIds,
      by_project: duplicateProjectReports.filter((r) => r.active_cargo_count > 1 || r.needs_manual_review),
    },
    orphans: {
      count: orphanCargos.length,
      total_amount_mxn: roundMoney(orphanCargos.reduce((sum, m) => sum + m.amount_mxn, 0)),
      proposed_cancellation_reason: 'Limpieza 2026-08: proyecto cancelado',
      proposed_cancel_movement_ids: proposedOrphanCancelIds,
      movements: orphanCargos,
    },
    comparative: {
      balance_from_projects_pending_mxn: balanceFromProjects,
      balance_from_movements_cargo_mxn: balanceFromMovements,
      difference_mxn: roundMoney(balanceFromMovements - balanceFromProjects),
      active_projects_total_mxn: activeProjectsTotalMxn,
      active_proyecto_cargos_sum_mxn: activeProyectoCargoSum,
      active_proyecto_cargos_vs_projects_difference_mxn: roundMoney(activeProyectoCargoSum - activeProjectsTotalMxn),
      projects_with_balance_count: projectsWithBalance.length,
      projects_with_balance: projectsWithBalance,
      neutral_pago_recibido_count: neutralPayments.length,
      neutral_pago_recibido_amount_mxn: roundMoney(
        neutralPayments.reduce((sum, m) => sum + movementAmountMxn(m), 0),
      ),
    },
    proposed_cleanup_summary: {
      duplicate_movements_to_cancel: proposedDuplicateCancelIds.length,
      orphan_movements_to_cancel: proposedOrphanCancelIds.length,
      total_movements_to_cancel: proposedDuplicateCancelIds.length + proposedOrphanCancelIds.length,
      all_proposed_cancel_movement_ids: [...new Set([...proposedDuplicateCancelIds, ...proposedOrphanCancelIds])].sort(
        (a, b) => a - b,
      ),
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
  resolveStatementConcept,
  describeEcovisNetBalance,
  buildEcovisAccountHeader,
  generateEcovisIntegrityDiagnostic,
  STATEMENT_TYPE_LABELS,
};
