export class JSONValidator {

    // ===============================
    // JSON Parsing Validation
    // ===============================
    static validateJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return { isValid: true, error: null, data };
        } catch (err) {
            return { isValid: false, error: err.message, data: null };
        }
    }

    // ===============================
    // Schema Validation
    // ===============================
    static validateSchema(json, schema, options = {}, path = "") {
        const errors = [];
        const {
            strict = false,
            applyDefaults = false,
            deepStrict = false
        } = options;

        // Prevent prototype pollution
        if (json && typeof json === "object") {
            if ("__proto__" in json || "constructor" in json) {
                errors.push(`Unsafe key detected at '${path || "root"}'`);
                return { isValid: false, errors };
            }
        }

        // Strict mode (top-level)
        if (strict && typeof json === "object" && json !== null) {
            for (const key of Object.keys(json)) {
                if (!schema[key]) {
                    errors.push(`Unknown field '${path ? path + "." : ""}${key}'`);
                }
            }
        }

        for (const [key, rules] of Object.entries(schema)) {
            let value = json?.[key];
            const fieldPath = path ? `${path}.${key}` : key;

            // Apply default
            if (value === undefined && applyDefaults && "default" in rules) {
                value = rules.default;
                json[key] = value;
            }

            // Required
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Field '${fieldPath}' is required`);
                continue;
            }

            // Nullable
            if (rules.nullable && value === null) continue;

            if (value === undefined || value === null) continue;

            // Transform (e.g. trim)
            if (typeof rules.transform === "function") {
                value = rules.transform(value);
                json[key] = value;
            }

            const actualType = this.getType(value);

            // Type check
            if (rules.type && actualType !== rules.type) {
                errors.push(
                    `Field '${fieldPath}' must be '${rules.type}', got '${actualType}'`
                );
                continue;
            }

            // Enum
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(
                    `Field '${fieldPath}' must be one of [${rules.enum.join(", ")}]`
                );
            }

            // STRING
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

            // NUMBER
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

            // BOOLEAN
            if (rules.type === "boolean") {
                if (typeof value !== "boolean") {
                    errors.push(`Field '${fieldPath}' must be boolean`);
                }
            }

            // DATE
            if (rules.type === "date") {
                if (!(value instanceof Date) || isNaN(value)) {
                    errors.push(`Field '${fieldPath}' must be a valid date`);
                }
            }

            // OBJECT
            if (rules.type === "object" && rules.schema) {
                const nested = this.validateSchema(
                    value,
                    rules.schema,
                    { ...options, strict: deepStrict },
                    fieldPath
                );
                errors.push(...nested.errors);
            }

            // ARRAY
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

                if (rules.items) {
                    value.forEach((item, i) => {
                        const itemPath = `${fieldPath}[${i}]`;

                        if (rules.items.schema) {
                            const nested = this.validateSchema(
                                item,
                                rules.items.schema,
                                options,
                                itemPath
                            );
                            errors.push(...nested.errors);
                        } else if (rules.items.type) {
                            const itemType = this.getType(item);
                            if (itemType !== rules.items.type) {
                                errors.push(
                                    `Field '${itemPath}' must be '${rules.items.type}'`
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

        const obj = Object.create(null); // safer object
        seen.set(value, obj);

        for (const key in value) {
            if (key === "__proto__" || key === "constructor") continue;
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
            if (key === "__proto__" || key === "constructor") continue;

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
