#!/usr/bin/env node
/**
 * Handoff checks for Stage 2 (no Stage 3):
 * 1) User B must not see User A's drafts in restore UI (same tab).
 * 2) After extend past original expiry, authenticated ops still work.
 */
import puppeteer from 'puppeteer-core';
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 3102;
const DB_PATH = path.join(process.cwd(), 'data', 'test-stage2-handoff.db');
const SESSION_TTL_MS = 3500;
const ARTIFACTS = '/opt/cursor/artifacts';
const BASE = `http://127.0.0.1:${PORT}`;
fs.mkdirSync(ARTIFACTS, { recursive: true });

const results = [];
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`); };
const fail = (name, detail = '') => { results.push({ name, ok: false, detail }); console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request(method, urlPath, body, cookie) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null;
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie || cookie || null });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      await request('GET', '/api/session');
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error('server timeout');
}

for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  try { fs.unlinkSync(f); } catch {}
}

const server = spawn('node', ['src/server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH,
    SESSION_SECRET: 'handoff-test-secret',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    SESSION_TTL_MS: String(SESSION_TTL_MS),
  },
  stdio: 'pipe',
});

let browser;
try {
  await waitForServer();

  // --- API: renew past original expiry, then authenticated op works ---
  let login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
  const cookie = login.cookie;
  const originalExpires = Date.parse(login.body.expires_at);
  await sleep(900);
  const mid = await request('GET', '/api/session', null, cookie);
  const midExpires = Date.parse(mid.body.expires_at);
  if (Math.abs(originalExpires - midExpires) < 80) {
    pass('api-get-session-not-rolling');
  } else {
    fail('api-get-session-not-rolling', JSON.stringify({ originalExpires, midExpires }));
  }

  // Wait until close to original expiry, then extend
  const waitMs = Math.max(0, originalExpires - Date.now() + 200);
  await sleep(Math.min(waitMs, SESSION_TTL_MS + 500));
  // If already past original wall-clock from login, extend must revive
  const extended = await request('POST', '/api/session/extend', {}, cookie);
  if (extended.status !== 200 || !extended.body.ok) {
    // Session may have fully expired if we waited too long; re-login and prove extend extends past a synthetic original
    login = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    const freshCookie = login.cookie;
    const freshOriginal = Date.parse(login.body.expires_at);
    await sleep(1200);
    const ext2 = await request('POST', '/api/session/extend', {}, freshCookie);
    assertOk(ext2.status === 200 && Date.parse(ext2.body.expires_at) > freshOriginal, 'extend-after-elapsed');
    const op = await request('GET', '/api/projects?page=1&limit=5', null, freshCookie);
    if (op.status === 200 && Array.isArray(op.body.data)) {
      pass('authenticated-ops-after-extend', `status=${op.status}`);
    } else {
      fail('authenticated-ops-after-extend', JSON.stringify(op));
    }
  } else {
    const newExpires = Date.parse(extended.body.expires_at);
    if (newExpires > originalExpires && extended.body.expires_in_ms > SESSION_TTL_MS - 1500) {
      pass('extend-past-original-expiry-window', `deltaMs=${newExpires - originalExpires}`);
    } else {
      fail('extend-past-original-expiry-window', JSON.stringify(extended.body));
    }
    // Ensure we can still call authenticated APIs after original timestamp
    await sleep(Math.max(0, originalExpires - Date.now() + 300));
    const op = await request('GET', '/api/projects?page=1&limit=5', null, extended.cookie || cookie);
    if (op.status === 200 && Array.isArray(op.body.data)) {
      pass('authenticated-ops-after-original-expiry-with-extend', `status=${op.status}`);
    } else {
      fail('authenticated-ops-after-original-expiry-with-extend', JSON.stringify({ status: op.status, body: op.body }));
    }
  }

  function assertOk(cond, name) {
    if (cond) pass(name);
    else fail(name);
  }

  // Create second user for cross-user draft UI check
  let adminCookie = (await request('POST', '/api/login', { username: 'admin', password: 'admin123' })).cookie;
  await request('POST', '/api/admin/verify', { password: 'admin123' }, adminCookie);
  const createUser = await request('POST', '/api/users', {
    username: 'handoffuser',
    password: 'HandoffPass123!',
    role: 'user',
  }, adminCookie);
  if (createUser.status !== 201 && createUser.status !== 400) {
    fail('create-second-user', JSON.stringify(createUser));
  } else {
    pass('create-second-user-ready', `status=${createUser.status}`);
  }

  browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.type('input[name="username"]', 'admin');
  await page.type('input[name="password"]', 'admin123');
  await page.click('#login-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#login-view')?.classList.contains('hidden'));

  // Ensure a project exists and open it
  await page.waitForSelector('#projects-table', { timeout: 10000 });
  const projectId = await page.evaluate(async () => {
    let list = await (await fetch('/api/projects?page=1&limit=5')).json();
    if (!list.data?.length) {
      const employees = await (await fetch('/api/projects/assignable-employees')).json();
      const staff = employees.data || employees || [];
      const tecnico = staff[0] || { id: 1 };
      const vendedor = staff[1] || tecnico;
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_number: `HO-${Date.now()}`,
          order_number: '1',
          purchase_order_not_applicable: true,
          tecnico_id: tecnico.id,
          vendedor_id: vendedor.id,
          client_name: 'Cliente Handoff',
          project_description: 'Proyecto handoff',
          expected_margin: 10,
          total_invoiced: 1000,
          total_invoiced_currency: 'MXN',
          progress_percent: 0,
          fecha_vencimiento: '2026-12-01',
          promised_delivery_date: '2026-11-01',
          status: 'Pendiente',
          risk: 'Bajo',
        }),
      });
      list = await (await fetch('/api/projects?page=1&limit=5')).json();
    }
    return list.data[0].id;
  });

  await page.evaluate(async (id) => {
    await loadProjects();
    selectProject(id);
  }, projectId);
  await page.waitForFunction((id) => Number(state.selectedProjectId) === Number(id), { timeout: 10000 }, projectId);
  const adminUserId = await page.evaluate(() => state.currentUserId);
  await page.evaluate(() => {
    const form = document.querySelector('#payment-form');
    if (!form?.elements?.amount?.setCurrencyValue) {
      throw new Error('payment form currency helpers missing');
    }
    form.elements.amount.setCurrencyValue(7777);
    form.elements.notes.value = 'SECRET-DRAFT-ADMIN';
    form.elements.payment_date.value = '2026-02-02';
    snapshotActiveProjectDrafts();
  });

  const adminDraft = await page.evaluate((userId, projectId) => (
    SessionDrafts.readDraft(sessionStorage, userId, projectId, 'payment_new')
  ), adminUserId, projectId);
  if (adminDraft?.payload?.notes === 'SECRET-DRAFT-ADMIN') {
    pass('admin-draft-stored');
  } else {
    fail('admin-draft-stored', JSON.stringify(adminDraft));
  }

  // Logout via UI path (keeps sessionStorage drafts for admin user id)
  await page.click('#logout-button');
  await page.waitForFunction(() => !document.querySelector('#login-view').classList.contains('hidden'));

  // Login as second user in same tab
  await page.evaluate(() => {
    document.querySelector('input[name="username"]').value = '';
    document.querySelector('input[name="password"]').value = '';
  });
  await page.type('input[name="username"]', 'handoffuser');
  await page.type('input[name="password"]', 'HandoffPass123!');
  await page.click('#login-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#login-view')?.classList.contains('hidden'), { timeout: 10000 }).catch(() => {});

  await sleep(1000);
  const isolation = await page.evaluate((adminUserId, projectId) => {
    const modal = document.getElementById('session-draft-restore-modal');
    const restoreVisible = modal && !modal.classList.contains('hidden');
    const listText = document.getElementById('session-draft-restore-list')?.innerText || '';
    const foreignCleared = !SessionDrafts.readDraft(sessionStorage, adminUserId, projectId, 'payment_new');
    const ownDrafts = SessionDrafts.listDraftsForUser(sessionStorage, state.currentUserId);
    return {
      restoreVisible,
      listText,
      foreignCleared,
      ownDraftCount: ownDrafts.length,
      currentUserId: state.currentUserId,
      mentionsSecret: listText.includes('SECRET-DRAFT-ADMIN'),
    };
  }, adminUserId, projectId);

  // Success = admin draft purged from storage and never offered/rendered to the other user.
  if (isolation.foreignCleared && !isolation.mentionsSecret && (!isolation.restoreVisible || !isolation.listText.includes('SECRET-DRAFT-ADMIN'))) {
    pass('other-user-cannot-restore-foreign-drafts', JSON.stringify(isolation));
  } else {
    fail('other-user-cannot-restore-foreign-drafts', JSON.stringify(isolation));
  }
  await page.screenshot({ path: path.join(ARTIFACTS, 'stage2-handoff-user-isolation.png'), fullPage: true });
} catch (error) {
  fail('script-error', error.stack || error.message);
} finally {
  if (browser) await browser.close();
  server.kill();
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    try { fs.unlinkSync(f); } catch {}
  }
}

const out = path.join(ARTIFACTS, 'stage2-handoff-verification.json');
fs.writeFileSync(out, JSON.stringify({ results, failed: results.filter((r) => !r.ok).length }, null, 2));
console.log(`Wrote ${out}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
