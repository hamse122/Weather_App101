/**
 * =============================================
 *        ADVANCED ARRAY UTILITY FUNCTIONS
 *  High-performance, immutable, feature-rich
 * =============================================
 */

const isArray = Array.isArray;

function ensureArray(arr) {
  if (!isArray(arr)) {
    throw new TypeError(`Expected an array but received: ${typeof arr}`);
  }
}

/* ---------------------------------- */
/* Core Utilities */
/* ---------------------------------- */

export function removeDuplicates(arr) {
  ensureArray(arr);
  return [...new Set(arr)];
}

export function uniqueBy(arr, keyFn) {
  ensureArray(arr);
  const seen = new Set();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chunkArray(arr, size) {
  ensureArray(arr);
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Chunk size must be a positive integer.");
  }

  const length = arr.length;
  if (!length) return [];

  const chunks = new Array(Math.ceil(length / size));
  for (let i = 0, j = 0; i < length; i += size, j++) {
    chunks[j] = arr.slice(i, i + size);
  }
  return chunks;
}

export function flattenArray(arr, depth = Infinity) {
  ensureArray(arr);
  if (depth === 0) return [...arr];
  return arr.flat ? arr.flat(depth) : _flattenPolyfill(arr, depth);
}

function _flattenPolyfill(arr, depth, result = []) {
  for (const item of arr) {
    if (isArray(item) && depth > 0) {
      _flattenPolyfill(item, depth - 1, result);
    } else {
      result.push(item);
    }
  }
  return result;
}

/* ---------------------------------- */
/* Random & Sampling */
/* ---------------------------------- */

export function getRandomItem(arr) {
  ensureArray(arr);
  const { length } = arr;
  return length ? arr[(Math.random() * length) | 0] : undefined;
}

export function sampleArray(arr, count = 1) {
  ensureArray(arr);
  if (count <= 0) return [];
  if (count >= arr.length) return shuffleArray(arr);

  const result = [];
  const used = new Set();

  while (result.length < count) {
    const idx = (Math.random() * arr.length) | 0;
    if (!used.has(idx)) {
      used.add(idx);
      result.push(arr[idx]);
    }
  }

  return result;
}

export function shuffleArray(arr) {
  ensureArray(arr);
  const result = arr.slice();

  for (let i = result.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/* ---------------------------------- */
/* Filtering & Cleaning */
/* ---------------------------------- */

export function compactArray(arr) {
  ensureArray(arr);
  return arr.filter(Boolean);
}

export function removeNullish(arr) {
  ensureArray(arr);
  return arr.filter(v => v !== null && v !== undefined);
}

/* ---------------------------------- */
/* Set Operations (Optimized) */
/* ---------------------------------- */

export function arrayDifference(arr1, arr2) {
  ensureArray(arr1);
  ensureArray(arr2);

  const set2 = new Set(arr2);
  return arr1.filter(item => !set2.has(item));
}

export function arrayIntersection(arr1, arr2) {
  ensureArray(arr1);
  ensureArray(arr2);

  const set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
}

export function arrayUnion(...arrays) {
  arrays.forEach(ensureArray);
  return [...new Set(arrays.flat())];
}

/* ---------------------------------- */
/* Advanced Analytics */
/* ---------------------------------- */

export function countOccurrences(arr) {
  ensureArray(arr);
  const map = new Map();

  for (const item of arr) {
    map.set(item, (map.get(item) || 0) + 1);
  }

  return Object.fromEntries(map);
}

export function groupBy(arr, keyFn) {
  ensureArray(arr);
  const result = {};

  for (const item of arr) {
    const key = keyFn(item);
    (result[key] ||= []).push(item);
  }

  return result;
}

export function sortBy(arr, keyFn, order = "asc") {
  ensureArray(arr);
  const multiplier = order === "desc" ? -1 : 1;

  return arr.slice().sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka > kb) return 1 * multiplier;
    if (ka < kb) return -1 * multiplier;
    return 0;
  });
}

/* ---------------------------------- */
/* Utility Helpers */
/* ---------------------------------- */

export function first(arr) {
  ensureArray(arr);
  return arr[0];
}

export function last(arr) {
  ensureArray(arr);
  return arr[arr.length - 1];
}

export function take(arr, n = 1) {
  ensureArray(arr);
  return arr.slice(0, Math.max(0, n));
}

export function drop(arr, n = 1) {
  ensureArray(arr);
  return arr.slice(Math.max(0, n));
}

export function partition(arr, predicate) {
  ensureArray(arr);
  const truthy = [];
  const falsy = [];

  for (const item of arr) {
    (predicate(item) ? truthy : falsy).push(item);
  }

  return [truthy, falsy];
}
