/**
 * Encryption Utility
 * Encryption and decryption utilities using Web Crypto API
 */

/**
 * Encryption class for encrypting and decrypting data
 */
export class Encryption {
    /**
     * Generate a key for encryption
     * @param {string} password - Password for key derivation
     * @returns {Promise<CryptoKey>} - Generated key
     */
    static async generateKey(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return crypto.subtle.importKey(
            'raw',
            hash,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    /**
     * Encrypt data
     * @param {string} data - Data to encrypt
     * @param {string} password - Encryption password
     * @returns {Promise<string>} - Encrypted data as base64 string
     */
    static async encrypt(data, password) {
        const key = await this.generateKey(password);
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encoder.encode(data)
        );
        
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return btoa(String.fromCharCode.apply(null, combined));
    }
    
    /**
     * Decrypt data
     * @param {string} encryptedData - Encrypted data as base64 string
     * @param {string} password - Decryption password
     * @returns {Promise<string>} - Decrypted data
     */
    static async decrypt(encryptedData, password) {
        try {
            const key = await this.generateKey(password);
            const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            throw new Error('Decryption failed: Invalid password or corrupted data');
        }
    }
    
    /**
     * Hash data using SHA-256
     * @param {string} data - Data to hash
     * @returns {Promise<string>} - Hashed data as hex string
     */
    static async hash(data) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Create HMAC signature
     * @param {string} data - Data to sign
     * @param {string} secret - Secret key
     * @returns {Promise<string>} - HMAC signature as base64 string
     */
    static async createHMAC(data, secret) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
        return btoa(String.fromCharCode.apply(null, new Uint8Array(signature)));
    }
    
    /**
     * Verify HMAC signature
     * @param {string} data - Data to verify
     * @param {string} signature - HMAC signature
     * @param {string} secret - Secret key
     * @returns {Promise<boolean>} - True if signature is valid
     */
    static async verifyHMAC(data, signature, secret) {
        const expectedSignature = await this.createHMAC(data, secret);
        return expectedSignature === signature;
    }
}
