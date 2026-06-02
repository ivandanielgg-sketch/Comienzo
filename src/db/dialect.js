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

function appendReturningId(sql) {
  if (!isPostgres()) return sql;
  const trimmed = sql.trim();
  if (!/^\s*INSERT/i.test(trimmed) || /RETURNING/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} RETURNING id`;
}

module.exports = {
  isPostgres,
  toPositionalParams,
  yearFilter,
  monthFilter,
  distinctYearSelect,
  appendReturningId,
};
