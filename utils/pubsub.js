/**
 * Publish–Subscribe (PubSub) System
 * Supports channels, history, replay, and safe subscriptions
 */

class PubSub {
    #channels = new Map();
    #history = new Map();

    constructor({ maxHistory = 100 } = {}) {
        this.maxHistory = maxHistory;
    }

    /* =========================
       Subscriptions
    ========================== */

    subscribe(channel, callback, { replay = 0 } = {}) {
        if (!this.#channels.has(channel)) {
            this.#channels.set(channel, new Set());
        }

        this.#channels.get(channel).add(callback);

        // Optional replay
        if (replay > 0) {
            this.getHistory(channel, replay).forEach(msg => {
                callback(msg.data, channel, msg.timestamp);
            });
        }

        return () => this.unsubscribe(channel, callback);
    }

    once(channel, callback) {
        const unsubscribe = this.subscribe(channel, (data) => {
            unsubscribe();
            callback(data, channel);
        });
    }

    unsubscribe(channel, callback) {
        const subs = this.#channels.get(channel);
        if (!subs) return;

        subs.delete(callback);
        if (subs.size === 0) {
            this.#channels.delete(channel);
        }
    }

    /* =========================
       Publishing
    ========================== */

    publish(channel, data) {
        const message = {
            data,
            timestamp: Date.now()
        };

        if (!this.#history.has(channel)) {
            this.#history.set(channel, []);
        }

        const history = this.#history.get(channel);
        history.push(message);

        if (history.length > this.maxHistory) {
            history.shift();
        }

        const subs = this.#channels.get(channel);
        if (!subs) return 0;

        subs.forEach(cb => {
            try {
                cb(data, channel, message.timestamp);
            } catch (err) {
                console.error(`PubSub error on "${channel}":`, err);
            }
        });

        return subs.size;
    }

    /* =========================
       History
    ========================== */

    getHistory(channel, limit = 10) {
        return (this.#history.get(channel) || []).slice(-limit);
    }

    clearHistory(channel = null) {
        if (channel) {
            this.#history.delete(channel);
        } else {
            this.#history.clear();
        }
    }

    /* =========================
       Stats
    ========================== */

    getSubscriberCount(channel = null) {
        if (channel) {
            return this.#channels.get(channel)?.size || 0;
        }

        return [...this.#channels.values()]
            .reduce((sum, set) => sum + set.size, 0);
    }

    getChannels() {
        return [...this.#channels.keys()];
    }

    reset() {
        this.#channels.clear();
        this.#history.clear();
    }
}

module.exports = PubSub;
