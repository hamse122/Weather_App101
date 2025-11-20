/**
 * =============================================
 *              ARRAY UTILITY FUNCTIONS
 *   Improved, optimized, and feature-rich
 * =============================================
 */

/**
 * Ensure input is a valid array
 */
function ensureArray(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError("Expected an array but received: " + typeof arr);
  }
}

/**
 * Remove duplicates from an array
 * @param {Array} arr
 * @returns {Array}
 */
export function removeDuplicates(arr) {
  ensureArray(arr);
  return [...new Set(arr)];
}

/**
 * Chunk an array into smaller groups
 * @param {Array} arr
 * @param {number} size
 * @returns {Array[]}
 */
export function chunkArray(arr, size) {
  ensureArray(arr);
  if (size <= 0) throw new Error("Chunk size must be greater than zero.");

  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get a random item from an array
 * @param {Array} arr
 * @returns {*}
 */
export function getRandomItem(arr) {
  ensureArray(arr);
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffleArray(arr) {
  ensureArray(arr);
  const result = [...arr];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Flatten a nested array to specified depth
 * @param {Array} arr
 * @param {number} depth
 * @returns {Array}
 */
export function flattenArray(arr, depth = Infinity) {
  ensureArray(arr);
  return arr.flat(depth);
}

/**
 * Remove falsy values (null, undefined, '', 0, false)
 * @param {Array} arr
 * @returns {Array}
 */
export function compactArray(arr) {
  ensureArray(arr);
  return arr.filter(Boolean);
}

/**
 * Get the difference between two arrays
 * @param {Array} arr1
 * @param {Array} arr2
 * @returns {Array}
 */
export function arrayDifference(arr1, arr2) {
  ensureArray(arr1);
  ensureArray(arr2);
  const set2 = new Set(arr2);
  return arr1.filter((item) => !set2.has(item));
}

/**
 * Get the intersection of two arrays
 * @param {Array} arr1
 * @param {Array} arr2
 * @returns {Array}
 */
export function arrayIntersection(arr1, arr2) {
  ensureArray(arr1);
  ensureArray(arr2);
  const set2 = new Set(arr2);
  return arr1.filter((item) => set2.has(item));
}

/**
 * Count occurrences of items in array
 * @param {Array} arr
 * @returns {Object} - Example: { apple: 2, orange: 1 }
 */
export function countOccurrences(arr) {
  ensureArray(arr);
  return arr.reduce((acc, cur) => {
    acc[cur] = (acc[cur] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Randomize N items from array (without replacement)
 * @param {Array} arr
 * @param {number} count
 * @returns {Array}
 */
export function sampleArray(arr, count = 1) {
  ensureArray(arr);
  if (count <= 0) return [];
  return shuffleArray(arr).slice(0, count);
}
