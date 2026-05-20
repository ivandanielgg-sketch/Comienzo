const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('dashboard exposes Numero de pedido column backed by order_number', () => {
  assert.match(indexHtml, /Numero de pedido/);
  assert.match(appJs, /key: 'order_number', label: 'Numero de pedido'/);
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

test('admin backup buttons replace general Excel export UI', () => {
  assert.match(indexHtml, /Crear respaldo/);
  assert.match(indexHtml, /Importar respaldo/);
  assert.doesNotMatch(indexHtml, /Exportar Excel General|export-general-excel/);
  assert.match(appJs, /\/api\/admin\/backup/);
  assert.doesNotMatch(appJs, /export-general-excel|generateGeneralExcel/);
});
