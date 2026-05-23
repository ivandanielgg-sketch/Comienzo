'use strict';

const TIMEZONE = 'America/Mexico_City';
const LOCALE = 'es-MX';

/**
 * Returns the current timestamp in UTC ISO format for storage.
 */
function nowUtc() {
  return new Date().toISOString();
}

/**
 * Formats a date (ISO string or Date object) to DD/MM/YYYY HH:mm in CDMX timezone.
 * Returns null if input is falsy.
 */
function formatDateTimeCDMX(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  const day = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, day: '2-digit' });
  const month = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, month: '2-digit' });
  const year = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, year: 'numeric' });
  const hour = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, hour: '2-digit', hour12: false });
  const minute = d.toLocaleString(LOCALE, { timeZone: TIMEZONE, minute: '2-digit' });

  const parts = d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const time = d.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${parts} ${time}`;
}

/**
 * Formats a date to DD/MM/YYYY only (no time) in CDMX timezone.
 */
function formatDateCDMX(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

module.exports = {
  TIMEZONE,
  LOCALE,
  nowUtc,
  formatDateTimeCDMX,
  formatDateCDMX,
};
