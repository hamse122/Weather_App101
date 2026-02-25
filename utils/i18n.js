/**
 * Enterprise Internationalization (i18n) Utility
 * Features:
 * - Nested key resolution (dot notation)
 * - Multi-level fallback chain
 * - Deep merge
 * - Async loading with protection
 * - Smart caching
 * - Pluralization
 * - Namespaces
 * - Locale normalization
 * - Strict mode
 */

export class I18n {
    constructor(options = {}) {
        this.translations = new Map();
        this.currentLocale = options.defaultLocale || "en";

        this.fallbackChain = options.fallbackChain || ["en"];
        this.listeners = [];

        this.cache = new Map();
        this.strict = options.strict || false;

        this.cacheTTL = options.cacheTTL || null; // optional TTL in ms
        this.cacheTimestamps = new Map();

        this.loadingLocales = new Set();
    }

    /* ---------------------------------- */
    /* Utilities                          */
    /* ---------------------------------- */

    static normalizeLocale(locale) {
        if (!locale) return "en";
        return locale.toLowerCase().split("-")[0]; // en-US → en
    }

    static deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    static getNestedValue(obj, path) {
        return path.split(".").reduce((acc, key) => acc?.[key], obj);
    }

    static interpolate(str, params) {
        return str.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
            const value = I18n.getNestedValue(params, key);
            return value !== undefined ? value : `{{${key}}}`;
        });
    }

    /* ---------------------------------- */
    /* Translation Management             */
    /* ---------------------------------- */

    addTranslations(locale, translations) {
        locale = I18n.normalizeLocale(locale);

        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }

        const existing = this.translations.get(locale);
        const merged = I18n.deepMerge(existing, translations);

        this.translations.set(locale, merged);
        this.cache.clear();
    }

    async load(locale, loaderFn) {
        locale = I18n.normalizeLocale(locale);

        if (this.loadingLocales.has(locale)) return;
        this.loadingLocales.add(locale);

        try {
            const loaded = await loaderFn();
            this.addTranslations(locale, loaded);
        } finally {
            this.loadingLocales.delete(locale);
        }
    }

    setLocale(locale) {
        locale = I18n.normalizeLocale(locale);

        if (!this.translations.has(locale)) {
            console.warn(`⚠ Locale "${locale}" not loaded.`);
        }

        this.currentLocale = locale;
        this.cache.clear();
        this.notifyListeners(locale);
    }

    setFallbackChain(localesArray) {
        if (!Array.isArray(localesArray)) {
            throw new Error("Fallback chain must be array.");
        }

        this.fallbackChain = [
            ...new Set(localesArray.map(I18n.normalizeLocale)),
        ];

        this.cache.clear();
    }

    /* ---------------------------------- */
    /* Core Resolver                      */
    /* ---------------------------------- */

    _resolveKey(key) {
        const now = Date.now();

        if (this.cache.has(key)) {
            if (
                !this.cacheTTL ||
                now - this.cacheTimestamps.get(key) < this.cacheTTL
            ) {
                return this.cache.get(key);
            }
        }

        const searchLocales = [
            this.currentLocale,
            ...this.fallbackChain,
        ].filter((v, i, arr) => arr.indexOf(v) === i);

        for (const locale of searchLocales) {
            const translations = this.translations.get(locale);
            if (!translations) continue;

            const value = I18n.getNestedValue(translations, key);

            if (value !== undefined) {
                this.cache.set(key, value);
                this.cacheTimestamps.set(key, now);
                return value;
            }
        }

        if (this.strict) {
            throw new Error(`Missing translation: ${key}`);
        }

        return key;
    }

    /* ---------------------------------- */
    /* Pluralization                      */
    /* ---------------------------------- */

    _handlePlural(resolved, params) {
        if (typeof resolved !== "object" || resolved === null) {
            return resolved;
        }

        const count = params.count;

        if (count === 0 && resolved.zero) return resolved.zero;
        if (count === 1 && resolved.one) return resolved.one;
        if (count > 1 && resolved.other) return resolved.other;

        return resolved.other || resolved.one || resolved.zero;
    }

    /* ---------------------------------- */
    /* Public API                         */
    /* ---------------------------------- */

    t(key, params = {}) {
        let resolved = this._resolveKey(key);

        resolved = this._handlePlural(resolved, params);

        if (typeof resolved !== "string") {
            return resolved;
        }

        return I18n.interpolate(resolved, params);
    }

    has(key) {
        return this._resolveKey(key) !== key;
    }

    getAll() {
        return (
            this.translations.get(this.currentLocale) ||
            this.translations.get(this.fallbackChain[0]) ||
            {}
        );
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(locale) {
        const data = {
            locale,
            translations: this.getAll(),
        };
        this.listeners.forEach((fn) => fn(data));
    }

    getAvailableLocales() {
        return Array.from(this.translations.keys());
    }

    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }
}

// Global instance
export const i18n = new I18n({
    defaultLocale: "en",
    fallbackChain: ["en"],
    strict: false,
});
