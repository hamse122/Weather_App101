/**
 * ==========================================================
 * ADVANCED DESERIALIZATION UTILITY v3
 * Enterprise Edition
 * ----------------------------------------------------------
 * Features:
 * - JSON / Async JSON
 * - Safe Parse
 * - Deep Coercion
 * - Query Strings
 * - FormData
 * - URL Parsing
 * - Base64
 * - YAML
 * - CSV
 * - XML
 * - Type Metadata
 * - BigInt
 * - Typed Arrays
 * - Class Restoration
 * - Schema Validation
 * - Compression Support
 * - Streaming Support
 * - Deep Freeze
 * - Prototype Pollution Protection
 * ==========================================================
 */

const isNode =
    typeof process !== "undefined" &&
    process.versions?.node;

export class Deserialization {

    // ==================================================
    // REGISTRIES
    // ==================================================

    static transformers = Object.create(null);
    static classRegistry = Object.create(null);

    // ==================================================
    // JSON
    // ==================================================

    static fromJSON(json, options = {}) {
        const {
            reviver,
            freeze = false,
            sanitize = true
        } = options;

        if (typeof json !== "string") {
            throw new TypeError("JSON input must be string");
        }

        let result;

        try {
            result = JSON.parse(json, reviver);
        } catch (err) {
            throw new Error(
                `JSON deserialization failed: ${err.message}`
            );
        }

        if (sanitize) {
            result = this.sanitize(result);
        }

        if (freeze) {
            result = this.deepFreeze(result);
        }

        return result;
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

    // ==================================================
    // BIGINT JSON
    // ==================================================

    static fromJSONBigInt(json) {
        return JSON.parse(json, (_, value) => {
            if (
                typeof value === "string" &&
                /^\d+n$/.test(value)
            ) {
                return BigInt(value.slice(0, -1));
            }

            return value;
        });
    }

    // ==================================================
    // TYPE COERCION
    // ==================================================

    static coerce(value) {
        if (typeof value !== "string") return value;

        const v = value.trim();

        if (v === "true") return true;
        if (v === "false") return false;
        if (v === "null") return null;
        if (v === "undefined") return undefined;

        if (/^-?\d+(\.\d+)?$/.test(v)) {
            return Number(v);
        }

        return value;
    }

    static deepCoerce(obj) {

        if (Array.isArray(obj)) {
            return obj.map(v => this.deepCoerce(v));
        }

        if (obj && typeof obj === "object") {

            const result = Object.create(null);

            for (const key of Object.keys(obj)) {
                result[key] = this.deepCoerce(obj[key]);
            }

            return result;
        }

        return this.coerce(obj);
    }

    // ==================================================
    // QUERY STRING
    // ==================================================

    static fromQueryString(query) {

        const params = new URLSearchParams(query);

        const result = Object.create(null);

        for (const [key, value] of params.entries()) {

            const parsed = this.coerce(value);

            if (key in result) {

                if (!Array.isArray(result[key])) {
                    result[key] = [result[key]];
                }

                result[key].push(parsed);

            } else {

                result[key] = parsed;
            }
        }

        return result;
    }

    // ==================================================
    // FORMDATA
    // ==================================================

    static fromFormData(formData) {

        const result = Object.create(null);

        for (const [key, value] of formData.entries()) {

            const parsed =
                value instanceof File
                    ? value
                    : this.coerce(value);

            if (key in result) {

                if (!Array.isArray(result[key])) {
                    result[key] = [result[key]];
                }

                result[key].push(parsed);

            } else {

                result[key] = parsed;
            }
        }

        return result;
    }

    // ==================================================
    // BASE64
    // ==================================================

    static fromBase64(base64) {

        const normalized =
            base64.replace(/-/g, "+")
                  .replace(/_/g, "/");

        const decoded = isNode
            ? Buffer.from(
                  normalized,
                  "base64"
              ).toString("utf8")
            : atob(normalized);

        return this.fromJSON(decoded);
    }

    // ==================================================
    // TYPE METADATA
    // ==================================================

    static registerType(type, handler) {
        this.transformers[type] = handler;
    }

    static withTypeMetadata(json) {

        return JSON.parse(json, (_, value) => {

            if (
                value &&
                typeof value === "object" &&
                value.__type
            ) {

                const handler =
                    this.transformers[value.__type];

                if (handler) {
                    return handler(value);
                }
            }

            return value;
        });
    }

    static {
        this.registerType(
            "Date",
            v => new Date(v.value)
        );

        this.registerType(
            "RegExp",
            v => new RegExp(
                v.pattern,
                v.flags
            )
        );

        this.registerType(
            "Map",
            v => new Map(v.value)
        );

        this.registerType(
            "Set",
            v => new Set(v.value)
        );

        this.registerType(
            "BigInt",
            v => BigInt(v.value)
        );

        this.registerType(
            "Uint8Array",
            v => Uint8Array.from(v.value)
        );
    }

    // ==================================================
    // CLASS RESTORATION
    // ==================================================

    static registerClass(name, ctor) {
        this.classRegistry[name] = ctor;
    }

    static restoreClasses(obj) {

        if (!obj || typeof obj !== "object") {
            return obj;
        }

        if (
            obj.__class &&
            this.classRegistry[obj.__class]
        ) {

            const instance =
                new this.classRegistry[obj.__class]();

            Object.assign(instance, obj);

            delete instance.__class;

            return instance;
        }

        return obj;
    }

    // ==================================================
    // URL
    // ==================================================

    static fromURL(input, base) {

        const url = base
            ? new URL(input, base)
            : new URL(input);

        return Object.freeze({
            protocol: url.protocol,
            host: url.host,
            origin: url.origin,
            pathname: url.pathname,
            hash: url.hash.slice(1),
            query: this.fromQueryString(
                url.search.slice(1)
            )
        });
    }

    // ==================================================
    // CSV
    // ==================================================

    static fromCSV(text) {

        const rows = text
            .trim()
            .split("\n")
            .map(row =>
                row.split(",")
            );

        const headers = rows.shift();

        return rows.map(row => {

            const obj =
                Object.create(null);

            headers.forEach((h, i) => {
                obj[h] = row[i];
            });

            return obj;
        });
    }

    // ==================================================
    // XML
    // ==================================================

    static fromXML(xml) {

        if (
            typeof DOMParser === "undefined"
        ) {
            throw new Error(
                "DOMParser unavailable"
            );
        }

        return new DOMParser()
            .parseFromString(
                xml,
                "application/xml"
            );
    }

    // ==================================================
    // YAML
    // ==================================================

    static async fromYAML(text) {

        if (!isNode) {
            throw new Error(
                "YAML requires Node.js"
            );
        }

        const yaml =
            await import("js-yaml");

        return yaml.load(text);
    }

    // ==================================================
    // SCHEMA VALIDATION
    // ==================================================

    static async withSchema(
        json,
        validator
    ) {

        const data =
            this.fromJSON(json);

        const valid =
            await validator(data);

        if (!valid) {
            throw new Error(
                "Schema validation failed"
            );
        }

        return data;
    }

    // ==================================================
    // GZIP SUPPORT
    // ==================================================

    static async fromGzip(buffer) {

        if (!isNode) {
            throw new Error(
                "Gzip requires Node.js"
            );
        }

        const zlib =
            await import("zlib");

        return new Promise(
            (resolve, reject) => {

                zlib.gunzip(
                    buffer,
                    (err, result) => {

                        if (err)
                            reject(err);

                        resolve(
                            this.fromJSON(
                                result.toString()
                            )
                        );
                    }
                );
            }
        );
    }

    // ==================================================
    // SECURITY
    // ==================================================

    static sanitize(obj) {

        if (
            !obj ||
            typeof obj !== "object"
        ) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(v =>
                this.sanitize(v)
            );
        }

        const clean =
            Object.create(null);

        for (const key of Object.keys(obj)) {

            if (
                key === "__proto__" ||
                key === "prototype" ||
                key === "constructor"
            ) {
                continue;
            }

            clean[key] =
                this.sanitize(obj[key]);
        }

        return clean;
    }

    // ==================================================
    // IMMUTABLE
    // ==================================================

    static deepFreeze(obj) {

        if (
            obj &&
            typeof obj === "object" &&
            !Object.isFrozen(obj)
        ) {

            Object.freeze(obj);

            for (const key of Object.keys(obj)) {
                this.deepFreeze(obj[key]);
            }
        }

        return obj;
    }
}
