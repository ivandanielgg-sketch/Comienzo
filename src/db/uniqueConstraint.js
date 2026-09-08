'use strict';

/**
 * Detecta violaciones de UNIQUE en SQLite y PostgreSQL.
 * SQLite: SQLITE_CONSTRAINT_UNIQUE
 * PostgreSQL: 23505 (unique_violation)
 */
function isUniqueConstraintError(err) {
  if (!err) return false;
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  if (err.code === 'SQLITE_CONSTRAINT' && String(err.message || '').includes('UNIQUE')) {
    return true;
  }
  return err.code === '23505';
}

function uniqueConstraintMessage(err) {
  const haystack = [
    err && err.constraint,
    err && err.detail,
    err && err.message,
  ].filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes('users') && haystack.includes('username')) {
    return 'El usuario ya existe.';
  }
  if (haystack.includes('employees') && haystack.includes('employee_number')) {
    return 'El numero de empleado ya existe.';
  }
  if (haystack.includes('projects') && haystack.includes('quote_number')) {
    return 'El numero de cotizacion ya existe.';
  }
  return 'El registro ya existe.';
}

module.exports = {
  isUniqueConstraintError,
  uniqueConstraintMessage,
};
