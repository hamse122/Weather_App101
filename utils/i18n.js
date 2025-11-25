/**
 * Advanced Internationalization (i18n) Utility
 * Includes: fallback chain, deep merge, async loading, caching, interpolation
 */

export class I18n {
    constructor() {
        this.translations = new Map();
        this.currentLocale = "en";

        // Support multi-level fallback chain instead of a single locale
        this.fallbackChain = ["en"];

        // Listeners for locale changes
        this.listeners = [];

        // Translation cache for speed
        this.cache = new Map();
    }

    /** Deep merge for nested translations */
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

    /**
     * Add translations for a locale
     */
    addTranslations(locale, translations) {
        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }

        const existing = this.translations.get(locale);
        const merged = I18n.deepMerge(existing, translations);

        this.translations.set(locale, merged);

        // Clear cache since translations changed
        this.cache.clear();
    }

    /**
     * Async loader (allows import("./locales/en.json"))
     */
    async load(locale, loaderFn) {
        const loaded = await loaderFn(); // e.g. fetch JSON or dynamic import()
        this.addTranslations(locale, loaded);
    }

    /**
     * Set current locale
     */
    setLocale(locale) {
        if (!this.translations.has(locale)) {
            console.warn(`Locale "${locale}" has no translations loaded.`);
        }

        this.currentLocale = locale;
        this.cache.clear();
        this.notifyListeners(locale);
    }

    getLocale() {
        return this.currentLocale;
    }

    /**
     * Set fallback chain, e.g. ["som", "ar", "en"]
     */
    setFallbackChain(localesArray) {
        if (!Array.isArray(localesArray)) {
            throw new Error("Fallback chain must be an array of locales.");
        }
        this.fallbackChain = localesArray;
        this.cache.clear();
    }

    /**
     * Internal method to resolve key by searching locale + fallback chain
     */
    _resolveKey(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const searchLocales = [this.currentLocale, ...this.fallbackChain];

        for (const locale of searchLocales) {
            const translations = this.translations.get(locale);
            if (!translations) continue;

            const value = translations[key];
            if (value !== undefined) {
                this.cache.set(key, value);
                return value;
            }
        }

        return key; // default to key if missing
    }

    /**
     * Parameter interpolation with nested params:
     * {{user.name}}, {{count}}
     */
    static interpolate(str, params) {
        return str.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
            const keys = key.split(".");
            let value = params;

            for (const k of keys) {
                value = value?.[k];
                if (value === undefined) return `{{${key}}}`;
            }
            return value;
        });
    }

    /**
     * Translate a key
     */
    t(key, params = {}) {
        const resolved = this._resolveKey(key);

        if (typeof resolved !== "string") {
            return resolved; // allow returning objects for advanced usage
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

    /**
     * Listener system
     */
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
}

// Global instance
export const i18n = new I18n();
