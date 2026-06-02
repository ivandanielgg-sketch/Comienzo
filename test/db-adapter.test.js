
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStatementArgs } = require('../src/db/betterSqlite3Adapter');
const { resolveDbMode } = require('../src/db/mode');

describe('better-sqlite3 adapter', () => {
  it('normalizeStatementArgs expands named params', () => {
    const { sql, params } = normalizeStatementArgs(
      'INSERT INTO t (a,b) VALUES (@a, @b)',
      [{ a: 1, b: 2 }],
    );
    assert.match(sql, /VALUES \(\?, \?\)/);
    assert.deepEqual(params, [1, 2]);
  });

  it('DATABASE_URL selects postgres in any environment', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/x';
    assert.equal(resolveDbMode(), 'postgres');
    process.env.NODE_ENV = prev.NODE_ENV;
    process.env.DATABASE_URL = prev.DATABASE_URL;
  });

  it('production without DATABASE_URL throws', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    assert.throws(() => resolveDbMode(), /produccion se requiere DATABASE_URL/i);
    process.env.NODE_ENV = prev.NODE_ENV;
    if (prev.DATABASE_URL) process.env.DATABASE_URL = prev.DATABASE_URL;
  });
});
