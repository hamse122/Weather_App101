// Advanced data validation system
class Validator {
    constructor() {
        this.rules = new Map();
        this.customValidators = new Map();
    }
    
    addRule(field, rule) {
        if (!this.rules.has(field)) {
            this.rules.set(field, []);
        }
        this.rules.get(field).push(rule);
    }
    
    addCustomValidator(name, validatorFn) {
        this.customValidators.set(name, validatorFn);
    }
    
    validate(data) {
        const errors = {};
        const validData = {};
        
        for (const [field, rules] of this.rules) {
            const value = data[field];
            
            for (const rule of rules) {
                const result = this.applyRule(rule, value, data);
                
                if (result !== true) {
                    if (!errors[field]) errors[field] = [];
                    errors[field].push(result);
                    break; // Stop at first error for this field
                }
            }
            
            // Only add to validData if no errors
            if (!errors[field]) {
                validData[field] = value;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            validData
        };
    }
    
    applyRule(rule, value, allData) {
        if (typeof rule === 'function') {
            return rule(value, allData);
        }
        
        if (typeof rule === 'string') {
            const customValidator = this.customValidators.get(rule);
            if (customValidator) {
                return customValidator(value, allData);
            }
        }
        
        if (rule.validator) {
            return rule.validator(value, allData) || rule.message || 'Validation failed';
        }
        
        return true;
    }
}

// Built-in validators
const builtInValidators = {
    required: (value) => value != null && value !== '' || 'This field is required',
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email format',
    minLength: (min) => (value) => value && value.length >= min || `Minimum length is ${min}`,
    maxLength: (max) => (value) => !value || value.length <= max || `Maximum length is ${max}`,
    numeric: (value) => !isNaN(parseFloat(value)) && isFinite(value) || 'Must be a number',
    matches: (regex, message) => (value) => regex.test(value) || message || 'Invalid format'
};

module.exports = { Validator, builtInValidators };

