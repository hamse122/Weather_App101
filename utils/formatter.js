// formatter.js

class Formatter {
    /* -------------------- Currency -------------------- */
    static formatCurrency(
        amount,
        {
            currency = 'USD',
            locale = 'en-US',
            minimumFractionDigits,
            maximumFractionDigits
        } = {}
    ) {
        if (typeof amount !== 'number' || isNaN(amount)) return '';

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits,
            maximumFractionDigits
        }).format(amount);
    }

    /* -------------------- Dates -------------------- */
    static formatDate(
        date,
        { format = 'medium', locale = 'en-US', timeZone } = {}
    ) {
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

        return dateObj.toLocaleDateString(locale, {
            ...(formats[format] || formats.medium),
            timeZone
        });
    }

    /* -------------------- Numbers -------------------- */
    static formatNumber(
        value,
        {
            locale = 'en-US',
            minimumFractionDigits = 0,
            maximumFractionDigits = 2
        } = {}
    ) {
        if (typeof value !== 'number' || isNaN(value)) return '';

        return new Intl.NumberFormat(locale, {
            minimumFractionDigits,
            maximumFractionDigits
        }).format(value);
    }

    static formatPercent(value, locale = 'en-US') {
        if (typeof value !== 'number') return '';
        return new Intl.NumberFormat(locale, {
            style: 'percent',
            maximumFractionDigits: 2
        }).format(value);
    }

    /* -------------------- Phone Numbers -------------------- */
    static formatPhoneNumber(phoneNumber, countryCode = 'US') {
        if (!phoneNumber) return '';

        const digits = phoneNumber.replace(/\D/g, '');

        if (countryCode === 'US' && digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }

        // Basic international fallback (E.164-ish)
        if (digits.length >= 8) {
            return `+${digits}`;
        }

        return phoneNumber;
    }

    /* -------------------- Text Utilities -------------------- */
    static truncateText(text, maxLength, { suffix = '...', wordSafe = true } = {}) {
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
            .normalize('NFD')                 // remove accents
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    static capitalizeWords(text) {
        if (!text) return '';
        return text.replace(/\b\p{L}/gu, char => char.toUpperCase());
    }

    static getInitials(text, max = 2) {
        if (!text) return '';
        return text
            .trim()
            .split(/\s+/)
            .slice(0, max)
            .map(w => w[0].toUpperCase())
            .join('');
    }

    /* -------------------- File Size -------------------- */
    static formatFileSize(bytes, decimals = 2) {
        if (typeof bytes !== 'number' || bytes <= 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${units[i]}`;
    }
}

/* CommonJS + ES Module support */
module.exports = Formatter;
module.exports.default = Formatter;
