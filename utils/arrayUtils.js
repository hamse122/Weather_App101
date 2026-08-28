/**
 * =============================================
 *        ADVANCED ARRAY UTILITY FUNCTIONS
 *  High-performance, immutable, feature-rich
 * =============================================
 */

const isArray = Array.isArray;

function getType(value) {
  if (value === null) return "null";
  if (isArray(value)) return "array";

  const type = typeof value;

  if (type === "object") {
    return value?.constructor?.name || "object";
  }

  return type;
}

function ensureArray(arr, name = "value") {
  if (!isArray(arr)) {
    throw new TypeError(
      `${name} must be an array. Received: ${getType(arr)}`
    );
  }

  return arr;
}

function ensureFunction(fn, name = "callback") {
  if (typeof fn !== "function") {
    throw new TypeError(
      `${name} must be a function. Received: ${getType(fn)}`
    );
  }

  return fn;
}

function ensureNonEmptyArray(arr, name = "array") {
  ensureArray(arr, name);

  if (arr.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }

  return arr;
}

function ensureIndex(index, length, name = "index") {
  if (!Number.isInteger(index)) {
    throw new TypeError(`${name} must be an integer`);
  }

  if (index < 0 || index >= length) {
    throw new RangeError(
      `${name} must be between 0 and ${Math.max(0, length - 1)}. Received: ${index}`
    );
  }

  return index;
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
  ensureFunction(keyFn, "keyFn");

  const seen = new Set();
  const result = [];

  for (const item of arr) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

export function chunkArray(arr, size) {
  ensureArray(arr);

  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError("Chunk size must be a positive integer.");
  }

  const chunks = new Array(Math.ceil(arr.length / size));

  for (let i = 0; i < arr.length; i += size) {
    chunks[i / size] = arr.slice(i, i + size);
  }

  return chunks;
}

export function flattenArray(arr, depth = Infinity) {
  ensureArray(arr);

  if (depth !== Infinity && (!Number.isInteger(depth) || depth < 0)) {
    throw new RangeError("Depth must be a non-negative integer or Infinity.");
  }

  if (depth === 0) return [...arr];

  return typeof arr.flat === "function"
    ? arr.flat(depth)
    : _flattenPolyfill(arr, depth);
}

function _flattenPolyfill(arr, depth, result = []) {
  for (const item of arr) {
    if (isArray(item) && depth > 0) {
      _flattenPolyfill(item, depth === Infinity ? Infinity : depth - 1, result);
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
  return arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : undefined;
}

export function sampleArray(arr, count = 1) {
  ensureArray(arr);

  if (!Number.isInteger(count)) {
    throw new TypeError("Sample count must be an integer.");
  }

  if (count <= 0 || arr.length === 0) return [];
  if (count >= arr.length) return shuffleArray(arr);

  const result = arr.slice();
  const selected = [];

  for (let i = 0; i < count; i++) {
    const index = i + Math.floor(Math.random() * (result.length - i));
    [result[i], result[index]] = [result[index], result[i]];
    selected.push(result[i]);
  }

  return selected;
}

export function shuffleArray(arr) {
  ensureArray(arr);

  const result = [...arr];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
  return arr.filter(value => value != null);
}

/* ---------------------------------- */
/* Set Operations */
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

  const result = [];
  const seen = new Set();

  for (const arr of arrays) {
    for (const item of arr) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }

  return result;
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

  return map;
}

export function groupBy(arr, keyFn) {
  ensureArray(arr);
  ensureFunction(keyFn, "keyFn");

  const result = Object.create(null);

  for (const item of arr) {
    const key = String(keyFn(item));
    (result[key] ||= []).push(item);
  }

  return result;
}

export function sortBy(arr, keyFn, order = "asc") {
  ensureArray(arr);
  ensureFunction(keyFn, "keyFn");

  if (order !== "asc" && order !== "desc") {
    throw new Error('Order must be "asc" or "desc".');
  }

  const multiplier = order === "desc" ? -1 : 1;

  return arr
    .map((value, index) => ({
      value,
      key: keyFn(value),
      index
    }))
    .sort((a, b) => {
      if (a.key > b.key) return multiplier;
      if (a.key < b.key) return -multiplier;
      return a.index - b.index;
    })
    .map(item => item.value);
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

  if (!Number.isInteger(n)) {
    throw new TypeError("Count must be an integer.");
  }

  return n <= 0 ? [] : arr.slice(0, n);
}

export function drop(arr, n = 1) {
  ensureArray(arr);

  if (!Number.isInteger(n)) {
    throw new TypeError("Count must be an integer.");
  }

  return n <= 0 ? [...arr] : arr.slice(n);
}

export function partition(arr, predicate) {
  ensureArray(arr);
  ensureFunction(predicate, "predicate");

  const truthy = [];
  const falsy = [];

  for (const item of arr) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }

  return [truthy, falsy];
}
