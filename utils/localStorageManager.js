/**
 * LocalStorage Manager
 * Provides a safe and convenient interface for localStorage operations
 */

/**
 * Get an item from localStorage with automatic JSON parsing
 * @param {string} key - The key to retrieve
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} - The stored value or defaultValue
 */
export function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Set an item in localStorage with automatic JSON stringification
 * @param {string} key - The key to set
 * @param {*} value - The value to store
 * @returns {boolean} - True if successful, false otherwise
 */
export function setItem(key, value) {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringValue);
    return true;
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
    return false;
  }
}

/**
 * Remove an item from localStorage
 * @param {string} key - The key to remove
 * @returns {boolean} - True if successful, false otherwise
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing item ${key}:`, error);
    return false;
  }
}

/**
 * Clear all items from localStorage
 * @returns {boolean} - True if successful, false otherwise
 */
export function clear() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
}

/**
 * Get all keys from localStorage
 * @returns {string[]} - Array of all keys
 */
export function getAllKeys() {
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.error('Error getting all keys:', error);
    return [];
  }
}

