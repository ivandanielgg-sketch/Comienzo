const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePaginationParams, buildPaginationMeta, ALLOWED_LIMITS, DEFAULT_LIMIT } = require('../src/pagination');

test('parsePaginationParams defaults', () => {
  const result = parsePaginationParams({});
  assert.deepEqual(result, { page: 1, limit: 15, search: '', sortBy: '', sortOrder: 'ASC' });
});

test('parsePaginationParams parses valid values', () => {
  const result = parsePaginationParams({ page: '3', limit: '30', search: ' hello ', sortBy: 'name', sortOrder: 'desc' });
  assert.equal(result.page, 3);
  assert.equal(result.limit, 30);
  assert.equal(result.search, 'hello');
  assert.equal(result.sortBy, 'name');
  assert.equal(result.sortOrder, 'DESC');
});

test('parsePaginationParams rejects invalid page', () => {
  assert.equal(parsePaginationParams({ page: '0' }).page, 1);
  assert.equal(parsePaginationParams({ page: '-5' }).page, 1);
  assert.equal(parsePaginationParams({ page: 'abc' }).page, 1);
});

test('parsePaginationParams rejects invalid limit', () => {
  assert.equal(parsePaginationParams({ limit: '10' }).limit, DEFAULT_LIMIT);
  assert.equal(parsePaginationParams({ limit: 'abc' }).limit, DEFAULT_LIMIT);
});

test('parsePaginationParams allows export limit up to 9999', () => {
  assert.equal(parsePaginationParams({ limit: '100' }).limit, 9999);
  assert.equal(parsePaginationParams({ limit: '9999' }).limit, 9999);
  assert.equal(parsePaginationParams({ limit: '10000' }).limit, DEFAULT_LIMIT);
});

test('parsePaginationParams accepts allowed limits', () => {
  for (const allowed of ALLOWED_LIMITS) {
    assert.equal(parsePaginationParams({ limit: String(allowed) }).limit, allowed);
  }
});

test('buildPaginationMeta with 15 records on page 1 limit 15', () => {
  const result = buildPaginationMeta(1, 15, 15);
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 1);
  assert.equal(result.totalRecords, 15);
  assert.equal(result.hasNextPage, false);
  assert.equal(result.hasPreviousPage, false);
  assert.equal(result.offset, 0);
});

test('buildPaginationMeta with 16 records shows 2 pages', () => {
  const result = buildPaginationMeta(1, 15, 16);
  assert.equal(result.totalPages, 2);
  assert.equal(result.hasNextPage, true);
  assert.equal(result.hasPreviousPage, false);
});

test('buildPaginationMeta page 2 of 16 records', () => {
  const result = buildPaginationMeta(2, 15, 16);
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 2);
  assert.equal(result.hasNextPage, false);
  assert.equal(result.hasPreviousPage, true);
  assert.equal(result.offset, 15);
});

test('buildPaginationMeta with 31 records has 3 pages at limit 15', () => {
  const result = buildPaginationMeta(1, 15, 31);
  assert.equal(result.totalPages, 3);
  assert.equal(result.hasNextPage, true);
});

test('buildPaginationMeta clamps page beyond totalPages', () => {
  const result = buildPaginationMeta(99, 15, 31);
  assert.equal(result.page, 3);
  assert.equal(result.offset, 30);
  assert.equal(result.hasNextPage, false);
  assert.equal(result.hasPreviousPage, true);
});

test('buildPaginationMeta with 0 records', () => {
  const result = buildPaginationMeta(1, 15, 0);
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 1);
  assert.equal(result.totalRecords, 0);
  assert.equal(result.hasNextPage, false);
  assert.equal(result.hasPreviousPage, false);
  assert.equal(result.offset, 0);
});

test('buildPaginationMeta middle page navigation', () => {
  const result = buildPaginationMeta(2, 15, 43);
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 3);
  assert.equal(result.hasNextPage, true);
  assert.equal(result.hasPreviousPage, true);
  assert.equal(result.offset, 15);
});

test('buildPaginationMeta with limit 30', () => {
  const result = buildPaginationMeta(1, 30, 43);
  assert.equal(result.totalPages, 2);
  assert.equal(result.hasNextPage, true);
});

test('buildPaginationMeta with limit 50', () => {
  const result = buildPaginationMeta(1, 50, 43);
  assert.equal(result.totalPages, 1);
  assert.equal(result.hasNextPage, false);
});
