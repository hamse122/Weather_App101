/**
 * Advanced JSON Validator Utility
 * Supports schema validation, strict mode, enums, custom validators,
 * deep clone with circular reference protection, and safe deep merge.
 */

export class JSONValidator {

    // ===============================
    // JSON Parsing Validation
    // ===============================
    static validateJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return { isValid: true, error: null, data };
        } catch (err) {
            return { isValid: false, error: err.message };
        }
    }

    // ===============================
    // Schema Validation
    // ===============================
    static validateSchema(json, schema, options = {}, path = "") {
        const errors = [];
        const { strict = false } = options;

        // Strict mode → detect unknown fields
        if (strict && typeof json === "object" && json !== null) {
            for (const key of Object.keys(json)) {
                if (!schema[key]) {
                    errors.push(`Unknown field '${path ? path + "." : ""}${key}'`);
                }
            }
        }

        for (const [key, rules] of Object.entries(schema)) {
            const value = json?.[key];
            const fieldPath = path ? `${path}.${key}` : key;

            // Required check
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Field '${fieldPath}' is required`);
                continue;
            }

            if (value === undefined || value === null) continue;

            const actualType = this.getType(value);

            // Type validation
            if (rules.type && actualType !== rules.type) {
                errors.push(
                    `Field '${fieldPath}' must be '${rules.type}', got '${actualType}'`
                );
                continue;
            }

            // Enum validation
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(
                    `Field '${fieldPath}' must be one of [${rules.enum.join(", ")}]`
                );
            }

            // String rules
            if (rules.type === "string") {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`Field '${fieldPath}' min length is ${rules.minLength}`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`Field '${fieldPath}' max length is ${rules.maxLength}`);
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`Field '${fieldPath}' does not match pattern`);
                }
            }

            // Number rules
            if (rules.type === "number") {
                if (Number.isNaN(value)) {
                    errors.push(`Field '${fieldPath}' must be a valid number`);
                }
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`Field '${fieldPath}' must be >= ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`Field '${fieldPath}' must be <= ${rules.max}`);
                }
            }

            // Object rules
            if (rules.type === "object" && rules.schema) {
                const nested = this.validateSchema(
                    value,
                    rules.schema,
                    options,
                    fieldPath
                );
                errors.push(...nested.errors);
            }

            // Array rules
            if (rules.type === "array") {
                if (!Array.isArray(value)) {
                    errors.push(`Field '${fieldPath}' must be an array`);
                    continue;
                }

                if (rules.minItems && value.length < rules.minItems) {
                    errors.push(`Field '${fieldPath}' requires at least ${rules.minItems} items`);
                }
                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push(`Field '${fieldPath}' allows at most ${rules.maxItems} items`);
                }

                // Nested array schema
                if (rules.items) {
                    value.forEach((item, i) => {
                        if (rules.items.schema) {
                            const nested = this.validateSchema(
                                item,
                                rules.items.schema,
                                options,
                                `${fieldPath}[${i}]`
                            );
                            errors.push(...nested.errors);
                        } else if (rules.items.type) {
                            const itemType = this.getType(item);
                            if (itemType !== rules.items.type) {
                                errors.push(
                                    `Field '${fieldPath}[${i}]' must be '${rules.items.type}'`
                                );
                            }
                        }
                    });
                }
            }

            // Custom validator
            if (typeof rules.validate === "function") {
                const result = rules.validate(value, json);
                if (result !== true) {
                    errors.push(
                        typeof result === "string"
                            ? result
                            : `Field '${fieldPath}' failed custom validation`
                    );
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ===============================
    // Utilities
    // ===============================
    static getType(value) {
        if (Array.isArray(value)) return "array";
        if (value === null) return "null";
        if (value instanceof Date) return "date";
        return typeof value;
    }

    // ===============================
    // Deep Clone (Circular-safe)
    // ===============================
    static deepClone(value, seen = new WeakMap()) {
        if (value === null || typeof value !== "object") return value;

        if (seen.has(value)) return seen.get(value);

        if (Array.isArray(value)) {
            const arr = [];
            seen.set(value, arr);
            value.forEach((v, i) => (arr[i] = this.deepClone(v, seen)));
            return arr;
        }

        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        const obj = {};
        seen.set(value, obj);

        for (const key in value) {
            obj[key] = this.deepClone(value[key], seen);
        }

        return obj;
    }

    // ===============================
    // Deep Merge (Safe)
    // ===============================
    static merge(target, source) {
        const output = this.deepClone(target);

        for (const key in source) {
            const srcVal = source[key];
            const tgtVal = output[key];

            if (
                this.getType(srcVal) === "object" &&
                this.getType(tgtVal) === "object"
            ) {
                output[key] = this.merge(tgtVal, srcVal);
            } else {
                output[key] = this.deepClone(srcVal);
            }
        }

        return output;
    }
}
