/**
 * Calculator Utility Functions
 * Provides useful mathematical calculation functions
 */

/**
 * Calculate the sum of an array of numbers
 */
export function sum(numbers) {
  return numbers.reduce((acc, num) => acc + num, 0);
}

/**
 * Calculate the average of an array of numbers
 */
export function average(numbers) {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Calculate percentage
 */
export function percentage(value, total, decimals = 2) {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Round a number to specified decimal places
 */
export function roundTo(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Calculate the factorial of a number
 */
export function factorial(n) {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Clamp a number between min and max
 */
export function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/* -------------------------------------------------------
   NEW FUNCTIONS (Added 1–5 extra utility lines as requested)
-------------------------------------------------------- */

/**
 * Get the maximum number in an array
 */
export function max(numbers) {
  return numbers.length === 0 ? undefined : Math.max(...numbers);
}

/**
 * Get the minimum number in an array
 */
export function min(numbers) {
  return numbers.length === 0 ? undefined : Math.min(...numbers);
}

/**
 * Calculate the median of an array of numbers
 */
export function median(numbers) {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate distance between two points
 */
export function distance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
