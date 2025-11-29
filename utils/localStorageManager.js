/**
 * LocalStorage Manager (Advanced)
 * Safe, structured, and feature-rich wrapper for localStorage
 */

const STORAGE_PREFIX = "app_";  // Namespace prefix

/**
 * Build namespaced key
 * @param {string} key
 */
function buildKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

/**
 * Set item with optional TTL (in milliseconds)
 * @param {string} key
 * @param {*} value
 * @param {number|null} ttl - Time to live (ms)
 */
export function setItem(key, value, ttl = null) {
  try {
    const data = {
      value,
      expiresAt: ttl ? Date.now() + ttl : null
    };

    localStorage.setItem(buildKey(key), JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
    return false;
  }
}

/**
 * Get item with TTL auto-expire support
 * @param {string} key
 * @param {*} defaultValue
 */
export function getItem(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(buildKey(key));
    if (!raw) return defaultValue;

    const parsed = JSON.parse(raw);

    // Check TTL expiration
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      removeItem(key);
      return defaultValue;
    }

    return parsed.value;
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Remove an item
 * @param {string} key
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(buildKey(key));
    return true;
  } catch (error) {
    console.error(`Error removing item ${key}:`, error);
    return false;
  }
}

/**
 * Clear all keys under this namespace only
 */
export function clear() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error("Error clearing localStorage:", error);
    return false;
  }
}

/**
 * Check if a key exists
 * @param {string} key
 */
export function hasKey(key) {
  return localStorage.getItem(buildKey(key)) !== null;
}

/**
 * Get all namespaced keys
 */
export function getAllKeys() {
  try {
    return Object.keys(localStorage).filter((key) =>
      key.startsWith(STORAGE_PREFIX)
    );
  } catch (error) {
    console.error("Error getting all keys:", error);
    return [];
  }
}

/**
 * Get estimated storage usage (bytes)
 */
export function getStorageSize() {
  try {
    let total = 0;
    for (let key in localStorage) {
      const value = localStorage.getItem(key);
      total += key.length + (value ? value.length : 0);
    }
    return total;
  } catch (error) {
    console.error("Error calculating storage size:", error);
    return 0;
  }
}

/**
 * Export all stored data as object
 */
export function exportData() {
  const result = {};
  getAllKeys().forEach((key) => {
    const pureKey = key.replace(STORAGE_PREFIX, "");
    result[pureKey] = getItem(pureKey);
  });
  return result;
}

/**
 * Import data object (bulk insert)
 * @param {Object} obj
 */
export function importData(obj) {
  try {
    Object.entries(obj).forEach(([key, value]) => {
      setItem(key, value);
    });
    return true;
  } catch (error) {
    console.error("Error importing data:", error);
    return false;
  }
}
