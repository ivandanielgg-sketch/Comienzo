#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const BASE = process.env.APP_URL || 'http://127.0.0.1:3000';
const ARTIFACTS = '/opt/cursor/artifacts';
fs.mkdirSync(ARTIFACTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`); };
const fail = (name, detail = '') => { results.push({ name, ok: false, detail }); console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`); };
const step = (label) => { console.log(`STEP: ${label} @ ${new Date().toISOString()}`); };

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);

// Native alert/confirm blocks CDP evaluate until dismissed. Capture and dismiss so
// failures surface as assertion errors instead of ProtocolError timeouts.
const dialogs = [];
page.on('dialog', async (dialog) => {
  const entry = { type: dialog.type(), message: dialog.message() };
  dialogs.push(entry);
  console.error(`DIALOG: ${entry.type} — ${entry.message}`);
  try {
    await dialog.accept();
  } catch {
    /* already handled */
  }
});

try {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.type('input[name="username"]', 'admin');
  await page.type('input[name="password"]', 'admin123');
  await page.click('#login-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#login-view')?.classList.contains('hidden'));

  const sessionMeta = await page.evaluate(async () => {
    const res = await fetch('/api/session');
    return res.json();
  });
  if (sessionMeta.authenticated && sessionMeta.expires_at && sessionMeta.expires_in_ms > 0) {
    pass('session-has-expiry-metadata', `expires_in_ms=${sessionMeta.expires_in_ms}`);
  } else {
    fail('session-has-expiry-metadata', JSON.stringify(sessionMeta));
  }

  // Force warning window for UI check
  await page.evaluate(() => {
    state.sessionExpiresAtMs = Date.now() + 5000;
  });
  await sleep(1500);
  const warningVisible = await page.evaluate(() => {
    const modal = document.getElementById('session-expiry-modal');
    return modal && !modal.classList.contains('hidden') && state.sessionWarningVisible === true;
  });
  if (warningVisible) pass('warning-modal-single-instance');
  else fail('warning-modal-single-instance');
  await page.screenshot({ path: path.join(ARTIFACTS, 'session-warning-modal.png'), fullPage: true });

  const onlyOneModal = await page.evaluate(() => document.querySelectorAll('#session-expiry-modal').length === 1);
  if (onlyOneModal) pass('no-duplicate-warning-modals');
  else fail('no-duplicate-warning-modals');

  await page.click('#session-expiry-extend');
  await sleep(800);
  const afterExtend = await page.evaluate(async () => {
    const res = await fetch('/api/session');
    const data = await res.json();
    const modal = document.getElementById('session-expiry-modal');
    return {
      authenticated: data.authenticated,
      expires_in_ms: data.expires_in_ms,
      warningHidden: modal.classList.contains('hidden'),
      warningFlag: state.sessionWarningVisible,
    };
  });
  if (afterExtend.authenticated && afterExtend.expires_in_ms > 30000 && afterExtend.warningHidden && !afterExtend.warningFlag) {
    pass('extend-renews-and-closes-modal', JSON.stringify(afterExtend));
  } else {
    fail('extend-renews-and-closes-modal', JSON.stringify(afterExtend));
  }

  // Draft isolation + restore flow — pick a project with enough pending balance so the
  // save step is not rejected by PAYMENT_OVERPAY (which opens a blocking native alert).
  await page.waitForSelector('#projects-table tr[data-row-id]', { timeout: 10000 });
  step('select-project-with-pending');
  const target = await page.evaluate(async () => {
    const res = await fetch('/api/projects?limit=50');
    const data = await res.json();
    const rows = data.data || [];
    const row = rows.find((p) => Number(p.pending_collection) >= 50 && !p.closed_at);
    if (!row) return null;
    return { id: Number(row.id), pending: Number(row.pending_collection) };
  });
  if (!target?.id) throw new Error('No open project with pending_collection >= 50');
  const projectId = target.id;
  // Keep draft amount well under pending so overpay protection cannot fire.
  const draftAmount = Math.min(100, Math.max(1, Math.floor(target.pending / 2)));
  console.log(`TARGET: projectId=${projectId} pending=${target.pending} draftAmount=${draftAmount}`);

  await page.evaluate(() => {
    const toggle = document.querySelector('#projects-workspace-mode-toggle');
    if (toggle && toggle.checked) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof ProjectWorkspace !== 'undefined' && typeof ProjectWorkspace.setWorkspaceMode === 'function') {
      ProjectWorkspace.setWorkspaceMode(false);
    }
    if (typeof applyProjectsUiModeFromToggle === 'function') {
      applyProjectsUiModeFromToggle();
    }
  });
  await page.evaluate((id) => selectProject(id), projectId);
  await page.waitForFunction(() => {
    const drawer = document.querySelector('#project-detail-drawer');
    const workspace = document.querySelector('#project-workspace');
    return (drawer && !drawer.classList.contains('hidden'))
      || (workspace && !workspace.classList.contains('hidden'));
  }, { timeout: 10000 });
  await page.evaluate((amount) => {
    const pagosTab = document.querySelector('.workspace-tab[data-ws-tab="payments"]');
    if (pagosTab && typeof setWorkspaceTab === 'function') setWorkspaceTab('payments');
    else if (pagosTab) pagosTab.click();
    const form = document.querySelector('#payment-form');
    form.elements.amount.setCurrencyValue(amount);
    form.elements.notes.value = 'DRAFT-SESSION';
    form.elements.payment_date.value = '2026-01-20';
    snapshotActiveProjectDrafts();
  }, draftAmount);

  const stored = await page.evaluate((userId, projectId) => {
    return SessionDrafts.readDraft(sessionStorage, userId, projectId, 'payment_new');
  }, sessionMeta.user.id, projectId);
  if (stored?.payload?.notes === 'DRAFT-SESSION' && Number(stored.payload.amount) === draftAmount) {
    pass('draft-saved-to-sessionStorage', JSON.stringify(stored.payload));
  } else {
    fail('draft-saved-to-sessionStorage', JSON.stringify({ stored, draftAmount }));
  }

  // Simulate expiry handling without waiting full TTL
  await page.evaluate(() => handleAuthenticatedSessionLoss('expired'));
  await sleep(300);
  const onLogin = await page.evaluate(() => !document.querySelector('#login-view').classList.contains('hidden'));
  if (onLogin) pass('expiry-redirects-to-login');
  else fail('expiry-redirects-to-login');

  // Re-login same tab should offer restore
  await page.type('input[name="username"]', 'admin');
  await page.type('input[name="password"]', 'admin123');
  await page.click('#login-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#login-view')?.classList.contains('hidden'));
  await sleep(800);
  const restoreVisible = await page.evaluate(() => {
    const modal = document.getElementById('session-draft-restore-modal');
    return modal && !modal.classList.contains('hidden');
  });
  if (restoreVisible) pass('restore-modal-after-relogin');
  else fail('restore-modal-after-relogin');
  await page.screenshot({ path: path.join(ARTIFACTS, 'session-draft-restore-modal.png'), fullPage: true });

  await page.click('#session-draft-restore');
  await sleep(1000);
  await page.evaluate(() => {
    const pagosTab = document.querySelector('.workspace-tab[data-ws-tab="payments"]');
    if (pagosTab && typeof setWorkspaceTab === 'function') setWorkspaceTab('payments');
    else if (pagosTab) pagosTab.click();
  });
  const restored = await page.evaluate(() => {
    const form = document.querySelector('#payment-form');
    return {
      amount: form.elements.amount.getCurrencyValue(),
      notes: form.elements.notes.value,
      paymentDate: form.elements.payment_date.value,
    };
  });
  if (Number(restored.amount) === draftAmount && restored.notes === 'DRAFT-SESSION') {
    pass('draft-restored-into-form', JSON.stringify(restored));
  } else {
    fail('draft-restored-into-form', JSON.stringify({ restored, draftAmount }));
  }

  // Saving payment clears draft and does not auto-create extras beyond submit
  step('beforeCount-fetch');
  const beforeCount = await page.evaluate(async (id) => {
    const res = await fetch('/api/projects/' + id);
    const data = await res.json();
    return (data.payments || []).length;
  }, projectId);
  step('set-payment-date');
  await page.evaluate(() => {
    document.querySelector('#payment-form').elements.payment_date.value = new Date().toISOString().slice(0, 10);
  });
  const dialogCountBeforeSave = dialogs.length;
  step('click-payment-submit');
  await page.click('#payment-form button[type="submit"]');
  step('wait-save-cleared');
  // Wait for product success signals instead of a fixed sleep (avoids racing applyProjectListUpdate).
  await page.waitForFunction((userId, projectId) => {
    const form = document.querySelector('#payment-form');
    if (!form?.elements?.amount?.getCurrencyValue) return false;
    const draft = SessionDrafts.readDraft(sessionStorage, userId, projectId, 'payment_new');
    const amount = form.elements.amount.getCurrencyValue();
    return !draft && Math.abs(Number(amount) || 0) < 0.000001;
  }, { timeout: 15000 }, sessionMeta.user.id, projectId);
  if (dialogs.length > dialogCountBeforeSave) {
    fail('save-clears-draft-and-one-payment-only', `unexpected dialog during save: ${JSON.stringify(dialogs.slice(dialogCountBeforeSave))}`);
  } else {
    step('afterSave-evaluate');
    const afterSave = await page.evaluate((userId, projectId) => {
      return {
        draft: SessionDrafts.readDraft(sessionStorage, userId, projectId, 'payment_new'),
        amount: document.querySelector('#payment-form').elements.amount.getCurrencyValue(),
      };
    }, sessionMeta.user.id, projectId);
    step('afterCount-fetch');
    const afterCount = await page.evaluate(async (id) => {
      const res = await fetch('/api/projects/' + id);
      const data = await res.json();
      return (data.payments || []).length;
    }, projectId);
    if (!afterSave.draft && Math.abs(Number(afterSave.amount) || 0) < 0.000001 && afterCount === beforeCount + 1) {
      pass('save-clears-draft-and-one-payment-only', JSON.stringify({ beforeCount, afterCount, draftAmount, projectId }));
    } else {
      fail('save-clears-draft-and-one-payment-only', JSON.stringify({ afterSave, beforeCount, afterCount, draftAmount, projectId, dialogs }));
    }
  }

  // Multiple 401s collapse to one handled expiry
  step('logout-fetch');
  await page.evaluate(async () => {
    await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  });
  step('multi401-evaluate');
  const multi401 = await page.evaluate(async () => {
    state.sessionExpiredHandled = false;
    state.sessionAuthBlocked = false;
    const original = window.showLogin;
    let showLoginCount = 0;
    window.showLogin = function (...args) {
      showLoginCount += 1;
      return original.apply(this, args);
    };
    const settled = await Promise.allSettled([
      api('/api/projects'),
      api('/api/projects'),
      api('/api/projects'),
    ]);
    window.showLogin = original;
    return {
      showLoginCount,
      handled: state.sessionExpiredHandled,
      rejected: settled.filter((item) => item.status === 'rejected').length,
    };
  });
  if (multi401.handled && multi401.showLoginCount === 1 && multi401.rejected === 3) {
    pass('multiple-401-single-handler', JSON.stringify(multi401));
  } else {
    fail('multiple-401-single-handler', JSON.stringify(multi401));
  }
  step('done');
} catch (error) {
  const dialogHint = dialogs.length ? ` | dialogs=${JSON.stringify(dialogs)}` : '';
  fail('script-error', `${error.stack || error.message}${dialogHint}`);
  try { await page.screenshot({ path: path.join(ARTIFACTS, 'session-stage2-error.png'), fullPage: true }); } catch {}
} finally {
  await browser.close();
}

const out = path.join(ARTIFACTS, 'session-stage2-verification.json');
fs.writeFileSync(out, JSON.stringify({ results, failed: results.filter((r) => !r.ok).length, dialogs }, null, 2));
console.log(`Wrote ${out}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
