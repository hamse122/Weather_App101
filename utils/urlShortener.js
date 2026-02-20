const crypto = require("crypto");
const { URL } = require("url");

class URLShortener {
    constructor(options = {}) {
        this.urls = new Map();              // code -> urlData
        this.urlIndex = new Map();          // longUrl -> code (dedup)
        this.baseUrl = options.baseUrl || "https://short.url/";
        this.codeLength = options.codeLength || 6;
        this.maxUrls = options.maxUrls || 10000;
        this.rateLimit = options.rateLimit || 100; // requests per session key
        this.characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        this.requestMap = new Map(); // rate limiting: key -> { count, resetTime }
        this.cleanupInterval = options.cleanupInterval || 60 * 60 * 1000; // 1 hour

        this.startAutoCleanup();
    }

    /* -------------------------
       INTERNAL UTILITIES
    ------------------------- */

    validateUrl(longUrl) {
        try {
            const parsed = new URL(longUrl);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                throw new Error("Only HTTP/HTTPS URLs are allowed");
            }
            return parsed.toString();
        } catch {
            throw new Error("Invalid URL format");
        }
    }

    generateCode(length = this.codeLength) {
        const bytes = crypto.randomBytes(length);
        let code = "";

        for (let i = 0; i < length; i++) {
            code += this.characters[bytes[i] % this.characters.length];
        }
        return code;
    }

    generateHashCode(longUrl) {
        return crypto
            .createHash("sha256")
            .update(longUrl)
            .digest("base64url")
            .slice(0, this.codeLength);
    }

    ensureCapacity() {
        if (this.urls.size >= this.maxUrls) {
            // Remove oldest (simple LRU-like cleanup)
            const oldestKey = this.urls.keys().next().value;
            const old = this.urls.get(oldestKey);
            this.urlIndex.delete(old.longUrl);
            this.urls.delete(oldestKey);
        }
    }

    checkRateLimit(key = "global") {
        const now = Date.now();
        const windowMs = 60 * 1000;

        if (!this.requestMap.has(key)) {
            this.requestMap.set(key, { count: 1, resetTime: now + windowMs });
            return;
        }

        const data = this.requestMap.get(key);

        if (now > data.resetTime) {
            data.count = 1;
            data.resetTime = now + windowMs;
            return;
        }

        if (data.count >= this.rateLimit) {
            throw new Error("Rate limit exceeded. Try again later.");
        }

        data.count++;
    }

    startAutoCleanup() {
        setInterval(() => {
            const now = new Date();
            for (const [code, data] of this.urls.entries()) {
                if (data.expiresAt && now > data.expiresAt) {
                    this.urlIndex.delete(data.longUrl);
                    this.urls.delete(code);
                }
            }
        }, this.cleanupInterval).unref();
    }

    normalizeCode(code) {
        if (!/^[A-Za-z0-9_-]+$/.test(code)) {
            throw new Error("Invalid short code format");
        }
        return code;
    }

    /* -------------------------
       CORE FEATURES
    ------------------------- */

    shorten(longUrl, options = {}) {
        this.checkRateLimit(options.rateKey);

        const {
            customCode = null,
            expiresIn = null,
            metadata = {},
            tags = []
        } = options;

        const normalizedUrl = this.validateUrl(longUrl);

        // Deduplicate existing URLs (unless custom code requested)
        if (!customCode && this.urlIndex.has(normalizedUrl)) {
            const existingCode = this.urlIndex.get(normalizedUrl);
            return this.urls.get(existingCode).shortUrl;
        }

        // Validate custom code
        let code;
        if (customCode) {
            code = this.normalizeCode(customCode);
            if (this.urls.has(code)) {
                throw new Error("Custom code already exists");
            }
        } else {
            // Generate unique code with fallback hashing
            code = this.generateCode();
            let attempts = 0;

            while (this.urls.has(code)) {
                code = attempts > 3
                    ? this.generateHashCode(normalizedUrl + Date.now())
                    : this.generateCode();
                attempts++;
            }
        }

        this.ensureCapacity();

        const shortUrl = this.baseUrl + code;

        const urlData = {
            code,
            longUrl: normalizedUrl,
            shortUrl,
            createdAt: new Date(),
            clicks: 0,
            uniqueVisitors: new Set(),
            analytics: {}, // date -> clicks
            referrers: {}, // referrer -> count
            metadata,
            tags,
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null
        };

        this.urls.set(code, urlData);
        this.urlIndex.set(normalizedUrl, code);

        return shortUrl;
    }

    expand(shortUrl, options = {}) {
        const code = shortUrl.replace(this.baseUrl, "").trim();
        const data = this.urls.get(code);

        if (!data) {
            throw new Error("Short URL not found");
        }

        if (data.expiresAt && new Date() > data.expiresAt) {
            this.delete(code);
            throw new Error("Short URL has expired");
        }

        // Analytics update
        data.clicks++;

        const dateKey = new Date().toISOString().split("T")[0];
        data.analytics[dateKey] = (data.analytics[dateKey] || 0) + 1;

        if (options.visitorId) {
            data.uniqueVisitors.add(options.visitorId);
        }

        if (options.referrer) {
            data.referrers[options.referrer] =
                (data.referrers[options.referrer] || 0) + 1;
        }

        return data.longUrl;
    }

    /* -------------------------
       ANALYTICS & MANAGEMENT
    ------------------------- */

    getStats(code) {
        code = this.normalizeCode(code);
        const data = this.urls.get(code);
        if (!data) return null;

        return {
            code: data.code,
            longUrl: data.longUrl,
            shortUrl: data.shortUrl,
            createdAt: data.createdAt,
            clicks: data.clicks,
            uniqueVisitors: data.uniqueVisitors.size,
            analytics: data.analytics,
            referrers: data.referrers,
            metadata: data.metadata,
            tags: data.tags,
            expiresAt: data.expiresAt
        };
    }

    update(code, updates = {}) {
        code = this.normalizeCode(code);
        const data = this.urls.get(code);
        if (!data) throw new Error("Code not found");

        if (updates.metadata) {
            data.metadata = { ...data.metadata, ...updates.metadata };
        }

        if (updates.tags) {
            data.tags = Array.from(new Set([...data.tags, ...updates.tags]));
        }

        if (updates.expiresIn) {
            data.expiresAt = new Date(Date.now() + updates.expiresIn);
        }

        return true;
    }

    delete(code) {
        code = this.normalizeCode(code);
        const data = this.urls.get(code);
        if (!data) throw new Error("Code not found");

        this.urlIndex.delete(data.longUrl);
        this.urls.delete(code);
        return true;
    }

    bulkShorten(urls = []) {
        if (!Array.isArray(urls)) {
            throw new Error("Input must be an array of URLs");
        }

        return urls.map(url => {
            try {
                return { url, short: this.shorten(url) };
            } catch (err) {
                return { url, error: err.message };
            }
        });
    }

    search(query = "") {
        query = query.toLowerCase();
        return Array.from(this.urls.values()).filter(data =>
            data.longUrl.toLowerCase().includes(query) ||
            data.tags.some(tag => tag.toLowerCase().includes(query))
        );
    }

    getAllUrls({ includeExpired = false } = {}) {
        const now = new Date();
        return Array.from(this.urls.values()).filter(data => {
            if (includeExpired) return true;
            return !data.expiresAt || now <= data.expiresAt;
        });
    }

    clear() {
        this.urls.clear();
        this.urlIndex.clear();
        this.requestMap.clear();
        return true;
    }
}

module.exports = URLShortener;
