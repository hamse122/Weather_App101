/**
 * Advanced Deserialization Utility
 * Secure, extensible, Node & Browser compatible
 */

const isNode =
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node;

export class Deserialization {

    // ==========================
    // CORE JSON
    // ==========================

    static fromJSON(json, reviver) {
        if (typeof json !== "string") {
            throw new TypeError("JSON input must be a string");
        }

        try {
            return JSON.parse(json, reviver);
        } catch (err) {
            throw new Error(`JSON deserialization failed: ${err.message}`);
        }
    }

    static safe(json, fallback = null) {
        try {
            return this.fromJSON(json);
        } catch {
            return fallback;
        }
    }

    static isJSON(value) {
        if (typeof value !== "string") return false;
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    }

    // ==========================
    // TYPE COERCION
    // ==========================

    static coerce(value) {
        if (value === "true") return true;
        if (value === "false") return false;
        if (value === "null") return null;
        if (value === "undefined") return undefined;
        if (!isNaN(value) && value.trim() !== "") return Number(value);
        return value;
    }

    // ==========================
    // QUERY STRING
    // ==========================

    static fromQueryString(query) {
        const params = new URLSearchParams(query);
        const result = Object.create(null);

        for (const [key, raw] of params.entries()) {
            const value = this.coerce(raw);

            if (key in result) {
                result[key] = Array.isArray(result[key])
                    ? [...result[key], value]
                    : [result[key], value];
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    // ==========================
    // FORM DATA
    // ==========================

    static fromFormData(formData) {
        const result = Object.create(null);

        for (const [key, value] of formData.entries()) {
            const val = value instanceof File ? value : this.coerce(value);

            if (key in result) {
                result[key] = Array.isArray(result[key])
                    ? [...result[key], val]
                    : [result[key], val];
            } else {
                result[key] = val;
            }
        }

        return result;
    }

    // ==========================
    // BASE64 JSON
    // ==========================

    static fromBase64(base64) {
        try {
            const decoded = isNode
                ? Buffer.from(base64, "base64").toString("utf-8")
                : new TextDecoder().decode(
                      Uint8Array.from(atob(base64), c => c.charCodeAt(0))
                  );

            return JSON.parse(decoded);
        } catch (err) {
            throw new Error(`Base64 deserialization failed: ${err.message}`);
        }
    }

    // ==========================
    // TYPE METADATA
    // ==========================

    static withTypeMetadata(json) {
        return JSON.parse(json, (_, value) => {
            if (!value || typeof value !== "object") return value;

            switch (value.__type) {
                case "Date":
                    return new Date(value.value);

                case "RegExp":
                    return new RegExp(value.pattern, value.flags);

                case "Map":
                    return new Map(value.value);

                case "Set":
                    return new Set(value.value);

                default:
                    return value;
            }
        });
    }

    // ==========================
    // URL
    // ==========================

    static fromURL(input, base) {
        try {
            const url = base ? new URL(input, base) : new URL(input);

            return {
                protocol: url.protocol,
                origin: url.origin,
                host: url.host,
                pathname: url.pathname,
                query: this.fromQueryString(url.search.slice(1)),
                hash: url.hash.slice(1)
            };
        } catch (err) {
            throw new Error(`URL deserialization failed: ${err.message}`);
        }
    }

    // ==========================
    // YAML (NODE ONLY)
    // ==========================

    static fromYAML(text) {
        if (!isNode) {
            throw new Error("YAML parsing is only supported in Node.js");
        }

        try {
            const yaml = require("js-yaml");
            return yaml.load(text);
        } catch {
            throw new Error("YAML deserialization failed. Install 'js-yaml'.");
        }
    }

    // ==========================
    // SCHEMA VALIDATION (OPTIONAL)
    // ==========================

    static withSchema(json, validator) {
        const data = this.fromJSON(json);
        if (!validator(data)) {
            throw new Error("Schema validation failed");
        }
        return data;
    }
}
