class EventEmitter {
    constructor(options = {}) {
        this.events = new Map();
        this.anyListeners = new Set();
        this.maxListeners = options.maxListeners || 10;
        this.captureErrors = options.captureErrors ?? true;
    }

    /* =========================
       Internal Helpers
    ========================= */
    _getListeners(event) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        return this.events.get(event);
    }

    _warnIfExceeded(event) {
        const count = this.listenerCount(event);
        if (count > this.maxListeners) {
            console.warn(
                `[EventEmitter] Possible memory leak detected. ` +
                `${count} listeners added for "${event}".`
            );
        }
    }

    /* =========================
       Core API
    ========================= */
    on(event, listener) {
        this._getListeners(event).push(listener);
        this._warnIfExceeded(event);
        return this;
    }

    prependListener(event, listener) {
        this._getListeners(event).unshift(listener);
        this._warnIfExceeded(event);
        return this;
    }

    once(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener(...args);
        };
        wrapper._once = true;
        return this.on(event, wrapper);
    }

    prependOnceListener(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener(...args);
        };
        wrapper._once = true;
        return this.prependListener(event, wrapper);
    }

    off(event, listenerToRemove) {
        if (!this.events.has(event)) return this;

        const listeners = this.events
            .get(event)
            .filter(l => l !== listenerToRemove);

        listeners.length
            ? this.events.set(event, listeners)
            : this.events.delete(event);

        return this;
    }

    emit(event, ...args) {
        const listeners = this.events.get(event);
        if (!listeners && this.anyListeners.size === 0) return false;

        const safeCall = fn => {
            try {
                fn(...args);
            } catch (err) {
                if (this.captureErrors && event !== "error") {
                    this.emit("error", err);
                } else {
                    throw err;
                }
            }
        };

        listeners && [...listeners].forEach(safeCall);
        this.anyListeners.forEach(fn => safeCall(fn.bind(null, event)));

        return true;
    }

    async emitAsync(event, ...args) {
        const listeners = this.events.get(event) || [];
        const tasks = [];

        for (const listener of listeners) {
            tasks.push(Promise.resolve(listener(...args)));
        }

        for (const listener of this.anyListeners) {
            tasks.push(Promise.resolve(listener(event, ...args)));
        }

        await Promise.all(tasks);
        return true;
    }

    /* =========================
       Global / Utility
    ========================= */
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

    /* =========================
       Aliases (Node.js compatible)
    ========================= */
    addListener(event, listener) {
        return this.on(event, listener);
    }

    removeListener(event, listener) {
        return this.off(event, listener);
    }
}

module.exports = EventEmitter;
