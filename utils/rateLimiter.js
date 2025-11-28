/**
 * Advanced Rate Limiter
 * Supports Token Bucket, Fixed Window, Sliding Window, and Redis-based distributed limits
 */

export class RateLimiter {
    /**
     * @param {Object} options
     * @param {number} options.maxRequests - Maximum number of requests
     * @param {number} options.timeWindow - Time window in ms
     * @param {"fixed"|"sliding"|"token"} [options.strategy="token"]
     * @param {Object|null} [options.storage=null] - Optional storage adapter (Redis)
     * @param {function} [options.logger=console] - Logging function
     */
    constructor({ maxRequests, timeWindow, strategy = "token", storage = null, logger = console }) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.strategy = strategy;
        this.logger = logger;
        this.storage = storage;

        // Memory store fallback
        this.memory = new Map();
    }

    /**
     * Fetch existing bucket or create a fresh one
     */
    async _getBucket(key) {
        if (this.storage) {
            const raw = await this.storage.get(`ratelimit:${key}`);
            if (raw) return JSON.parse(raw);
        }

        return this.memory.get(key) || {
            tokens: this.maxRequests,
            lastRefill: Date.now(),
            requestTimestamps: [] // For sliding window
        };
    }

    /**
     * Persist bucket to storage or memory
     */
    async _saveBucket(key, bucket) {
        if (this.storage) {
            await this.storage.set(`ratelimit:${key}`, JSON.stringify(bucket), "PX", this.timeWindow);
            return;
        }
        this.memory.set(key, bucket);
    }

    /**
     * Token bucket logic
     */
    _applyTokenBucket(bucket) {
        const now = Date.now();
        const refillRate = this.maxRequests / this.timeWindow;
        const elapsed = now - bucket.lastRefill;

        bucket.tokens = Math.min(
            this.maxRequests,
            bucket.tokens + elapsed * refillRate
        );
        bucket.lastRefill = now;

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { allowed: true, remaining: Math.floor(bucket.tokens), resetTime: now + this.timeWindow };
        }

        const waitTime = (1 - bucket.tokens) / refillRate;
        return { allowed: false, remaining: 0, resetTime: now + waitTime };
    }

    /**
     * Fixed window logic
     */
    _applyFixedWindow(bucket) {
        const now = Date.now();

        if (!bucket.windowStart || now - bucket.windowStart >= this.timeWindow) {
            bucket.windowStart = now;
            bucket.count = 0;
        }

        if (bucket.count < this.maxRequests) {
            bucket.count++;
            return {
                allowed: true,
                remaining: this.maxRequests - bucket.count,
                resetTime: bucket.windowStart + this.timeWindow
            };
        }

        return {
            allowed: false,
            remaining: 0,
            resetTime: bucket.windowStart + this.timeWindow
        };
    }

    /**
     * Sliding window logic
     */
    _applySlidingWindow(bucket) {
        const now = Date.now();
        bucket.requestTimestamps = bucket.requestTimestamps.filter(ts => now - ts < this.timeWindow);

        if (bucket.requestTimestamps.length < this.maxRequests) {
            bucket.requestTimestamps.push(now);
            return {
                allowed: true,
                remaining: this.maxRequests - bucket.requestTimestamps.length,
                resetTime: now + this.timeWindow
            };
        }

        return {
            allowed: false,
            remaining: 0,
            resetTime: bucket.requestTimestamps[0] + this.timeWindow
        };
    }

    /**
     * Main check method
     * @param {string} key
     * @returns {Promise<Object>}
     */
    async check(key) {
        let bucket = await this._getBucket(key);

        let result;
        switch (this.strategy) {
            case "fixed":
                result = this._applyFixedWindow(bucket);
                break;

            case "sliding":
                result = this._applySlidingWindow(bucket);
                break;

            case "token":
            default:
                result = this._applyTokenBucket(bucket);
                break;
        }

        await this._saveBucket(key, bucket);
        return result;
    }

    /**
     * Manual memory cleanup (redis auto-cleans)
     */
    cleanup() {
        const now = Date.now();
        for (const [key, bucket] of this.memory) {
            if (
                (bucket.lastRefill && now - bucket.lastRefill > this.timeWindow * 2) ||
                (bucket.windowStart && now - bucket.windowStart > this.timeWindow * 2)
            ) {
                this.memory.delete(key);
            }
        }
    }
}
