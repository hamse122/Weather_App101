/**
 * API Service Utilities
 * Provides useful functions for API requests and data handling
 */

/**
 * Make a GET request
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function get(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('GET request failed:', error);
    throw error;
  }
}

/**
 * Make a POST request
 * @param {string} url - The URL to post to
 * @param {Object} data - Data to send
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function post(url, data, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('POST request failed:', error);
    throw error;
  }
}

/**
 * Make a PUT request
 * @param {string} url - The URL to put to
 * @param {Object} data - Data to send
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function put(url, data, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('PUT request failed:', error);
    throw error;
  }
}

/**
 * Make a DELETE request
 * @param {string} url - The URL to delete
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function del(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('DELETE request failed:', error);
    throw error;
  }
}

