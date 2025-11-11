/**
 * JSON Validator Utility
 * JSON schema validation and JSON structure validation
 */

/**
 * JSONValidator class for validating JSON structures
 */
export class JSONValidator {
    /**
     * Validate JSON string
     * @param {string} jsonString - JSON string to validate
     * @returns {Object} - Validation result with isValid and error message
     */
    static validateJSON(jsonString) {
        try {
            JSON.parse(jsonString);
            return { isValid: true, error: null };
        } catch (error) {
            return { isValid: false, error: error.message };
        }
    }
    
    /**
     * Validate JSON against a schema structure
     * @param {Object} json - JSON object to validate
     * @param {Object} schema - Schema object with required fields and types
     * @returns {Object} - Validation result
     */
    static validateSchema(json, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            if (rules.required && (json[key] === undefined || json[key] === null)) {
                errors.push(`Field '${key}' is required`);
                continue;
            }
            
            if (json[key] !== undefined && rules.type) {
                const actualType = Array.isArray(json[key]) ? 'array' : typeof json[key];
                if (actualType !== rules.type) {
                    errors.push(`Field '${key}' must be of type ${rules.type}, got ${actualType}`);
                }
            }
            
            if (json[key] !== undefined && rules.minLength && json[key].length < rules.minLength) {
                errors.push(`Field '${key}' must have minimum length of ${rules.minLength}`);
            }
            
            if (json[key] !== undefined && rules.maxLength && json[key].length > rules.maxLength) {
                errors.push(`Field '${key}' must have maximum length of ${rules.maxLength}`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Deep clone a JSON object
     * @param {Object} obj - Object to clone
     * @returns {Object} - Cloned object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    /**
     * Merge two JSON objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} - Merged object
     */
    static merge(target, source) {
        return { ...target, ...source };
    }
}


