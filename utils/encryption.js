/**
 * Modern Encryption Utility using Web Crypto API with PBKDF2 + AES-GCM
 * Strong security upgrade to your original version.
 */

export class Encryption {

    // === Helper Functions ===
    static encode(data) {
        return new TextEncoder().encode(data);
    }

    static decode(data) {
        return new TextDecoder().decode(data);
    }

    static toBase64(bytes) {
        return btoa(String.fromCharCode(...bytes));
    }

    static fromBase64(str) {
        return Uint8Array.from(atob(str), c => c.charCodeAt(0));
    }

    // === Secure PBKDF2 Key Derivation ===
    static async deriveKey(password, salt, iterations = 100000) {
        const baseKey = await crypto.subtle.importKey(
            "raw",
            this.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations,
                hash: "SHA-256"
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Encrypt data using password
     */
    static async encrypt(data, password) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const salt = crypto.getRandomValues(new Uint8Array(16));

        const key = await this.deriveKey(password, salt);

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            this.encode(data)
        );

        const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(encrypted), salt.length + iv.length);

        return this.toBase64(result);
    }

    /**
     * Decrypt data using password
     */
    static async decrypt(encryptedData, password) {
        try {
            const data = this.fromBase64(encryptedData);

            const salt = data.slice(0, 16);
            const iv = data.slice(16, 16 + 12);
            const encrypted = data.slice(28);

            const key = await this.deriveKey(password, salt);

            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                encrypted
            );

            return this.decode(decrypted);

        } catch (err) {
            throw new Error("Decryption failed: Invalid password or corrupted data");
        }
    }

    /**
     * SHA-256 Hash (Hex)
     */
    static async hash(data) {
        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            this.encode(data)
        );
        return [...new Uint8Array(hashBuffer)]
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    /**
     * Create HMAC-SHA256 signature
     */
    static async createHMAC(data, secret) {
        const key = await crypto.subtle.importKey(
            "raw",
            this.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signature = await crypto.subtle.sign(
            "HMAC",
            key,
            this.encode(data)
        );

        return this.toBase64(new Uint8Array(signature));
    }

    /**
     * Constant-time compare to prevent timing attacks
     */
    static timingSafeEqual(a, b) {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    /**
     * Verify HMAC signature
     */
    static async verifyHMAC(data, signature, secret) {
        const expected = await this.createHMAC(data, secret);
        return this.timingSafeEqual(expected, signature);
    }
}
