/**
 * Deserialization Utility
 * Object deserialization utilities for converting various formats to objects
 */

/**
 * Deserialization class for handling different deserialization formats
 */
export class Deserialization {
    /**
     * Deserialize JSON string to object
     * @param {string} json - JSON string
     * @returns {any} - Deserialized object
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
     * @returns {Record<string, any>} - Parsed object
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
     * Deserialize FormData into an object
     * @param {FormData} formData - FormData instance
     * @returns {Record<string, any>} - Parsed object
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
     * Deserialize JSON with a custom reviver
     * @param {string} json - JSON string
     * @param {Function} reviver - Reviver function
     * @returns {any} - Parsed object
     */
    static withReviver(json, reviver) {
        return JSON.parse(json, reviver);
    }

    /**
     * Deserialize base64 encoded JSON
     * @param {string} base64 - Base64 string
     * @returns {any} - Parsed object
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
     * Deserialize JSON string with type restoration metadata
     * @param {string} json - JSON string with type metadata
     * @returns {any} - Parsed object
     */
    static withTypeMetadata(json) {
        return JSON.parse(json, (key, value) => {
            if (value && typeof value === 'object' && value.type) {
                switch (value.type) {
                    case 'Date':
                        return new Date(value.value);
                    case 'RegExp': {
                        const match = value.value.match(/\/(.+)\/([gimy]*)/);
                        return new RegExp(match[1], match[2]);
                    }
                    case 'Map':
                        return new Map(value.value);
                    case 'Set':
                        return new Set(value.value);
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
     * Deserialize URL into its components
     * @param {string} url - URL string
     * @returns {{protocol: string, host: string, pathname: string, params: Record<string, any>, hash: string}}
     */
    static fromURL(url) {
        try {
            const parsed = new URL(url);
            return {
                protocol: parsed.protocol,
                host: parsed.host,
                pathname: parsed.pathname,
                params: this.fromQueryString(parsed.search.substring(1)),
                hash: parsed.hash
            };
        } catch (error) {
            throw new Error(`URL deserialization failed: ${error.message}`);
        }
    }

    /**
     * Safe deserialize JSON with fallback
     * @param {string} json - JSON string
     * @param {any} defaultValue - Fallback value
     * @returns {any} - Parsed object or default value
     */
    static safe(json, defaultValue = null) {
        try {
            return JSON.parse(json);
        } catch {
            return defaultValue;
        }
    }
}
