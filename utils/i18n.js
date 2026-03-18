/**
 * Enterprise I18n Utility v2 (Advanced)
 */

class LRUCache {
    constructor(limit = 500) {
        this.limit = limit;
        this.map = new Map();
    }

    get(key) {
        if (!this.map.has(key)) return;
        const val = this.map.get(key);
        this.map.delete(key);
        this.map.set(key, val);
        return val;
    }

    set(key, val) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, val);

        if (this.map.size > this.limit) {
            const first = this.map.keys().next().value;
            this.map.delete(first);
        }
    }

    clear() {
        this.map.clear();
    }
}

export class I18n {
    constructor(options = {}) {
        this.translations = new Map();

        this.currentLocale = options.defaultLocale || "en";
        this.fallbackChain = options.fallbackChain || ["en"];

        this.strict = options.strict || false;
        this.listeners = [];

        this.cache = new LRUCache(options.cacheSize || 500);

        this.loadingPromises = new Map(); // dedupe async loads

        this.onMissingKey = options.onMissingKey || null;
    }

    /* ---------------------------------- */
    /* Locale                             */
    /* ---------------------------------- */

    static normalizeLocale(locale) {
        if (!locale) return "en";
        return locale.toLowerCase();
    }

    static splitLocale(locale) {
        const [lang, region] = locale.split("-");
        return [locale, lang].filter(Boolean);
    }

    /* ---------------------------------- */
    /* Deep Merge                         */
    /* ---------------------------------- */

    static deepMerge(target, source) {
        for (const key in source) {
            const val = source[key];

            if (val && typeof val === "object" && !Array.isArray(val)) {
                target[key] = target[key] || {};
                this.deepMerge(target[key], val);
            } else {
                target[key] = val;
            }
        }
        return target;
    }

    /* ---------------------------------- */
    /* Fast Path Resolver (compiled)      */
    /* ---------------------------------- */

    static compilePath(path) {
        const parts = path.split(".");
        return obj => {
            let cur = obj;
            for (const p of parts) {
                if (!cur) return undefined;
                cur = cur[p];
            }
            return cur;
        };
    }

    /* ---------------------------------- */
    /* Interpolation                      */
    /* ---------------------------------- */

    static interpolate(str, params) {
        return str.replace(/\{\{(.*?)\}\}/g, (_, key) => {
            return key.split(".").reduce((acc, k) => acc?.[k], params) ?? `{{${key}}}`;
        });
    }

    /* ---------------------------------- */
    /* Translation Management             */
    /* ---------------------------------- */

    addTranslations(locale, data) {
        locale = I18n.normalizeLocale(locale);

        const existing = this.translations.get(locale) || {};
        const merged = I18n.deepMerge(existing, data);

        this.translations.set(locale, merged);
        this.cache.clear();
    }

    async load(locale, loaderFn) {
        locale = I18n.normalizeLocale(locale);

        if (this.loadingPromises.has(locale)) {
            return this.loadingPromises.get(locale);
        }

        const promise = loaderFn().then(data => {
            this.addTranslations(locale, data);
            this.loadingPromises.delete(locale);
        });

        this.loadingPromises.set(locale, promise);
        return promise;
    }

    setLocale(locale) {
        locale = I18n.normalizeLocale(locale);
        this.currentLocale = locale;
        this.cache.clear();
        this.notifyListeners(locale);
    }

    /* ---------------------------------- */
    /* Core Resolver                      */
    /* ---------------------------------- */

    _resolve(key) {
        const cached = this.cache.get(key);
        if (cached !== undefined) return cached;

        // namespace support: ns:key.path
        let namespace = null;
        let path = key;

        if (key.includes(":")) {
            [namespace, path] = key.split(":");
        }

        const locales = [
            ...I18n.splitLocale(this.currentLocale),
            ...this.fallbackChain
        ];

        const resolver = I18n.compilePath(path);

        for (const locale of locales) {
            const data = this.translations.get(locale);
            if (!data) continue;

            const source = namespace ? data[namespace] : data;
            const value = resolver(source);

            if (value !== undefined) {
                this.cache.set(key, value);
                return value;
            }
        }

        if (this.onMissingKey) {
            this.onMissingKey(key, this.currentLocale);
        }

        if (this.strict) {
            throw new Error(`Missing translation: ${key}`);
        }

        return key;
    }

    /* ---------------------------------- */
    /* Pluralization (Intl powered)       */
    /* ---------------------------------- */

    _plural(value, count) {
        if (typeof value !== "object") return value;

        const pr = new Intl.PluralRules(this.currentLocale);
        const rule = pr.select(count);

        return value[rule] ?? value.other;
    }

    /* ---------------------------------- */
    /* Formatting (NEW)
    ---------------------------------- */

    formatNumber(num, options) {
        return new Intl.NumberFormat(this.currentLocale, options).format(num);
    }

    formatDate(date, options) {
        return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
    }

    /* ---------------------------------- */
    /* Public API                         */
    /* ---------------------------------- */

    t(key, params = {}) {
        let value = this._resolve(key);

        if (params.count !== undefined) {
            value = this._plural(value, params.count);
        }

        if (typeof value !== "string") return value;

        return I18n.interpolate(value, params);
    }

    has(key) {
        return this._resolve(key) !== key;
    }

    subscribe(fn) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(f => f !== fn);
        };
    }

    notifyListeners(locale) {
        this.listeners.forEach(fn => fn(locale));
    }

    clearCache() {
        this.cache.clear();
    }
}

/* ---------------------------------- */
/* Global Instance                    */
/* ---------------------------------- */

export const i18n = new I18n({
    defaultLocale: "en",
    fallbackChain: ["en"],
    strict: false,
});
