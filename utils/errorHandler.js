export class EnhancedErrorHandler {
    constructor(options = {}) {
        this.handlers = new Map();
        this.subscribers = new Set();
        this.transports = new Set();

        this.logger = options.logger || console.error;
        this.globalFallback = null;

        this.rateLimit = {
            capacity: 10,
            tokens: 10,
            refillMs: 1000,
            lastRefill: Date.now()
        };

        this.circuitState = new Map(); // handlerName -> failures
    }

    /* =========================
       Configuration
    ========================== */

    setLogger(logger) {
        this.logger = logger;
    }

    setFallback(handler) {
        this.globalFallback = handler;
    }

    registerHandler(type, handler, { retries = 0, breaker = 5 } = {}) {
        this.handlers.set(type, {
            handler,
            retries,
            breaker
        });
    }

    registerTransport(transportFn) {
        this.transports.add(transportFn);
    }

    onError(subscriber) {
        this.subscribers.add(subscriber);
        return () => this.subscribers.delete(subscriber);
    }

    /* =========================
       Core Handling
    ========================== */

    async handle(error, context = {}) {
        const payload = this._buildPayload(error, context);

        if (!this._allowLog()) return null;

        // Notify observers (async safe)
        await Promise.allSettled(
            [...this.subscribers].map(sub => sub(payload))
        );

        // Send to transports
        for (const transport of this.transports) {
            try {
                await transport(payload);
            } catch (_) {}
        }

        // Log
        this.logger(payload);

        const entry =
            this.handlers.get(payload.type) ||
            this.handlers.get("default");

        if (!entry) {
            return this.globalFallback?.(error, context);
        }

        return this._executeWithResilience(entry, error, context);
    }

    /* =========================
       Resilience
    ========================== */

    async _executeWithResilience(entry, error, context) {
        const name = error.type;
        const state = this.circuitState.get(name) || { failures: 0 };

        if (state.failures >= entry.breaker) {
            return null; // circuit open
        }

        try {
            return await this.retry(
                () => entry.handler(error, context),
                entry.retries
            );
        } catch (err) {
            state.failures++;
            this.circuitState.set(name, state);
            throw err;
        }
    }

    retry(fn, retries = 0, delay = 300) {
        return new Promise(async (resolve, reject) => {
            let last;
            for (let i = 0; i <= retries; i++) {
                try {
                    return resolve(await fn());
                } catch (e) {
                    last = e;
                    await new Promise(r =>
                        setTimeout(r, delay * Math.pow(2, i))
                    );
                }
            }
            reject(last);
        });
    }

    /* =========================
       Wrappers
    ========================== */

    wrap(fn, context = {}) {
        return (...args) => {
            try {
                const result = fn(...args);
                if (result instanceof Promise) {
                    return result.catch(err =>
                        this.handle(err, { ...context, args })
                    );
                }
                return result;
            } catch (err) {
                return this.handle(err, { ...context, args });
            }
        };
    }

    /* =========================
       Error Creation
    ========================== */

    createError(message, {
        type = "GeneralError",
        severity = "error",
        domain = "app",
        tags = {},
        cause = null,
        context = {}
    } = {}) {
        const err = new Error(message);
        err.type = type;
        err.severity = severity;
        err.domain = domain;
        err.tags = tags;
        err.cause = cause;
        err.context = context;
        err.timestamp = new Date().toISOString();
        err.traceId = crypto.randomUUID();
        return err;
    }

    /* =========================
       Payload & Utilities
    ========================== */

    _buildPayload(error, context) {
        return {
            name: error.name,
            type: error.type || error.constructor.name,
            message: error.message,
            severity: error.severity || "error",
            domain: error.domain || "app",
            tags: error.tags || {},
            stack: error.stack,
            traceId: error.traceId || crypto.randomUUID(),
            context: { ...error.context, ...context },
            timestamp: error.timestamp || new Date().toISOString()
        };
    }

    _allowLog() {
        const now = Date.now();
        const rl = this.rateLimit;

        if (now - rl.lastRefill > rl.refillMs) {
            rl.tokens = rl.capacity;
            rl.lastRefill = now;
        }

        if (rl.tokens <= 0) return false;
        rl.tokens--;
        return true;
    }
}

/* =========================
   Singleton
========================== */

export const errorHandler = new EnhancedErrorHandler();
