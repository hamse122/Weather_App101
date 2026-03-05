/**
 * Ultra Advanced Template Engine
 * Features:
 * - variables
 * - nested paths
 * - loops
 * - conditionals (if / unless)
 * - helpers with multiple arguments
 * - partials
 * - caching
 * - HTML escaping
 * - comments
 */

export class TemplateEngine {

    static cache = new Map();

    /* =========================
       HTML ESCAPE
    ========================== */
    static escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =========================
       PATH RESOLVER
       supports user.name or items[0].title
    ========================== */
    static resolvePath(obj, path) {
        if (!path) return undefined;

        const parts = path
            .replace(/\[(\d+)\]/g, ".$1")
            .split(".");

        return parts.reduce((acc, key) => {
            return acc && acc[key] !== undefined ? acc[key] : undefined;
        }, obj);
    }

    /* =========================
       RENDER ENGINE
    ========================== */
    static render(template, data = {}, helpers = {}, partials = {}) {

        let result = template;

        /* =========================
           REMOVE COMMENTS
        ========================== */
        result = result.replace(/\{\{!\s*[\s\S]*?\}\}/g, "");

        /* =========================
           PARTIALS {{> header}}
        ========================== */
        result = result.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
            if (!partials[name]) return "";
            return this.render(partials[name], data, helpers, partials);
        });

        /* =========================
           EACH LOOP
        ========================== */
        result = result.replace(
            /\{\{#each\s+([\w.[\]]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
            (_, path, block) => {

                const array = this.resolvePath(data, path);
                if (!Array.isArray(array)) return "";

                return array.map((item, index) => {

                    const context = {
                        ...data,
                        ...item,
                        "@index": index,
                        "@first": index === 0,
                        "@last": index === array.length - 1
                    };

                    return this.render(block, context, helpers, partials);

                }).join("");
            }
        );

        /* =========================
           IF / ELSE
        ========================== */
        result = result.replace(
            /\{\{#if\s+([\w.[\]]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
            (_, path, ifBlock, elseBlock) => {

                const value = this.resolvePath(data, path);
                return value ? ifBlock : (elseBlock || "");
            }
        );

        /* =========================
           UNLESS
        ========================== */
        result = result.replace(
            /\{\{#unless\s+([\w.[\]]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
            (_, path, block) => {

                const value = this.resolvePath(data, path);
                return !value ? block : "";
            }
        );

        /* =========================
           HELPERS {{ helper arg1 arg2 }}
        ========================== */
        result = result.replace(
            /\{\{(\w+)\s+([^\}]+)\}\}/g,
            (_, helperName, argsStr) => {

                if (!helpers[helperName]) return _;

                const args = argsStr
                    .split(/\s+/)
                    .map(arg => this.resolvePath(data, arg) ?? arg);

                return helpers[helperName](...args, data);
            }
        );

        /* =========================
           RAW {{{value}}}
        ========================== */
        result = result.replace(
            /\{\{\{([\w.[\]]+)\}\}\}/g,
            (_, path) => {

                const value = this.resolvePath(data, path);
                return value ?? "";
            }
        );

        /* =========================
           ESCAPED {{value}}
        ========================== */
        result = result.replace(
            /\{\{([\w.[\]]+)\}\}/g,
            (_, path) => {

                const value = this.resolvePath(data, path);
                return value !== undefined
                    ? this.escapeHTML(value)
                    : "";
            }
        );

        return result;
    }

    /* =========================
       COMPILE TEMPLATE
    ========================== */
    static compile(template, helpers = {}, partials = {}) {

        if (this.cache.has(template)) {
            return this.cache.get(template);
        }

        const fn = (data) =>
            this.render(template, data, helpers, partials);

        this.cache.set(template, fn);

        return fn;
    }
}
