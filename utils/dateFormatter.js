/**
 * Date Formatter Utilities
 * Provides useful date formatting and manipulation functions
 */

/**
 * Format a date to a readable string
 * @param {Date|string|number} date - The date to format
 * @param {string} format - Format string (default: 'YYYY-MM-DD')
 * @returns {string} - Formatted date string
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {Date|string|number} date - The date to compare
 * @returns {string} - Relative time string
 */
export function getRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(then);
}

/**
 * Check if a date is today
 * @param {Date|string|number} date - The date to check
 * @returns {boolean} - True if the date is today
 */
export function isToday(date) {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is in the past
 * @param {Date|string|number} date - The date to check
 * @returns {boolean} - True if the date is in the past
 */
export function isPast(date) {
  return new Date(date) < new Date();
}

/**
 * Add days to a date
 * @param {Date|string|number} date - The base date
 * @param {number} days - Number of days to add
 * @returns {Date} - New date with days added
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

