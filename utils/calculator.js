/**
 * Calculator Utility Functions
 * Provides useful mathematical calculation utilities with added safety,
 * error handling, optimizations, and additional advanced helpers.
 */

/* -------------------------------------------------------
   BASIC UTILITIES
-------------------------------------------------------- */

/**
 * Calculate the sum of an array of numbers
 */
export function sum(numbers) {
  if (!Array.isArray(numbers)) throw new Error("Input must be an array");
  return numbers.reduce((acc, num) => acc + Number(num || 0), 0);
}

/**
 * Calculate the average of an array of numbers
 */
export function average(numbers) {
  if (!Array.isArray(numbers)) return 0;
  return numbers.length === 0 ? 0 : sum(numbers) / numbers.length;
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
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

/**
 * Calculate the factorial of a number
 */
export function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Clamp a number between min and max
 */
export function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/* -------------------------------------------------------
   NEW FUNCTIONS (Upgraded + Additional Logic)
-------------------------------------------------------- */

/**
 * Get maximum number in an array
 */
export function max(numbers) {
  return numbers.length === 0 ? undefined : Math.max(...numbers);
}

/**
 * Get minimum number in an array
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
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  return Math.hypot(x2 - x1, y2 - y1);
}

/* -------------------------------------------------------
   🔥 EXTRA ADVANCED FUNCTIONS (NEW)
-------------------------------------------------------- */

/**
 * Standard deviation of a dataset
 */
export function standardDeviation(numbers) {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const variance = average(numbers.map(n => (n - avg) ** 2));
  return Math.sqrt(variance);
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + t * (end - start);
}

/**
 * Check if a number is prime
 */
export function isPrime(n) {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;

  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Convert degrees to radians
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}
