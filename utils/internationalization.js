// Internationalization and localization system
class I18n {
    constructor(options = {}) {
        this.defaultLocale = options.defaultLocale || 'en';
        this.currentLocale = this.defaultLocale;
        this.translations = new Map();
        this.fallbacks = new Map();
        this.formatters = new Map();
        this.eventHandlers = new Map();
        this.initFormatters();
    }

    addTranslations(locale, translations) {
        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }
        const existing = this.translations.get(locale);
        this.translations.set(locale, { ...existing, ...translations });
        return this;
    }

    t(key, variables = {}) {
        let translation = this.getTranslation(key, this.currentLocale);

        if (!translation && this.fallbacks.has(this.currentLocale)) {
            const fallbackLocale = this.fallbacks.get(this.currentLocale);
            translation = this.getTranslation(key, fallbackLocale);
        }

        if (!translation) {
            translation = this.getTranslation(key, this.defaultLocale) || key;
        }

        return this.interpolate(translation, variables);
    }

    getTranslation(key, locale) {
        const localeTranslations = this.translations.get(locale);
        if (!localeTranslations) {
            return null;
        }
        return key.split('.').reduce((obj, k) => (obj ? obj[k] : null), localeTranslations);
    }

    interpolate(text, variables) {
        if (typeof text !== 'string') {
            return text;
        }
        return text.replace(/\{\{(\w+)\}\}/g, (match, token) => {
            return Object.prototype.hasOwnProperty.call(variables, token) ? variables[token] : match;
        });
    }

    setLocale(locale) {
        if (this.translations.has(locale)) {
            this.currentLocale = locale;
            this.dispatchEvent('localeChange', { locale });
        }
        return this;
    }

    setFallback(locale, fallbackLocale) {
        this.fallbacks.set(locale, fallbackLocale);
        return this;
    }

    formatNumber(number, options = {}) {
        const formatter = this.getNumberFormatter(options);
        return formatter.format(number);
    }

    formatDate(date, options = {}) {
        const formatter = this.getDateFormatter(options);
        return formatter.format(date);
    }

    formatCurrency(amount, currency, options = {}) {
        const formatter = this.getNumberFormatter({ style: 'currency', currency, ...options });
        return formatter.format(amount);
    }

    getNumberFormatter(options = {}) {
        const key = JSON.stringify({ type: 'number', locale: this.currentLocale, options });
        if (!this.formatters.has(key)) {
            this.formatters.set(key, new Intl.NumberFormat(this.currentLocale, options));
        }
        return this.formatters.get(key);
    }

    getDateFormatter(options = {}) {
        const key = JSON.stringify({ type: 'date', locale: this.currentLocale, options });
        if (!this.formatters.has(key)) {
            this.formatters.set(key, new Intl.DateTimeFormat(this.currentLocale, options));
        }
        return this.formatters.get(key);
    }

    initFormatters() {
        this.formatters.clear();
    }

    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(callback);
        }
    }

    dispatchEvent(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('I18n event handler error:', error);
                }
            });
        }
    }

    getSupportedLocales() {
        return Array.from(this.translations.keys());
    }
}

module.exports = I18n;

