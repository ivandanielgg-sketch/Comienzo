'use strict';

/**
 * Regresión Etapa 4 — C1/M1/M2 (y anclas M3–M5).
 * Prueba estática del contrato en public/app.js / projectHistorial.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SETTLEMENT_PAYMENT_NOTES } = require('../src/projectInvoiceSettlement');
const { buildProjectHistorial } = require('../src/projectHistorial');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const historialJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'projectHistorial.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `missing function ${name}`);
  const openParen = source.indexOf('(', start);
  assert.ok(openParen >= 0, `missing params for ${name}`);
  let depth = 0;
  let i = openParen;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0 && ch === ')') break;
    }
  }
  assert.ok(depth === 0, `unbalanced params for ${name}`);
  i = source.indexOf('{', i);
  assert.ok(i >= 0, `missing body for ${name}`);
  depth = 0;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  assert.fail(`unclosed function ${name}`);
}

test('C1: applyProjectListUpdate skips fill/baseline when project form is dirty', () => {
  const body = extractFunction(appJs, 'applyProjectListUpdate');
  assert.match(body, /isProjectFormDirty\s*\(/);
  assert.match(body, /formDirty/);
  assert.match(body, /if\s*\(\s*!formDirty\s*\)\s*\{[\s\S]*fillProjectForm\([\s\S]*snapshotProjectFormBaseline\(/);
  // Must still refresh detail/lists when workspace or drawer is open.
  assert.match(body, /projectDrawerOpen\s*\|\|\s*state\.projectWorkspaceOpen/);
  assert.match(body, /renderDetail\(/);
  // Anti-pattern: unconditional fill + baseline rebase (pre-fix C1).
  assert.doesNotMatch(
    body,
    /if\s*\(\s*state\.selectedProjectId\s*===\s*id\s*\)\s*\{\s*fillProjectForm\([\s\S]*snapshotProjectFormBaseline\(\);\s*if\s*\(\s*state\.projectWorkspaceOpen/,
  );
});

test('C1+M2: loadProjects respects dirty form and refreshes workspace detail', () => {
  const body = extractFunction(appJs, 'loadProjects');
  assert.match(body, /isProjectFormDirty\s*\(/);
  assert.match(body, /if\s*\(\s*!isProjectFormDirty\(\)\s*\)\s*\{[\s\S]*fillProjectForm\([\s\S]*snapshotProjectFormBaseline\(/);
  assert.match(body, /projectDrawerOpen\s*\|\|\s*state\.projectWorkspaceOpen/);
  assert.match(body, /renderDetail\(/);
  // Pre-fix M2 only checked drawer.
  assert.doesNotMatch(
    body,
    /if\s*\(\s*state\.projectDrawerOpen\s*\)\s*\{\s*renderDetail\(current\);\s*\}/,
  );
});

test('C1: project save syncs form only when unchanged since submit', () => {
  assert.match(appJs, /submittedSnapshot/);
  assert.match(appJs, /unchangedSinceSubmit/);
  assert.match(
    appJs,
    /unchangedSinceSubmit[\s\S]{0,400}fillProjectForm\(savedProject\)[\s\S]{0,120}snapshotProjectFormBaseline\(\)/,
  );
});

test('M1: loadWorkspaceHistorial uses AbortController/token anti-stale', () => {
  assert.match(appJs, /function beginHistorialLoad/);
  assert.match(appJs, /function isHistorialLoadCurrent/);
  const body = extractFunction(appJs, 'loadWorkspaceHistorial');
  assert.match(body, /beginHistorialLoad\(/);
  assert.match(body, /isHistorialLoadCurrent\(/);
  assert.match(body, /signal:\s*load\.signal/);
  assert.match(body, /AbortError/);
});

test('M3: applyPermissionVisibility gates create/edit/close project controls', () => {
  const body = extractFunction(appJs, 'applyPermissionVisibility');
  assert.match(body, /canAccess\('projects',\s*'create'\)/);
  assert.match(body, /canAccess\('projects',\s*'edit'\)/);
  assert.match(body, /canAccess\('projects',\s*'close'\)/);
  assert.match(body, /projects-new-button/);
  assert.match(body, /workspace-new-from-ws/);
  assert.match(body, /payment-form button\[type="submit"\]/);
  const rowActions = extractFunction(appJs, 'projectRowActions');
  assert.match(rowActions, /projectsCanClose/);
});

test('M4: settlement payment label uses SETTLEMENT_PAYMENT_NOTES, not substring', () => {
  assert.match(historialJs, /SETTLEMENT_PAYMENT_NOTES/);
  assert.doesNotMatch(historialJs, /includes\('liquidaci'\)/);

  const db = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      return {
        get(id) {
          if (text.startsWith('SELECT id, quote_number FROM projects')) {
            return Number(id) === 7 ? { id: 7, quote_number: 'Q-7' } : null;
          }
          return null;
        },
        all(projectId) {
          if (text.startsWith('SELECT id FROM project_payments')) return [{ id: 1 }, { id: 2 }];
          if (text.startsWith('SELECT id FROM project_costs')) return [];
          if (text.includes('FROM audit_logs')) return [];
          if (text.includes('FROM project_payments')) {
            return [
              {
                id: 1,
                amount: 50,
                currency: 'MXN',
                amount_mxn: 50,
                exchange_rate_to_mxn: 1,
                payment_date: '2026-10-01',
                notes: SETTLEMENT_PAYMENT_NOTES,
                created_at: '2026-10-01T12:00:00.000Z',
                created_by_user_id: 1,
                created_by_name: 'admin',
              },
              {
                id: 2,
                amount: 10,
                currency: 'MXN',
                amount_mxn: 10,
                exchange_rate_to_mxn: 1,
                payment_date: '2026-10-02',
                notes: 'Nota con liquidacion en texto libre',
                created_at: '2026-10-02T12:00:00.000Z',
                created_by_user_id: 1,
                created_by_name: 'admin',
              },
            ].filter(() => Number(projectId) === 7);
          }
          if (text.includes('FROM project_costs')) return [];
          return [];
        },
      };
    },
  };

  const result = buildProjectHistorial(db, 7, { limit: 50, offset: 0 });
  const settlement = result.data.filter((e) => e.event_type === 'settlement_payment_created');
  const regular = result.data.filter((e) => e.event_type === 'payment_registered');
  assert.equal(settlement.length, 1);
  assert.equal(settlement[0].summary.notes, SETTLEMENT_PAYMENT_NOTES);
  assert.equal(regular.length, 1);
  assert.match(String(regular[0].summary.notes), /liquidacion/i);
});

test('M5: legacy selectProject confirms dirty project form', () => {
  const body = extractFunction(appJs, 'selectProject');
  assert.match(body, /isProjectFormDirty\s*\(/);
  assert.match(body, /confirmLeaveProjectWorkspace/);
  // Legacy path must not rely only on movement-draft confirm.
  assert.match(
    body,
    /isProjectFormDirty\(\)[\s\S]{0,200}confirmLeaveProjectWorkspace[\s\S]{0,200}confirmDiscardUnsavedMovementDrafts/,
  );
});
