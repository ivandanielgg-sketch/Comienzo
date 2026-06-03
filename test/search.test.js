const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSearchTerm,
  buildSearchCondition,
  matchesSearchText,
  sqlSearchExpr,
} = require('../src/search');

test('normalizeSearchTerm is case and accent insensitive', () => {
  assert.equal(normalizeSearchTerm('  José  '), 'jose');
  assert.equal(normalizeSearchTerm('EN PROCESO'), 'en proceso');
});

test('matchesSearchText supports partial matches', () => {
  assert.equal(matchesSearchText('Cliente ACME México', 'mexico'), true);
  assert.equal(matchesSearchText('Pendiente', 'term'), false);
});

test('buildSearchCondition returns normalized LIKE params', () => {
  const built = buildSearchCondition(['p.status', 'p.client_name'], 'Pénd');
  assert.ok(built);
  assert.match(built.clause, /LIKE \?/);
  assert.equal(built.params.length, 2);
  assert.equal(built.params[0], '%pend%');
  assert.ok(built.clause.includes(sqlSearchExpr('p.status')));
  assert.ok(built.clause.includes(sqlSearchExpr('p.client_name')));
});

test('buildSearchCondition ignores empty search', () => {
  assert.equal(buildSearchCondition(['p.status'], '   '), null);
});
