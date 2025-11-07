/**
 * String Helper Functions
 * Provides useful string manipulation and utility functions
 */

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} - Capitalized string
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to camelCase
 * @param {string} str - The string to convert
 * @returns {string} - camelCase string
 */
export function toCamelCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

/**
 * Convert a string to kebab-case
 * @param {string} str - The string to convert
 * @returns {string} - kebab-case string
 */
export function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Truncate a string to a specified length
 * @param {string} str - The string to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} - Truncated string
 */
export function truncate(str, length, suffix = '...') {
  if (str.length <= length) return str;
  return str.slice(0, length) + suffix;
}

/**
 * Remove all whitespace from a string
 * @param {string} str - The string to process
 * @returns {string} - String without whitespace
 */
export function removeWhitespace(str) {
  return str.replace(/\s+/g, '');
}

/**
 * Reverse a string
 * @param {string} str - The string to reverse
 * @returns {string} - Reversed string
 */
export function reverseString(str) {
  return str.split('').reverse().join('');
}

