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

function isEcovisCancelledProject(project) {
  return Boolean(project && (project.is_cancelled === true || project.is_cancelled === 1 || project.is_cancelled === '1' || project.status === 'cancelado'));
}

/** Official per-project pending: prefer stored pending_amount_mxn, else amount − paid/allocs. */
function resolveProjectPendingMxn(project, allocations = []) {
  if (project == null) return 0;
  if (project.pending_amount_mxn != null && project.pending_amount_mxn !== '') {
    return roundMoney(Math.max(0, Number(project.pending_amount_mxn)));
  }
  const totalMxn = Number(project.amount_mxn || project.total_amount || 0);
  if (project.paid_amount_mxn != null && project.paid_amount_mxn !== '') {
    return roundMoney(Math.max(0, totalMxn - Number(project.paid_amount_mxn)));
  }
  const paidFromAllocs = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .filter((a) => Number(a.ecovis_project_id) === Number(project.id))
      .reduce((sum, a) => sum + Number(a.amount_mxn || a.amount || 0), 0),
  );
  return roundMoney(Math.max(0, totalMxn - paidFromAllocs));
}

/**
 * Official ECOVIS account summary.
 * pending_project_amount / ecovis_owes_revram = Σ pending_amount_mxn of non-cancelled projects.
 * Never sum movements by direction for the official balance.
 */
