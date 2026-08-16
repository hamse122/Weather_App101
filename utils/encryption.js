export class Encryption {

    static VERSION = 3;
    static SALT_LENGTH = 16;
    static IV_LENGTH = 12;
    static TAG_LENGTH = 16;
    static DEFAULT_ITERATIONS = 310_000;
    static MIN_ITERATIONS = 100_000;
    static MAX_ITERATIONS = 2_000_000;

    static encoder = new TextEncoder();
    static decoder = new TextDecoder();

    // =========================
    // Encoding
    // =========================

    static encode(data) {
        if (typeof data !== "string") {
            throw new TypeError("Data must be a string");
        }

        return this.encoder.encode(data.normalize("NFKC"));
    }

    static decode(data) {
        return this.decoder.decode(data);
    }

    // =========================
    // Base64URL
    // =========================

    static toBase64Url(bytes) {
        let binary = "";
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(i, i + chunkSize)
            );
        }

        return btoa(binary)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    static fromBase64Url(value) {
        if (typeof value !== "string" || !value) {
            throw new Error("Invalid Base64URL payload");
        }

        let str = value
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        while (str.length % 4) str += "=";

        let binary;

        try {
            binary = atob(str);
        } catch {
            throw new Error("Invalid Base64URL payload");
        }

        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }

    // =========================
    // Validation
    // =========================

    static validateIterations(iterations) {
        if (
            !Number.isInteger(iterations) ||
            iterations < this.MIN_ITERATIONS ||
            iterations > this.MAX_ITERATIONS
        ) {
            throw new Error("Invalid PBKDF2 iteration count");
        }

        return iterations;
    }

    static validatePayload(data) {
        if (!(data instanceof Uint8Array)) {
            throw new TypeError("Invalid encryption payload");
        }

        const minimum =
            1 +
            1 +
            4 +
            this.SALT_LENGTH +
            this.IV_LENGTH +
            this.TAG_LENGTH;

        if (data.length < minimum) {
            throw new Error("Invalid or corrupted encryption payload");
        }
    }

    // =========================
    // Key Derivation
    // =========================

    static async deriveKey(password, salt, iterations) {
        if (typeof password !== "string" || !password.length) {
            throw new Error("Password is required");
        }

        if (!(salt instanceof Uint8Array) || salt.length !== this.SALT_LENGTH) {
            throw new Error("Invalid salt");
        }

        iterations = this.validateIterations(iterations);

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
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // =========================
    // Compression
    // =========================

    static compress(text) {
        // Kept intentionally lightweight.
        // Can later be replaced with CompressionStream.
        return this.encode(text);
    }

    static decompress(bytes) {
        return this.decode(bytes);
    }

    // =========================
    // Encryption
    // =========================

    static async encrypt(plaintext, password, options = {}) {
        if (typeof plaintext !== "string") {
            throw new TypeError("Plaintext must be a string");
        }

        const iterations = this.validateIterations(
            options.iterations ?? this.DEFAULT_ITERATIONS
        );

        const compressed = options.compress === true;

        const salt = crypto.getRandomValues(
            new Uint8Array(this.SALT_LENGTH)
        );

        const iv = crypto.getRandomValues(
            new Uint8Array(this.IV_LENGTH)
        );

        const key = await this.deriveKey(
            password,
            salt,
            iterations
        );

        const data = compressed
            ? this.compress(plaintext)
            : this.encode(plaintext);

        // Bind important metadata to the authentication tag.
        const aad = new Uint8Array([
            this.VERSION,
            compressed ? 1 : 0
        ]);

        const encrypted = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: aad,
                tagLength: 128
            },
            key,
            data
        );

        const encryptedBytes = new Uint8Array(encrypted);

        const ciphertext = encryptedBytes.slice(
            0,
            encryptedBytes.length - this.TAG_LENGTH
        );

        const tag = encryptedBytes.slice(
            encryptedBytes.length - this.TAG_LENGTH
        );

        /*
         * Format:
         *
         * [version:1]
         * [flags:1]
         * [iterations:4]
         * [salt:16]
         * [iv:12]
         * [tag:16]
         * [ciphertext:n]
         */

        const totalLength =
            1 +
            1 +
            4 +
            this.SALT_LENGTH +
            this.IV_LENGTH +
            this.TAG_LENGTH +
            ciphertext.length;

        const output = new Uint8Array(totalLength);
        const view = new DataView(output.buffer);

        let offset = 0;

        output[offset++] = this.VERSION;
        output[offset++] = compressed ? 1 : 0;

        view.setUint32(offset, iterations);
        offset += 4;

        output.set(salt, offset);
        offset += this.SALT_LENGTH;

        output.set(iv, offset);
        offset += this.IV_LENGTH;

        output.set(tag, offset);
        offset += this.TAG_LENGTH;

        output.set(ciphertext, offset);

        return this.toBase64Url(output);
    }

    // =========================
    // Decryption
    // =========================

    static async decrypt(payload, password) {
        const data = this.fromBase64Url(payload);

        this.validatePayload(data);

        let offset = 0;

        const version = data[offset++];
        const compressed = data[offset++] === 1;

        if (version !== this.VERSION) {
            throw new Error(
                `Unsupported encryption version: ${version}`
            );
        }

        const view = new DataView(
            data.buffer,
            data.byteOffset,
            data.byteLength
        );

        const iterations = view.getUint32(offset);
        offset += 4;

        this.validateIterations(iterations);

        const salt = data.slice(
            offset,
            offset + this.SALT_LENGTH
        );

        offset += this.SALT_LENGTH;

        const iv = data.slice(
            offset,
            offset + this.IV_LENGTH
        );

        offset += this.IV_LENGTH;

        const tag = data.slice(
            offset,
            offset + this.TAG_LENGTH
        );

        offset += this.TAG_LENGTH;

        const ciphertext = data.slice(offset);

        if (!ciphertext.length) {
            throw new Error("Invalid ciphertext");
        }

        const key = await this.deriveKey(
            password,
            salt,
            iterations
        );

        const combined = new Uint8Array(
            ciphertext.length + tag.length
        );

        combined.set(ciphertext);
        combined.set(tag, ciphertext.length);

        const aad = new Uint8Array([
            version,
            compressed ? 1 : 0
        ]);

        try {
            const plaintext = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv,
                    additionalData: aad,
                    tagLength: 128
                },
                key,
                combined
            );

            return compressed
                ? this.decompress(new Uint8Array(plaintext))
                : this.decode(new Uint8Array(plaintext));

        } catch {
            throw new Error(
                "Decryption failed: invalid password or corrupted data"
            );
        }
    }

    // =========================
    // SHA-256
    // =========================

    static async sha256(data) {
        const hash = await crypto.subtle.digest(
            "SHA-256",
            this.encode(data)
        );

        return Array.from(new Uint8Array(hash))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    // =========================
    // HMAC-SHA256
    // =========================

    static async hmac(data, secret) {
        if (!secret) {
            throw new Error("HMAC secret is required");
        }

        const key = await crypto.subtle.importKey(
            "raw",
            this.encode(secret),
            {
                name: "HMAC",
                hash: "SHA-256"
            },
            false,
            ["sign"]
        );

        const signature = await crypto.subtle.sign(
            "HMAC",
            key,
            this.encode(data)
        );

        return this.toBase64Url(
            new Uint8Array(signature)
        );
    }

    // =========================
    // Timing-safe comparison
    // =========================

    static timingSafeEqual(a, b) {
        if (!(a instanceof Uint8Array) ||
            !(b instanceof Uint8Array)) {
            return false;
        }

        if (a.length !== b.length) {
            return false;
        }

        let difference = 0;

        for (let i = 0; i < a.length; i++) {
            difference |= a[i] ^ b[i];
        }

        return difference === 0;
    }

    // =========================
    // HMAC Verification
    // =========================

    static async verifyHMAC(data, signature, secret) {
        try {
            const expected = await this.hmac(
                data,
                secret
            );

            const actualBytes =
                this.fromBase64Url(signature);

            const expectedBytes =
                this.fromBase64Url(expected);

            return this.timingSafeEqual(
                expectedBytes,
                actualBytes
            );
        } catch {
            return false;
        }
    }
}
