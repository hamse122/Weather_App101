/**
 * Serialization Utility
 * Object serialization utilities for converting objects to various formats
 */

/**
 * Serialization class for serializing objects
 */
export class Serialization {
    /**
     * Serialize object to JSON string
     * @param {Object} obj - Object to serialize
     * @param {number} indent - JSON indentation
     * @returns {string} - JSON string
     */
    static toJSON(obj, indent = 2) {
        try {
            return JSON.stringify(obj, null, indent);
        } catch (error) {
            throw new Error(`Serialization failed: ${error.message}`);
        }
    }
    
    /**
     * Serialize object to query string
     * @param {Object} obj - Object to serialize
     * @returns {string} - Query string
     */
    static toQueryString(obj) {
        const params = new URLSearchParams();
        Object.entries(obj).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value !== null && value !== undefined) {
                params.append(key, value);
            }
        });
        return params.toString();
    }
    
    /**
     * Serialize object to form data
     * @param {Object} obj - Object to serialize
     * @returns {FormData} - FormData object
     */
    static toFormData(obj) {
        const formData = new FormData();
        Object.entries(obj).forEach(([key, value]) => {
            if (value instanceof File || value instanceof Blob) {
                formData.append(key, value);
            } else if (Array.isArray(value)) {
                value.forEach(v => formData.append(key, v));
            } else if (value !== null && value !== undefined) {
                formData.append(key, value);
            }
        });
        return formData;
    }
    
    /**
     * Serialize object with custom replacer
     * @param {Object} obj - Object to serialize
     * @param {Function} replacer - Replacer function
     * @returns {string} - Serialized string
     */
    static serializeWithReplacer(obj, replacer) {
        return JSON.stringify(obj, replacer);
    }
    
    /**
     * Deep clone object using serialization
     * @param {Object} obj - Object to clone
     * @returns {Object} - Cloned object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    /**
     * Serialize object to base64
     * @param {Object} obj - Object to serialize
     * @returns {string} - Base64 encoded string
     */
    static toBase64(obj) {
        const json = JSON.stringify(obj);
        return btoa(unescape(encodeURIComponent(json)));
    }
    
    /**
     * Serialize with circular reference handling
     * @param {Object} obj - Object to serialize
     * @returns {string} - Serialized string
     */
    static serializeCircular(obj) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            return value;
        });
    }
    
    /**
     * Serialize object with type information
     * @param {Object} obj - Object to serialize
     * @returns {string} - Serialized string with type info
     */
    static serializeWithTypes(obj) {
        return JSON.stringify(obj, (key, value) => {
            if (value === null) return { type: 'null', value: null };
            if (value instanceof Date) return { type: 'Date', value: value.toISOString() };
            if (value instanceof RegExp) return { type: 'RegExp', value: value.toString() };
            if (typeof value === 'function') return { type: 'Function', value: value.toString() };
            if (typeof value === 'undefined') return { type: 'undefined', value: null };
            return value;
        });
    }
}


