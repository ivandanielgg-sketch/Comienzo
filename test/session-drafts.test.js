'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const {
  sanitizeDraftPayload,
  saveDraft,
  readDraft,
  listDraftsForUser,
  clearDraftsForUser,
  clearForeignDrafts,
  isExpired,
  draftHasContent,
  DRAFT_TTL_MS,
} = require('../src/sessionDrafts');

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

test('sanitizeDraftPayload strips passwords and tokens', () => {
  const clean = sanitizeDraftPayload({
    client_name: 'ACME',
    password: 'secret',
    admin_password: 'x',
    notes: 'ok',
    session_token: 'abc',
  });
  assert.equal(clean.client_name, 'ACME');
  assert.equal(clean.notes, 'ok');
  assert.equal(clean.password, undefined);
  assert.equal(clean.admin_password, undefined);
  assert.equal(clean.session_token, undefined);
});

test('drafts are isolated by user and project and expire', () => {
  const storage = memoryStorage();
  const now = Date.now();
  saveDraft(storage, {
    userId: 1,
    projectId: 10,
    formType: 'payment_new',
    payload: { amount: 15000, notes: 'A' },
    nowMs: now,
  });
  saveDraft(storage, {
    userId: 2,
    projectId: 10,
    formType: 'payment_new',
    payload: { amount: 99, notes: 'B' },
    nowMs: now,
  });
  saveDraft(storage, {
    userId: 1,
    projectId: 11,
    formType: 'cost_new',
    payload: { amount: 5, description: 'gas' },
    nowMs: now,
  });

  const user1 = listDraftsForUser(storage, 1, now);
  assert.equal(user1.length, 2);
  assert.equal(readDraft(storage, 2, 10, 'payment_new', now).payload.notes, 'B');
  assert.equal(readDraft(storage, 1, 10, 'payment_new', now).payload.amount, 15000);

  assert.equal(isExpired({ savedAt: new Date(now - DRAFT_TTL_MS - 1000).toISOString() }, now), true);
  assert.equal(readDraft(storage, 1, 10, 'payment_new', now + DRAFT_TTL_MS + 5), null);
});

test('clearForeignDrafts and clearDraftsForUser protect shared tab storage', () => {
  const storage = memoryStorage();
  saveDraft(storage, { userId: 1, projectId: 1, formType: 'project_edit', payload: { client_name: 'A' } });
  saveDraft(storage, { userId: 2, projectId: 1, formType: 'project_edit', payload: { client_name: 'B' } });
  clearForeignDrafts(storage, 2);
  assert.equal(listDraftsForUser(storage, 1).length, 0);
  assert.equal(listDraftsForUser(storage, 2).length, 1);
  clearDraftsForUser(storage, 2);
  assert.equal(listDraftsForUser(storage, 2).length, 0);
});

test('draftHasContent ignores empty payloads', () => {
  assert.equal(draftHasContent({ notes: '  ' }), false);
  assert.equal(draftHasContent({ amount: 0 }), false);
  assert.equal(draftHasContent({ amount: 10 }), true);
  assert.equal(draftHasContent({ notes: 'x' }), true);
});

test('frontend wires session warning, extend endpoint usage and sessionStorage drafts', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(indexHtml, /session-expiry-modal/);
  assert.match(indexHtml, /session-draft-restore-modal/);
  assert.match(indexHtml, /session-drafts\.js/);
  assert.match(appJs, /\/api\/session\/extend/);
  assert.match(appJs, /showSessionExpiryModal/);
  assert.match(appJs, /sessionStorage/);
  assert.match(appJs, /handleAuthenticatedSessionLoss/);
  assert.match(appJs, /response\.status === 401/);
  assert.match(appJs, /state\.sessionWarningVisible/);
  assert.doesNotMatch(appJs, /localStorage\.setItem\(['"]cp:draft/);
});
