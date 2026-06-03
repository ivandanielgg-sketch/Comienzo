'use strict';

const { isPostgres } = require('./mode');

function toPositionalParams(sql) {
  if (!isPostgres()) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function yearFilter(column, yearParamPlaceholder = '?') {
  if (isPostgres()) {
    return `AND EXTRACT(YEAR FROM ${column}::timestamp) = ${yearParamPlaceholder}`;
  }
  return `AND CAST(strftime('%Y', ${column}) AS INTEGER) = ${yearParamPlaceholder}`;
}

function monthFilter(column, monthParamPlaceholder = '?') {
  if (isPostgres()) {
    return `AND EXTRACT(MONTH FROM ${column}::timestamp) = ${monthParamPlaceholder}`;
  }
  return `AND CAST(strftime('%m', ${column}) AS INTEGER) = ${monthParamPlaceholder}`;
}

function distinctYearSelect(column, alias = 'year') {
  if (isPostgres()) {
    return `SELECT DISTINCT CAST(EXTRACT(YEAR FROM ${column}::timestamp) AS INTEGER) AS ${alias}`;
  }
  return `SELECT DISTINCT CAST(strftime('%Y', ${column}) AS INTEGER) AS ${alias}`;
}

/** Expresión año (SELECT/GROUP BY) para columnas TEXT fecha/hora. */
function sqlYearExpr(column) {
  if (isPostgres()) {
    return `CAST(EXTRACT(YEAR FROM ${column}::timestamp) AS INTEGER)`;
  }
  return `CAST(strftime('%Y', ${column}) AS INTEGER)`;
}

/** Expresión mes 1–12 (SELECT/GROUP BY) para columnas TEXT fecha/hora. */
function sqlMonthExpr(column) {
  if (isPostgres()) {
    return `CAST(EXTRACT(MONTH FROM ${column}::timestamp) AS INTEGER)`;
  }
  return `CAST(strftime('%m', ${column}) AS INTEGER)`;
}

function sqlDateCompareGte(column, paramPlaceholder = '?') {
  if (isPostgres()) {
    return `(${column})::date >= (${paramPlaceholder})::date`;
  }
  return `date(${column}) >= date(${paramPlaceholder})`;
}

function sqlDateCompareLte(column, paramPlaceholder = '?') {
  if (isPostgres()) {
    return `(${column})::date <= (${paramPlaceholder})::date`;
  }
  return `date(${column}) <= date(${paramPlaceholder})`;
}

const INSERT_TABLES_WITHOUT_ID = new Set([
  'exchange_rates',
  'service_quote_settings',
  'sessions',
]);

function insertTargetTable(sql) {
  const match = sql.trim().match(/^INSERT\s+INTO\s+"?(\w+)"?/i);
  return match ? match[1].toLowerCase() : null;
}

function appendReturningId(sql) {
  if (!isPostgres()) return sql;
  const trimmed = sql.trim();
  if (!/^\s*INSERT/i.test(trimmed) || /RETURNING/i.test(trimmed)) {
    return trimmed;
  }
  const table = insertTargetTable(trimmed);
  if (table && INSERT_TABLES_WITHOUT_ID.has(table)) {
    return trimmed;
  }
  return `${trimmed} RETURNING id`;
}

/** Fecha actual en SQL (columnas TEXT tipo fecha). */
function sqlCurrentDate() {
  return isPostgres() ? 'CURRENT_DATE' : "date('now')";
}

/** INTEGER/boolean flags from SQLite or PostgreSQL (pg may return "0"/"1" strings). */
function isDbTruthy(value) {
  if (value === null || value === undefined || value === false) return false;
  return Number(value) !== 0;
}

module.exports = {
  isPostgres,
  toPositionalParams,
  yearFilter,
  monthFilter,
  distinctYearSelect,
  sqlYearExpr,
  sqlMonthExpr,
  sqlDateCompareGte,
  sqlDateCompareLte,
  appendReturningId,
  sqlCurrentDate,
  isDbTruthy,
};
