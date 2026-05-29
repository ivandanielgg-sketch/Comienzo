const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

let cookie = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        Cookie: cookie,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('Activity Monitor Summary endpoint', () => {
  before(async () => {
    const loginRes = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(loginRes.status, 200);
    const setCookie = loginRes.headers['set-cookie'];
    if (setCookie) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  });

  it('GET summary by year returns valid structure', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=year&year=2026');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.period);
    assert.strictEqual(res.body.period.periodType, 'year');
    assert.strictEqual(res.body.period.label, '2026');
    assert.ok(res.body.period.startDate);
    assert.ok(res.body.period.endDate);
    assert.ok(res.body.summary);
    assert.ok(Array.isArray(res.body.users));
    assert.ok(Array.isArray(res.body.events));
    assert.strictEqual(typeof res.body.summary.totalUsers, 'number');
    assert.strictEqual(typeof res.body.summary.totalSessions, 'number');
    assert.strictEqual(typeof res.body.summary.totalDurationSeconds, 'number');
    assert.strictEqual(typeof res.body.summary.totalEvents, 'number');
  });

  it('GET summary by month returns correct label', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=month&year=2026&month=5');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.period.label, 'Mayo 2026');
    assert.ok(res.body.period.startDate.includes('2026'));
    assert.ok(res.body.period.endDate.includes('2026'));
  });

  it('GET summary by week returns monday-sunday range', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=week&year=2026&weekNumber=22');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.period.label.includes('Semana 22'));
    assert.ok(res.body.period.startDate);
    assert.ok(res.body.period.endDate);
  });

  it('GET summary by day returns correct date', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=day&date=2026-05-29');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.period.label, '2026-05-29');
    assert.ok(res.body.period.startDate.includes('2026-05'));
    assert.ok(res.body.period.endDate.includes('2026-05'));
  });

  it('summary accumulates sessions per user', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=year&year=2026');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.summary.totalSessions >= 1);
    assert.ok(res.body.users.length >= 1);
    const admin = res.body.users.find(u => u.user_name === 'admin');
    assert.ok(admin, 'admin user should appear in results');
    assert.ok(admin.total_sessions >= 1);
    assert.strictEqual(typeof admin.avg_per_session, 'number');
    assert.strictEqual(typeof admin.total_events, 'number');
  });

  it('returns events for period', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=year&year=2026');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.events.length >= 1);
    const ev = res.body.events[0];
    assert.ok(ev.timestamp_utc);
    assert.ok(ev.action);
    assert.strictEqual(ev.password_hash, undefined);
    assert.strictEqual(ev.sess, undefined);
  });

  it('missing periodType returns 400', async () => {
    const res = await request('GET', '/api/activity-monitor/summary');
    assert.strictEqual(res.status, 400);
  });

  it('invalid periodType returns 400', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=invalid');
    assert.strictEqual(res.status, 400);
  });

  it('month without month param returns 400', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=month&year=2026');
    assert.strictEqual(res.status, 400);
  });

  it('week without weekNumber returns 400', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=week&year=2026');
    assert.strictEqual(res.status, 400);
  });

  it('day without date returns 400', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=day');
    assert.strictEqual(res.status, 400);
  });

  it('non-admin user gets 403', async () => {
    await request('POST', '/api/users', { username: 'montest', password: 'test123', role: 'user' });
    const loginRes = await new Promise((resolve, reject) => {
      const opts = { hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify({ username: 'montest', password: 'test123' })) } };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ username: 'montest', password: 'test123' }));
      req.end();
    });
    const userCookie = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const res = await new Promise((resolve, reject) => {
      const opts = { hostname: 'localhost', port: 3000, path: '/api/activity-monitor/summary?periodType=year&year=2026', method: 'GET', headers: { Cookie: userCookie } };
      const req = http.request(opts, (res2) => {
        let data = '';
        res2.on('data', (c) => { data += c; });
        res2.on('end', () => resolve({ status: res2.statusCode }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(res.status, 403);
  });

  it('empty period returns empty arrays not null', async () => {
    const res = await request('GET', '/api/activity-monitor/summary?periodType=year&year=2020');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
    assert.ok(Array.isArray(res.body.events));
    assert.strictEqual(res.body.summary.totalUsers, 0);
    assert.strictEqual(res.body.summary.totalSessions, 0);
  });
});
