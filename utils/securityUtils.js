/**
 * Security Utilities
 * Provides safe, reusable helpers for handling common security operations
 * such as sanitization, hashing, token generation, and validation.
 */

export class SecurityUtils {
    /**
     * Safely sanitize HTML content to prevent XSS.
     * Converts HTML into plain text by escaping all tags.
     * NOTE: For heavy sanitization, integrate DOMPurify.
     *
     * @param {string} html - The HTML string to sanitize.
     * @returns {string} - Sanitized and safe HTML string.
     */
    static sanitizeHTML(html) {
        const wrapper = document.createElement('div');
        wrapper.textContent = String(html);
        return wrapper.innerHTML;
    }

    /**
     * Escape HTML special characters.
     *
     * @param {string} str - String to escape.
     * @returns {string} - Escaped string safe for output.
     */
    static escapeHTML(str) {
        if (!str) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return String(str).replace(/[&<>"']/g, char => map[char]);
    }

    /**
     * Generate a cryptographically secure random token.
     *
     * @param {number} length - Token length.
     * @returns {string} - Secure random token.
     */
    static generateToken(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);

        return Array.from(array, v => chars[v % chars.length]).join('');
    }

    /**
     * Generate a RFC4122 version 4 UUID using crypto API.
     *
     * @returns {string} - Random UUID (v4).
     */
    static generateUUID() {
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // Fallback for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Hash a string using SHA-256 (crypto.subtle).
     *
     * @param {string} str - Input string to hash.
     * @returns {Promise<string>} - Hexadecimal hash string.
     */
    static async hashSHA256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const bytes = new Uint8Array(hashBuffer);

        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Validate a Content Security Policy header.
     * Ensures that mandatory directives exist.
     *
     * @param {string} csp - CSP header string.
     * @returns {boolean} - True if valid CSP format is detected.
     */
    static validateCSP(csp) {
        if (typeof csp !== 'string' || !csp.trim()) return false;

        const requiredDirectives = [
            'default-src',
            'script-src',
            'style-src',
            'img-src',
            'connect-src',
        ];

        return requiredDirectives.every(dir => csp.includes(dir));
    }

    /**
     * Check if a URL is safe and does not use dangerous schemes.
     *
     * @param {string} url - URL to validate.
     * @returns {boolean} - True if safe.
     */
    static isSafeURL(url) {
        try {
            const parsed = new URL(url);
            const unsafeProtocols = ['javascript:', 'data:', 'vbscript:'];

            return !unsafeProtocols.includes(parsed.protocol.toLowerCase());
        } catch {
            return false;
        }
    }

    /**
     * Validate password strength score based on security criteria.
     *
     * @param {string} password - Password to validate.
     * @returns {{
     *   strength: number,
     *   feedback: string[],
     *   isStrong: boolean
     * }}
     */
    static validatePasswordStrength(password) {
        const feedback = [];
        let score = 0;

        if (password.length >= 8) score++;
        else feedback.push('Password must be at least 8 characters long');

        if (/[a-z]/.test(password)) score++;
        else feedback.push('Add at least one lowercase letter');

        if (/[A-Z]/.test(password)) score++;
        else feedback.push('Add at least one uppercase letter');

        if (/[0-9]/.test(password)) score++;
        else feedback.push('Include at least one number');

        if (/[^a-zA-Z0-9]/.test(password)) score++;
        else feedback.push('Use at least one special character');

        return {
            strength: score,
            feedback,
            isStrong: score >= 4,
        };
    }
}
