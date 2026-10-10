'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isPaymentDraftDirty,
  isCostDraftDirty,
  isUnsavedMovementDraftDirty,
  isProjectDetailLoadCurrent,
  nextProjectDetailLoadToken,
} = require('../src/projectFormIsolation');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const helperJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'project-form-isolation.js'), 'utf8');

test('payment draft is dirty when amount, notes or non-default date are present', () => {
  assert.equal(isPaymentDraftDirty({
    amount: 15000,
    notes: '',
    paymentDate: '2026-10-10',
    todayDate: '2026-10-10',
  }), true);
  assert.equal(isPaymentDraftDirty({
    amount: 0,
    notes: 'anticipo',
    paymentDate: '2026-10-10',
    todayDate: '2026-10-10',
  }), true);
  assert.equal(isPaymentDraftDirty({
    amount: 0,
    notes: '',
    paymentDate: '2026-09-01',
    todayDate: '2026-10-10',
  }), true);
  assert.equal(isPaymentDraftDirty({
    amount: 0,
    notes: '   ',
    paymentDate: '2026-10-10',
    todayDate: '2026-10-10',
  }), false);
});

test('cost draft is dirty when amount, description or non-default date are present', () => {
  assert.equal(isCostDraftDirty({
    amount: 500,
    description: '',
    costDate: '2026-10-10',
    todayDate: '2026-10-10',
  }), true);
  assert.equal(isCostDraftDirty({
    amount: 0,
    description: 'gasolina',
    costDate: '2026-10-10',
    todayDate: '2026-10-10',
  }), true);
  assert.equal(isCostDraftDirty({
    amount: 0,
    description: '',
    costDate: '2026-01-02',
    todayDate: '2026-10-10',
  }), true);
  assert.equal(isCostDraftDirty({
    amount: 0,
    description: '',
    costDate: '2026-10-10',
    todayDate: '2026-10-10',
  }), false);
});

test('unsaved movement helper combines payment and cost drafts', () => {
  assert.equal(isUnsavedMovementDraftDirty(
    { amount: 0, notes: '', paymentDate: '2026-10-10' },
    { amount: 0, description: '', costDate: '2026-10-10' },
    '2026-10-10',
  ), false);
  assert.equal(isUnsavedMovementDraftDirty(
    { amount: 15000, notes: '', paymentDate: '2026-10-10' },
    { amount: 0, description: '', costDate: '2026-10-10' },
    '2026-10-10',
  ), true);
});

test('detail load token rejects stale responses for another project', () => {
  const state = { projectDetailLoadToken: 2, selectedProjectId: 20 };
  assert.equal(isProjectDetailLoadCurrent(state, 2, 20), true);
  assert.equal(isProjectDetailLoadCurrent(state, 1, 20), false);
  assert.equal(isProjectDetailLoadCurrent(state, 2, 10), false);
  assert.equal(nextProjectDetailLoadToken(2), 3);
  assert.equal(nextProjectDetailLoadToken(undefined), 1);
});

test('app wires reset helpers, discard confirm and AbortController detail loads', () => {
  assert.match(indexHtml, /project-form-isolation\.js/);
  assert.match(helperJs, /isUnsavedMovementDraftDirty/);
  assert.match(appJs, /function resetPaymentForm\(/);
  assert.match(appJs, /function resetCostForm\(/);
  assert.match(appJs, /function resetMovementForms\(/);
  assert.match(appJs, /clearCurrencyValue/);
  assert.match(appJs, /function hasUnsavedMovementDrafts\(/);
  assert.match(appJs, /function confirmDiscardUnsavedMovementDrafts\(/);
  assert.match(appJs, /function beginProjectDetailLoad\(/);
  assert.match(appJs, /function isProjectDetailLoadCurrent\(/);
  assert.match(appJs, /new AbortController/);
  assert.match(appJs, /confirmDiscardUnsavedMovementDrafts\(\)/);
  assert.match(appJs, /resetMovementForms\(\)/);
  assert.match(appJs, /beginProjectDetailLoad\(nextProjectId\)/);
  assert.match(appJs, /renderDetail\(project, detailLoad\)/);
  assert.match(appJs, /async function renderDetailReports\(projectId, listElement, detailLoad/);
  assert.match(appJs, /signal \? \{ signal \} : \{\}/);
  assert.match(appJs, /if \(state\.selectedProjectId === projectId\) \{\s*resetPaymentForm\(\);/s);
  assert.match(appJs, /if \(state\.selectedProjectId === projectId\) \{\s*resetCostForm\(\);/s);
});

test('switching projects asks before discarding and keeps cancel path', () => {
  assert.match(
    appJs,
    /if \(isSwitchingProject\) \{\s*if \(!confirmDiscardUnsavedMovementDrafts\(\)\) \{\s*return;\s*\}/s,
  );
  assert.match(
    appJs,
    /Hay un pago o costo capturado que aún no se ha guardado/,
  );
});

test('payment and cost submit no longer rely on bare form.reset without clearing currency', () => {
  assert.doesNotMatch(
    appJs,
    /paymentForm\.addEventListener\('submit'[\s\S]*?paymentForm\.reset\(\);\s*setDefaultDates\(\);/s,
  );
  assert.doesNotMatch(
    appJs,
    /costForm\.addEventListener\('submit'[\s\S]*?costForm\.reset\(\);\s*setDefaultDates\(\);/s,
  );
  assert.match(appJs, /resetPaymentForm\(\)/);
  assert.match(appJs, /resetCostForm\(\)/);
});
