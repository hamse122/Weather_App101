/**
 * CryptoUtils v3 – Secure, Modern, Cross-Environment Utilities
 * (Educational ciphers included: XOR, Caesar)
 */

class CryptoUtils {

    /* ---------------------------------------------------
     * ENVIRONMENT HELPERS
     * --------------------------------------------------- */
    static isBrowser() {
        return typeof window !== "undefined" && typeof window.crypto !== "undefined";
    }

    static isNode() {
        return typeof process !== "undefined" &&
               process.release &&
               process.release.name === "node";
    }

    static getNodeCrypto() {
        if (this.isNode()) return require("crypto");
        return null;
    }


    /* ---------------------------------------------------
     * BASE64 / BASE64 URL
     * --------------------------------------------------- */

    static base64Encode(str) {
        if (typeof str !== "string") throw new Error("Input must be a string");

        if (this.isBrowser()) {
            return btoa(unescape(encodeURIComponent(str)));
        }
        return Buffer.from(str, "utf8").toString("base64");
    }

    static base64Decode(str) {
        if (typeof str !== "string") throw new Error("Input must be a string");
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) throw new Error("Invalid base64");

        if (this.isBrowser()) {
            return decodeURIComponent(escape(atob(str)));
        }
        return Buffer.from(str, "base64").toString("utf8");
    }

    static base64UrlEncode(str) {
        return this.base64Encode(str)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }

    static base64UrlDecode(str) {
        let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        return this.base64Decode(b64);
    }


    /* ---------------------------------------------------
     * RANDOM GENERATORS
     * --------------------------------------------------- */

    /** Secure random hex string */
    static generateSecureRandom(length = 32) {
        if (length <= 0) throw new Error("Length must be positive");

        // Browser (Web Crypto)
        if (this.isBrowser() && crypto.getRandomValues) {
            const bytes = new Uint8Array(length);
            crypto.getRandomValues(bytes);
            return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        }

        // Node
        const nodeCrypto = this.getNodeCrypto();
        if (nodeCrypto) {
            return nodeCrypto.randomBytes(length).toString("hex");
        }

        throw new Error("No secure random generator available");
    }

    /** NON-secure generator (only for fallback / educational use) */
    static generateRandomString(length = 32) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }


    /* ---------------------------------------------------
     * HASHING FUNCTIONS
     * --------------------------------------------------- */

    /** SHA-256 (browser + Node compatible) */
    static async hashSHA256(str) {
        if (typeof str !== "string") throw new Error("Input must be a string");

        // Browser: use Web Crypto
        if (this.isBrowser() && crypto.subtle) {
            const data = new TextEncoder().encode(str);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        }

        // Node
        const nodeCrypto = this.getNodeCrypto();
        if (nodeCrypto) {
            return nodeCrypto.createHash("sha256").update(str).digest("hex");
        }

        throw new Error("SHA-256 hashing not supported");
    }

    /** Small simple hash (not secure) */
    static hashSimple(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }


    /* ---------------------------------------------------
     * PASSWORD VALIDATION & GENERATION
     * --------------------------------------------------- */

    static validatePassword(password) {
        if (typeof password !== "string") throw new Error("Password must be a string");

        const requirements = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            spaces: !/\s/.test(password),
            notCommon: !this.isCommonPassword(password)
        };

        const score = Object.values(requirements).filter(Boolean).length;

        return {
            isValid: score >= 5,
            score,
            strength:
                score >= 7 ? "very strong" :
                score >= 6 ? "strong" :
                score >= 5 ? "medium" : "weak",
            requirements
        };
    }

    static isCommonPassword(pwd) {
        return [
            "password", "123456", "12345678", "qwerty", "abc123",
            "letmein", "welcome", "passw0rd", "111111"
        ].includes(pwd.toLowerCase());
    }

    static generatePassword(options = {}) {
        const {
            length = 12,
            upper = true,
            lower = true,
            numbers = true,
            special = true
        } = options;

        const pools = {
            upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            lower: "abcdefghijklmnopqrstuvwxyz",
            numbers: "0123456789",
            special: "!@#$%^&*()_+-=[]{}|;:,.<>?"
        };

        let allowed = "";
        let password = "";

        if (upper) { allowed += pools.upper; password += pools.upper.randomChar(); }
        if (lower) { allowed += pools.lower; password += pools.lower.randomChar(); }
        if (numbers) { allowed += pools.numbers; password += pools.numbers.randomChar(); }
        if (special) { allowed += pools.special; password += pools.special.randomChar(); }

        if (!allowed) throw new Error("No character types selected");

        for (let i = password.length; i < length; i++) {
            password += allowed.randomChar();
        }

        return password.split("").sort(() => Math.random() - 0.5).join("");
    }


    /* ---------------------------------------------------
     * EDUCATIONAL CIPHERS
     * --------------------------------------------------- */

    static simpleXOREncrypt(text, key) {
        if (!text || !key) throw new Error("Text & key required");

        let out = "";
        for (let i = 0; i < text.length; i++) {
            out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return out;
    }

    static simpleXORDecrypt(txt, key) {
        return this.simpleXOREncrypt(txt, key);
    }

    static caesarCipher(text, shift, encrypt = true) {
        if (typeof text !== "string") throw new Error("Text must be a string");

        if (!encrypt) shift = (26 - shift) % 26;

        return text.replace(/[a-z]/gi, c => {
            const base = c <= "Z" ? 65 : 97;
            return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
        });
    }


    /* ---------------------------------------------------
     * CONSTANT-TIME COMPARISON
     * --------------------------------------------------- */
    static constantTimeCompare(a, b) {
        if (typeof a !== "string" || typeof b !== "string") return false;
        if (a.length !== b.length) return false;

        let res = 0;
        for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return res === 0;
    }
}

/* Add helper for random char */
String.prototype.randomChar = function() {
    return this[Math.floor(Math.random() * this.length)];
};

module.exports = CryptoUtils;
