/**
 * Deserialization Utility
 * Object deserialization utilities for converting various formats to objects
 */

/**
 * Deserialization class for deserializing objects
 */
export class Deserialization {
    /**
     * Deserialize JSON string to object
     * @param {string} json - JSON string
     * @returns {Object} - Deserialized object
     */
    static fromJSON(json) {
        try {
            return JSON.parse(json);
        } catch (error) {
            throw new Error(`Deserialization failed: ${error.message}`);
        }
    }
    
    /**
     * Deserialize query string to object
     * @param {string} queryString - Query string
     * @returns {Object} - Deserialized object
     */
    static fromQueryString(queryString) {
        const params = new URLSearchParams(queryString);
        const obj = {};
        
        for (const [key, value] of params.entries()) {
            if (obj[key]) {
                if (Array.isArray(obj[key])) {
                    obj[key].push(value);
                } else {
                    obj[key] = [obj[key], value];
                }
            } else {
                obj[key] = value;
            }
        }
        
        return obj;
    }
    
    /**
     * Deserialize form data to object
     * @param {FormData} formData - FormData object
     * @returns {Object} - Deserialized object
     */
    static fromFormData(formData) {
        const obj = {};
        for (const [key, value] of formData.entries()) {
            if (obj[key]) {
                if (Array.isArray(obj[key])) {
                    obj[key].push(value);
                } else {
                    obj[key] = [obj[key], value];
                }
            } else {
                obj[key] = value;
            }
        }
        return obj;
    }
    
    /**
     * Deserialize with custom reviver
     * @param {string} json - JSON string
     * @param {Function} reviver - Reviver function
     * @returns {Object} - Deserialized object
     */
    static deserializeWithReviver(json, reviver) {
        return JSON.parse(json, reviver);
    }
    
    /**
     * Deserialize from base64
     * @param {string} base64 - Base64 encoded string
     * @returns {Object} - Deserialized object
     */
    static fromBase64(base64) {
        try {
            const json = decodeURIComponent(escape(atob(base64)));
            return JSON.parse(json);
        } catch (error) {
            throw new Error(`Base64 deserialization failed: ${error.message}`);
        }
    }
    
    /**
     * Deserialize with type restoration
     * @param {string} json - JSON string with type information
     * @returns {Object} - Deserialized object with restored types
     */
    static deserializeWithTypes(json) {
        return JSON.parse(json, (key, value) => {
            if (value && typeof value === 'object' && value.type) {
                switch (value.type) {
                    case 'Date':
                        return new Date(value.value);
                    case 'RegExp':
                        const match = value.value.match(/\/(.+)\/([gimy]*)?/);
                        return new RegExp(match[1], match[2]);
                    case 'Function':
                        return new Function('return ' + value.value)();
                    case 'null':
                        return null;
                    case 'undefined':
                        return undefined;
                    default:
                        return value.value;
                }
            }
            return value;
        });
    }
    
    /**
     * Deserialize URL to object
     * @param {string} url - URL string
     * @returns {Object} - Deserialized URL components
     */
    static fromURL(url) {
        try {
            const urlObj = new URL(url);
            return {
                protocol: urlObj.protocol,
                host: urlObj.host,
                hostname: urlObj.hostname,
                port: urlObj.port,
                pathname: urlObj.pathname,
                search: urlObj.search,
                hash: urlObj.hash,
                params: this.fromQueryString(urlObj.search.substring(1))
            };
        } catch (error) {
            throw new Error(`URL deserialization failed: ${error.message}`);
        }
    }
    
    /**
     * Safe deserialize with error handling
     * @param {string} data - Data to deserialize
     * @param {*} defaultValue - Default value if deserialization fails
     * @returns {*} - Deserialized object or default value
     */
    static safeDeserialize(data, defaultValue = null) {
        try {
            return this.fromJSON(data);
        } catch {
            return defaultValue;
        }
    }
}


