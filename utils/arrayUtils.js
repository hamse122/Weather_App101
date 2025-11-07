/**
 * Array Utility Functions
 * Provides useful array manipulation and helper functions
 */

/**
 * Remove duplicates from an array
 * @param {Array} arr - The array to remove duplicates from
 * @returns {Array} - New array with unique values
 */
export function removeDuplicates(arr) {
  return [...new Set(arr)];
}

/**
 * Chunk an array into smaller arrays of specified size
 * @param {Array} arr - The array to chunk
 * @param {number} size - The size of each chunk
 * @returns {Array} - Array of chunks
 */
export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get a random item from an array
 * @param {Array} arr - The array to get a random item from
 * @returns {*} - A random item from the array
 */
export function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle an array (Fisher-Yates algorithm)
 * @param {Array} arr - The array to shuffle
 * @returns {Array} - New shuffled array
 */
export function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Flatten a nested array
 * @param {Array} arr - The array to flatten
 * @param {number} depth - The depth to flatten to
 * @returns {Array} - Flattened array
 */
export function flattenArray(arr, depth = Infinity) {
  return arr.flat(depth);
}

