/**
 * Enterprise Rate Limiter
 * Token Bucket, Fixed Window, Sliding Window
 * Memory + Redis compatible
 */

export class RateLimiter {
  constructor({
    maxRequests,
    timeWindow,
    strategy = "token",
    storage = null,
    burstMultiplier = 1,
    blockDuration = 0, // ms temporary ban after limit hit
    logger = console
  }) {
    if (!maxRequests || !timeWindow) {
      throw new Error("maxRequests and timeWindow are required");
    }

    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.strategy = strategy;
    this.storage = storage;
    this.logger = logger;

    this.capacity = maxRequests * burstMultiplier;
    this.blockDuration = blockDuration;

    this.memory = new Map();
  }

  /* ---------------------------------- */
  /* Internal Helpers */
  /* ---------------------------------- */

  _now() {
    return Date.now();
  }

  async _getBucket(key) {
    if (this.storage) {
      const raw = await this.storage.get(`ratelimit:${key}`);
      if (raw) return JSON.parse(raw);
    }

    return this.memory.get(key) || {
      tokens: this.capacity,
      lastRefill: this._now(),
      timestamps: [],
      windowStart: null,
      count: 0,
      blockedUntil: 0
    };
  }

  async _saveBucket(key, bucket) {
    if (this.storage) {
      await this.storage.set(
        `ratelimit:${key}`,
        JSON.stringify(bucket),
        "PX",
        this.timeWindow * 2
      );
      return;
    }

    this.memory.set(key, bucket);
  }

  /* ---------------------------------- */
  /* Token Bucket */
  /* ---------------------------------- */

  _token(bucket) {
    const now = this._now();
    const refillRate = this.maxRequests / this.timeWindow;
    const elapsed = now - bucket.lastRefill;

    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsed * refillRate
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return this._allow(bucket, Math.floor(bucket.tokens));
    }

    return this._deny(bucket, (1 - bucket.tokens) / refillRate);
  }

  /* ---------------------------------- */
  /* Fixed Window */
  /* ---------------------------------- */

  _fixed(bucket) {
    const now = this._now();

    if (!bucket.windowStart || now - bucket.windowStart >= this.timeWindow) {
      bucket.windowStart = now;
      bucket.count = 0;
    }

    if (bucket.count < this.maxRequests) {
      bucket.count++;
      return this._allow(bucket, this.maxRequests - bucket.count);
    }

    return this._deny(bucket, bucket.windowStart + this.timeWindow - now);
  }

  /* ---------------------------------- */
  /* Sliding Window (Optimized) */
  /* ---------------------------------- */

  _sliding(bucket) {
    const now = this._now();
    const windowStart = now - this.timeWindow;

    while (
      bucket.timestamps.length &&
      bucket.timestamps[0] <= windowStart
    ) {
      bucket.timestamps.shift();
    }

    if (bucket.timestamps.length < this.maxRequests) {
      bucket.timestamps.push(now);
      return this._allow(
        bucket,
        this.maxRequests - bucket.timestamps.length
      );
    }

    return this._deny(
      bucket,
      bucket.timestamps[0] + this.timeWindow - now
    );
  }

  /* ---------------------------------- */
  /* Allow / Deny */
  /* ---------------------------------- */

  _allow(bucket, remaining) {
    return {
      allowed: true,
      remaining,
      retryAfter: 0
    };
  }

  _deny(bucket, retryMs) {
    if (this.blockDuration > 0) {
      bucket.blockedUntil = this._now() + this.blockDuration;
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(retryMs / 1000)
    };
  }

  /* ---------------------------------- */
  /* Main Check */
  /* ---------------------------------- */

  async check(key) {
    const bucket = await this._getBucket(key);
    const now = this._now();

    if (bucket.blockedUntil && now < bucket.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil(
          (bucket.blockedUntil - now) / 1000
        )
      };
    }

    let result;

    switch (this.strategy) {
      case "fixed":
        result = this._fixed(bucket);
        break;
      case "sliding":
        result = this._sliding(bucket);
        break;
      case "token":
      default:
        result = this._token(bucket);
        break;
    }

    await this._saveBucket(key, bucket);
    return result;
  }

  /* ---------------------------------- */
  /* Express Middleware */
  /* ---------------------------------- */

  middleware({ keyGenerator = req => req.ip } = {}) {
    return async (req, res, next) => {
      const key = keyGenerator(req);
      const result = await this.check(key);

      res.setHeader("X-RateLimit-Limit", this.maxRequests);
      res.setHeader("X-RateLimit-Remaining", result.remaining);
      res.setHeader("Retry-After", result.retryAfter);

      if (!result.allowed) {
        return res.status(429).json({
          error: "Too Many Requests",
          retryAfter: result.retryAfter
        });
      }

      next();
    };
  }

  /* ---------------------------------- */
  /* Memory Cleanup */
  /* ---------------------------------- */

  cleanup() {
    const now = this._now();

    for (const [key, bucket] of this.memory.entries()) {
      if (
        (bucket.lastRefill &&
          now - bucket.lastRefill > this.timeWindow * 3) ||
        (bucket.windowStart &&
          now - bucket.windowStart > this.timeWindow * 3)
      ) {
        this.memory.delete(key);
      }
    }
  }
}
