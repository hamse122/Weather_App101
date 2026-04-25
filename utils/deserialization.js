/**
 * Advanced Deserialization Utility (v2)
 * Secure, extensible, async-ready
 */

const isNode =
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node;

export class Deserialization {

    // ==========================
    // CORE JSON
    // ==========================

    static fromJSON(json, { reviver, freeze = false } = {}) {
        if (typeof json !== "string") {
            throw new TypeError("JSON input must be a string");
        }

        try {
            const parsed = JSON.parse(json, reviver);
            return freeze ? this.deepFreeze(parsed) : parsed;
        } catch (err) {
            throw new Error(`JSON deserialization failed: ${err.message}`);
        }
    }

    static async fromJSONAsync(json, options) {
        return this.fromJSON(json, options);
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
    // TYPE COERCION (DEEP)
    // ==========================

    static coerce(value) {
        if (typeof value !== "string") return value;

        const v = value.trim();

        if (v === "true") return true;
        if (v === "false") return false;
        if (v === "null") return null;
        if (v === "undefined") return undefined;
        if (!isNaN(v) && v !== "") return Number(v);

        return value;
    }

    static deepCoerce(obj) {
        if (Array.isArray(obj)) {
            return obj.map(v => this.deepCoerce(v));
        }

        if (obj && typeof obj === "object") {
            const result = Object.create(null);
            for (const key in obj) {
                result[key] = this.deepCoerce(obj[key]);
            }
            return result;
        }

        return this.coerce(obj);
    }

    // ==========================
    // QUERY STRING
    // ==========================

    static fromQueryString(query, { deep = false } = {}) {
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

        return deep ? this.deepCoerce(result) : result;
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
    // BASE64 JSON (URL SAFE)
    // ==========================

    static fromBase64(base64) {
        try {
            const normalized = base64
                .replace(/-/g, "+")
                .replace(/_/g, "/");

            const decoded = isNode
                ? Buffer.from(normalized, "base64").toString("utf-8")
                : new TextDecoder().decode(
                      Uint8Array.from(atob(normalized), c => c.charCodeAt(0))
                  );

            return JSON.parse(decoded);
        } catch (err) {
            throw new Error(`Base64 deserialization failed: ${err.message}`);
        }
    }

    // ==========================
    // TYPE METADATA (EXTENSIBLE)
    // ==========================

    static transformers = {
        Date: v => new Date(v.value),
        RegExp: v => new RegExp(v.pattern, v.flags),
        Map: v => new Map(v.value),
        Set: v => new Set(v.value),
    };

    static registerType(type, handler) {
        this.transformers[type] = handler;
    }

    static withTypeMetadata(json) {
        return JSON.parse(json, (_, value) => {
            if (!value || typeof value !== "object") return value;

            if (value.__type && this.transformers[value.__type]) {
                return this.transformers[value.__type](value);
            }

            return value;
        });
    }

    // ==========================
    // URL
    // ==========================

    static fromURL(input, base) {
        try {
            const url = base ? new URL(input, base) : new URL(input);

            return Object.freeze({
                protocol: url.protocol,
                origin: url.origin,
                host: url.host,
                pathname: url.pathname,
                query: this.fromQueryString(url.search.slice(1)),
                hash: url.hash.slice(1)
            });
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
        } catch (err) {
            throw new Error(`YAML deserialization failed: ${err.message}`);
        }
    }

    // ==========================
    // SCHEMA VALIDATION (SYNC + ASYNC)
    // ==========================

    static async withSchema(json, validator) {
        const data = this.fromJSON(json);

        const valid = validator.constructor.name === "AsyncFunction"
            ? await validator(data)
            : validator(data);

        if (!valid) {
            throw new Error("Schema validation failed");
        }

        return data;
    }

    // ==========================
    // SECURITY
    // ==========================

    static sanitize(obj) {
        if (!obj || typeof obj !== "object") return obj;

        const clean = Object.create(null);

        for (const key in obj) {
            if (key === "__proto__" || key === "constructor") continue;
            clean[key] = this.sanitize(obj[key]);
        }

        return clean;
    }

    // ==========================
    // UTIL
    // ==========================

    static deepFreeze(obj) {
        if (obj && typeof obj === "object") {
            Object.freeze(obj);
            for (const key in obj) {
                this.deepFreeze(obj[key]);
            }
        }
        return obj;
    }
}
