/**
 * Calculator Utility Functions
 * Provides useful mathematical calculation functions
 */

/**
 * Calculate the sum of an array of numbers
 * @param {number[]} numbers - Array of numbers to sum
 * @returns {number} - Sum of all numbers
 */
export function sum(numbers) {
  return numbers.reduce((acc, num) => acc + num, 0);
}

/**
 * Calculate the average of an array of numbers
 * @param {number[]} numbers - Array of numbers
 * @returns {number} - Average of all numbers
 */
export function average(numbers) {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Calculate percentage
 * @param {number} value - The value
 * @param {number} total - The total
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} - Percentage value
 */
export function percentage(value, total, decimals = 2) {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Round a number to specified decimal places
 * @param {number} num - The number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} - Rounded number
 */
export function roundTo(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Calculate the factorial of a number
 * @param {number} n - The number
 * @returns {number} - Factorial of n
 */
export function factorial(n) {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Clamp a number between min and max
 * @param {number} num - The number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped number
 */
export function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

