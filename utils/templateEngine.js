/**
 * Template Engine Utility
 * Simple template engine for string interpolation
 */

/**
 * TemplateEngine class for rendering templates
 */
export class TemplateEngine {
    /**
     * Render template with variables
     * @param {string} template - Template string with {{variable}} placeholders
     * @param {Object} data - Data object with variable values
     * @returns {string} - Rendered template
     */
    static render(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }
    
    /**
     * Render template with nested object support
     * @param {string} template - Template string with {{object.key}} placeholders
     * @param {Object} data - Data object
     * @returns {string} - Rendered template
     */
    static renderNested(template, data) {
        return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
            const keys = path.split('.');
            let value = data;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return match;
                }
            }
            
            return value !== undefined ? value : match;
        });
    }
    
    /**
     * Render template with conditionals and loops
     * @param {string} template - Template string with helpers
     * @param {Object} data - Data object
     * @returns {string} - Rendered template
     */
    static renderWithHelpers(template, data) {
        let result = template;
        
        result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            return data[condition] ? content : '';
        });
        
        result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
            const array = data[arrayName];
            if (!Array.isArray(array)) return '';
            
            return array.map(item => {
                return this.render(content, { ...data, ...item });
            }).join('');
        });
        
        return this.renderNested(result, data);
    }
    
    /**
     * Compile template to a function
     * @param {string} template - Template string
     * @returns {Function} - Compiled template function
     */
    static compile(template) {
        return (data) => this.renderNested(template, data);
    }
}
