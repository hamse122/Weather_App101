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
   STATISTICS & GEOMETRY UTILITIES
   Upgraded + Safe + Production Ready
-------------------------------------------------------- */

/**
 * Validate numeric input
 */
function assertNumbers(numbers) {
  if (numbers == null || typeof numbers[Symbol.iterator] !== "function") {
    throw new TypeError("Expected an iterable of numbers");
  }

  const values = Array.from(numbers);

  if (!values.every(Number.isFinite)) {
    throw new TypeError("All values must be finite numbers");
  }

  return values;
}

/**
 * Get maximum number in an array
 */
export function max(numbers) {
  const values = assertNumbers(numbers);
  return values.length ? Math.max(...values) : undefined;
}

/**
 * Get minimum number in an array
 */
export function min(numbers) {
  const values = assertNumbers(numbers);
  return values.length ? Math.min(...values) : undefined;
}

/**
 * Calculate the median of an array of numbers
 */
export function median(numbers) {
  const values = assertNumbers(numbers);

  if (values.length === 0) return undefined;

  values.sort((a, b) => a - b);

  const middle = Math.floor(values.length / 2);

  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

/**
 * Generate a cryptographically stronger random integer
 * between min and max (inclusive).
 */
export function randomInt(minValue, maxValue) {
  if (!Number.isSafeInteger(minValue) || !Number.isSafeInteger(maxValue)) {
    throw new TypeError("Bounds must be safe integers");
  }

  if (minValue > maxValue) {
    throw new RangeError("minValue cannot be greater than maxValue");
  }

  const range = maxValue - minValue + 1;

  if (range > 0xffffffff) {
    throw new RangeError("Range is too large");
  }

  if (
    typeof globalThis.crypto?.getRandomValues === "function"
  ) {
    const maxUint = 0xffffffff;
    const limit = Math.floor((maxUint + 1) / range) * range;

    const buffer = new Uint32Array(1);

    do {
      globalThis.crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);

    return minValue + (buffer[0] % range);
  }

  return Math.floor(Math.random() * range) + minValue;
}

/**
 * Calculate Euclidean distance between two 2D points.
 */
export function distance(x1, y1, x2, y2) {
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    throw new TypeError("Coordinates must be finite numbers");
  }

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
