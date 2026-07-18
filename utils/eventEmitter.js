/**
 * Advanced EventEmitter v3
 * - Listener metadata (priority, once)
 * - High-performance internal storage
 * - Safe async + sync emit pipelines
 * - Any listeners
 * - Error capturing & forwarding
 * - Listener warnings
 */

class EventEmitter {
    constructor(options = {}) {
        this.events = new Map();               // { event: [ { fn, once, priority } ] }
        this.anyListeners = new Set();         // for onAny
        this.maxListeners = options.maxListeners || 10;
        this.captureErrors = options.captureErrors ?? true;
        this.profile = options.profile ?? false;
    }

/* ============================================
   Internal Helpers (v2)
============================================ */

_getStore(event) {
    if (typeof event !== "string" && typeof event !== "symbol") {
        throw new TypeError("Event name must be a string or symbol");
    }

    if (!this.events.has(event)) {
        this.events.set(event, []);
    }

    return this.events.get(event);
}

_warnIfExceeded(event) {
    if (!Number.isFinite(this.maxListeners) || this.maxListeners <= 0) {
        return;
    }

    const count = this.listenerCount(event);

    if (count > this.maxListeners) {
        const warning = new Error(
            `[EventEmitter] Possible memory leak detected. ${count} listeners attached to "${String(event)}".`
        );

        warning.name = "MaxListenersExceededWarning";

        if (typeof process !== "undefined" && process.emitWarning) {
            process.emitWarning(warning);
        } else {
            console.warn(warning.message);
        }
    }
}

_addListener(
    event,
    fn,
    once = false,
    prepend = false,
    priority = 0
) {
    if (typeof fn !== "function") {
        throw new TypeError("Listener must be a function");
    }

    const store = this._getStore(event);

    const meta = {
        fn,
        once,
        priority: Number(priority) || 0,
        addedAt: Date.now(),
        calls: 0,
        enabled: true
    };

    // Prevent duplicate listeners
    if (store.some(l => l.fn === fn)) {
        return this;
    }

    if (prepend) {
        store.unshift(meta);
    } else {
        // Higher priority executes first
        let index = store.findIndex(
            l => l.priority < meta.priority
        );

        if (index === -1) index = store.length;

        store.splice(index, 0, meta);
    }

    this._warnIfExceeded(event);

    this.emit?.("newListener", event, fn);

    return this;
}
    /* ============================================
       Core API
    ============================================ */
    on(event, listener, options = {}) {
        return this._addListener(event, listener, false, false, options.priority ?? 0);
    }

    prependListener(event, listener) {
        return this._addListener(event, listener, false, true);
    }

    once(event, listener, options = {}) {
        return this._addListener(event, listener, true, false, options.priority ?? 0);
    }

    prependOnceListener(event, listener) {
        return this._addListener(event, listener, true, true);
    }

    off(event, fn) {
        const store = this.events.get(event);
        if (!store) return this;

        const filtered = store.filter(meta => meta.fn !== fn);
        filtered.length ? this.events.set(event, filtered) : this.events.delete(event);

        return this;
    }

    /* ============================================
       Emit (Sync)
    ============================================ */
    emit(event, ...args) {
        const store = this.events.get(event);
        const anyListeners = [...this.anyListeners];
        if (!store && anyListeners.length === 0) return false;

        const start = this.profile ? performance.now() : 0;

        // Copy to avoid mutation during iteration
        const listeners = store ? [...store] : [];

        for (const meta of listeners) {
            try {
                meta.fn(...args);
                if (meta.once) this.off(event, meta.fn);
            } catch (err) {
                if (this.captureErrors && event !== "error") {
                    this.emit("error", err);
                } else {
                    throw err;
                }
            }
        }

        // Any listeners
        for (const fn of anyListeners) {
            try {
                fn(event, ...args);
            } catch (err) {
                if (this.captureErrors) this.emit("error", err);
                else throw err;
            }
        }

        if (this.profile) {
            console.log(`[EventEmitter] Event "${event}" took ${(performance.now() - start).toFixed(2)}ms`);
        }

        return true;
    }

    /* ============================================
       Emit Async (Promise)
    ============================================ */
    async emitAsync(event, ...args) {
        const store = this.events.get(event) || [];
        const tasks = [];

        for (const meta of [...store]) {
            const task = Promise.resolve()
                .then(() => meta.fn(...args))
                .catch(err => {
                    if (this.captureErrors && event !== "error") {
                        this.emit("error", err);
                    } else {
                        throw err;
                    }
                });

            tasks.push(task);
            if (meta.once) this.off(event, meta.fn);
        }

        for (const fn of this.anyListeners) {
            tasks.push(Promise.resolve(fn(event, ...args)));
        }

        await Promise.all(tasks);
        return true;
    }

    /* ============================================
       Global / Utility
    ============================================ */
    onAny(listener) {
        this.anyListeners.add(listener);
        return this;
    }

    offAny(listener) {
        this.anyListeners.delete(listener);
        return this;
    }

    removeAllListeners(event) {
        event ? this.events.delete(event) : this.events.clear();
        return this;
    }

    listenerCount(event) {
        return this.events.get(event)?.length || 0;
    }

    eventNames() {
        return [...this.events.keys()];
    }

    setMaxListeners(n) {
        this.maxListeners = n;
        return this;
    }

    /* ============================================
       Aliases (Node.js compatibility)
    ============================================ */
    addListener(event, fn) {
        return this.on(event, fn);
    }

    removeListener(event, fn) {
        return this.off(event, fn);
    }
}

module.exports = EventEmitter;
