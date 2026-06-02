
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

  it('production keeps sqlite without USE_POSTGRES', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/x';
    delete process.env.USE_POSTGRES;
    assert.equal(resolveDbMode(), 'sqlite');
    process.env.NODE_ENV = prev.NODE_ENV;
    process.env.DATABASE_URL = prev.DATABASE_URL;
    if (prev.USE_POSTGRES) process.env.USE_POSTGRES = prev.USE_POSTGRES;
  });
});

