// Basic cryptography utilities (for educational purposes)
class CryptoUtils {
    static base64Encode(str) {
        return Buffer.from(str).toString('base64');
    }
    
    static base64Decode(str) {
        return Buffer.from(str, 'base64').toString('utf8');
    }
    
    static simpleXOREncrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }
    
    static generateRandomString(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    static hashSimple(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    
    static validatePassword(password) {
        const requirements = {
            length: password.length >= 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        return {
            isValid: Object.values(requirements).every(Boolean),
            requirements
        };
    }
}

module.exports = CryptoUtils;

