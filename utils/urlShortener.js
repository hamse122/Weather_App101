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
   INTERNAL UTILITIES (v3)
------------------------- */

validateUrl(longUrl) {
    try {
        const url = new URL(longUrl.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Only HTTP/HTTPS URLs are allowed");
        }

        const host = url.hostname.toLowerCase();

        // Optional security checks
        if (this.allowPrivate !== true) {
            if (
                host === "localhost" ||
                host === "::1" ||
                /^127\./.test(host) ||
                /^10\./.test(host) ||
                /^192\.168\./.test(host) ||
                /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
            ) {
                throw new Error("Private/local addresses are not allowed");
            }
        }

        // Remove URL fragment for consistency
        url.hash = "";

        return url.toString();

    } catch (err) {
        throw new Error(err.message || "Invalid URL");
    }
}

generateCode(length = this.codeLength) {
    const chars = this.characters;
    const charsLength = chars.length;

    let code = "";

    while (code.length < length) {
        const bytes = crypto.randomBytes(length * 2);

        for (const byte of bytes) {

            // Rejection sampling (avoids modulo bias)
            const max = 256 - (256 % charsLength);

            if (byte >= max) continue;

            code += chars[byte % charsLength];

            if (code.length === length) break;
        }
    }

    return code;
}

generateHashCode(longUrl) {
    return crypto
        .createHash("sha256")
        .update(longUrl + (this.hashSalt || ""))
        .digest("base64url")
        .substring(0, this.codeLength);
}

ensureCapacity() {
    if (this.urls.size < this.maxUrls) return;

    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.urls) {

        const time =
            value.lastAccessed?.getTime?.() ??
            value.createdAt?.getTime?.() ??
            0;

        if (time < oldestTime) {
            oldestTime = time;
            oldestKey = key;
        }
    }

    if (oldestKey) {
        const entry = this.urls.get(oldestKey);

        this.urlIndex.delete(entry.longUrl);
        this.urls.delete(oldestKey);
    }
}

checkRateLimit(key = "global") {

    const now = Date.now();
    const windowMs = this.rateWindow ?? 60000;

    let data = this.requestMap.get(key);

    if (!data || now >= data.resetTime) {

        data = {
            count: 0,
            resetTime: now + windowMs
        };

        this.requestMap.set(key, data);
    }

    if (++data.count > this.rateLimit) {
        throw new Error("Rate limit exceeded.");
    }

    // Cleanup expired entries occasionally
    if (Math.random() < 0.02) {
        for (const [k, v] of this.requestMap) {
            if (now >= v.resetTime) {
                this.requestMap.delete(k);
            }
        }
    }
}

startAutoCleanup() {

    if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
    }

    this._cleanupTimer = setInterval(() => {

        const now = Date.now();

        for (const [code, data] of this.urls) {

            if (
                data.expiresAt &&
                now >= new Date(data.expiresAt).getTime()
            ) {
                this.urlIndex.delete(data.longUrl);
                this.urls.delete(code);
            }
        }

    }, this.cleanupInterval);

    this._cleanupTimer.unref?.();
}

