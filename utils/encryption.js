/**
 * Advanced Encryption Utility
 * PBKDF2 + AES-256-GCM (Web Crypto API)
 * Versioned, authenticated, hardened
 */

export class Encryption {

    // ===== Constants =====
    static VERSION = 1;
    static SALT_LENGTH = 16;
    static IV_LENGTH = 12;
    static DEFAULT_ITERATIONS = 150_000;

    // ===== Encoding Helpers =====
    static encoder = new TextEncoder();
    static decoder = new TextDecoder();

    static encode(data) {
        return this.encoder.encode(data);
    }

    static decode(data) {
        return this.decoder.decode(data);
    }

    // Base64URL (RFC 4648 §5)
    static toBase64Url(bytes) {
        return btoa(String.fromCharCode(...bytes))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    static fromBase64Url(str) {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) str += "=";
        return Uint8Array.from(atob(str), c => c.charCodeAt(0));
    }

    // ===== Key Derivation =====
    static async deriveKey(password, salt, iterations) {
        if (!password || !salt) {
            throw new Error("Password and salt required");
        }

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
                hash: "SHA-256",
                salt,
                iterations
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // ===== Encryption =====
    static async encrypt(plaintext, password, iterations = this.DEFAULT_ITERATIONS) {
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

        const key = await this.deriveKey(password, salt, iterations);

        const aad = new Uint8Array([this.VERSION]); // authenticated metadata

        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv, additionalData: aad },
            key,
            this.encode(plaintext)
        );

        // Payload format:
        // [version|iterations(4)|salt|iv|ciphertext]
        const buffer = new Uint8Array(
            1 + 4 + salt.length + iv.length + ciphertext.byteLength
        );

        let offset = 0;
        buffer[offset++] = this.VERSION;

        new DataView(buffer.buffer).setUint32(offset, iterations);
        offset += 4;

        buffer.set(salt, offset); offset += salt.length;
        buffer.set(iv, offset); offset += iv.length;
        buffer.set(new Uint8Array(ciphertext), offset);

        return this.toBase64Url(buffer);
    }

    // ===== Decryption =====
    static async decrypt(payload, password) {
        try {
            const data = this.fromBase64Url(payload);
            let offset = 0;

            const version = data[offset++];
            if (version !== this.VERSION) {
                throw new Error("Unsupported encryption version");
            }

            const iterations = new DataView(data.buffer).getUint32(offset);
            offset += 4;

            const salt = data.slice(offset, offset + this.SALT_LENGTH);
            offset += this.SALT_LENGTH;

            const iv = data.slice(offset, offset + this.IV_LENGTH);
            offset += this.IV_LENGTH;

            const ciphertext = data.slice(offset);

            const key = await this.deriveKey(password, salt, iterations);

            const plaintext = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv,
                    additionalData: new Uint8Array([version])
                },
                key,
                ciphertext
            );

            return this.decode(plaintext);

        } catch {
            throw new Error("Decryption failed (bad password or corrupted data)");
        }
    }

    // ===== Hashing =====
    static async sha256(data) {
        const hash = await crypto.subtle.digest(
            "SHA-256",
            this.encode(data)
        );
        return [...new Uint8Array(hash)]
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // ===== HMAC =====
    static async hmac(data, secret) {
        const key = await crypto.subtle.importKey(
            "raw",
            this.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const sig = await crypto.subtle.sign("HMAC", key, this.encode(data));
        return this.toBase64Url(new Uint8Array(sig));
    }

    // ===== Constant-Time Compare (Bytes) =====
    static timingSafeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff === 0;
    }

    static async verifyHMAC(data, signature, secret) {
        const expected = await this.hmac(data, secret);
        return this.timingSafeEqual(
            this.fromBase64Url(expected),
            this.fromBase64Url(signature)
        );
    }
}
