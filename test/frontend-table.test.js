const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('dashboard exposes N. Pedido column backed by order_number', () => {
  assert.match(indexHtml, /N\. Pedido/);
  assert.match(appJs, /key: 'order_number', label: 'N\. Pedido'/);
  assert.match(appJs, /p\.order_number \|\| 'Sin pedido'/);
});

test('DataTable centralizes header sorting and pagination state', () => {
  assert.match(appJs, /function renderDataTable/);
  assert.match(appJs, /data-sort-key/);
  assert.match(appJs, /sortOrder: 'desc'/);
  assert.match(appJs, /pageState\.page = 1/);
  assert.match(appJs, /buildTableParams\('projects'\)/);
  assert.doesNotMatch(appJs, /data-apply-filter/);
  assert.doesNotMatch(appJs, /datatable-filters/);
});

test('main table keeps general search and sends sort before pagination', () => {
  assert.match(appJs, /new URLSearchParams\(\{\s*page: state\.projectsPag\.page,\s*limit: state\.projectsPag\.limit,\s*search: state\.projectsSearch,\s*\.\.\.buildTableParams\('projects'\),/s);
  assert.match(appJs, /renderPaginationControls\(\s*paginationContainerId,/);
});

test('projects list defaults to order_number ascending and patches rows in place', () => {
  assert.match(appJs, /state\.tableSort\.projects = \{ sortBy: 'order_number', sortOrder: 'asc' \}/);
  assert.match(appJs, /async function applyProjectListUpdate/);
  assert.match(appJs, /function preserveWindowScroll/);
  assert.match(appJs, /row-last-worked/);
  assert.match(appJs, /await applyProjectListUpdate\(updatedProject\)/);
  assert.doesNotMatch(
    appJs,
    /paymentForm\.reset\(\);\s*setDefaultDates\(\);\s*await loadProjects\(\);/s,
  );
  assert.doesNotMatch(
    appJs,
    /costForm\.reset\(\);\s*setDefaultDates\(\);\s*await loadProjects\(\);/s,
  );
});
