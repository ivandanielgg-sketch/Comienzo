'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isUniqueConstraintError, uniqueConstraintMessage } = require('../src/db/uniqueConstraint');

test('isUniqueConstraintError detects SQLite unique codes', () => {
  assert.equal(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE' }), true);
  assert.equal(
    isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed: projects.quote_number' }),
    true,
  );
  assert.equal(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT', message: 'CHECK constraint failed' }), false);
});

test('isUniqueConstraintError detects PostgreSQL 23505', () => {
  assert.equal(isUniqueConstraintError({
    code: '23505',
    constraint: 'projects_quote_number_key',
    detail: 'Key (quote_number)=(5588) already exists.',
    message: 'duplicate key value violates unique constraint "projects_quote_number_key"',
  }), true);
  assert.equal(isUniqueConstraintError({ code: '23503' }), false);
  assert.equal(isUniqueConstraintError(null), false);
});

test('uniqueConstraintMessage maps projects.quote_number for Postgres and SQLite', () => {
  assert.equal(
    uniqueConstraintMessage({
      code: '23505',
      constraint: 'projects_quote_number_key',
      detail: 'Key (quote_number)=(5588) already exists.',
      message: 'duplicate key value violates unique constraint "projects_quote_number_key"',
    }),
    'El numero de cotizacion ya existe.',
  );
  assert.equal(
    uniqueConstraintMessage({
      code: 'SQLITE_CONSTRAINT_UNIQUE',
      message: 'UNIQUE constraint failed: projects.quote_number',
    }),
    'El numero de cotizacion ya existe.',
  );
  assert.equal(
    uniqueConstraintMessage({
      code: '23505',
      constraint: 'users_username_key',
      detail: 'Key (username)=(admin) already exists.',
    }),
    'El usuario ya existe.',
  );
  assert.equal(
    uniqueConstraintMessage({ code: '23505', constraint: 'other_unique' }),
    'El registro ya existe.',
  );
});
