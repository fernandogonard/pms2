/**
 * Utilidades para fechas
 * REGLA: TODO en UTC
 */

/**
 * Parsear string YYYY-MM-DD a Date en UTC
 */
function parseUTC(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Invalid date string');
  }
  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Convertir Date a string YYYY-MM-DD
 */
function toDateString(date) {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date object');
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Normalizar Date al inicio del día en UTC
 */
function startOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Normalizar Date al final del día en UTC
 */
function endOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

const toUTC = (date) => {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};

const fromUTC = (date) => {
  const d = new Date(date);
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
};

module.exports = {
  parseUTC,
  toDateString,
  startOfDayUTC,
  endOfDayUTC,
  toUTC,
  fromUTC
};
