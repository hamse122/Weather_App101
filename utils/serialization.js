/**
 * Advanced Serialization Utility
 * Enhanced object → string / binary serializers
 * Supports: circular refs, types, Maps, Sets, Date, RegExp, BigInt
 */

export class Serialization {
    /********************************************************************
     * JSON SERIALIZATION
     ********************************************************************/
    
    static toJSON(obj, indent = 2) {
        try {
            return JSON.stringify(obj, null, indent);
        } catch (err) {
            throw new Error(`JSON serialization failed: ${err.message}`);
        }
    }

    static fromJSON(json) {
        try {
            return JSON.parse(json);
        } catch (err) {
            throw new Error(`JSON parse failed: ${err.message}`);
        }
    }

    /********************************************************************
     * QUERY STRING
     ********************************************************************/
    
    static toQueryString(obj) {
        const params = new URLSearchParams();

        const build = (prefix, value) => {
            if (value === undefined || value === null) return;

            if (Array.isArray(value)) {
                value.forEach(v => build(prefix, v));
            } else if (typeof value === "object") {
                Object.entries(value).forEach(([k, v]) => {
                    build(`${prefix}[${k}]`, v);
                });
            } else {
                params.append(prefix, value);
            }
        };

        Object.entries(obj).forEach(([key, value]) => build(key, value));
        return params.toString();
    }

    static fromQueryString(str) {
        const params = new URLSearchParams(str);
        const result = {};

        for (const [key, value] of params.entries()) {
            if (key.includes("[")) {
                // nested: user[name]
                const keys = key.split(/[\[\]]/).filter(Boolean);
                let current = result;

                keys.forEach((k, i) => {
                    if (i === keys.length - 1) {
                        current[k] = value;
                    } else {
                        current[k] = current[k] || {};
                        current = current[k];
                    }
                });
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    /********************************************************************
     * FORM DATA SERIALIZATION
     ********************************************************************/

    static toFormData(obj, form = new FormData(), prefix = "") {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}[${key}]` : key;

            if (value instanceof File || value instanceof Blob) {
                form.append(fullKey, value);
            } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                this.toFormData(value, form, fullKey);
            } else if (Array.isArray(value)) {
                value.forEach(v => form.append(fullKey, v));
            } else if (value !== undefined && value !== null) {
                form.append(fullKey, value);
            }
        }
        return form;
    }

    /********************************************************************
     * BASE64
     ********************************************************************/

    static toBase64(obj) {
        const json = encodeURIComponent(JSON.stringify(obj));
        return btoa(json);
    }

    static fromBase64(str) {
        try {
            const json = decodeURIComponent(atob(str));
            return JSON.parse(json);
        } catch (err) {
            throw new Error(`Invalid Base64: ${err.message}`);
        }
    }

    /********************************************************************
     * CIRCULAR-SAFE SERIALIZATION
     ********************************************************************/

    static serializeCircular(obj) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]";
                seen.add(value);
            }
            return value;
        });
    }

    /********************************************************************
     * DEEP CLONE (CIRCULAR-SAFE)
     ********************************************************************/

    static deepClone(obj) {
        const seen = new WeakMap();

        function clone(value) {
            if (typeof value !== "object" || value === null) return value;

            if (seen.has(value)) return seen.get(value);

            let result;

            if (Array.isArray(value)) {
                result = [];
                seen.set(value, result);
                value.forEach((v, i) => (result[i] = clone(v)));
                return result;
            }

            result = {};
            seen.set(value, result);
            for (const [k, v] of Object.entries(value)) {
                result[k] = clone(v);
            }
            return result;
        }

        return clone(obj);
    }

    /********************************************************************
     * TYPE-SAFE SERIALIZATION + DESERIALIZER
     ********************************************************************/

    static serializeWithTypes(obj) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]";
                seen.add(value);
            }

            if (value instanceof Date) return { __type: "Date", value: value.toISOString() };
            if (value instanceof RegExp) return { __type: "RegExp", value: value.toString() };
            if (value instanceof Map) return { __type: "Map", value: [...value] };
            if (value instanceof Set) return { __type: "Set", value: [...value] };
            if (typeof value === "bigint") return { __type: "BigInt", value: value.toString() };

            return value;
        });
    }

    static deserializeWithTypes(json) {
        return JSON.parse(json, (_, value) => {
            if (!value || typeof value !== "object") return value;

            if (value.__type === "Date") return new Date(value.value);
            if (value.__type === "RegExp") return new RegExp(value.value.slice(1, -1));
            if (value.__type === "Map") return new Map(value.value);
            if (value.__type === "Set") return new Set(value.value);
            if (value.__type === "BigInt") return BigInt(value.value);

            return value;
        });
    }

    /********************************************************************
     * STABLE SERIALIZATION (DETERMINISTIC)
     ********************************************************************/
    static stableStringify(obj) {
        return JSON.stringify(obj, Object.keys(obj).sort(), 2);
    }

    /********************************************************************
     * CUSTOM REPLACER / REVIVER
     ********************************************************************/
    static serializeWithReplacer(obj, replacer) {
        return JSON.stringify(obj, replacer);
    }

    static deserializeWithReviver(json, reviver) {
        return JSON.parse(json, reviver);
    }
}
