/**
 * ==========================================================
 * I18N v3 ENTERPRISE EDITION
 * ----------------------------------------------------------
 * Features
 * ----------------------------------------------------------
 * ✓ Nested locale fallbacks
 * ✓ Namespaces
 * ✓ Lazy loading
 * ✓ Relative time
 * ✓ Currency/Number/Date formatting
 * ✓ List formatting
 * ✓ Display names
 * ✓ RTL detection
 * ✓ Translation cache
 * ✓ Locale persistence
 * ✓ Middleware support
 * ✓ Missing translation registry
 * ✓ Event system
 * ✓ Async locale loading
 * ✓ Context translations
 * ✓ Pluralization
 * ==========================================================
 */

class I18n {

    constructor(options = {}) {

        this.defaultLocale =
            options.defaultLocale || "en";

        this.currentLocale =
            options.locale ||
            this.detectLocale() ||
            this.defaultLocale;

        this.translations = new Map();
        this.fallbacks = new Map();
        this.formatters = new Map();

        this.middlewares = [];
        this.missingKeys = new Set();

        this.eventHandlers = new Map();

        this.loaderCache = new Map();

        this.persistenceKey =
            options.persistenceKey ||
            "__i18n_locale__";

        this.missingHandler =
            options.onMissingTranslation ||
            ((key, locale) => {
                console.warn(
                    `[i18n] Missing "${key}" (${locale})`
                );
            });

        this.restoreLocale();

        this.initFormatters();
    }

    // =====================================================
    // TRANSLATIONS
    // =====================================================

    addTranslations(
        locale,
        translations,
        namespace = "default"
    ) {

        const locales =
            this.translations.get(locale) ||
            new Map();

        const existing =
            locales.get(namespace) || {};

        locales.set(
            namespace,
            this.deepMerge(
                existing,
                translations
            )
        );

        this.translations.set(
            locale,
            locales
        );

        return this;
    }

    async loadTranslations(
        locale,
        loader,
        namespace = "default"
    ) {

        const cacheKey =
            `${locale}:${namespace}`;

        if (
            this.loaderCache.has(cacheKey)
        ) {
            return this.loaderCache.get(
                cacheKey
            );
        }

        const promise =
            Promise.resolve(
                loader(locale)
            ).then(data => {

                this.addTranslations(
                    locale,
                    data,
                    namespace
                );

                this.dispatchEvent(
                    "translationsLoaded",
                    {
                        locale,
                        namespace
                    }
                );

                return data;
            });

        this.loaderCache.set(
            cacheKey,
            promise
        );

        return promise;
    }

    // =====================================================
    // LOCALE
    // =====================================================

    setLocale(locale) {

        this.currentLocale = locale;

        this.saveLocale(locale);

        this.initFormatters();

        this.dispatchEvent(
            "localeChange",
            { locale }
        );

        return this;
    }

    getLocale() {
        return this.currentLocale;
    }

    detectLocale() {

        if (
            typeof navigator === "undefined"
        ) {
            return this.defaultLocale;
        }

        return (
            navigator.language ||
            this.defaultLocale
        );
    }

    setFallback(
        locale,
        fallbacks
    ) {

        this.fallbacks.set(
            locale,
            Array.isArray(fallbacks)
                ? fallbacks
                : [fallbacks]
        );

        return this;
    }

    getLocaleChain() {

        const visited =
            new Set();

        const chain = [];

        const walk = locale => {

            if (
                !locale ||
                visited.has(locale)
            ) {
                return;
            }

            visited.add(locale);

            chain.push(locale);

            const fallbacks =
                this.fallbacks.get(locale);

            if (fallbacks) {
                fallbacks.forEach(walk);
            }
        };

        walk(this.currentLocale);

        if (
            !chain.includes(
                this.defaultLocale
            )
        ) {
            chain.push(
                this.defaultLocale
            );
        }

        return chain;
    }

    // =====================================================
    // TRANSLATE
    // =====================================================

    t(
        key,
        variables = {},
        options = {}
    ) {

        const {
            namespace = "default",
            count,
            context
        } = options;

        let value = null;

        const locales =
            this.getLocaleChain();

        for (const locale of locales) {

            value =
                this.getTranslation(
                    locale,
                    namespace,
                    key,
                    count,
                    context
                );

            if (value != null) {
                break;
            }
        }

        if (value == null) {

            this.missingKeys.add(
                `${this.currentLocale}:${key}`
            );

            this.missingHandler(
                key,
                this.currentLocale
            );

            return key;
        }

        let result =
            this.interpolate(
                value,
                variables
            );

        for (
            const middleware
            of this.middlewares
        ) {
            result =
                middleware(
                    result,
                    key,
                    options
                );
        }

        return result;
    }

