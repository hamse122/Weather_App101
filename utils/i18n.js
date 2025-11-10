/**
 * Internationalization (i18n) Utility
 * Internationalization system for multi-language support
 */

/**
 * I18n class for managing translations
 */
export class I18n {
    constructor() {
        this.translations = new Map();
        this.currentLocale = 'en';
        this.fallbackLocale = 'en';
        this.listeners = [];
    }
    
    /**
     * Add translations for a locale
     * @param {string} locale - Locale code
     * @param {Object} translations - Translations object
     */
    addTranslations(locale, translations) {
        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }
        
        const existing = this.translations.get(locale);
        this.translations.set(locale, { ...existing, ...translations });
    }
    
    /**
     * Set current locale
     * @param {string} locale - Locale code
     */
    setLocale(locale) {
        if (this.translations.has(locale) || locale === this.fallbackLocale) {
            this.currentLocale = locale;
            this.notifyListeners(locale);
        }
    }
    
    /**
     * Get current locale
     * @returns {string} - Current locale code
     */
    getLocale() {
        return this.currentLocale;
    }
    
    /**
     * Translate a key
     * @param {string} key - Translation key
     * @param {Object} params - Parameters for interpolation
     * @returns {string} - Translated string
     */
    t(key, params = {}) {
        const translations = this.translations.get(this.currentLocale)
            || this.translations.get(this.fallbackLocale)
            || {};
        
        let translation = translations[key] || key;
        
        if (params && Object.keys(params).length > 0) {
            translation = translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
                return params[paramKey] !== undefined ? params[paramKey] : match;
            });
        }
        
        return translation;
    }
    
    /**
     * Check if a translation exists
     * @param {string} key - Translation key
     * @returns {boolean} - True if translation exists
     */
    has(key) {
        const translations = this.translations.get(this.currentLocale)
            || this.translations.get(this.fallbackLocale)
            || {};
        return key in translations;
    }
    
    /**
     * Get all translations for current locale
     * @returns {Object} - Translations object
     */
    getAll() {
        return this.translations.get(this.currentLocale)
            || this.translations.get(this.fallbackLocale)
            || {};
    }
    
    /**
     * Subscribe to locale changes
     * @param {Function} listener - Listener function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) this.listeners.splice(index, 1);
        };
    }
    
    /**
     * Notify all listeners
     * @param {string} locale - New locale
     */
    notifyListeners(locale) {
        this.listeners.forEach(listener => {
            listener({ locale, translations: this.getAll() });
        });
    }
    
    /**
     * Set fallback locale
     * @param {string} locale - Fallback locale code
     */
    setFallbackLocale(locale) {
        this.fallbackLocale = locale;
    }
    
    /**
     * Get available locales
     * @returns {Array} - Array of available locale codes
     */
    getAvailableLocales() {
        return Array.from(this.translations.keys());
    }
}

// Global i18n instance
export const i18n = new I18n();
