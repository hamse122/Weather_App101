/**
 * JSON Validator Utility
 * JSON schema validation and JSON structure validation
 */

export class JSONValidator {

    /**
     * Validate JSON string format
     * @param {string} jsonString
     * @returns {{isValid: boolean, error: string|null, data?: object}}
     */
    static validateJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return { isValid: true, error: null, data: parsed };
        } catch (error) {
            return { isValid: false, error: error.message };
        }
    }

    /**
     * Validate JSON object against a schema
     * Schema example:
     * {
     *   name:  { required: true, type: "string", minLength: 3 },
     *   age:   { required: true, type: "number" },
     *   tags:  { type: "array", items: { type: "string" } },
     *   info:  { type: "object", schema: { city: { type: "string" } } }
     * }
     *
     * @param {object} json
     * @param {object} schema
     * @returns {{isValid: boolean, errors: string[]}}
     */
    static validateSchema(json, schema, path = "") {
        const errors = [];

        for (const [key, rules] of Object.entries(schema)) {
            const value = json[key];
            const fieldPath = path ? `${path}.${key}` : key;

            // Required field check
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Field '${fieldPath}' is required`);
                continue;
            }

            // Skip further checks if undefined
            if (value === undefined || value === null) continue;

            // Determine actual value type
            const actualType = Array.isArray(value) ? "array" : typeof value;

            // Type validation
            if (rules.type && actualType !== rules.type) {
                errors.push(
                    `Field '${fieldPath}' must be type '${rules.type}', got '${actualType}'`
                );
                continue;
            }

            // String length validations
            if (rules.type === "string") {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`Field '${fieldPath}' must have minimum length ${rules.minLength}`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`Field '${fieldPath}' must have maximum length ${rules.maxLength}`);
                }
            }

            // Number validation
            if (rules.type === "number") {
                if (typeof value !== "number" || Number.isNaN(value)) {
                    errors.push(`Field '${fieldPath}' must be a valid number`);
                }
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`Field '${fieldPath}' must be >= ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`Field '${fieldPath}' must be <= ${rules.max}`);
                }
            }

            // Object validation (nested schema)
            if (rules.type === "object" && rules.schema) {
                const nested = this.validateSchema(value, rules.schema, fieldPath);
                errors.push(...nested.errors);
            }

            // Array validation
            if (rules.type === "array") {
                if (!Array.isArray(value)) {
                    errors.push(`Field '${fieldPath}' must be an array`);
                    continue;
                }

                if (rules.minItems !== undefined && value.length < rules.minItems) {
                    errors.push(`Field '${fieldPath}' must have at least ${rules.minItems} items`);
                }
                if (rules.maxItems !== undefined && value.length > rules.maxItems) {
                    errors.push(`Field '${fieldPath}' must have at most ${rules.maxItems} items`);
                }

                // Validate each element's type
                if (rules.items) {
                    value.forEach((item, index) => {
                        const itemType = typeof item;
                        if (rules.items.type && itemType !== rules.items.type) {
                            errors.push(
                                `Field '${fieldPath}[${index}]' must be type '${rules.items.type}', got '${itemType}'`
                            );
                        }
                    });
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Deep clone JSON object
     * Now supports Date, Array, Object
     * @param {*} value
     * @returns {*}
     */
    static deepClone(value) {
        if (value === null || typeof value !== "object") return value;

        if (Array.isArray(value)) {
            return value.map(item => this.deepClone(item));
        }

        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        const result = {};
        for (const key in value) {
            result[key] = this.deepClone(value[key]);
        }
        return result;
    }

    /**
     * Deep merge JSON objects
     * @param {object} target
     * @param {object} source
     * @returns {object}
     */
    static merge(target, source) {
        const output = this.deepClone(target);

        for (const key in source) {
            const value = source[key];

            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                typeof output[key] === "object"
            ) {
                output[key] = this.merge(output[key], value);
            } else {
                output[key] = this.deepClone(value);
            }
        }

        return output;
    }
}
