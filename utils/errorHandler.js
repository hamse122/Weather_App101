/* =========================
   Resilience (2026 Edition)
========================= */

async _executeWithResilience(entry, error, context) {
    const name = error?.type || error?.constructor?.name || "Error";
    const now = Date.now();

    let state = this.circuitState.get(name) || {
        failures: 0,
        successes: 0,
        circuitOpenUntil: 0,
        halfOpen: false
    };

    // Circuit breaker: reject while cooldown is active.
    if (state.circuitOpenUntil > now) {
        this.circuitState.set(name, state);
        return null;
    }

    // Allow a single trial after cooldown.
    if (state.failures >= entry.breaker) {
        if (state.halfOpen) return null;
        state.halfOpen = true;
    }

    try {
        const result = await this.retry(
            () => this._withTimeout(
                () => entry.handler(error, context),
                entry.timeout
            ),
            entry.retries
        );

        state.failures = 0;
        state.successes++;
        state.circuitOpenUntil = 0;
        state.halfOpen = false;

        this.circuitState.set(name, state);
        return result;
    } catch (err) {
        state.failures++;
        state.halfOpen = false;

        if (state.failures >= entry.breaker) {
            state.circuitOpenUntil = Date.now() + entry.cooldown;
        }

        this.circuitState.set(name, state);
        throw err;
    }
}

async _withTimeout(fn, timeout = 0) {
    if (!timeout) return await fn();

    let timer;

    try {
        return await Promise.race([
            Promise.resolve().then(fn),
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`Handler timed out after ${timeout}ms`)),
                    timeout
                );
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async retry(fn, retries = 0, delay = 300) {
    const attempts = Math.max(0, Math.floor(Number(retries) || 0));
    let lastError;

    for (let attempt = 0; attempt <= attempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === attempts) break;

            const backoff = Math.min(
                delay * 2 ** attempt,
                30_000
            );

            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }

    throw lastError;
}

/* =========================
   Rate Limiting
========================= */

_allowLog() {
    const now = Date.now();
    const rl = this.rateLimit;

    if (now - rl.lastRefill >= rl.refillMs) {
        const intervals = Math.floor(
            (now - rl.lastRefill) / rl.refillMs
        );

        rl.tokens = Math.min(
            rl.capacity,
            rl.tokens + intervals * rl.capacity
        );

        rl.lastRefill += intervals * rl.refillMs;
    }

    if (rl.tokens <= 0) return false;

    rl.tokens--;
    return true;
}

/* =========================
   Error Creation
========================= */

createError(message, {
    type = "GeneralError",
    severity = "error",
    domain = "app",
    tags = {},
    cause = null,
    context = {}
} = {}) {
    const err = new Error(String(message), { cause });

    err.type = type;
    err.severity = severity;
    err.domain = domain;
    err.tags = { ...tags };
    err.context = { ...context };
    err.timestamp = new Date().toISOString();

    err.traceId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    return err;
}

/* =========================
   Payload & Utilities
========================= */

_buildPayload(error, context = {}) {
    const err = error instanceof Error
        ? error
        : new Error(String(error ?? "Unknown error"));

    const traceId =
        err.traceId ??
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    return {
        name: err.name,
        type: err.type || err.constructor.name,
        message: err.message,
        severity: err.severity || "error",
        domain: err.domain || "app",
        tags: { ...(err.tags || {}) },
        stack: err.stack,
        cause: err.cause
            ? {
                name: err.cause.name,
                message: err.cause.message
            }
            : null,
        traceId,
        context: {
            ...(err.context || {}),
            ...context
        },
        timestamp: err.timestamp || new Date().toISOString()
    };
}
