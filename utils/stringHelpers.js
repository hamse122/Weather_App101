/**
 * String Helper Functions (Enhanced Version)
 * Production-ready utility helpers with validation & edge-case handling
 */

/**
 * Capitalize the first letter of a string
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str = '') {
  if (typeof str !== 'string' || !str.trim()) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to camelCase
 * Handles spaces, underscores, and hyphens
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str = '') {
  if (typeof str !== 'string') return '';

  return str
    .toLowerCase()
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
}

/**
 * Convert a string to kebab-case
 * Handles camelCase, spaces, and underscores
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase(str = '') {
  if (typeof str !== 'string') return '';

  return str
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Truncate a string to a specified length
 * Optionally prevents breaking words
 * @param {string} str
 * @param {number} length
 * @param {Object} options
 * @param {string} options.suffix - Suffix if truncated (default: '...')
 * @param {boolean} options.wordBoundary - Avoid cutting words (default: false)
 * @returns {string}
 */
export function truncate(
  str = '',
  length = 0,
  { suffix = '...', wordBoundary = false } = {}
) {
  if (typeof str !== 'string' || length <= 0) return '';

  if (str.length <= length) return str;

  let truncated = str.slice(0, length);

  if (wordBoundary) {
    truncated = truncated.slice(0, truncated.lastIndexOf(' '));
  }

  return truncated + suffix;
}

/**
 * Remove all whitespace from a string
 * @param {string} str
 * @returns {string}
 */
export function removeWhitespace(str = '') {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, '');
}

/**
 * Reverse a string (Unicode safe)
 * @param {string} str
 * @returns {string}
 */
export function reverseString(str = '') {
  if (typeof str !== 'string') return '';
  return [...str].reverse().join('');
}

/**
 * Check if a string is a palindrome
 * @param {string} str
 * @returns {boolean}
 */
export function isPalindrome(str = '') {
  if (typeof str !== 'string') return false;

  const cleaned = str.replace(/[\W_]/g, '').toLowerCase();
  return cleaned === [...cleaned].reverse().join('');
}

/**
 * Generate a random string
 * @param {number} length
 * @returns {string}
 */
export function randomString(length = 8) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}
