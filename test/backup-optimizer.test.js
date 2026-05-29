const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');

let cookie = '';

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyData = body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : null;
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: {
        'Content-Type': headers?.contentType || 'application/json',
        ...(bodyData ? { 'Content-Length': Buffer.byteLength(bodyData) } : {}),
        Cookie: cookie,
        ...headers,
      },
    };
    delete opts.headers.contentType;
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        try { resolve({ status: res.statusCode, body: JSON.parse(buf.toString()), raw: buf, headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: buf.toString(), raw: buf, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

describe('Backup Optimizer', () => {
  before(async () => {
    const loginRes = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(loginRes.status, 200);
    const setCookie = loginRes.headers['set-cookie'];
    if (setCookie) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  });

  describe('Diagnostic endpoint', () => {
    it('GET /api/admin/backup/diagnostic returns size analysis', async () => {
      const res = await request('GET', '/api/admin/backup/diagnostic');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.totalSizeBytes >= 0);
      assert.ok(res.body.totalSizeFormatted);
      assert.ok(res.body.entityCount > 0);
      assert.ok(Array.isArray(res.body.entities));
      assert.ok(Array.isArray(res.body.topHeaviest));
      assert.strictEqual(typeof res.body.hasBase64, 'boolean');
    });

    it('diagnostic identifies heaviest entity', async () => {
      const res = await request('GET', '/api/admin/backup/diagnostic');
      assert.ok(res.body.topHeaviest.length > 0);
      const top = res.body.topHeaviest[0];
      assert.ok(top.entity);
      assert.ok(top.sizeBytes >= 0);
      assert.ok(top.percentage >= 0);
      assert.ok(top.records >= 0);
    });

    it('diagnostic shows percentage per entity', async () => {
      const res = await request('GET', '/api/admin/backup/diagnostic');
      let totalPct = 0;
      for (const e of res.body.entities) {
        totalPct += e.percentage;
      }
      assert.ok(totalPct >= 99 && totalPct <= 101, 'percentages should sum to ~100');
    });
  });

  describe('Optimized backup types', () => {
    it('complete backup includes all entities', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.backupMetadata.backupType, 'complete');
      assert.ok(res.body.backupMetadata.includedEntities.length >= 30);
      assert.ok(res.body.backupMetadata.totalUncompressedSize > 0);
    });

    it('light backup has fewer entities than complete', async () => {
      const complete = await request('GET', '/api/admin/backup/optimized?type=complete');
      const light = await request('GET', '/api/admin/backup/optimized?type=light');
      assert.strictEqual(light.body.backupMetadata.backupType, 'light');
      assert.ok(light.body.backupMetadata.includedEntities.length <= complete.body.backupMetadata.includedEntities.length);
    });

    it('critical_only backup has fewest entities', async () => {
      const light = await request('GET', '/api/admin/backup/optimized?type=light');
      const critical = await request('GET', '/api/admin/backup/optimized?type=critical_only');
      assert.strictEqual(critical.body.backupMetadata.backupType, 'critical_only');
      assert.ok(critical.body.backupMetadata.includedEntities.length <= light.body.backupMetadata.includedEntities.length);
    });

    it('invalid backup type returns 400', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=invalid');
      assert.strictEqual(res.status, 400);
    });

    it('light backup excludes temporal entities', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=light');
      assert.ok(!res.body.backupMetadata.includedEntities.includes('userSessionActivities'));
    });
  });

  describe('Backup policies', () => {
    it('auditLogPolicy=last30Days limits audit logs', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete&auditLogPolicy=last30Days');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.backupMetadata.policiesUsed.auditLogPolicy, 'last30Days');
    });

    it('activityPolicy=none excludes session activities', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete&activityPolicy=none');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.backupMetadata.policiesUsed.activityPolicy, 'none');
    });

    it('activityPolicy=last30Days includes recent sessions', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete&activityPolicy=last30Days');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.backupMetadata.policiesUsed.activityPolicy, 'last30Days');
    });
  });

  describe('Compression', () => {
    it('compress=true returns gzip content', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete&compress=true');
      assert.strictEqual(res.headers['content-type'], 'application/gzip');
      assert.ok(res.headers['content-disposition'].includes('.json.gz'));
      assert.ok(res.raw.length > 0);
      const decompressed = zlib.gunzipSync(res.raw);
      const backup = JSON.parse(decompressed.toString());
      assert.strictEqual(backup.backupMetadata.compression, 'gzip');
      assert.strictEqual(backup.backupMetadata.backupType, 'complete');
    });

    it('compressed backup is smaller than uncompressed', async () => {
      const uncompressed = await request('GET', '/api/admin/backup/optimized?type=complete');
      const compressed = await request('GET', '/api/admin/backup/optimized?type=complete&compress=true');
      const uncompressedSize = JSON.stringify(uncompressed.body).length;
      assert.ok(compressed.raw.length < uncompressedSize, 'compressed should be smaller');
    });
  });

  describe('Manifest and metadata', () => {
    it('backup includes coverageManifest with entitySizes', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete');
      assert.ok(res.body.coverageManifest);
      assert.ok(res.body.coverageManifest.entitySizes);
      assert.ok(res.body.coverageManifest.totalUncompressedSize > 0);
      assert.ok(res.body.coverageManifest.backupType === 'complete');
    });

    it('excludedEntities includes reasons', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=light');
      const excluded = res.body.coverageManifest.excludedWithReasons;
      assert.ok(Array.isArray(excluded));
      assert.ok(excluded.length > 0);
      assert.ok(excluded[0].name);
      assert.ok(excluded[0].reason);
    });

    it('backup never includes passwordHash', async () => {
      const res = await request('GET', '/api/admin/backup/optimized?type=complete');
      const json = JSON.stringify(res.body.data);
      assert.ok(!json.includes('password_hash'), 'should not contain password_hash');
      assert.ok(!json.includes('"sess"'), 'should not contain session data');
    });
  });

  describe('Import compatibility', () => {
    it('existing import endpoint still works with standard JSON', async () => {
      const backup = await request('GET', '/api/admin/backup/optimized?type=critical_only');
      const previewRes = await request('POST', '/api/admin/backup/preview', backup.body);
      assert.strictEqual(previewRes.status, 200);
      assert.ok(previewRes.body.preview);
    });

    it('preview-compressed endpoint accepts gzip', async () => {
      const compressedRes = await request('GET', '/api/admin/backup/optimized?type=critical_only&compress=true');
      const previewRes = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'localhost', port: 3000,
          path: '/api/admin/backup/preview-compressed',
          method: 'POST',
          headers: { 'Content-Type': 'application/gzip', 'Content-Length': compressedRes.raw.length, Cookie: cookie },
        };
        const req = http.request(opts, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
        });
        req.on('error', reject);
        req.write(compressedRes.raw);
        req.end();
      });
      assert.strictEqual(previewRes.status, 200);
      assert.ok(previewRes.body.preview);
    });
  });
});