normalizeCode(code) {

    if (typeof code !== "string") {
        throw new Error("Short code must be a string");
    }

    code = code.trim();

    if (
        code.length === 0 ||
        code.length > 128 ||
        !/^[A-Za-z0-9_-]+$/.test(code)
    ) {
        throw new Error("Invalid short code format");
    }

    return code;
}
  /* -------------------------
   CORE FEATURES (v2)
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

    if (
        expiresIn !== null &&
        (!Number.isFinite(expiresIn) || expiresIn <= 0)
    ) {
        throw new TypeError("expiresIn must be a positive number of milliseconds");
    }

    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new TypeError("metadata must be an object");
    }

    if (!Array.isArray(tags)) {
        throw new TypeError("tags must be an array");
    }

    // Remove expired duplicate before reuse
    if (!customCode && this.urlIndex.has(normalizedUrl)) {
        const existingCode = this.urlIndex.get(normalizedUrl);
        const existing = this.urls.get(existingCode);

        if (
            existing &&
            (!existing.expiresAt || existing.expiresAt.getTime() > Date.now())
        ) {
            return existing.shortUrl;
        }

        if (existing) this.delete(existingCode);
    }

    // Generate or validate code
    let code;

    if (customCode !== null) {
        code = this.normalizeCode(customCode);

        const existing = this.urls.get(code);

        if (
            existing &&
            (!existing.expiresAt || existing.expiresAt.getTime() > Date.now())
        ) {
            throw new Error("Custom code already exists");
        }

        if (existing) this.delete(code);
    } else {
        let attempts = 0;

        do {
            code = attempts < 5
                ? this.generateCode()
                : this.generateHashCode(
                    `${normalizedUrl}:${Date.now()}:${crypto.randomUUID()}`
                );

            attempts++;

            if (attempts > 20 && this.urls.has(code)) {
                throw new Error("Unable to generate a unique short code");
            }
        } while (this.urls.has(code));
    }

    this.ensureCapacity();

    const shortUrl = new URL(code, this.baseUrl.endsWith("/")
        ? this.baseUrl
        : `${this.baseUrl}/`).toString();

    const urlData = {
        code,
        longUrl: normalizedUrl,
        shortUrl,
        createdAt: new Date(),
        clicks: 0,
        uniqueVisitors: new Set(),
        analytics: Object.create(null),
        referrers: Object.create(null),
        metadata: structuredClone(metadata),
        tags: [...new Set(tags.filter(tag => typeof tag === "string"))],
        expiresAt: expiresIn !== null
            ? new Date(Date.now() + expiresIn)
            : null
    };

    this.urls.set(code, urlData);
    this.urlIndex.set(normalizedUrl, code);

    return shortUrl;
}

expand(shortUrl, options = {}) {
    let code;

    try {
        const input = new URL(shortUrl);
        const base = new URL(
            this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`
        );

        if (input.origin !== base.origin) {
            throw new Error("Short URL origin mismatch");
        }

        const basePath = base.pathname.endsWith("/")
            ? base.pathname
            : `${base.pathname}/`;

        if (!input.pathname.startsWith(basePath)) {
            throw new Error("Short URL path mismatch");
        }

        code = decodeURIComponent(input.pathname.slice(basePath.length));

        if (!code || code.includes("/")) {
            throw new Error("Invalid short URL");
        }
    } catch {
        // Allow a bare code as input, but not an arbitrary external URL
        if (
            typeof shortUrl === "string" &&
            /^[A-Za-z0-9_-]+$/.test(shortUrl.trim())
        ) {
            code = shortUrl.trim();
        } else {
            throw new Error("Invalid short URL format");
        }
    }

    const data = this.urls.get(this.normalizeCode(code));

    if (!data) {
        throw new Error("Short URL not found");
    }

    if (data.expiresAt && Date.now() >= data.expiresAt.getTime()) {
        this.delete(code);
        throw new Error("Short URL has expired");
    }

    // Update analytics only when tracking is enabled
    if (options.track !== false) {
        data.clicks++;

        const now = new Date();
        const dateKey = now.toISOString().slice(0, 10);

        data.analytics[dateKey] = (data.analytics[dateKey] || 0) + 1;

        if (
            typeof options.visitorId === "string" &&
            options.visitorId.trim()
        ) {
            data.uniqueVisitors.add(options.visitorId.trim());
        }

        if (
            typeof options.referrer === "string" &&
            options.referrer.trim()
        ) {
            const referrer = options.referrer.trim().slice(0, 2048);

            data.referrers[referrer] =
                (data.referrers[referrer] || 0) + 1;
        }
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
        updatedAt: data.updatedAt ?? null,
        clicks: data.clicks,
        uniqueVisitors: data.uniqueVisitors?.size ?? 0,
        analytics: data.analytics ?? {},
        referrers: data.referrers ?? {},
        metadata: { ...(data.metadata ?? {}) },
        tags: [...(data.tags ?? [])],
        expiresAt: data.expiresAt ?? null,
        expired: !!data.expiresAt && new Date() > new Date(data.expiresAt)
    };
}

update(code, updates = {}) {
    code = this.normalizeCode(code);

    const data = this.urls.get(code);
    if (!data) throw new Error("Code not found");

    if (updates.metadata && typeof updates.metadata === "object") {
        data.metadata = {
            ...(data.metadata ?? {}),
            ...updates.metadata
        };
    }

    if (Array.isArray(updates.tags)) {
        data.tags = [
            ...new Set([
                ...(data.tags ?? []),
                ...updates.tags.map(String)
            ])
        ];
    }

    if (updates.expiresIn !== undefined) {
        if (!Number.isFinite(updates.expiresIn) || updates.expiresIn < 0) {
            throw new Error("expiresIn must be a non-negative number");
        }

        data.expiresAt = new Date(Date.now() + updates.expiresIn);
    }

    if (updates.expiresAt !== undefined) {
        data.expiresAt = updates.expiresAt
            ? new Date(updates.expiresAt)
            : null;
    }

    data.updatedAt = new Date();

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
            return {
                url,
                short: this.shorten(url)
            };
        } catch (err) {
            return {
                url,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });
}

search(query = "") {
    const normalizedQuery = String(query).trim().toLowerCase();

    if (!normalizedQuery) {
        return this.getAllUrls();
    }

    return Array.from(this.urls.values()).filter(data => {
        const longUrl = String(data.longUrl ?? "").toLowerCase();

        const tags = Array.isArray(data.tags)
            ? data.tags.map(tag => String(tag).toLowerCase())
            : [];

        return (
            longUrl.includes(normalizedQuery) ||
            tags.some(tag => tag.includes(normalizedQuery))
        );
    });
}

getAllUrls({ includeExpired = false } = {}) {
    const now = Date.now();

    return Array.from(this.urls.values()).filter(data => {
        if (includeExpired) return true;

        return !data.expiresAt ||
            new Date(data.expiresAt).getTime() >= now;
    });
}

clear() {
    this.urls.clear();
    this.urlIndex.clear();
    this.requestMap.clear();

    return true;
}
