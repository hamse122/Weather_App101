/**
 * String Helper Functions (Upgraded Production Version)
 * Features:
 * - Strong input validation
 * - Better Unicode-safe handling
 * - Safer truncation
 * - Configurable random string generation
 * - Extra useful helpers
 */

/**
 * Check whether a value is a string
 * @param {unknown} value
 * @returns {boolean}
 */
function isString(value) {
  return typeof value === 'string' || value instanceof String;
}

/**
 * Normalize string input
 * @param {unknown} value
 * @returns {string}
 */
function toSafeString(value) {
  return isString(value) ? String(value) : '';
}

/**
 * Capitalize the first character and lowercase the rest
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str = '') {
  const input = toSafeString(str).trim();
  if (!input) return '';

  const [first, ...rest] = [...input];
  return first.toLocaleUpperCase() + rest.join('').toLocaleLowerCase();
}

/**
 * Convert a string to camelCase
 * Handles spaces, underscores, hyphens, and mixed casing
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str = '') {
  const input = toSafeString(str).trim();
  if (!input) return '';

  return input
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join('');
}

/**
 * Convert a string to kebab-case
 * Handles camelCase, spaces, underscores, and repeated separators
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase(str = '') {
  const input = toSafeString(str).trim();
  if (!input) return '';

  return input
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLocaleLowerCase();
}

/**
 * Convert a string to snake_case
 * @param {string} str
 * @returns {string}
 */
export function toSnakeCase(str = '') {
  const input = toSafeString(str).trim();
  if (!input) return '';

  return input
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLocaleLowerCase();
}

/**
 * Convert a string to Title Case
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str = '') {
  const input = toSafeString(str).trim();
  if (!input) return '';

  return input
    .toLocaleLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate a string to a specified length
 * Supports word boundary preservation
 * @param {string} str
 * @param {number} maxLength
 * @param {Object} options
 * @param {string} [options.suffix='...']
 * @param {boolean} [options.wordBoundary=false]
 * @returns {string}
 */
export function truncate(
  str = '',
  maxLength = 0,
  { suffix = '...', wordBoundary = false } = {}
) {
  const input = toSafeString(str);
  const safeSuffix = toSafeString(suffix);

  if (!input || !Number.isInteger(maxLength) || maxLength <= 0) return '';
  if ([...input].length <= maxLength) return input;

  const chars = [...input];
  const allowedLength = Math.max(0, maxLength - [...safeSuffix].length);

  let truncated = chars.slice(0, allowedLength).join('');

  if (wordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  return truncated + safeSuffix;
}

/**
 * Remove all whitespace from a string
 * @param {string} str
 * @returns {string}
 */
export function removeWhitespace(str = '') {
  return toSafeString(str).replace(/\s+/g, '');
}

/**
 * Reverse a string safely for Unicode characters
 * @param {string} str
 * @returns {string}
 */
export function reverseString(str = '') {
  return [...toSafeString(str)].reverse().join('');
}

/**
 * Check if a string is a palindrome
 * Ignores punctuation, underscores, spaces, and case
 * @param {string} str
 * @returns {boolean}
 */
export function isPalindrome(str = '') {
  const input = toSafeString(str);
  if (!input) return false;

  const cleaned = input.replace(/[^\p{L}\p{N}]+/gu, '').toLocaleLowerCase();
  return cleaned === [...cleaned].reverse().join('');
}

/**
 * Generate a random string
 * @param {number} length
 * @param {Object} options
 * @param {boolean} [options.uppercase=true]
 * @param {boolean} [options.lowercase=true]
 * @param {boolean} [options.numbers=true]
 * @param {boolean} [options.symbols=false]
 * @returns {string}
 */
export function randomString(
  length = 8,
  {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = false,
  } = {}
) {
  if (!Number.isInteger(length) || length <= 0) return '';

  let chars = '';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!chars) {
    throw new Error('At least one character set must be enabled.');
  }

  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * chars.length);
    return chars.charAt(index);
  }).join('');
}

/**
 * Count words in a string
 * @param {string} str
 * @returns {number}
 */
export function wordCount(str = '') {
  const input = toSafeString(str).trim();
  if (!input) return 0;
  return input.split(/\s+/).length;
}

/**
 * Check if a string is empty or only whitespace
 * @param {string} str
 * @returns {boolean}
 */
export function isBlank(str = '') {
  return toSafeString(str).trim().length === 0;
}

/**
 * Repeat a string safely
 * @param {string} str
 * @param {number} count
 * @returns {string}
 */
export function repeatString(str = '', count = 1) {
  const input = toSafeString(str);
  if (!Number.isInteger(count) || count <= 0) return '';
  return input.repeat(count);
}