function calculateEcovisAccountSummary(projects, payments, allocations, movements) {
  const activeProjects = projects.filter((p) => !isEcovisCancelledProject(p));
  const activeNonPaid = activeProjects.filter((p) => {
    const pendingMxn = resolveProjectPendingMxn(p, allocations);
    const paidMxn = Number(p.paid_amount_mxn ?? 0);
    return pendingMxn > 0.01 || paidMxn === 0;
  });

  const totalProjected = roundMoney(
    activeProjects.reduce((sum, p) => sum + Number(p.amount_mxn || p.total_amount || 0), 0),
  );

  const activeProjectIds = new Set(activeProjects.map((p) => Number(p.id)));
  const totalPaidToProjects = roundMoney(
    allocations
      .filter((a) => a.allocation_type === 'proyecto' && !a.is_cancelled)
      .filter((a) => {
        if (a.ecovis_project_id == null) return true;
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

  // Source of truth: Σ pending_amount_mxn when stored on all active projects.
  // Fallback (legacy rows / unit fixtures without the column): totals − proyecto allocations.
  // Never sum movements by direction.
  const allHaveStoredPending = activeProjects.length > 0
    && activeProjects.every((p) => p.pending_amount_mxn != null && p.pending_amount_mxn !== '');
  const pendingProjectAmount = allHaveStoredPending
    ? roundMoney(activeProjects.reduce((sum, p) => sum + Math.max(0, Number(p.pending_amount_mxn)), 0))
    : roundMoney(Math.max(0, totalProjected - totalPaidToProjects));

  // Applied credit movements (historical direction=debe or new direction=revram_debe).
  const creditFromMovements = roundMoney(
    movements
      .filter((m) => m.movement_type === 'saldo_a_favor' && !m.is_cancelled)
      .filter((m) => m.direction === 'ecovis_debe_a_revram' || m.direction === 'revram_debe_a_ecovis')
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

  const revramDebt = roundMoney(totalLoans - totalRepayments);
  // Official "ECOVIS debe a REVRAM" = project pending only.
  const ecovisDebt = pendingProjectAmount;
  const netBalance = roundMoney(pendingProjectAmount + adjustments - revramDebt);

  const activeProjectsTotalMxn = roundMoney(
    activeNonPaid.reduce((sum, p) => sum + Number(p.amount_mxn || p.total_amount || 0), 0),
  );
  const activeProjectsPaidMxn = roundMoney(
    activeNonPaid.reduce((sum, p) => sum + Number(p.paid_amount_mxn || 0), 0),
  );
  const activeProjectsPendingMxn = pendingProjectAmount;

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
      .filter((m) => m.movement_type === 'saldo_a_favor' && !m.is_cancelled)
      .filter((m) => m.direction === 'ecovis_debe_a_revram' || m.direction === 'revram_debe_a_ecovis')
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
      if (movement.direction === 'ecovis_debe_a_revram' || movement.direction === 'revram_debe_a_ecovis') {
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
 * and do not affect the running balance.
 * Duplicate active proyecto cargos: only the first (oldest) per project affects balance;
 * extras stay as informational detail so the ledger is not inflated by historical dupes.
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
  const officialClosingBalance = options.officialClosingBalance;

  const sorted = [...movements].sort(compareStatementChronology);
  const proyectoBalanceIds = new Set();
  const seenProyectoProjects = new Set();
  for (const movement of sorted) {
    if (Number(movement.is_cancelled)) continue;
    if (movement.movement_type !== 'proyecto') continue;
    if (isInactiveProjectMovement(movement, classifyOpts)) continue;
    const pid = movement.related_project_id == null ? null : Number(movement.related_project_id);
    if (pid == null) continue;
    if (seenProyectoProjects.has(pid)) continue;
    seenProyectoProjects.add(pid);
    proyectoBalanceIds.add(Number(movement.id));
  }

  let running = 0;
  let openingBalance = 0;
  const rows = [];

  for (const movement of sorted) {
    let effect = classifyEcovisStatementEffect(movement, classifyOpts);
    const date = String(movement.movement_date || '');

    // Extra proyecto cargos (duplicates) are bitácora only — do not inflate running balance.
    if (
      effect.movement_type === 'proyecto'
      && effect.affects_balance
      && !proyectoBalanceIds.has(Number(movement.id))
    ) {
      effect = {
        ...effect,
        charge: 0,
        credit: 0,
        delta: 0,
        affects_balance: false,
        informational: true,
        concept: `${effect.concept} (cargo duplicado, sin efecto en saldo)`,
      };
    }

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

  let closingBalance = rows.length
    ? rows[rows.length - 1].running_balance
    : openingBalance;

  // When caller provides official closing (Σ pending_amount_mxn / summary), prefer it
  // for unfiltered statements so UI never depends on naive movement direction sums.
  if (officialClosingBalance != null && !from && !to) {
    closingBalance = roundMoney(Number(officialClosingBalance));
  }

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
  const pending = Number(summary.pending_project_amount || 0);
  const adjustments = Number(summary.adjustments || 0);
  const loans = Number(summary.outstanding_loans || 0);
  const net = roundMoney(pending + adjustments - loans);
  // Official label/amount "ECOVIS debe a REVRAM" = Σ pending_amount_mxn (not movement sums).
  const described = describeEcovisNetBalance(pending);
  return {
    ...described,
    net_balance: net,
    equation: {
      pending_projects: pending,
      adjustments,
      outstanding_loans: loans,
      net_balance: net,
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

/** Known creators of direction=ecovis_debe_a_revram (from src/server.js). Diagnostic only. */
const ECOVIS_DEBE_CODE_ORIGINS = {
  proyecto: {
    endpoint: 'POST /api/ecovis/projects',
    expected_role: 'cargo_inicial',
    modeling_issue: false,
    explanation:
      'Al crear un proyecto se inserta un movimiento tipo proyecto con direction=ecovis_debe_a_revram (cargo inicial). PUT de edicion no crea movimiento; si hay varios activos, son duplicados historicos o re-creaciones.',
  },
  aplicacion_a_proyecto: {
    endpoint: 'POST /api/ecovis/payments/:id/allocations',
    expected_role: 'abono_reduce_deuda',
    modeling_issue: true,
    explanation:
      'Historicos: direction=ecovis_debe_a_revram (espejos de asignacion; inflan sumas naive). Nuevos: direction=revram_debe_a_ecovis (reducen deuda). El ledger interpreta por tipo, no por direction. No se migran historicos.',
  },
  saldo_a_favor: {
    endpoint: 'POST /api/ecovis/apply-credit (allocation saldo_a_favor al crear credito usa neutral)',
    expected_role: 'aplicacion_credito',
    modeling_issue: true,
    explanation:
      'Historicos aplicados: direction=ecovis_debe_a_revram. Nuevos: revram_debe_a_ecovis. Credito disponible (allocation) sigue en neutral. No se migran historicos.',
  },
  cancelacion: {
    endpoint: 'POST /api/ecovis/projects/:id/cancel',
    expected_role: 'memo_cancelacion',
    modeling_issue: true,
    explanation:
      'Historicos: direction=ecovis_debe_a_revram (bug; el ledger los omite). Nuevos: direction=neutral (memo). No se migran historicos.',
  },
  ajuste: {
    endpoint: 'POST /api/ecovis/adjustments',
    expected_role: 'ajuste_manual',
    modeling_issue: false,
    explanation:
      'Ajustes manuales pueden elegir direction=ecovis_debe_a_revram a proposito (aumentan deuda).',
  },
};

function summarizeCargoMovement(movement, extras = {}) {
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
    related_payment_id: movement.related_payment_id == null ? null : Number(movement.related_payment_id),
    ...extras,
  };
}

function aggregateByMovementType(movementList) {
  const byType = new Map();
  for (const m of movementList) {
    const type = m.movement_type || '(sin_tipo)';
    const current = byType.get(type) || { movement_type: type, count: 0, amount_mxn: 0 };
    current.count += 1;
    current.amount_mxn = roundMoney(current.amount_mxn + movementAmountMxn(m));
    byType.set(type, current);
  }
  return [...byType.values()].sort((a, b) => b.amount_mxn - a.amount_mxn || a.movement_type.localeCompare(b.movement_type));
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
  const byTypeBreakdown = aggregateByMovementType(activeCargoMovements);
  const totalDebeMxn = roundMoney(
    activeCargoMovements.reduce((sum, m) => sum + movementAmountMxn(m), 0),
  );

  // Decide keep/cancel for proyecto duplicates on active projects.
  const proyectoKeepIds = new Set();
  const proyectoCancelDuplicateIds = new Set();
  const duplicateProjectReports = [];

  for (const project of activeProjects) {
    const projectId = Number(project.id);
    const cargos = activeProyectoCargos
      .filter((m) => Number(m.related_project_id) === projectId)
      .slice()
      .sort(compareMovementsOldestFirst);

    if (cargos.length === 0) continue;

    const matching = cargos.filter((m) => !amountsDiffer(movementAmountMxn(m), projectTotalMxn(project)));
    const keep = matching.length > 0 ? matching[0] : cargos[0];
    const cancelList = cargos.filter((m) => Number(m.id) !== Number(keep.id));
    const needsManualReview = matching.length === 0
      || (cargos.length === 1 && amountsDiffer(movementAmountMxn(keep), projectTotalMxn(project)));

    proyectoKeepIds.add(Number(keep.id));
    for (const m of cancelList) proyectoCancelDuplicateIds.add(Number(m.id));

    let reviewReason = null;
    if (cargos.length === 1 && needsManualReview) {
      reviewReason = 'El unico cargo activo tipo proyecto no coincide con el monto del proyecto.';
    } else if (cargos.length > 1 && matching.length === 0) {
      reviewReason = 'Ningun cargo activo tipo proyecto coincide con el monto del proyecto; se conserva el mas antiguo.';
    }

    duplicateProjectReports.push({
      project_id: projectId,
      project_name: project.project_name || '',
      project_status: project.status || null,
      project_amount_mxn: projectTotalMxn(project),
      active_cargo_count: cargos.length,
      keep_movement_id: Number(keep.id),
      cancel_movement_ids: cancelList.map((m) => Number(m.id)),
      needs_manual_review: needsManualReview,
      review_reason: reviewReason,
      keep_movement: summarizeCargoMovement(keep),
      cancel_movements: cancelList.map((m) => summarizeCargoMovement(m)),
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
        ...summarizeCargoMovement(m, {
          proposed_action: 'cancel_orphan',
          proposed_cancellation_reason: 'Limpieza 2026-08: proyecto cancelado',
        }),
        project_name: project?.project_name || '',
        project_status: project?.status || 'cancelado',
        project_cancelled_at: project?.cancelled_at || null,
      };
    });
  const orphanIds = new Set(orphanCargos.map((m) => m.id));

  function resolveProposedAction(movement) {
    const id = Number(movement.id);
    if (orphanIds.has(id)) {
      return {
        proposed_action: 'cancel_orphan',
        proposed_cancellation_reason: 'Limpieza 2026-08: proyecto cancelado',
      };
    }
    if (proyectoCancelDuplicateIds.has(id)) {
      return {
        proposed_action: 'cancel_duplicate',
        proposed_cancellation_reason: 'Limpieza 2026-08: cargo duplicado',
      };
    }
    if (movement.movement_type === 'proyecto' && proyectoKeepIds.has(id)) {
      return { proposed_action: 'keep', proposed_cancellation_reason: null };
    }
    return { proposed_action: 'none', proposed_cancellation_reason: null };
  }

  function annotateDebeMovement(movement) {
    const origin = ECOVIS_DEBE_CODE_ORIGINS[movement.movement_type] || {
      endpoint: '(desconocido)',
      expected_role: 'desconocido',
      modeling_issue: true,
      explanation: `Tipo ${movement.movement_type} con direction=ecovis_debe_a_revram sin origen documentado en el codigo actual.`,
    };
    const action = resolveProposedAction(movement);
    return summarizeCargoMovement(movement, {
      ...action,
      modeling_issue: Boolean(origin.modeling_issue),
      code_origin: origin.endpoint,
      expected_role: origin.expected_role,
    });
  }

  // Per active project: ALL debe movements of any type.
  const activeProjectsDebeDetail = activeProjects
    .map((project) => {
      const projectId = Number(project.id);
      const debeMovements = activeCargoMovements
        .filter((m) => Number(m.related_project_id) === projectId)
        .slice()
        .sort(compareMovementsOldestFirst)
        .map(annotateDebeMovement);
      if (debeMovements.length === 0) return null;

      const byType = aggregateByMovementType(
        activeCargoMovements.filter((m) => Number(m.related_project_id) === projectId),
      );
      const total = roundMoney(debeMovements.reduce((sum, m) => sum + m.amount_mxn, 0));
      const proposedCancelIds = debeMovements
        .filter((m) => m.proposed_action === 'cancel_duplicate' || m.proposed_action === 'cancel_orphan')
        .map((m) => m.id);

      return {
        project_id: projectId,
        project_name: project.project_name || '',
        project_status: project.status || null,
        project_amount_mxn: projectTotalMxn(project),
        paid_amount_mxn: roundMoney(Number(project.paid_amount_mxn ?? 0)),
        pending_amount_mxn: roundMoney(Number(project.pending_amount_mxn ?? 0)),
        active_debe_count: debeMovements.length,
        active_debe_amount_mxn: total,
        by_movement_type: byType,
        proposed_cancel_movement_ids: proposedCancelIds,
        movements: debeMovements,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.project_id - b.project_id);

  // Unlinked debe movements (no related_project_id) — e.g. OC applications, adjustments.
  const unlinkedDebe = activeCargoMovements
    .filter((m) => m.related_project_id == null)
    .slice()
    .sort(compareMovementsOldestFirst)
    .map(annotateDebeMovement);

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

  const balanceFromMovements = totalDebeMxn;

  const activeProyectoCargoSum = roundMoney(
    activeProyectoCargos.reduce((sum, m) => sum + movementAmountMxn(m), 0),
  );
  const activeProjectsTotalMxn = roundMoney(
    activeProjects.reduce((sum, p) => sum + projectTotalMxn(p), 0),
  );

  const nonProyectoDebe = activeCargoMovements.filter((m) => m.movement_type !== 'proyecto');
  const nonProyectoDebeSum = roundMoney(
    nonProyectoDebe.reduce((sum, m) => sum + movementAmountMxn(m), 0),
  );
  const orphanSum = roundMoney(orphanCargos.reduce((sum, m) => sum + m.amount_mxn, 0));
  const proyectoNonOrphanSum = roundMoney(
    activeProyectoCargos
      .filter((m) => !orphanIds.has(Number(m.id)))
      .reduce((sum, m) => sum + movementAmountMxn(m), 0),
  );

  const neutralPayments = movements.filter(
    (m) => !isEcovisTruthy(m.is_cancelled)
      && m.movement_type === 'pago_recibido'
      && m.direction === 'neutral',
  );

  const proposedDuplicateCancelIds = [...proyectoCancelDuplicateIds].sort((a, b) => a - b);
  const proposedOrphanCancelIds = orphanCargos.map((m) => m.id);

  const modelingIssueTypes = byTypeBreakdown
    .filter((row) => ECOVIS_DEBE_CODE_ORIGINS[row.movement_type]?.modeling_issue)
    .map((row) => ({
      ...row,
      ...ECOVIS_DEBE_CODE_ORIGINS[row.movement_type],
    }));

  return {
    generated_at: new Date().toISOString(),
    read_only: true,
    notes: [
      'Diagnostico de solo lectura. No modifica datos.',
      'Cargos/debe = movimientos activos con direction=ecovis_debe_a_revram (cualquier movement_type).',
      'Duplicados propuestos a cancelar: solo movement_type=proyecto extras en proyectos activos (conservar el mas antiguo que coincida con el monto; si ninguno, el mas antiguo + needs_manual_review).',
      'Huérfanos: cualquier debe activo ligado a proyecto cancelado.',
      'aplicacion_a_proyecto / cancelacion / saldo_a_favor con direction=debe son espejos o memos mal modelados: NO se proponen a cancelar en limpieza de duplicados (salvo huerfanos). Ver code_origins.',
      'Saldo por proyectos = suma de pending_amount_mxn de no cancelados con pendiente > 0.',
      'Saldo por movimientos (naive) = suma amount_mxn de TODOS los debe activos; inflado por aplicacion/cancelacion/saldo_a_favor.',
    ],
    code_origins: ECOVIS_DEBE_CODE_ORIGINS,
    debe_by_type: {
      total_count: activeCargoMovements.length,
      total_amount_mxn: totalDebeMxn,
      by_type: byTypeBreakdown.map((row) => ({
        ...row,
        pct_of_total: totalDebeMxn > 0 ? roundMoney((row.amount_mxn / totalDebeMxn) * 100) : 0,
        modeling_issue: Boolean(ECOVIS_DEBE_CODE_ORIGINS[row.movement_type]?.modeling_issue),
        code_origin: ECOVIS_DEBE_CODE_ORIGINS[row.movement_type]?.endpoint || '(desconocido)',
        explanation: ECOVIS_DEBE_CODE_ORIGINS[row.movement_type]?.explanation
          || `Tipo ${row.movement_type} sin origen documentado.`,
      })),
      unexplained_gap: {
        formula: 'total_debe − proyecto_no_huerfano − huerfanos',
        total_debe_mxn: totalDebeMxn,
        proyecto_non_orphan_mxn: proyectoNonOrphanSum,
        orphan_debe_mxn: orphanSum,
        remainder_mxn: roundMoney(totalDebeMxn - proyectoNonOrphanSum - orphanSum),
        remainder_equals_non_proyecto_debe_mxn: nonProyectoDebeSum,
        note:
          'El remanente (~7.56M en el respaldo analizado) son movimientos debe de tipos distintos de proyecto: tipicamente aplicacion_a_proyecto (espejos de pagos asignados), mas cancelacion y saldo_a_favor mal dirigidos.',
      },
      modeling_issue_types: modelingIssueTypes,
    },
    active_projects_debe: {
      projects_with_debe_movements: activeProjectsDebeDetail.length,
      projects: activeProjectsDebeDetail,
      unlinked_debe_movements: {
        count: unlinkedDebe.length,
        total_amount_mxn: roundMoney(unlinkedDebe.reduce((sum, m) => sum + m.amount_mxn, 0)),
        by_type: aggregateByMovementType(
          activeCargoMovements.filter((m) => m.related_project_id == null),
        ),
        movements: unlinkedDebe,
      },
    },
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
      total_amount_mxn: orphanSum,
      by_type: aggregateByMovementType(
        activeCargoMovements.filter(
          (m) => m.related_project_id != null && cancelledProjectIds.has(Number(m.related_project_id)),
        ),
      ),
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
      non_proyecto_debe_sum_mxn: nonProyectoDebeSum,
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
      note:
        'La limpieza propuesta NO cancela aplicacion_a_proyecto / cancelacion / saldo_a_favor en proyectos activos; esos requieren decision de modelado (Fase 2), no borrado de bitacora de asignaciones.',
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
  resolveProjectPendingMxn,
  STATEMENT_TYPE_LABELS,
};
