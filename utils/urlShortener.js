// Upgraded URL Shortener Utility
const crypto = require("crypto");

class URLShortener {
    constructor() {
        this.urls = new Map(); // Stores: code -> urlData
        this.baseUrl = "https://short.url/";
        this.characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    }

    generateCode(length = 6) {
        let code = "";
        const bytes = crypto.randomBytes(length);

        for (let i = 0; i < length; i++) {
            code += this.characters[bytes[i] % this.characters.length];
        }
        return code;
    }

    shorten(longUrl, customCode = null, expiresIn = null) {
        if (!longUrl || typeof longUrl !== "string") {
            throw new Error("Invalid URL");
        }

        // Validate custom code
        if (customCode) {
            if (!/^[A-Za-z0-9_-]+$/.test(customCode)) {
                throw new Error("Custom code contains invalid characters");
            }
            if (this.urls.has(customCode)) {
                throw new Error("Custom code already exists");
            }
        }

        // Auto-generate unique random code
        let code = customCode || this.generateCode();
        while (this.urls.has(code)) {
            code = this.generateCode(); // Regenerate if collision occurs
        }

        const shortUrl = this.baseUrl + code;

        // Check if same long URL already exists (avoid duplicates)
        for (const [existingCode, data] of this.urls) {
            if (data.longUrl === longUrl && !customCode) {
                return data.shortUrl;
            }
        }

        this.urls.set(code, {
            longUrl,
            shortUrl,
            createdAt: new Date(),
            clicks: 0,
            analytics: {},   // Track clicks per day
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null
        });

        return shortUrl;
    }

    expand(shortUrl) {
        const code = shortUrl.replace(this.baseUrl, "");
        const data = this.urls.get(code);

        if (!data) throw new Error("URL not found");
        if (data.expiresAt && new Date() > data.expiresAt) {
            this.urls.delete(code);
            throw new Error("Short URL has expired");
        }

        // Update analytics
        data.clicks++;
        const dateKey = new Date().toISOString().split("T")[0];
        data.analytics[dateKey] = (data.analytics[dateKey] || 0) + 1;

        return data.longUrl;
    }

    getStats(code) {
        const data = this.urls.get(code);
        if (!data) return null;

        return {
            longUrl: data.longUrl,
            shortUrl: data.shortUrl,
            createdAt: data.createdAt,
            clicks: data.clicks,
            analytics: data.analytics,
            expiresAt: data.expiresAt
        };
    }

    delete(code) {
        if (!this.urls.has(code)) {
            throw new Error("Code not found");
        }
        this.urls.delete(code);
        return true;
    }

    getAllUrls() {
        return Array.from(this.urls.entries()).map(([code, data]) => ({
            code,
            ...data
        }));
    }
}

module.exports = URLShortener;
