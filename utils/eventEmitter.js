class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    on(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(listener);
        return this;
    }

    prependListener(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).unshift(listener);
        return this;
    }

    once(event, listener) {
        const wrapper = (...args) => {
            listener(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }

    prependOnceListener(event, listener) {
        const wrapper = (...args) => {
            listener(...args);
            this.off(event, wrapper);
        };
        return this.prependListener(event, wrapper);
    }

    emit(event, ...args) {
        const listeners = this.events.get(event);
        if (!listeners) return false;

        // Copy array to prevent mutation during iteration
        [...listeners].forEach(listener => listener(...args));
        return true;
    }

    off(event, listenerToRemove) {
        if (!this.events.has(event)) return this;

        const filtered = this.events
            .get(event)
            .filter(listener => listener !== listenerToRemove);

        this.events.set(event, filtered);

        return this;
    }

    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
        return this;
    }

    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    eventNames() {
        return [...this.events.keys()];
    }
}

module.exports = EventEmitter;
