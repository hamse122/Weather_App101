/**
 * Enhanced Error Handler Utility
 * Advanced centralized error handling system with categorization, backoff,
 * async/sync wrapping, and extensible event-driven architecture.
 */

export class EnhancedErrorHandler {
    constructor() {
        this.handlers = new Map();
        this.logger = console.error;
        this.subscribers = new Set();
        this.globalFallback = null;
    }

    /* -------------------------------------------------------------------------- */
    /*                                CONFIGURATION                               */
    /* -------------------------------------------------------------------------- */

    /**
     * Use custom logger
     * @param {Function} logger
     */
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Set fallback handler when no handler matches
     * @param {Function} handler
     */
    setFallback(handler) {
        this.globalFallback = handler;
    }

    /**
     * Register specific error handler
     * @param {string} type
     * @param {Function} handler
     */
    registerHandler(type, handler) {
        this.handlers.set(type, handler);
    }

    /**
     * Subscribe to all errors (observer pattern)
     * @param {Function} subscriber
     */
    onError(subscriber) {
        this.subscribers.add(subscriber);
        return () => this.subscribers.delete(subscriber); // unsubscribe
    }

    /* -------------------------------------------------------------------------- */
    /*                               ERROR HANDLING                               */
    /* -------------------------------------------------------------------------- */

    /**
     * Handle error with logging + handler resolution
     * @param {Error} error
     * @param {Object} context
     */
    handle(error, context = {}) {
        const errorType = error.type || error.constructor.name;
        const handler = this.handlers.get(errorType) || this.handlers.get("default");

        const payload = {
            error: this.formatError(error),
            context,
            timestamp: new Date().toISOString()
        };

        // Notify observers
        this.subscribers.forEach(sub => sub(payload));

        // Log error
        if (this.logger) this.logger(payload);

        // Run handler
        if (handler) return handler(error, context);

        // Fallback
        if (this.globalFallback) return this.globalFallback(error, context);

        // Default: print to console
        console.error("Unhandled error:", error);
        return null;
    }

    /**
     * Format error object in clean JSON
     */
    formatError(error) {
        return {
            name: error.name,
            type: error.type || error.constructor.name,
            message: error.message,
            stack: error.stack,
            context: error.context || null,
            cause: error.originalError || null,
            timestamp: error.timestamp || new Date().toISOString()
        };
    }

    /* -------------------------------------------------------------------------- */
    /*                               FUNCTION WRAPPERS                             */
    /* -------------------------------------------------------------------------- */

    /**
     * Wrap async or sync functions with error handling
     * @param {Function} fn
     * @param {Object} context
     * @returns {Function}
     */
    wrap(fn, context = {}) {
        return (...args) => {
            try {
                const result = fn(...args);
                // Handle async functions
                if (result instanceof Promise) {
                    return result.catch(err =>
                        this.handle(err, { ...context, args })
                    );
                }
                return result;
            } catch (error) {
                return this.handle(error, { ...context, args });
            }
        };
    }

    /* -------------------------------------------------------------------------- */
    /*                              CUSTOM ERROR TYPES                             */
    /* -------------------------------------------------------------------------- */

    createError(message, context = {}, original = null, type = "GeneralError") {
        const error = new Error(message);
        error.type = type;
        error.context = context;
        error.originalError = original;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /* -------------------------------------------------------------------------- */
    /*                         RETRY WITH EXPONENTIAL BACKOFF                      */
    /* -------------------------------------------------------------------------- */

    /**
     * Retry function with exponential backoff
     * @param {Function} fn - must return a Promise
     * @param {number} retries
     * @param {number} delay
     */
    async retry(fn, retries = 3, delay = 500) {
        let lastError;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;

                if (attempt < retries) {
                    const backoff = delay * Math.pow(2, attempt - 1);
                    await new Promise(res => setTimeout(res, backoff));
                }
            }
        }

        throw lastError;
    }

    /* -------------------------------------------------------------------------- */
    /*                               ERROR DEDUPLICATION                           */
    /* -------------------------------------------------------------------------- */

    /**
     * Prevent same error from spamming logs (optional)
     * @param {number} windowMs
     */
    enableDeduplication(windowMs = 5000) {
        this.lastErrorHash = null;
        this.lastTimestamp = 0;

        this.setLogger((payload) => {
            const hash = JSON.stringify(payload.error);
            const now = Date.now();

            if (hash === this.lastErrorHash && now - this.lastTimestamp < windowMs)
                return; // Skip duplicate

            this.lastErrorHash = hash;
            this.lastTimestamp = now;

            console.error(payload);
        });
    }
}

/* -------------------------------------------------------------------------- */
/*                        EXPORT SINGLETON INSTANCE                           */
/* -------------------------------------------------------------------------- */

export const errorHandler = new EnhancedErrorHandler();
