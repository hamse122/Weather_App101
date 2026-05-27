/**
 * Security Utilities
 * Hardened helpers for sanitization, hashing, token generation,
 * validation, and safe comparisons.
 *
 * Browser + Node.js compatible.
 */

const cryptoAPI =
    typeof crypto !== 'undefined'
        ? crypto
        : await import('node:crypto').then(m => m.webcrypto);

export class SecurityUtils {
    /* ----------------------------- SANITIZATION ----------------------------- */

    /**
     * Safely sanitize HTML content to prevent XSS.
     * Escapes all HTML into plain text.
     * NOTE: For rich HTML sanitization, use DOMPurify.
     *
     * @param {unknown} html
     * @returns {string}
     */
    static sanitizeHTML(html) {
        if (typeof document === 'undefined') {
            return SecurityUtils.escapeHTML(html);
        }

        const wrapper = document.createElement('div');
        wrapper.textContent = String(html ?? '');
        return wrapper.innerHTML;
    }

    /**
     * Escape HTML special characters.
     *
     * @param {unknown} str
     * @returns {string}
     */
    static escapeHTML(str) {
        if (str == null) return '';

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '`': '&#096;',
        };

        return String(str).replace(/[&<>"'`]/g, ch => map[ch]);
    }

    /**
     * Strip dangerous tags completely.
     *
     * @param {string} html
     * @returns {string}
     */
    static stripDangerousTags(html = '') {
        return String(html).replace(
            /<\/?(script|iframe|object|embed|style|link|meta)[^>]*>/gi,
            ''
        );
    }

    /* ---------------------------- RANDOM HELPERS ----------------------------- */

    /**
     * Generate a cryptographically secure random token.
     * Uses rejection sampling to avoid modulo bias.
     *
     * @param {number} length
     * @returns {string}
     */
    static generateToken(length = 32) {
        const chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const max = chars.length;

        const result = [];
        const randomBytes = new Uint8Array(length * 2);

        while (result.length < length) {
            cryptoAPI.getRandomValues(randomBytes);

            for (const byte of randomBytes) {
                if (byte < max * 4) {
                    result.push(chars[byte % max]);
                }

                if (result.length === length) break;
            }
        }

        return result.join('');
    }

    /**
     * Generate RFC4122 UUID v4.
     *
     * @returns {string}
     */
    static generateUUID() {
        if (typeof cryptoAPI.randomUUID === 'function') {
            return cryptoAPI.randomUUID();
        }

        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = cryptoAPI.getRandomValues(new Uint8Array(1))[0] & 15;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Generate secure random bytes in hex format.
     *
     * @param {number} size
     * @returns {string}
     */
    static randomHex(size = 32) {
        const bytes = new Uint8Array(size);
        cryptoAPI.getRandomValues(bytes);

        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /* ------------------------------- HASHING -------------------------------- */

    /**
     * Hash a string using SHA-256.
     *
     * @param {string} str
     * @returns {Promise<string>}
     */
    static async hashSHA256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(String(str));

        const hashBuffer = await cryptoAPI.subtle.digest(
            'SHA-256',
            data
        );

        return [...new Uint8Array(hashBuffer)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Hash a string using SHA-512.
     *
     * @param {string} str
     * @returns {Promise<string>}
     */
    static async hashSHA512(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(String(str));

        const hashBuffer = await cryptoAPI.subtle.digest(
            'SHA-512',
            data
        );

        return [...new Uint8Array(hashBuffer)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Timing-safe string comparison.
     *
     * @param {string} a
     * @param {string} b
     * @returns {boolean}
     */
    static timingSafeEqual(a, b) {
        a = String(a);
        b = String(b);

        if (a.length !== b.length) return false;

        let diff = 0;

        for (let i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return diff === 0;
    }

    /* --------------------------- CSP VALIDATION ------------------------------ */

    /**
     * Validate CSP header format and required directives.
     *
     * @param {string} csp
     * @returns {boolean}
     */
    static validateCSP(csp) {
        if (typeof csp !== 'string' || !csp.trim()) {
            return false;
        }

        const directives = csp
            .split(';')
            .map(d => d.trim().split(/\s+/)[0])
            .filter(Boolean);

        const required = [
            'default-src',
            'script-src',
            'style-src',
            'img-src',
            'connect-src',
        ];

        return required.every(d => directives.includes(d));
    }

    /* ------------------------------ URL SAFETY ------------------------------- */

    /**
     * Validate URL safety and protocol.
     *
     * @param {string} url
     * @returns {boolean}
     */
    static isSafeURL(url) {
        try {
            const parsed = new URL(url, 'http://localhost');

            const allowedProtocols = ['http:', 'https:'];

            if (!allowedProtocols.includes(parsed.protocol)) {
                return false;
            }

            const lower = parsed.href.toLowerCase();

            const blockedPatterns = [
                'javascript:',
                'data:text/html',
                'vbscript:',
            ];

            if (blockedPatterns.some(p => lower.includes(p))) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if URL uses HTTPS.
     *
     * @param {string} url
     * @returns {boolean}
     */
    static isHTTPS(url) {
        try {
            return new URL(url).protocol === 'https:';
        } catch {
            return false;
        }
    }

    /* ------------------------- PASSWORD VALIDATION --------------------------- */

    /**
     * Validate password strength.
     *
     * @param {string} password
     * @returns {{
     *   strength: number,
     *   feedback: string[],
     *   isStrong: boolean,
     *   entropyBits: number
     * }}
     */
    static validatePasswordStrength(password = '') {
        const feedback = [];
        let score = 0;

        if (password.length >= 12) score++;
        else feedback.push('Password should be at least 12 characters long');

        if (/[a-z]/.test(password)) score++;
        else feedback.push('Add at least one lowercase letter');

        if (/[A-Z]/.test(password)) score++;
        else feedback.push('Add at least one uppercase letter');

        if (/[0-9]/.test(password)) score++;
        else feedback.push('Include at least one number');

        if (/[^a-zA-Z0-9]/.test(password)) score++;
        else feedback.push('Use at least one special character');

        if (!/(.)\1{2,}/.test(password)) score++;
        else feedback.push('Avoid repeated characters');

        const poolSize =
            (/[a-z]/.test(password) ? 26 : 0) +
            (/[A-Z]/.test(password) ? 26 : 0) +
            (/[0-9]/.test(password) ? 10 : 0) +
            (/[^a-zA-Z0-9]/.test(password) ? 32 : 0);

        const entropyBits =
            poolSize > 0
                ? Math.round(password.length * Math.log2(poolSize))
                : 0;

        return {
            strength: score,
            feedback,
            isStrong: score >= 5 && entropyBits >= 60,
            entropyBits,
        };
    }

    /* ----------------------------- INPUT CHECKS ------------------------------ */

    /**
     * Validate email format.
     *
     * @param {string} email
     * @returns {boolean}
     */
    static isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
    }

    /**
     * Validate username.
     *
     * @param {string} username
     * @returns {boolean}
     */
    static isValidUsername(username) {
        return /^[a-zA-Z0-9_-]{3,20}$/.test(String(username));
    }

    /**
     * Validate JSON safely.
     *
     * @param {string} str
     * @returns {boolean}
     */
    static isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    /* ------------------------------- UTILITIES ------------------------------- */

    /**
     * Deep freeze object for immutability.
     *
     * @param {object} obj
     * @returns {object}
     */
    static deepFreeze(obj) {
        Object.freeze(obj);

        for (const key of Object.keys(obj)) {
            const value = obj[key];

            if (
                value &&
                typeof value === 'object' &&
                !Object.isFrozen(value)
            ) {
                SecurityUtils.deepFreeze(value);
            }
        }

        return obj;
    }
}
