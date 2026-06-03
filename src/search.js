const ACCENT_PAIRS = [
  ['á', 'a'], ['à', 'a'], ['ä', 'a'], ['â', 'a'], ['ã', 'a'],
  ['é', 'e'], ['è', 'e'], ['ë', 'e'], ['ê', 'e'],
  ['í', 'i'], ['ì', 'i'], ['ï', 'i'], ['î', 'i'],
  ['ó', 'o'], ['ò', 'o'], ['ö', 'o'], ['ô', 'o'], ['õ', 'o'],
  ['ú', 'u'], ['ù', 'u'], ['ü', 'u'], ['û', 'u'],
  ['ñ', 'n'], ['ç', 'c'],
];

function normalizeSearchTerm(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim().toLowerCase();
  if (!text) return '';
  for (const [accent, plain] of ACCENT_PAIRS) {
    text = text.split(accent).join(plain);
    const upper = accent.toUpperCase();
    if (upper !== accent) {
      text = text.split(upper).join(plain);
    }
  }
  return text.replace(/\s+/g, ' ');
}

function sqlSearchExpr(expression) {
  let expr = `LOWER(COALESCE(CAST(${expression} AS TEXT), ''))`;
  for (const [accent, plain] of ACCENT_PAIRS) {
    expr = `REPLACE(${expr}, '${accent}', '${plain}')`;
    const upper = accent.toUpperCase();
    if (upper !== accent) {
      expr = `REPLACE(${expr}, '${upper}', '${plain}')`;
    }
  }
  return expr;
}

function buildSearchCondition(columns, rawSearch) {
  const term = normalizeSearchTerm(rawSearch);
  if (!term || !columns?.length) return null;
  const pattern = `%${term}%`;
  const clause = columns.map((column) => `${sqlSearchExpr(column)} LIKE ?`).join(' OR ');
  return {
    clause: `(${clause})`,
    params: columns.map(() => pattern),
  };
}

function remapSearchColumns(columns, fromAlias, toAlias) {
  const from = `${fromAlias}.`;
  const to = `${toAlias}.`;
  return columns.map((column) => column.split(from).join(to));
}

function matchesSearchText(haystack, needle) {
  const normalizedHay = normalizeSearchTerm(haystack);
  const normalizedNeedle = normalizeSearchTerm(needle);
  if (!normalizedNeedle) return true;
  return normalizedHay.includes(normalizedNeedle);
}

function matchesAnySearchField(values, needle) {
  return values.some((value) => matchesSearchText(value, needle));
}

module.exports = {
  ACCENT_PAIRS,
  normalizeSearchTerm,
  sqlSearchExpr,
  buildSearchCondition,
  remapSearchColumns,
  matchesSearchText,
  matchesAnySearchField,
};
