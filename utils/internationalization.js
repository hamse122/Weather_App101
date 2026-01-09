// Internationalization and localization system (v2)
class I18n {
    constructor(options = {}) {
        this.defaultLocale = options.defaultLocale || 'en';
        this.currentLocale = this.defaultLocale;

        this.translations = new Map();
        this.fallbacks = new Map(); // locale -> [fallbacks]
        this.formatters = new Map();
        this.eventHandlers = new Map();

        this.missingHandler =
            options.onMissingTranslation ||
            ((key, locale) => console.warn(`[i18n] Missing "${key}" for locale "${locale}"`));

        this.initFormatters();
    }

    /* ------------------------------------------------------------------
     * Translation management
     * ------------------------------------------------------------------ */

    addTranslations(locale, translations) {
        const existing = this.translations.get(locale) || {};
        this.translations.set(locale, this.deepMerge(existing, translations));
        return this;
    }

    async loadTranslations(locale, loaderFn) {
        const translations = await loaderFn(locale);
        this.addTranslations(locale, translations);
        this.dispatchEvent('translationsLoaded', { locale });
        return this;
    }

    getSupportedLocales() {
        return Array.from(this.translations.keys());
    }

    /* ------------------------------------------------------------------
     * Locale handling
     * ------------------------------------------------------------------ */

    setLocale(locale) {
        this.currentLocale = locale;
        this.initFormatters();
        this.dispatchEvent('localeChange', { locale });
        return this;
    }

    setFallback(locale, fallbackLocales) {
        this.fallbacks.set(
            locale,
            Array.isArray(fallbackLocales) ? fallbackLocales : [fallbackLocales]
        );
        return this;
    }

    /* ------------------------------------------------------------------
     * Translation lookup
     * ------------------------------------------------------------------ */

    t(key, variables = {}, options = {}) {
        const locales = this.getLocaleChain();
        let value = null;

        for (const locale of locales) {
            value = this.getTranslation(key, locale, options.count);
            if (value != null) break;
        }

        if (value == null) {
            this.missingHandler(key, this.currentLocale);
            return key;
        }

        return this.interpolate(value, variables);
    }

    getTranslation(key, locale, count) {
        const dict = this.translations.get(locale);
        if (!dict) return null;

        let value = this.resolvePath(dict, key);

        // Pluralization support
        if (value && typeof value === 'object' && count != null) {
            const rule = new Intl.PluralRules(locale).select(count);
            value = value[rule] ?? value.other;
        }

        return value ?? null;
    }

    getLocaleChain() {
        const chain = [this.currentLocale];

        const fallbacks = this.fallbacks.get(this.currentLocale);
        if (fallbacks) chain.push(...fallbacks);

        if (!chain.includes(this.defaultLocale)) {
            chain.push(this.defaultLocale);
        }

        return chain;
    }

    /* ------------------------------------------------------------------
     * Interpolation
     * ------------------------------------------------------------------ */

    interpolate(text, variables) {
        if (typeof text !== 'string') return text;

        return text.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
            const value = this.resolvePath(variables, path);
            return value != null ? value : `{{${path}}}`;
        });
    }

    /* ------------------------------------------------------------------
     * Formatting
     * ------------------------------------------------------------------ */

    formatNumber(number, options = {}) {
        return this.getNumberFormatter(options).format(number);
    }

    formatCurrency(amount, currency, options = {}) {
        return this.getNumberFormatter({
            style: 'currency',
            currency,
            ...options
        }).format(amount);
    }

    formatDate(date, options = {}) {
        return this.getDateFormatter(options).format(date);
    }

    getNumberFormatter(options = {}) {
        return this.getFormatter('number', options, () =>
            new Intl.NumberFormat(this.currentLocale, options)
        );
    }

    getDateFormatter(options = {}) {
        return this.getFormatter('date', options, () =>
            new Intl.DateTimeFormat(this.currentLocale, options)
        );
    }

    getFormatter(type, options, factory) {
        const key = JSON.stringify({ type, locale: this.currentLocale, options });
        if (!this.formatters.has(key)) {
            this.formatters.set(key, factory());
        }
        return this.formatters.get(key);
    }

    initFormatters() {
        this.formatters.clear();
    }

    /* ------------------------------------------------------------------
     * Events
     * ------------------------------------------------------------------ */

    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        this.eventHandlers.get(event)?.delete(callback);
    }

    dispatchEvent(event, payload) {
        this.eventHandlers.get(event)?.forEach(handler => {
            try {
                handler(payload);
            } catch (err) {
                console.error(`[i18n] Event "${event}" error:`, err);
            }
        });
    }

    /* ------------------------------------------------------------------
     * Utilities
     * ------------------------------------------------------------------ */

    resolvePath(obj, path) {
        return path.split('.').reduce((acc, key) => acc?.[key], obj);
    }

    deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (
                source[key] &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key])
            ) {
                target[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }
}

module.exports = I18n;
