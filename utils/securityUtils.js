/**
 * Security Utilities
 * Security helpers for common security tasks
 */

/**
 * SecurityUtils class for security-related utilities
 */
export class SecurityUtils {
    /**
     * Sanitize HTML string to prevent XSS
     * @param {string} html - HTML string to sanitize
     * @returns {string} - Sanitized HTML string
     */
    static sanitizeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    /**
     * Escape HTML special characters
     * @param {string} str - String to escape
     * @returns {string} - Escaped string
     */
    static escapeHTML(str) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    }
    
    /**
     * Generate a random token
     * @param {number} length - Token length
     * @returns {string} - Random token
     */
    static generateToken(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        
        for (let i = 0; i < length; i++) {
            token += chars[array[i] % chars.length];
        }
        
        return token;
    }
    
    /**
     * Generate a random UUID
     * @returns {string} - UUID string
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Hash a string using SHA-256
     * @param {string} str - String to hash
     * @returns {Promise<string>} - Hashed string
     */
    static async hashSHA256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Validate CSP (Content Security Policy) header
     * @param {string} csp - CSP header value
     * @returns {boolean} - True if CSP is valid
     */
    static validateCSP(csp) {
        const directives = ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src'];
        return directives.some(directive => csp.includes(directive));
    }
    
    /**
     * Check if a URL is safe
     * @param {string} url - URL to check
     * @returns {boolean} - True if URL is safe
     */
    static isSafeURL(url) {
        try {
            const parsed = new URL(url);
            return !['javascript:', 'data:', 'vbscript:'].includes(parsed.protocol.toLowerCase());
        } catch {
            return false;
        }
    }
    
    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} - Validation result
     */
    static validatePasswordStrength(password) {
        const result = {
            strength: 0,
            feedback: []
        };
        
        if (password.length >= 8) result.strength++;
        else result.feedback.push('Password should be at least 8 characters long');
        
        if (/[a-z]/.test(password)) result.strength++;
        else result.feedback.push('Password should contain lowercase letters');
        
        if (/[A-Z]/.test(password)) result.strength++;
        else result.feedback.push('Password should contain uppercase letters');
        
        if (/[0-9]/.test(password)) result.strength++;
        else result.feedback.push('Password should contain numbers');
        
        if (/[^a-zA-Z0-9]/.test(password)) result.strength++;
        else result.feedback.push('Password should contain special characters');
        
        return result;
    }
}
