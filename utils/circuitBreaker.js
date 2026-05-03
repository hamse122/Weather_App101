export class CircuitBreaker {
    constructor(fn, options = {}) {
        if (typeof fn !== "function") {
            throw new Error("CircuitBreaker requires a function");
        }

        this.fn = fn;

        // Config
        this.threshold = options.threshold ?? 5;
        this.timeout = options.timeout ?? 10000;
        this.resetTimeout = options.resetTimeout ?? 30000;
        this.fallback = options.fallback ?? null;

        // Advanced options
        this.errorFilter = options.errorFilter ?? (() => true);
        this.onOpen = options.onOpen ?? (() => {});
        this.onClose = options.onClose ?? (() => {});
        this.onHalfOpen = options.onHalfOpen ?? (() => {});
        this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;

        // State
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();

        // Concurrency control
        this.halfOpenActiveCalls = 0;
    }

    async execute(...args) {
        if (this.state === "OPEN") {
            if (Date.now() < this.nextAttempt) {
                return this._handleFallback(
                    new Error("CircuitBreaker: OPEN (cooldown active)"),
                    args
                );
            }

            this.state = "HALF_OPEN";
            this.successCount = 0;
            this.halfOpenActiveCalls = 0;
            this.onHalfOpen();
        }

        if (this.state === "HALF_OPEN") {
            if (this.halfOpenActiveCalls >= this.halfOpenMaxCalls) {
                return this._handleFallback(
                    new Error("CircuitBreaker: HALF_OPEN limit reached"),
                    args
                );
            }
            this.halfOpenActiveCalls++;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const result = await this.fn(...args, { signal: controller.signal });

            clearTimeout(timeoutId);
            this._handleSuccess();
            return result;

        } catch (error) {
            clearTimeout(timeoutId);

            // Ignore non-critical errors
            if (!this.errorFilter(error)) {
                throw error;
            }

            this._handleFailure(error);
            return this._handleFallback(error, args);
        }
    }

    _handleSuccess() {
        this.failureCount = 0;

        if (this.state === "HALF_OPEN") {
            this.successCount++;

            if (this.successCount >= this.threshold) {
                this._close();
            }
        }
    }

    _handleFailure(error) {
        this.failureCount++;

        if (this.state === "HALF_OPEN" || this.failureCount >= this.threshold) {
            this._open();
        }
    }

    _handleFallback(error, args) {
        if (this.fallback) {
            return this.fallback(error, ...args);
        }
        throw error;
    }

    _open() {
        if (this.state !== "OPEN") {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.resetTimeout;
            this.onOpen();
        }
    }

    _close() {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.onClose();
    }

    getState() {
        return {
            state: this.state,
            failures: this.failureCount,
            successes: this.successCount,
            nextAttempt: this.nextAttempt
        };
    }

    reset() {
        this._close();
    }

    forceOpen() {
        this._open();
    }

    forceClose() {
        this._close();
    }
}

export function createCircuitBreaker(fn, options = {}) {
    return new CircuitBreaker(fn, options);
}
