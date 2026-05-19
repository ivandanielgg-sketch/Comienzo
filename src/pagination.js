const ALLOWED_LIMITS = [15, 30, 50];
const MAX_EXPORT_LIMIT = 9999;
const DEFAULT_LIMIT = 15;
const VALID_SORT_ORDERS = ['ASC', 'DESC'];

function parsePaginationParams(query) {
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (!ALLOWED_LIMITS.includes(limit)) {
    if (Number.isFinite(limit) && limit > 50 && limit <= MAX_EXPORT_LIMIT) {
      limit = MAX_EXPORT_LIMIT;
    } else {
      limit = DEFAULT_LIMIT;
    }
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

  return { page, limit, search, sortBy, sortOrder };
}

function normalizeSort(query, allowedSorts = {}, defaultSort = '') {
  const rawSortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortBy = rawSortBy && Object.prototype.hasOwnProperty.call(allowedSorts, rawSortBy)
    ? rawSortBy
    : '';
  const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const sortExpression = sortBy ? allowedSorts[sortBy] : '';
  const orderBy = sortExpression
    ? `${sortExpression} ${sortOrder}`
    : defaultSort;

  return {
    sortBy,
    sortOrder,
    orderBy,
  };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === '1' || value === 1 || value === 'si') {
    return 1;
  }
  if (value === false || value === 'false' || value === '0' || value === 0 || value === 'no') {
    return 0;
  }
  return null;
}

function readQueryValue(query, key) {
  const value = query[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function addSqlFilters(query, filterDefinitions = {}, whereParts = [], params = []) {
  const activeFilters = {};

  Object.entries(filterDefinitions).forEach(([key, definition]) => {
    const column = definition.column || definition.expression;
    if (!column) return;

    if (definition.type === 'text') {
      const value = String(readQueryValue(query, key) ?? '').trim();
      if (value) {
        whereParts.push(`${column} LIKE ?`);
        params.push(`%${value}%`);
        activeFilters[key] = value;
      }
      return;
    }

    if (definition.type === 'number' || definition.type === 'currency') {
      const exact = String(readQueryValue(query, key) ?? '').trim();
      const min = String(readQueryValue(query, `${key}_min`) ?? readQueryValue(query, `${key}_from`) ?? '').trim();
      const max = String(readQueryValue(query, `${key}_max`) ?? readQueryValue(query, `${key}_to`) ?? '').trim();

      if (exact) {
        const numeric = Number(exact);
        if (Number.isFinite(numeric)) {
          whereParts.push(`${column} = ?`);
          params.push(numeric);
          activeFilters[key] = numeric;
        }
      }
      if (min) {
        const numeric = Number(min);
        if (Number.isFinite(numeric)) {
          whereParts.push(`${column} >= ?`);
          params.push(numeric);
          activeFilters[`${key}_min`] = numeric;
        }
      }
      if (max) {
        const numeric = Number(max);
        if (Number.isFinite(numeric)) {
          whereParts.push(`${column} <= ?`);
          params.push(numeric);
          activeFilters[`${key}_max`] = numeric;
        }
      }
      return;
    }

    if (definition.type === 'date') {
      const exact = String(readQueryValue(query, key) ?? '').trim();
      const from = String(readQueryValue(query, `${key}_from`) ?? '').trim();
      const to = String(readQueryValue(query, `${key}_to`) ?? '').trim();

      if (exact && isValidDate(exact)) {
        whereParts.push(`${column} = ?`);
        params.push(exact);
        activeFilters[key] = exact;
      }
      if (from && isValidDate(from)) {
        whereParts.push(`${column} >= ?`);
        params.push(from);
        activeFilters[`${key}_from`] = from;
      }
      if (to && isValidDate(to)) {
        whereParts.push(`${column} <= ?`);
        params.push(to);
        activeFilters[`${key}_to`] = to;
      }
      return;
    }

    if (definition.type === 'select') {
      const value = String(readQueryValue(query, key) ?? '').trim();
      const options = definition.options || [];
      if (value && (!options.length || options.includes(value))) {
        whereParts.push(`${column} = ?`);
        params.push(value);
        activeFilters[key] = value;
      }
      return;
    }

    if (definition.type === 'boolean') {
      const value = normalizeBoolean(readQueryValue(query, key));
      if (value !== null) {
        whereParts.push(`${column} = ?`);
        params.push(value);
        activeFilters[key] = Boolean(value);
      }
    }
  });

  return { whereParts, params, activeFilters };
}

function buildListResponse(data, pagination, sorting, filters, extra = {}) {
  return {
    data,
    pagination,
    sorting: {
      sortBy: sorting.sortBy || '',
      sortOrder: sorting.sortOrder === 'DESC' ? 'desc' : 'asc',
    },
    filters: filters || {},
    ...extra,
  };
}

function buildPaginationMeta(page, limit, totalRecords) {
  const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / limit) : 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  return {
    page: safePage,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
    offset,
  };
}

module.exports = {
  ALLOWED_LIMITS,
  MAX_EXPORT_LIMIT,
  DEFAULT_LIMIT,
  VALID_SORT_ORDERS,
  parsePaginationParams,
  buildPaginationMeta,
  normalizeSort,
  isValidDate,
  normalizeBoolean,
  addSqlFilters,
  buildListResponse,
};
