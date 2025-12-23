/**
 * Advanced Template Engine Utility
 * Supports variables, nested paths, conditionals, loops, helpers, and escaping
 */

export class TemplateEngine {
    /**
     * Escape HTML to prevent XSS
     */
    static escapeHTML(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Resolve deep object path safely
     */
    static resolvePath(obj, path) {
        return path.split('.').reduce((acc, key) => {
            return acc && acc[key] !== undefined ? acc[key] : undefined;
        }, obj);
    }

    /**
     * Core render method
     */
    static render(template, data = {}, helpers = {}) {
        let result = template;

        /* =========================
           EACH LOOP
        ========================== */
        result = result.replace(
            /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
            (_, path, block) => {
                const array = this.resolvePath(data, path);
                if (!Array.isArray(array)) return '';

                return array.map((item, index) => {
                    return this.render(block, {
                        ...data,
                        ...item,
                        '@index': index,
                        '@first': index === 0,
                        '@last': index === array.length - 1
                    }, helpers);
                }).join('');
            }
        );

        /* =========================
           IF / ELSE
        ========================== */
        result = result.replace(
            /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
            (_, condition, ifBlock, elseBlock) => {
                const value = this.resolvePath(data, condition);
                return value ? ifBlock : (elseBlock || '');
            }
        );

        /* =========================
           HELPERS {{ helper arg }}
        ========================== */
        result = result.replace(
            /\{\{(\w+)\s+([\w.]+)\}\}/g,
            (_, helperName, path) => {
                if (helpers[helperName]) {
                    return helpers[helperName](this.resolvePath(data, path), data);
                }
                return _;
            }
        );

        /* =========================
           RAW (NO ESCAPE) {{{value}}}
        ========================== */
        result = result.replace(
            /\{\{\{([\w.]+)\}\}\}/g,
            (_, path) => {
                const value = this.resolvePath(data, path);
                return value ?? '';
            }
        );

        /* =========================
           SAFE ESCAPED {{value}}
        ========================== */
        result = result.replace(
            /\{\{([\w.]+)\}\}/g,
            (_, path) => {
                const value = this.resolvePath(data, path);
                return value !== undefined ? this.escapeHTML(value) : '';
            }
        );

        return result;
    }

    /**
     * Compile template to reusable function
     */
    static compile(template, helpers = {}) {
        return (data) => this.render(template, data, helpers);
    }
}
