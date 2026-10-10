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

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
page.setDefaultTimeout(20000);

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

  // Draft isolation + restore flow
  await page.waitForSelector('#projects-table tr[data-row-id]', { timeout: 10000 });
  const projectId = await page.evaluate(() => {
    const row = document.querySelector('#projects-table tr[data-row-id]');
    return row ? Number(row.getAttribute('data-row-id')) : null;
  });
  if (!projectId) throw new Error('No project rows');

  await page.evaluate((id) => selectProject(id), projectId);
  await page.waitForSelector('#project-detail-drawer:not(.hidden)');
  await page.evaluate(() => {
    const form = document.querySelector('#payment-form');
    form.elements.amount.setCurrencyValue(15000);
    form.elements.notes.value = 'DRAFT-SESSION';
    form.elements.payment_date.value = '2026-01-20';
    snapshotActiveProjectDrafts();
  });

  const stored = await page.evaluate((userId, projectId) => {
    return SessionDrafts.readDraft(sessionStorage, userId, projectId, 'payment_new');
  }, sessionMeta.user.id, projectId);
  if (stored?.payload?.notes === 'DRAFT-SESSION' && Number(stored.payload.amount) === 15000) {
    pass('draft-saved-to-sessionStorage', JSON.stringify(stored.payload));
  } else {
    fail('draft-saved-to-sessionStorage', JSON.stringify(stored));
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
  const restored = await page.evaluate(() => {
    const form = document.querySelector('#payment-form');
    return {
      amount: form.elements.amount.getCurrencyValue(),
      notes: form.elements.notes.value,
      paymentDate: form.elements.payment_date.value,
    };
  });
  if (Number(restored.amount) === 15000 && restored.notes === 'DRAFT-SESSION') {
    pass('draft-restored-into-form', JSON.stringify(restored));
  } else {
    fail('draft-restored-into-form', JSON.stringify(restored));
  }

  // Saving payment clears draft and does not auto-create extras beyond submit
  const beforeCount = await page.evaluate(async (id) => {
    const res = await fetch('/api/projects/' + id);
    const data = await res.json();
    return (data.payments || []).length;
  }, projectId);
  await page.evaluate(() => {
    document.querySelector('#payment-form').elements.payment_date.value = new Date().toISOString().slice(0, 10);
  });
  await page.click('#payment-form button[type="submit"]');
  await sleep(1000);
  const afterSave = await page.evaluate((userId, projectId) => {
    return {
      draft: SessionDrafts.readDraft(sessionStorage, userId, projectId, 'payment_new'),
      amount: document.querySelector('#payment-form').elements.amount.getCurrencyValue(),
    };
  }, sessionMeta.user.id, projectId);
  const afterCount = await page.evaluate(async (id) => {
    const res = await fetch('/api/projects/' + id);
    const data = await res.json();
    return (data.payments || []).length;
  }, projectId);
  if (!afterSave.draft && Math.abs(Number(afterSave.amount) || 0) < 0.000001 && afterCount === beforeCount + 1) {
    pass('save-clears-draft-and-one-payment-only', JSON.stringify({ beforeCount, afterCount }));
  } else {
    fail('save-clears-draft-and-one-payment-only', JSON.stringify({ afterSave, beforeCount, afterCount }));
  }

  // Multiple 401s collapse to one handled expiry
  await page.evaluate(async () => {
    await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  });
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
} catch (error) {
  fail('script-error', error.stack || error.message);
  try { await page.screenshot({ path: path.join(ARTIFACTS, 'session-stage2-error.png'), fullPage: true }); } catch {}
} finally {
  await browser.close();
}

const out = path.join(ARTIFACTS, 'session-stage2-verification.json');
fs.writeFileSync(out, JSON.stringify({ results, failed: results.filter((r) => !r.ok).length }, null, 2));
console.log(`Wrote ${out}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