    getTranslation(
        locale,
        namespace,
        key,
        count,
        context
    ) {

        const localeData =
            this.translations.get(locale);

        if (!localeData) {
            return null;
        }

        const dict =
            localeData.get(namespace);

        if (!dict) {
            return null;
        }

        let value =
            this.resolvePath(
                dict,
                key
            );

        // context
        if (
            context &&
            value?.[context]
        ) {
            value =
                value[context];
        }

        // plural
        if (
            count != null &&
            typeof value === "object"
        ) {

            const rule =
                new Intl.PluralRules(
                    locale
                ).select(count);

            value =
                value[rule] ??
                value.other;
        }

        return value;
    }

    // =====================================================
    // INTERPOLATION
    // =====================================================

    interpolate(
        text,
        variables
    ) {

        if (
            typeof text !== "string"
        ) {
            return text;
        }

        return text.replace(
            /\{\{([\w.]+)\}\}/g,
            (_, path) => {

                const value =
                    this.resolvePath(
                        variables,
                        path
                    );

                return value ??
                    `{{${path}}}`;
            }
        );
    }

    // =====================================================
    // FORMATTERS
    // =====================================================

    formatNumber(
        value,
        options = {}
    ) {
        return this.getFormatter(
            "number",
            options,
            () =>
                new Intl.NumberFormat(
                    this.currentLocale,
                    options
                )
        ).format(value);
    }

    formatCurrency(
        value,
        currency,
        options = {}
    ) {

        return this.formatNumber(
            value,
            {
                style: "currency",
                currency,
                ...options
            }
        );
    }

    formatDate(
        value,
        options = {}
    ) {

        return this.getFormatter(
            "date",
            options,
            () =>
                new Intl.DateTimeFormat(
                    this.currentLocale,
                    options
                )
        ).format(value);
    }

    formatRelativeTime(
        value,
        unit = "day"
    ) {

        return this.getFormatter(
            "relative",
            {},
            () =>
                new Intl.RelativeTimeFormat(
                    this.currentLocale
                )
        ).format(value, unit);
    }

    formatList(
        items,
        options = {}
    ) {

        return this.getFormatter(
            "list",
            options,
            () =>
                new Intl.ListFormat(
                    this.currentLocale,
                    options
                )
        ).format(items);
    }

    formatDisplayName(
        value,
        type = "language"
    ) {

        return this.getFormatter(
            "display",
            { type },
            () =>
                new Intl.DisplayNames(
                    [this.currentLocale],
                    { type }
                )
        ).of(value);
    }

    // =====================================================
    // RTL
    // =====================================================

    isRTL() {

        return [
            "ar",
            "he",
            "fa",
            "ur"
        ].some(code =>
            this.currentLocale.startsWith(
                code
            )
        );
    }

    // =====================================================
    // MIDDLEWARE
    // =====================================================

    use(fn) {

        if (
            typeof fn === "function"
        ) {
            this.middlewares.push(fn);
        }

        return this;
    }

    // =====================================================
    // FORMATTER CACHE
    // =====================================================

    getFormatter(
        type,
        options,
        factory
    ) {

        const key =
            JSON.stringify({
                type,
                locale:
                    this.currentLocale,
                options
            });

        if (
            !this.formatters.has(key)
        ) {
            this.formatters.set(
                key,
                factory()
            );
        }

        return this.formatters.get(
            key
        );
    }

    initFormatters() {
        this.formatters.clear();
    }

    // =====================================================
    // PERSISTENCE
    // =====================================================

    saveLocale(locale) {

        try {
            localStorage.setItem(
                this.persistenceKey,
                locale
            );
        } catch {}
    }

    restoreLocale() {

        try {

            const locale =
                localStorage.getItem(
                    this.persistenceKey
                );

            if (locale) {
                this.currentLocale =
                    locale;
            }

        } catch {}
    }

    // =====================================================
    // EVENTS
    // =====================================================

    on(event, handler) {

        if (
            !this.eventHandlers.has(
                event
            )
        ) {
            this.eventHandlers.set(
                event,
                new Set()
            );
        }

        this.eventHandlers
            .get(event)
            .add(handler);

        return () =>
            this.off(
                event,
                handler
            );
    }

    off(event, handler) {
        this.eventHandlers
            .get(event)
            ?.delete(handler);
    }

    dispatchEvent(
        event,
        payload
    ) {

        this.eventHandlers
            .get(event)
            ?.forEach(fn => {

                try {
                    fn(payload);
                } catch (err) {
                    console.error(err);
                }
            });
    }

    // =====================================================
    // UTILITIES
    // =====================================================

    resolvePath(obj, path) {

        return path
            .split(".")
            .reduce(
                (acc, key) =>
                    acc?.[key],
                obj
            );
    }

    deepMerge(
        target,
        source
    ) {

        for (const key of Object.keys(
            source
        )) {

            const value =
                source[key];

            if (
                value &&
                typeof value ===
                    "object" &&
                !Array.isArray(value)
            ) {

                target[key] =
                    this.deepMerge(
                        target[key] || {},
                        value
                    );

            } else {

                target[key] = value;
            }
        }

        return target;
    }

    getMissingKeys() {
        return [...this.missingKeys];
    }
}

module.exports = I18n;
