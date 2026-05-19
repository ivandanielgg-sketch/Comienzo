const ALLOWED_LIMITS = [15, 30, 50];
const MAX_EXPORT_LIMIT = 9999;
const DEFAULT_LIMIT = 15;

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
  parsePaginationParams,
  buildPaginationMeta,
};
