// Data formatting utilities
class Formatter {
    static formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }
    
    static formatDate(date, format = 'medium', locale = 'en-US') {
        const dateObj = new Date(date);
        const options = {};
        
        switch (format) {
            case 'short':
                options.year = 'numeric';
                options.month = 'numeric';
                options.day = 'numeric';
                break;
            case 'medium':
                options.year = 'numeric';
                options.month = 'short';
                options.day = 'numeric';
                break;
            case 'long':
                options.year = 'numeric';
                options.month = 'long';
                options.day = 'numeric';
                break;
            case 'full':
                options.weekday = 'long';
                options.year = 'numeric';
                options.month = 'long';
                options.day = 'numeric';
                break;
        }
        
        return dateObj.toLocaleDateString(locale, options);
    }
    
    static formatNumber(number, options = {}) {
        const {
            minimumFractionDigits = 0,
            maximumFractionDigits = 2,
            locale = 'en-US'
        } = options;
        
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits,
            maximumFractionDigits
        }).format(number);
    }
    
    static formatPhoneNumber(phoneNumber, country = 'US') {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        switch (country) {
            case 'US':
                if (cleanNumber.length === 10) {
                    return `(${cleanNumber.slice(0, 3)}) ${cleanNumber.slice(3, 6)}-${cleanNumber.slice(6)}`;
                }
                break;
            default:
                return cleanNumber;
        }
        
        return phoneNumber;
    }
    
    static truncateText(text, maxLength, suffix = '...') {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }
    
    static slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    }
    
    static capitalizeWords(text) {
        return text.replace(/\b\w/g, char => char.toUpperCase());
    }
}

module.exports = Formatter;

