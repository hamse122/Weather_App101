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
========================= */

setLogger(logger) {
    if (logger != null && typeof logger !== "object") {
        throw new TypeError("Logger must be an object or null");
    }

    this.logger = logger;
    return this;
}

setFallback(handler) {
    if (handler != null && typeof handler !== "function") {
        throw new TypeError("Fallback handler must be a function or null");
    }

    this.globalFallback = handler;
    return this;
}

registerHandler(
    type,
    handler,
    {
        retries = 0,
        breaker = 5,
        cooldown = 30_000,
        timeout = 0,
        enabled = true
    } = {}
) {
    if (!type || typeof type !== "string") {
        throw new TypeError("Handler type must be a non-empty string");
    }

    if (typeof handler !== "function") {
        throw new TypeError("Handler must be a function");
    }

    this.handlers.set(type, {
        handler,
        retries: Math.max(0, Number(retries) || 0),
        breaker: Math.max(1, Number(breaker) || 5),
        cooldown: Math.max(0, Number(cooldown) || 0),
        timeout: Math.max(0, Number(timeout) || 0),
        enabled: Boolean(enabled),
        failures: 0,
        lastFailure: null,
        circuitOpenUntil: null
    });

    return this;
}

unregisterHandler(type) {
    return this.handlers.delete(type);
}

registerTransport(transportFn) {
    if (typeof transportFn !== "function") {
        throw new TypeError("Transport must be a function");
    }

    this.transports.add(transportFn);

    // Returns a cleanup function
    return () => this.transports.delete(transportFn);
}

onError(subscriber) {
    if (typeof subscriber !== "function") {
        throw new TypeError("Error subscriber must be a function");
    }

    this.subscribers.add(subscriber);

    return () => this.subscribers.delete(subscriber);
}

clearConfiguration() {
    this.handlers.clear();
    this.transports.clear();
    this.subscribers.clear();
    this.globalFallback = null;

    return this;
}

/* =========================
   Core Handling
========================== */

async handle(error, context = {}) {
    const payloadSource = this._buildPayload(error, context);

    let payload;

    try {
        payload = Object.freeze(
            typeof structuredClone === "function"
                ? structuredClone(payloadSource)
                : { ...payloadSource }
        );
    } catch {
        payload = Object.freeze({ ...payloadSource });
    }

    if (!this._allowLog()) return null;

    const start =
        typeof performance !== "undefined"
            ? performance.now()
            : Date.now();

    try {
        // Notify subscribers independently
        const subscriberResults = await Promise.allSettled(
            [...this.subscribers].map(sub =>
                Promise.resolve().then(() => sub(payload))
            )
        );

        subscriberResults.forEach(result => {
            if (result.status === "rejected") {
                console.error(
                    "[ErrorHandler] Subscriber failed:",
                    result.reason
                );
            }
        });

        // Execute transports concurrently
        const transportResults = await Promise.allSettled(
            this.transports.map(transport =>
                Promise.resolve().then(() => transport(payload))
            )
        );

        transportResults.forEach(result => {
            if (result.status === "rejected") {
                console.error(
                    "[ErrorHandler] Transport failed:",
                    result.reason
                );
            }
        });

        // Logger is isolated from the main error flow
        try {
            await Promise.resolve(this.logger?.(payload));
        } catch (err) {
            console.error("[ErrorHandler] Logger failed:", err);
        }

        // Resolve type-specific handler
        const entry =
            this.handlers.get(payload.type) ??
            this.handlers.get("default");

        if (!entry) {
            if (typeof this.globalFallback === "function") {
                try {
                    return await this.globalFallback(error, context);
                } catch (fallbackError) {
                    console.error(
                        "[ErrorHandler] Fallback failed:",
                        fallbackError
                    );
                }
            }

            return null;
        }

        return await this._executeWithResilience(
            entry,
            error,
            context
        );

    } catch (err) {
        console.error("[ErrorHandler] Handling failed:", err);

        if (typeof this.globalFallback === "function") {
            try {
                return await this.globalFallback(error, context);
            } catch (fallbackError) {
                console.error(
                    "[ErrorHandler] Global fallback failed:",
                    fallbackError
                );
            }
        }

        return null;

    } finally {
        this.metrics ??= {
            handled: 0,
            totalTime: 0,
            lastHandledAt: null
        };

        const end =
            typeof performance !== "undefined"
                ? performance.now()
                : Date.now();

        this.metrics.handled++;
        this.metrics.totalTime += end - start;
        this.metrics.lastHandledAt = Date.now();
    }
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
