// formatter.js (Upgraded v2)

class Formatter {
    /* -------------------- Internal Cache -------------------- */
    static #cache = new Map();

    static #getFormatter(key, factory) {
        if (!this.#cache.has(key)) {
            this.#cache.set(key, factory());
        }
        return this.#cache.get(key);
    }

    /* -------------------- Currency -------------------- */
    static formatCurrency(amount, options = {}) {
        const {
            currency = 'USD',
            locale = 'en-US',
            minimumFractionDigits,
            maximumFractionDigits
        } = options;

        if (!Number.isFinite(amount)) return '';

        const key = `currency-${locale}-${currency}-${minimumFractionDigits}-${maximumFractionDigits}`;

        const formatter = this.#getFormatter(key, () =>
            new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
                minimumFractionDigits,
                maximumFractionDigits
            })
        );

        return formatter.format(amount);
    }

    /* -------------------- Dates -------------------- */
    static formatDate(date, options = {}) {
        const {
            format = 'medium',
            locale = 'en-US',
            timeZone = 'UTC'
        } = options;

        const dateObj = new Date(date);
        if (isNaN(dateObj)) return '';

        const formats = {
            short: { year: 'numeric', month: 'numeric', day: 'numeric' },
            medium: { year: 'numeric', month: 'short', day: 'numeric' },
            long: { year: 'numeric', month: 'long', day: 'numeric' },
            full: {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        };

        const key = `date-${locale}-${format}-${timeZone}`;

        const formatter = this.#getFormatter(key, () =>
            new Intl.DateTimeFormat(locale, {
                ...(formats[format] || formats.medium),
                timeZone
            })
        );

        return formatter.format(dateObj);
    }

    /* -------------------- Relative Time -------------------- */
    static formatRelativeTime(date, locale = 'en-US') {
        const now = Date.now();
        const diff = (new Date(date).getTime() - now) / 1000;

        const units = [
            { unit: 'year', value: 31536000 },
            { unit: 'month', value: 2592000 },
            { unit: 'day', value: 86400 },
            { unit: 'hour', value: 3600 },
            { unit: 'minute', value: 60 },
            { unit: 'second', value: 1 }
        ];

        for (const { unit, value } of units) {
            if (Math.abs(diff) >= value) {
                const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
                return formatter.format(Math.round(diff / value), unit);
            }
        }

        return 'now';
    }

    /* -------------------- Numbers -------------------- */
    static formatNumber(value, options = {}) {
        const {
            locale = 'en-US',
            minimumFractionDigits = 0,
            maximumFractionDigits = 2
        } = options;

        if (!Number.isFinite(value)) return '';

        const key = `number-${locale}-${minimumFractionDigits}-${maximumFractionDigits}`;

        const formatter = this.#getFormatter(key, () =>
            new Intl.NumberFormat(locale, {
                minimumFractionDigits,
                maximumFractionDigits
            })
        );

        return formatter.format(value);
    }

    static formatCompactNumber(value, locale = 'en-US') {
        if (!Number.isFinite(value)) return '';

        return new Intl.NumberFormat(locale, {
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(value);
    }

    static formatPercent(value, locale = 'en-US') {
        if (!Number.isFinite(value)) return '';

        return new Intl.NumberFormat(locale, {
            style: 'percent',
            maximumFractionDigits: 2
        }).format(value);
    }

    /* -------------------- Phone Numbers -------------------- */
    static formatPhoneNumber(phoneNumber, { countryCode = 'US', international = true } = {}) {
        if (!phoneNumber) return '';

        const digits = phoneNumber.replace(/\D/g, '');

        // Basic US format
        if (countryCode === 'US' && digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }

        // International fallback
        return international ? `+${digits}` : digits;
    }

    /* -------------------- Text Utilities -------------------- */
    static truncateText(text, maxLength, options = {}) {
        const { suffix = '...', wordSafe = true } = options;

        if (!text || text.length <= maxLength) return text;

        const cut = maxLength - suffix.length;
        let truncated = text.slice(0, cut);

        if (wordSafe) {
            truncated = truncated.replace(/\s+\S*$/, '');
        }

        return truncated + suffix;
    }

    static slugify(text) {
        if (!text) return '';

        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    static capitalizeWords(text) {
        if (!text) return '';
        return text.replace(/\b\p{L}/gu, c => c.toUpperCase());
    }

    static getInitials(text, max = 2) {
        if (!text) return '';

        return text
            .trim()
            .split(/\s+/)
            .slice(0, max)
            .map(w => w[0]?.toUpperCase() || '')
            .join('');
    }

    /* -------------------- File Size -------------------- */
    static formatFileSize(bytes, decimals = 2) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${units[i]}`;
    }
}

/* CommonJS + ES Module */
module.exports = Formatter;
module.exports.default = Formatter;
