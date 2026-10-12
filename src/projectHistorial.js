'use strict';

const { sanitizeForLog } = require('./audit');
const { SETTLEMENT_PAYMENT_NOTES } = require('./projectInvoiceSettlement');

const SAFE_SUMMARY_KEYS = [
  'status',
  'invoice_payment_status',
  'invoice_paid_at',
  'progress_percent',
  'total_invoiced',
  'total_invoiced_currency',
  'client_name',
  'quote_number',
  'order_number',
  'risk',
  'amount',
  'currency',
  'amount_mxn',
  'exchange_rate_to_mxn',
  'payment_date',
  'cost_date',
  'category',
  'description',
  'notes',
  'settlement_action',
  'idempotent',
  'payment_id',
  'previous_pending_mxn',
];

function parseJson(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

function pickSafeSummary(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const sanitized = sanitizeForLog(obj);
  const out = {};
  for (const key of SAFE_SUMMARY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key) && sanitized[key] !== undefined) {
      out[key] = sanitized[key];
    }
  }
  return Object.keys(out).length ? out : null;
}

function changedKeys(before, after) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed.filter((key) => !String(key).toLowerCase().includes('password')
    && !String(key).toLowerCase().includes('token')
    && !String(key).toLowerCase().includes('secret'));
}

function pushEvent(events, event) {
  if (!event || !event.event_type || !event.recorded_at) return;
  events.push(event);
}

