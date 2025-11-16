// Advanced data validation system
class Validator {
    constructor(options = {}) {
        this.rules = new Map();
        this.customValidators = new Map();
        this.sanitizers = new Map();
        this.validateAll = options.validateAll || false; // NEW
    }
    
    addRule(field, rule) {
        if (!this.rules.has(field)) {
            this.rules.set(field, []);
        }
        this.rules.get(field).push(rule);
    }

    addRules(field, ruleArray = []) { // NEW
        ruleArray.forEach(r => this.addRule(field, r));
    }
    
    addCustomValidator(name, validatorFn) {
        this.customValidators.set(name, validatorFn);
    }

    addSanitizer(field, sanitizerFn) { // NEW
        this.sanitizers.set(field, sanitizerFn);
    }

    loadSchema(schema) { // NEW
        for (const field in schema) {
            const { rules = [], sanitize } = schema[field];
            this.addRules(field, rules);
            if (sanitize) this.addSanitizer(field, sanitize);
        }
    }
    
    async validate(data) {
        const errors = {};
        const validData = {};
        
        for (const [field, rules] of this.rules) {
            let value = data[field];

            // Apply sanitizer
            if (this.sanitizers.has(field)) {
                value = this.sanitizers.get(field)(value);
            }
            
            for (const rule of rules) {
                const result = await this.applyRule(rule, value, data);
                
                if (result !== true) {
                    if (!errors[field]) errors[field] = [];
                    errors[field].push(result);

                    if (!this.validateAll) break; // Stop on first error per field
                }
            }
            
            if (!errors[field]) validData[field] = value;
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            validData
        };
    }
    
    async applyRule(rule, value, allData) {
        if (typeof rule === 'function') {
            return await rule(value, allData);
        }
        
        if (typeof rule === 'string') {
            const customValidator = this.customValidators.get(rule);
            if (customValidator) return await customValidator(value, allData);
        }
        
        if (rule.validator) {
            const response = await rule.validator(value, allData);
            return response === true ? true : (rule.message || response || 'Validation failed');
        }
        
        return true;
    }

    formatErrors(errors) { // NEW
        return Object.entries(errors)
            .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
            .join('\n');
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
