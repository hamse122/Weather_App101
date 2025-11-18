/**
 * Enhanced Date Formatter Utilities
 * A lightweight alternative to Moment.js / Day.js
 */

/**
 * Validate and normalize input date
 */
function normalizeDate(date) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Full-featured date formatting (mini moment.js)
 * Supported tokens:
 * YYYY, YY, MMMM, MMM, MM, M, DD, D, HH, H, hh, h, mm, ss, A, a
 */
export function formatDate(date, format = "YYYY-MM-DD") {
  const d = normalizeDate(date);
  if (!d) return "";

  const monthsFull = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthsShort = monthsFull.map(m => m.slice(0, 3));

  const tokens = {
    YYYY: d.getFullYear(),
    YY: String(d.getFullYear()).slice(-2),
    MMMM: monthsFull[d.getMonth()],
    MMM: monthsShort[d.getMonth()],
    MM: String(d.getMonth() + 1).padStart(2, "0"),
    M: d.getMonth() + 1,
    DD: String(d.getDate()).padStart(2, "0"),
    D: d.getDate(),
    HH: String(d.getHours()).padStart(2, "0"),
    H: d.getHours(),
    hh: String((d.getHours() % 12) || 12).padStart(2, "0"),
    h: (d.getHours() % 12) || 12,
    mm: String(d.getMinutes()).padStart(2, "0"),
    ss: String(d.getSeconds()).padStart(2, "0"),
    A: d.getHours() >= 12 ? "PM" : "AM",
    a: d.getHours() >= 12 ? "pm" : "am",
  };

  return Object.entries(tokens)
    .reduce((out, [token, value]) => out.replace(token, value), format);
}

/**
 * Relative time with future support
 * Examples:
 * "just now", "5 minutes ago", "in 2 hours", "3 months ago"
 */
export function getRelativeTime(date) {
  const now = new Date().getTime();
  const then = normalizeDate(date);
  if (!then) return "";

  const diff = then.getTime() - now;
  const absDiff = Math.abs(diff);

  const secs = Math.floor(absDiff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  const suffix = diff < 0 ? "ago" : "from now";

  if (secs < 10) return "just now";
  if (secs < 60) return `${secs} seconds ${suffix}`;
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ${suffix}`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ${suffix}`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ${suffix}`;
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ${suffix}`;
  return `${years} year${years > 1 ? "s" : ""} ${suffix}`;
}

/**
 * Check if date is today
 */
export function isToday(date) {
  const d = normalizeDate(date);
  if (!d) return false;

  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date) {
  const d = normalizeDate(date);
  if (!d) return false;

  const y = new Date();
  y.setDate(y.getDate() - 1);

  return (
    d.getDate() === y.getDate() &&
    d.getMonth() === y.getMonth() &&
    d.getFullYear() === y.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
export function isPast(date) {
  const d = normalizeDate(date);
  return d ? d.getTime() < Date.now() : false;
}

/**
 * Check if date is in the future
 */
export function isFuture(date) {
  const d = normalizeDate(date);
  return d ? d.getTime() > Date.now() : false;
}

/**
 * Add days
 */
export function addDays(date, days) {
  const d = normalizeDate(date);
  if (!d) return null;

  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months
 */
export function addMonths(date, months) {
  const d = normalizeDate(date);
  if (!d) return null;

  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add years
 */
export function addYears(date, years) {
  const d = normalizeDate(date);
  if (!d) return null;

  const result = new Date(d);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Difference helpers
 */
export function diffInDays(date1, date2) {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  if (!d1 || !d2) return NaN;

  const diff = Math.abs(d1 - d2);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function diffInHours(date1, date2) {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  if (!d1 || !d2) return NaN;

  const diff = Math.abs(d1 - d2);
  return Math.floor(diff / (1000 * 60 * 60));
}

/**
 * Convert to ISO string without timezone offset
 */
export function toISO(date) {
  const d = normalizeDate(date);
  if (!d) return "";

  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/**
 * Start & End of day
 */
export function startOfDay(date) {
  const d = normalizeDate(date);
  if (!d) return null;

  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

export function endOfDay(date) {
  const d = normalizeDate(date);
  if (!d) return null;

  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}
