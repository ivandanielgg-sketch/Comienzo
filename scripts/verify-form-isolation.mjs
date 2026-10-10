#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const BASE = process.env.APP_URL || 'http://127.0.0.1:3000';
const ARTIFACTS = '/opt/cursor/artifacts';
fs.mkdirSync(ARTIFACTS, { recursive: true });

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(page, method, urlPath, body) {
  return page.evaluate(async (method, urlPath, body) => {
    const res = await fetch(urlPath, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return { status: res.status, data };
  }, method, urlPath, body || null);
}

async function ensureTwoProjects(page) {
  const list = await api(page, 'GET', '/api/projects?page=1&limit=50');
  const existing = list.data?.data || [];
  if (existing.length >= 2) {
    return [existing[0], existing[1]];
  }

  const employees = await api(page, 'GET', '/api/projects/assignable-employees');
  const staff = employees.data?.data || employees.data || [];
  const tecnico = staff.find((e) => e.id) || { id: 1 };
  const vendedor = staff.find((e) => e.id && e.id !== tecnico.id) || tecnico;
  const stamp = Date.now();

  async function createOne(suffix) {
    const payload = {
      quote_number: `ISO-${stamp}-${suffix}`,
      order_number: `PED-${suffix}`,
      purchase_order_not_applicable: true,
      tecnico_id: tecnico.id,
      vendedor_id: vendedor.id,
      client_name: `Cliente Isolation ${suffix}`,
      project_description: `Proyecto isolation ${suffix}`,
      expected_margin: 10,
      total_invoiced: 1605672,
      total_invoiced_currency: 'MXN',
      progress_percent: 0,
      fecha_vencimiento: '2026-12-01',
      promised_delivery_date: '2026-11-01',
      status: 'Pendiente',
      risk: 'Bajo',
    };
    const created = await api(page, 'POST', '/api/projects', payload);
    if (created.status >= 400) {
      throw new Error(`Create project failed: ${JSON.stringify(created)}`);
    }
    return created.data;
  }

  const a = existing[0] || await createOne('A');
  const b = existing[1] || await createOne('B');
  return [a, b];
}

async function openProjectById(page, projectId) {
  await page.evaluate((id) => {
    const btn = document.querySelector(`button[data-action="select"][data-id="${id}"]`);
    if (btn) {
      btn.click();
      return;
    }
    if (typeof selectProject === 'function') {
      selectProject(id);
    }
  }, projectId);
  await page.waitForSelector('#project-detail-drawer:not(.hidden)', { timeout: 5000 });
}

async function readPaymentDraft(page) {
  return page.evaluate(() => {
    const form = document.querySelector('#payment-form');
    const amountInput = form.elements.amount;
    return {
      amount: amountInput.getCurrencyValue ? amountInput.getCurrencyValue() : amountInput.value,
      notes: form.elements.notes.value,
      paymentDate: form.elements.payment_date.value,
      display: amountInput.value,
    };
  });
}

async function fillPaymentDraft(page, { amount, notes, paymentDate }) {
  await page.evaluate(({ amount, notes, paymentDate }) => {
    const form = document.querySelector('#payment-form');
    const amountInput = form.elements.amount;
    if (amountInput.setCurrencyValue) amountInput.setCurrencyValue(amount);
    else amountInput.value = String(amount);
    form.elements.notes.value = notes;
    form.elements.payment_date.value = paymentDate;
  }, { amount, notes, paymentDate });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
page.setDefaultTimeout(15000);

let pendingDialogAction = 'dismiss';
page.on('dialog', async (dialog) => {
  const message = dialog.message();
  console.log(`DIALOG (${pendingDialogAction}): ${message.slice(0, 120)}`);
  if (pendingDialogAction === 'accept') await dialog.accept();
  else await dialog.dismiss();
});

try {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.type('#login-form input[name="username"], form#login-form input[name="username"], input[name="username"]', 'admin');
  await page.type('input[name="password"]', 'admin123');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForSelector('#app-view:not(.hidden), #projects-view', { timeout: 10000 }).catch(() => {}),
  ]);
  await page.waitForFunction(() => !document.querySelector('#login-view') || document.querySelector('#login-view').classList.contains('hidden'), { timeout: 10000 });

  const [projectA, projectB] = await ensureTwoProjects(page);
  pass('two-projects-ready', `A=#${projectA.id} B=#${projectB.id}`);

  // Refresh list so rows exist
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.querySelector('#login-view') || document.querySelector('#login-view').classList.contains('hidden'));
  await page.waitForSelector('#projects-table tr[data-row-id]', { timeout: 10000 });

  const paymentsBeforeA = (await api(page, 'GET', `/api/projects/${projectA.id}`)).data.payments || [];

  await openProjectById(page, projectA.id);
  await fillPaymentDraft(page, {
    amount: 15000,
    notes: 'BORRADOR-A',
    paymentDate: '2026-01-15',
  });
  const draftA = await readPaymentDraft(page);
  if (Number(draftA.amount) === 15000 && draftA.notes === 'BORRADOR-A' && draftA.paymentDate === '2026-01-15') {
    pass('draft-captured-on-A', JSON.stringify(draftA));
  } else {
    fail('draft-captured-on-A', JSON.stringify(draftA));
  }
  await page.screenshot({ path: path.join(ARTIFACTS, 'form-isolation-draft-on-a.png'), fullPage: true });

  // Cancel switch: should keep draft
  pendingDialogAction = 'dismiss';
  await openProjectById(page, projectB.id);
  await sleep(400);
  const stillOnA = await page.evaluate(() => state.selectedProjectId);
  const draftAfterCancel = await readPaymentDraft(page);
  if (Number(stillOnA) === Number(projectA.id)
    && Number(draftAfterCancel.amount) === 15000
    && draftAfterCancel.notes === 'BORRADOR-A'
    && draftAfterCancel.paymentDate === '2026-01-15') {
    pass('cancel-keeps-project-and-draft', JSON.stringify({ stillOnA, draftAfterCancel }));
  } else {
    fail('cancel-keeps-project-and-draft', JSON.stringify({ stillOnA, draftAfterCancel }));
  }
  await page.screenshot({ path: path.join(ARTIFACTS, 'form-isolation-cancel-keeps-draft.png'), fullPage: true });

  // Confirm switch: forms clean on B
  pendingDialogAction = 'accept';
  await openProjectById(page, projectB.id);
  await sleep(400);
  const onB = await page.evaluate(() => state.selectedProjectId);
  const draftOnB = await readPaymentDraft(page);
  const cleanB = Number(onB) === Number(projectB.id)
    && (!draftOnB.amount || Math.abs(Number(draftOnB.amount)) < 0.000001)
    && !String(draftOnB.notes || '').trim()
    && draftOnB.paymentDate !== '2026-01-15';
  if (cleanB) pass('confirm-switch-clears-draft-on-B', JSON.stringify(draftOnB));
  else fail('confirm-switch-clears-draft-on-B', JSON.stringify({ onB, draftOnB }));
  await page.screenshot({ path: path.join(ARTIFACTS, 'form-isolation-after-switch-clean.png'), fullPage: true });

  // No accidental payment on A
  const paymentsAfter = (await api(page, 'GET', `/api/projects/${projectA.id}`)).data.payments || [];
  if (paymentsAfter.length === paymentsBeforeA.length) {
    pass('no-accidental-payment-on-A', `count=${paymentsAfter.length}`);
  } else {
    fail('no-accidental-payment-on-A', `before=${paymentsBeforeA.length} after=${paymentsAfter.length}`);
  }

  // Stale response guard: token increments and mismatches are rejected
  const staleGuard = await page.evaluate(() => {
    const token1 = beginProjectDetailLoad(1);
    const token2 = beginProjectDetailLoad(2);
    state.selectedProjectId = 2;
    return {
      tokenGrew: token2.token > token1.token,
      staleRejected: !isProjectDetailLoadCurrent(token1.token, 1),
      currentOk: isProjectDetailLoadCurrent(token2.token, 2),
    };
  });
  if (staleGuard.tokenGrew && staleGuard.staleRejected && staleGuard.currentOk) {
    pass('stale-response-token-guard', JSON.stringify(staleGuard));
  } else {
    fail('stale-response-token-guard', JSON.stringify(staleGuard));
  }

  // Re-open B cleanly after token probe mutated selectedProjectId
  pendingDialogAction = 'accept';
  await openProjectById(page, projectB.id);
  await sleep(300);

  // Submit real payment on B and ensure form clears
  pendingDialogAction = 'dismiss';
  await fillPaymentDraft(page, {
    amount: 100,
    notes: 'PAGO-REAL-B',
    paymentDate: new Date().toISOString().slice(0, 10),
  });
  await page.click('#payment-form button[type="submit"]');
  await sleep(1000);
  const afterSubmit = await readPaymentDraft(page);
  const listText = await page.evaluate(() => document.querySelector('#payments-list')?.innerText || '');
  if ((!afterSubmit.amount || Math.abs(Number(afterSubmit.amount)) < 0.000001)
    && !String(afterSubmit.notes || '').trim()
    && /100/.test(listText)) {
    pass('submit-clears-form-and-lists-payment', JSON.stringify({ afterSubmit, listText: listText.slice(0, 120) }));
  } else {
    fail('submit-clears-form-and-lists-payment', JSON.stringify({ afterSubmit, listText }));
  }
  await page.screenshot({ path: path.join(ARTIFACTS, 'form-isolation-after-submit.png'), fullPage: true });
} catch (error) {
  fail('script-error', error.stack || error.message);
  try {
    await page.screenshot({ path: path.join(ARTIFACTS, 'form-isolation-error.png'), fullPage: true });
  } catch {}
} finally {
  await browser.close();
}

const summaryPath = path.join(ARTIFACTS, 'form-isolation-verification.json');
fs.writeFileSync(summaryPath, JSON.stringify({ results, failed: results.filter((r) => !r.ok).length }, null, 2));
console.log(`Wrote ${summaryPath}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
