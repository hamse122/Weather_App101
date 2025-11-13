// Basic cryptography utilities (for educational purposes)
class CryptoUtils {
    static base64Encode(str) {
        if (typeof str !== 'string') {
            throw new Error('Input must be a string');
        }
        return Buffer.from(str).toString('base64');
    }
    
    static base64Decode(str) {
        if (typeof str !== 'string') {
            throw new Error('Input must be a string');
        }
        // Validate base64 string
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
            throw new Error('Invalid base64 string');
        }
        return Buffer.from(str, 'base64').toString('utf8');
    }
    
    static base64UrlEncode(str) {
        return this.base64Encode(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
    
    static base64UrlDecode(str) {
        // Add padding if needed
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        return this.base64Decode(base64);
    }
    
    static simpleXOREncrypt(text, key) {
        if (!text || !key) {
            throw new Error('Text and key are required');
        }
        if (key.length === 0) {
            throw new Error('Key cannot be empty');
        }
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }
    
    // XOR is symmetric - same function for encrypt and decrypt
    static simpleXORDecrypt(encryptedText, key) {
        return this.simpleXOREncrypt(encryptedText, key);
    }
    
    static generateRandomString(length = 32) {
        if (length <= 0) {
            throw new Error('Length must be positive');
        }
        
        // Use crypto.getRandomValues if available (browser)
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(length);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        
        // Fallback for Node.js
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    static generateSecureRandom(length = 32) {
        try {
            const crypto = require('crypto');
            return crypto.randomBytes(length).toString('hex');
        } catch (error) {
            console.warn('Crypto module not available, falling back to Math.random()');
            return this.generateRandomString(length);
        }
    }
    
    static hashSimple(str) {
        if (typeof str !== 'string') {
            throw new Error('Input must be a string');
        }
        
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
    
    // More robust hash function using SHA-256 (Node.js)
    static async hashSHA256(str) {
        try {
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(str).digest('hex');
        } catch (error) {
            console.warn('Crypto module not available, falling back to simple hash');
            return this.hashSimple(str);
        }
    }
    
    static validatePassword(password) {
        if (typeof password !== 'string') {
            throw new Error('Password must be a string');
        }
        
        const requirements = {
            length: password.length >= 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            noSpaces: !/\s/.test(password),
            notCommon: !this.isCommonPassword(password)
        };
        
        const strengthScore = Object.values(requirements).filter(Boolean).length;
        let strengthLevel = 'weak';
        if (strengthScore >= 5) strengthLevel = 'medium';
        if (strengthScore >= 6) strengthLevel = 'strong';
        if (strengthScore >= 7) strengthLevel = 'very strong';
        
        return {
            isValid: requirements.length && requirements.hasUpperCase && 
                     requirements.hasLowerCase && requirements.hasNumbers &&
                     requirements.noSpaces,
            requirements,
            strengthScore,
            strengthLevel
        };
    }
    
    static isCommonPassword(password) {
        const commonPasswords = [
            'password', '123456', '12345678', 'qwerty', 'abc123',
            'password1', '12345', '123456789', 'letmein', 'welcome'
        ];
        return commonPasswords.includes(password.toLowerCase());
    }
    
    // Password strength meter (0-100)
    static passwordStrength(password) {
        let score = 0;
        
        // Length bonus
        score += Math.min(password.length * 4, 25);
        
        // Character variety bonuses
        if (/[a-z]/.test(password)) score += 10;
        if (/[A-Z]/.test(password)) score += 10;
        if (/\d/.test(password)) score += 10;
        if (/[^a-zA-Z0-9]/.test(password)) score += 15;
        
        // Deductions for patterns
        if (/(.)\1{2,}/.test(password)) score -= 10; // repeated chars
        if (/^[0-9]+$/.test(password)) score -= 15; // only numbers
        if (/^[a-zA-Z]+$/.test(password)) score -= 15; // only letters
        
        return Math.max(0, Math.min(100, score));
    }
    
    // Simple Caesar cipher for educational purposes
    static caesarCipher(text, shift, encrypt = true) {
        if (typeof text !== 'string') {
            throw new Error('Text must be a string');
        }
        
        if (!encrypt) {
            shift = (26 - shift) % 26;
        }
        
        return text.replace(/[a-z]/gi, char => {
            const code = char.charCodeAt(0);
            const isUpperCase = code >= 65 && code <= 90;
            const base = isUpperCase ? 65 : 97;
            
            return String.fromCharCode(((code - base + shift) % 26) + base);
        });
    }
    
    // Generate password based on requirements
    static generatePassword(options = {}) {
        const {
            length = 12,
            includeUpperCase = true,
            includeLowerCase = true,
            includeNumbers = true,
            includeSpecial = true
        } = options;
        
        const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        let chars = '';
        let password = '';
        
        if (includeUpperCase) chars += upperCase;
        if (includeLowerCase) chars += lowerCase;
        if (includeNumbers) chars += numbers;
        if (includeSpecial) chars += special;
        
        if (chars.length === 0) {
            throw new Error('At least one character type must be included');
        }
        
        // Ensure at least one character from each selected type
        if (includeUpperCase) password += upperCase[Math.floor(Math.random() * upperCase.length)];
        if (includeLowerCase) password += lowerCase[Math.floor(Math.random() * lowerCase.length)];
        if (includeNumbers) password += numbers[Math.floor(Math.random() * numbers.length)];
        if (includeSpecial) password += special[Math.floor(Math.random() * special.length)];
        
        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
    
    // Timing-safe string comparison
    static constantTimeCompare(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') {
            return false;
        }
        
        if (a.length !== b.length) {
            return false;
        }
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
}

module.exports = CryptoUtils;