function buildProjectHistorial(db, projectId, { limit = 50, offset = 0 } = {}) {
  const id = Number(projectId);
  if (!Number.isFinite(id) || id < 1) {
    const err = new Error('Id de proyecto invalido.');
    err.status = 400;
    throw err;
  }

  const project = db.prepare('SELECT id, quote_number FROM projects WHERE id = ?').get(id);
  if (!project) {
    const err = new Error('Proyecto no encontrado.');
    err.status = 404;
    throw err;
  }

  const events = [];
  const paymentIds = new Set(
    db.prepare('SELECT id FROM project_payments WHERE project_id = ?').all(id).map((row) => Number(row.id)),
  );
  const costIds = new Set(
    db.prepare('SELECT id FROM project_costs WHERE project_id = ?').all(id).map((row) => Number(row.id)),
  );

  const auditRows = db.prepare(`
    SELECT id, user_id, user_name, action, module, entity_type, entity_id, entity_label,
           timestamp_utc, before_json, after_json, metadata_json
    FROM audit_logs
    WHERE module IN ('projects', 'payments', 'costs', 'reports')
      AND (
        (entity_type = 'project' AND entity_id = ?)
        OR (entity_type = 'project_payment' AND entity_id IN (SELECT id FROM project_payments WHERE project_id = ?))
        OR (entity_type = 'project_cost' AND entity_id IN (SELECT id FROM project_costs WHERE project_id = ?))
        OR (metadata_json LIKE ?)
        OR (before_json LIKE ?)
        OR (after_json LIKE ?)
      )
    ORDER BY timestamp_utc DESC, id DESC
    LIMIT 500
  `).all(
    id,
    id,
    id,
    `%"project_id":${id}%`,
    `%"project_id":${id}%`,
    `%"project_id":${id}%`,
  );

  const seenAuditIds = new Set();
  const skipPaymentCreateIds = new Set();
  const skipCostCreateIds = new Set();

  for (const row of auditRows) {
    const metadata = parseJson(row.metadata_json) || {};
    const before = parseJson(row.before_json);
    const after = parseJson(row.after_json);
    const metaProjectId = metadata.project_id != null ? Number(metadata.project_id) : null;
    const beforeProjectId = before && before.project_id != null ? Number(before.project_id) : null;
    const afterProjectId = after && after.project_id != null ? Number(after.project_id) : null;
    const belongs = (
      (row.entity_type === 'project' && Number(row.entity_id) === id)
      || metaProjectId === id
      || beforeProjectId === id
      || afterProjectId === id
      || (row.entity_type === 'project_payment' && paymentIds.has(Number(row.entity_id)))
      || (row.entity_type === 'project_cost' && costIds.has(Number(row.entity_id)))
    );
    if (!belongs) continue;
    if (seenAuditIds.has(row.id)) continue;
    seenAuditIds.add(row.id);

    if (row.entity_type === 'project_payment' && row.action === 'create') {
      // Prefer domain payment row for active payments to avoid duplicate create events.
      if (paymentIds.has(Number(row.entity_id)) && !metadata.settlement) {
        skipPaymentCreateIds.add(Number(row.entity_id));
        continue;
      }
    }
    if (row.entity_type === 'project_cost' && row.action === 'create') {
      if (costIds.has(Number(row.entity_id))) {
        skipCostCreateIds.add(Number(row.entity_id));
        continue;
      }
    }

    let eventType = `audit_${row.action}`;
    let title = row.entity_label || row.action;
    if (row.entity_type === 'project' && row.action === 'create') {
      eventType = 'project_created';
      title = 'Proyecto creado';
    } else if (row.entity_type === 'project' && row.action === 'update') {
      eventType = 'project_updated';
      title = 'Proyecto modificado';
    } else if (row.entity_type === 'project' && row.action === 'settle_invoice') {
      eventType = 'invoice_settled';
      title = 'Factura liquidada (Pagada)';
    } else if (row.entity_type === 'project' && row.action === 'close') {
      eventType = 'project_closed';
      title = 'Proyecto cerrado';
    } else if (row.entity_type === 'project' && row.action === 'restore') {
      eventType = 'project_restored';
      title = 'Proyecto restaurado';
    } else if (row.entity_type === 'project_payment' && row.action === 'create') {
      eventType = metadata.settlement ? 'settlement_payment_created' : 'payment_registered';
      title = metadata.settlement ? 'Pago residual de liquidación' : 'Pago registrado';
    } else if (row.entity_type === 'project_payment' && row.action === 'delete') {
      eventType = 'payment_deleted';
      title = 'Pago eliminado';
    } else if (row.entity_type === 'project_cost' && row.action === 'create') {
      eventType = 'cost_registered';
      title = 'Costo registrado';
    } else if (row.entity_type === 'project_cost' && row.action === 'delete') {
      eventType = 'cost_deleted';
      title = 'Costo eliminado';
    } else if (row.module === 'reports') {
      eventType = `report_${row.action}`;
      title = row.entity_label || 'Reporte';
    }

    const diffKeys = changedKeys(before, after);
    pushEvent(events, {
      id: `audit-${row.id}`,
      event_type: eventType,
      title,
      movement_at: null,
      recorded_at: row.timestamp_utc,
      actor_user_id: row.user_id,
      actor_user_name: row.user_name,
      summary: {
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        changed_fields: diffKeys.slice(0, 20),
        before: pickSafeSummary(before),
        after: pickSafeSummary(after),
        metadata: pickSafeSummary(metadata),
      },
      source: 'audit_logs',
    });
  }

  const payments = db.prepare(`
    SELECT id, amount, currency, amount_mxn, exchange_rate_to_mxn, payment_date, notes,
           created_at, created_by_user_id, created_by_name
    FROM project_payments
    WHERE project_id = ?
    ORDER BY payment_date DESC, id DESC
  `).all(id);

  for (const payment of payments) {
    if (skipPaymentCreateIds.has(Number(payment.id))) {
      // Still emit domain event; audit create was skipped above for non-settlement.
    }
    // M4: prefer exact Etapa 3 settlement notes (not free-text "liquidaci" substring).
    const isSettlement = String(payment.notes || '') === SETTLEMENT_PAYMENT_NOTES;
    pushEvent(events, {
      id: `payment-${payment.id}`,
      event_type: isSettlement ? 'settlement_payment_created' : 'payment_registered',
      title: isSettlement ? 'Pago residual de liquidación' : 'Pago registrado',
      movement_at: payment.payment_date || null,
      recorded_at: payment.created_at,
      actor_user_id: payment.created_by_user_id,
      actor_user_name: payment.created_by_name,
      summary: pickSafeSummary({
        amount: payment.amount,
        currency: payment.currency,
        amount_mxn: payment.amount_mxn,
        exchange_rate_to_mxn: payment.exchange_rate_to_mxn,
        payment_date: payment.payment_date,
        notes: payment.notes,
      }),
      source: 'project_payments',
    });
  }

  const costs = db.prepare(`
    SELECT id, category, description, amount, currency, cost_date,
           created_at, created_by_user_id, created_by_name
    FROM project_costs
    WHERE project_id = ?
    ORDER BY cost_date DESC, id DESC
  `).all(id);

  for (const cost of costs) {
    pushEvent(events, {
      id: `cost-${cost.id}`,
      event_type: 'cost_registered',
      title: `Costo: ${cost.category}`,
      movement_at: cost.cost_date || null,
      recorded_at: cost.created_at,
      actor_user_id: cost.created_by_user_id,
      actor_user_name: cost.created_by_name,
      summary: pickSafeSummary({
        category: cost.category,
        description: cost.description,
        amount: cost.amount,
        currency: cost.currency,
        cost_date: cost.cost_date,
      }),
      source: 'project_costs',
    });
  }

  // Deduplicate settlement payment: if both settle_invoice audit and domain payment exist,
  // keep both (different event types). Deduplicate identical payment_registered from audit+domain:
  const deduped = [];
  const seenKeys = new Set();
  for (const event of events) {
    let key = `${event.event_type}|${event.source}|${event.id}`;
    if (event.source === 'project_payments') {
      key = `${event.event_type}|payment|${event.id}`;
    }
    if (event.source === 'project_costs') {
      key = `${event.event_type}|cost|${event.id}`;
    }
    if (event.source === 'audit_logs' && (event.event_type === 'payment_registered' || event.event_type === 'settlement_payment_created')) {
      // Drop audit create if domain payment event covers it.
      const paymentId = event.summary && event.summary.entity_id;
      if (paymentId && paymentIds.has(Number(paymentId))) {
        continue;
      }
    }
    if (event.source === 'audit_logs' && event.event_type === 'cost_registered') {
      const costId = event.summary && event.summary.entity_id;
      if (costId && costIds.has(Number(costId))) {
        continue;
      }
    }
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(event);
  }

  deduped.sort((a, b) => {
    const ta = String(a.recorded_at || '');
    const tb = String(b.recorded_at || '');
    if (ta === tb) return String(b.id).localeCompare(String(a.id));
    return ta < tb ? 1 : -1;
  });

  const total = deduped.length;
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const data = deduped.slice(safeOffset, safeOffset + safeLimit);

  return {
    project_id: id,
    total,
    limit: safeLimit,
    offset: safeOffset,
    data,
  };
}

module.exports = {
  buildProjectHistorial,
  pickSafeSummary,
  changedKeys,
};
