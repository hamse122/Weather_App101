/**
 * Circuit Breaker Utility
 * Protects async functions from cascading failures
 */

export class CircuitBreaker {
    constructor(fn, options = {}) {
        if (typeof fn !== "function") {
            throw new Error("CircuitBreaker requires a function");
        }

        this.fn = fn;

        // Configurable settings
        this.threshold = options.threshold ?? 5;        // failures before OPEN
        this.timeout = options.timeout ?? 60000;        // execution timeout
        this.resetTimeout = options.resetTimeout ?? 30000; // cooldown period
        this.fallback = options.fallback ?? null;       // optional fallback

        // internal state
        this.failureCount = 0;
        this.successCount = 0;
        this.state = "CLOSED";
        this.nextAttempt = Date.now();
    }

    /**
     * Execute function with circuit breaker protection
     */
    async execute(...args) {
        if (this.state === "OPEN") {
            if (Date.now() < this.nextAttempt) {
                if (this.fallback) return this.fallback(...args);
                throw new Error("CircuitBreaker: OPEN (cooldown active)");
            }
            // Trial execution
            this.state = "HALF_OPEN";
            this.successCount = 0;
        }

        try {
            const result = await Promise.race([
                this.fn(...args),
                this._timeoutReject(this.timeout)
            ]);

            this._handleSuccess();
            return result;

        } catch (error) {
            this._handleFailure(error);
            if (this.fallback) return this.fallback(...args);
            throw error;
        }
    }

    /**
     * Reject after the given timeout
     */
    _timeoutReject(ms) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error("CircuitBreaker: TIMEOUT")), ms)
        );
    }

    /**
     * Success handler
     */
    _handleSuccess() {
        this.failureCount = 0;

        if (this.state === "HALF_OPEN") {
            this.successCount++;
            if (this.successCount >= this.threshold) {
                this.state = "CLOSED";
                this.successCount = 0;
            }
        }
    }

    /**
     * Failure handler
     */
    _handleFailure(error) {
        this.failureCount++;

        if (this.failureCount >= this.threshold) {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.resetTimeout;
        }
    }

    /**
     * Get current state
     */
    getState() {
        return {
            state: this.state,
            failures: this.failureCount,
            successes: this.successCount,
            nextAttempt: this.nextAttempt
        };
    }

    /**
     * Reset to safe state
     */
    reset() {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();
    }

    /**
     * Force OPEN (manual override)
     */
    forceOpen() {
        this.state = "OPEN";
        this.nextAttempt = Date.now() + this.resetTimeout;
    }

    /**
     * Force CLOSED (manual override)
     */
    forceClose() {
        this.reset();
    }
}

/**
 * Factory function
 */
export function createCircuitBreaker(fn, options = {}) {
    return new CircuitBreaker(fn, options);
}
