/**
 * Deserialization Utility
 * Enhanced version with safer parsing, better type handling,
 * Node.js compatibility, and extended features.
 */

export class Deserialization {

    // --------------------------
    // JSON PARSING
    // --------------------------

    /**
     * Deserialize JSON string to object
     */
    static fromJSON(json) {
        try {
            return JSON.parse(json);
        } catch (error) {
            throw new Error(`JSON deserialization failed: ${error.message}`);
        }
    }

    /**
     * Safe JSON parse with fallback value
     */
    static safe(json, defaultValue = null) {
        try {
            return JSON.parse(json);
        } catch {
            return defaultValue;
        }
    }

    /**
     * Check whether text is valid JSON
     */
    static isJSON(text) {
        try {
            JSON.parse(text);
            return true;
        } catch {
            return false;
        }
    }

    // --------------------------
    // QUERY STRING PARSING
    // --------------------------

    /**
     * Deserialize query string to object
     */
    static fromQueryString(queryString) {
        const params = new URLSearchParams(queryString);
        const obj = {};

        for (const [key, value] of params.entries()) {
            if (obj[key]) {
                obj[key] = Array.isArray(obj[key]) ? [...obj[key], value] : [obj[key], value];
            } else {
                obj[key] = value;
            }
        }

        return obj;
    }

    // --------------------------
    // FORMDATA PARSING
    // --------------------------

    /**
     * Deserialize FormData into a JS object
     * Supports files, arrays, and repeated keys
     */
    static fromFormData(formData) {
        const obj = {};

        for (const [key, value] of formData.entries()) {
            if (obj[key]) {
                obj[key] = Array.isArray(obj[key]) ? [...obj[key], value] : [obj[key], value];
            } else {
                obj[key] = value instanceof File ? value : value;
            }
        }

        return obj;
    }

    // --------------------------
    // JSON with REVIVER
    // --------------------------

    /**
     * Deserialize JSON with a custom reviver
     */
    static withReviver(json, reviver) {
        try {
            return JSON.parse(json, reviver);
        } catch (error) {
            throw new Error(`Reviver deserialization failed: ${error.message}`);
        }
    }

    // --------------------------
    // BASE64 PARSING
    // --------------------------

    /**
     * Base64 decode JSON with browser + Node support
     */
    static fromBase64(base64) {
        try {
            const decoded = (typeof atob === "function")
                ? decodeURIComponent(escape(atob(base64)))
                : Buffer.from(base64, "base64").toString("utf-8");

            return JSON.parse(decoded);
        } catch (error) {
            throw new Error(`Base64 deserialization failed: ${error.message}`);
        }
    }

    // --------------------------
    // TYPE META RESTORATION
    // --------------------------

    /**
     * Restore objects from JSON with type metadata
     */
    static withTypeMetadata(json) {
        return JSON.parse(json, (key, value) => {
            if (value && typeof value === "object" && value.__type) {
                switch (value.__type) {
                    case "Date":
                        return new Date(value.value);

                    case "RegExp":
                        return new RegExp(value.pattern, value.flags);

                    case "Map":
                        return new Map(value.value);

                    case "Set":
                        return new Set(value.value);

                    case "Undefined":
                        return undefined;

                    default:
                        return value.value;
                }
            }
            return value;
        });
    }

    // --------------------------
    // URL PARSING
    // --------------------------

    /**
     * Deserialize URL into structured components
     */
    static fromURL(url) {
        try {
            const parsed = new URL(url);

            return {
                protocol: parsed.protocol,
                host: parsed.host,
                pathname: parsed.pathname,
                params: this.fromQueryString(parsed.search.slice(1)),
                hash: parsed.hash.replace("#", "")
            };
        } catch (error) {
            throw new Error(`URL deserialization failed: ${error.message}`);
        }
    }

    // --------------------------
    // OPTIONAL: YAML PARSING
    // --------------------------

    /**
     * Deserialize YAML into JS object (requires js-yaml)
     */
    static fromYAML(yamlText) {
        try {
            const yaml = require("js-yaml"); // safe load in Node
            return yaml.load(yamlText);
        } catch (err) {
            throw new Error("YAML deserialization failed. Install 'js-yaml' to use this feature.");
        }
    }
}
