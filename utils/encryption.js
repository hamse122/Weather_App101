export class Encryption {

    static VERSION = 2;
    static SALT_LENGTH = 16;
    static IV_LENGTH = 12;
    static TAG_LENGTH = 16;
    static DEFAULT_ITERATIONS = 210_000;

    static encoder = new TextEncoder();
    static decoder = new TextDecoder();

    // ===== Encoding =====
    static encode(data) {
        return this.encoder.encode(data.normalize("NFKC")); // normalize passwords
    }

    static decode(data) {
        return this.decoder.decode(data);
    }

    // ===== Safe Base64URL =====
    static toBase64Url(bytes) {
        let binary = "";
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }

        return btoa(binary)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    static fromBase64Url(str) {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) str += "=";

        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }

    // ===== Key Derivation =====
    static async deriveKey(password, salt, iterations) {
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

    // ===== Optional Compression =====
    static compress(text) {
        return new TextEncoder().encode(text); // placeholder (can plug gzip later)
    }

    static decompress(bytes) {
        return new TextDecoder().decode(bytes);
    }

    // ===== Encryption =====
    static async encrypt(plaintext, password, options = {}) {
        const {
            iterations = this.DEFAULT_ITERATIONS,
            compress = false
        } = options;

        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

        const key = await this.deriveKey(password, salt, iterations);

        let data = compress ? this.compress(plaintext) : this.encode(plaintext);

        const aad = new Uint8Array([this.VERSION, compress ? 1 : 0]);

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
            key,
            data
        );

        const encryptedBytes = new Uint8Array(encrypted);

        // Split ciphertext + tag (future-proof)
        const ciphertext = encryptedBytes.slice(0, -this.TAG_LENGTH);
        const tag = encryptedBytes.slice(-this.TAG_LENGTH);

        const buffer = new Uint8Array(
            1 + 1 + 4 + salt.length + iv.length + tag.length + ciphertext.length
        );

        let offset = 0;
        buffer[offset++] = this.VERSION;
        buffer[offset++] = compress ? 1 : 0;

        new DataView(buffer.buffer).setUint32(offset, iterations);
        offset += 4;

        buffer.set(salt, offset); offset += salt.length;
        buffer.set(iv, offset); offset += iv.length;
        buffer.set(tag, offset); offset += tag.length;
        buffer.set(ciphertext, offset);

        return this.toBase64Url(buffer);
    }

    // ===== Decryption =====
    static async decrypt(payload, password) {
        const data = this.fromBase64Url(payload);

        let offset = 0;

        const version = data[offset++];
        const compressed = data[offset++] === 1;

        if (version > this.VERSION) {
            throw new Error("Unsupported future encryption version");
        }

        const iterations = new DataView(data.buffer).getUint32(offset);
        offset += 4;

        const salt = data.slice(offset, offset + this.SALT_LENGTH);
        offset += this.SALT_LENGTH;

        const iv = data.slice(offset, offset + this.IV_LENGTH);
        offset += this.IV_LENGTH;

        const tag = data.slice(offset, offset + this.TAG_LENGTH);
        offset += this.TAG_LENGTH;

        const ciphertext = data.slice(offset);

        const key = await this.deriveKey(password, salt, iterations);

        const combined = new Uint8Array(ciphertext.length + tag.length);
        combined.set(ciphertext);
        combined.set(tag, ciphertext.length);

        const plaintext = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: new Uint8Array([version, compressed ? 1 : 0]),
                tagLength: 128
            },
            key,
            combined
        );

        return compressed
            ? this.decompress(new Uint8Array(plaintext))
            : this.decode(plaintext);
    }

    // ===== SHA-256 =====
    static async sha256(data) {
        const hash = await crypto.subtle.digest("SHA-256", this.encode(data));
        return Array.from(new Uint8Array(hash))
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
