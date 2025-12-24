/**
 * Advanced Publish–Subscribe (PubSub) System
 * - Channels + wildcards
 * - Async subscribers
 * - History with size + TTL
 * - Replay support
 * - Middleware
 * - Pause / resume
 */

class PubSub {
    #channels = new Map();        // channel -> Set(sub)
    #history = new Map();         // channel -> [{ data, timestamp }]
    #paused = new Set();          // paused channels
    #middleware = [];             // functions

    constructor({
        maxHistory = 100,
        historyTTL = null // ms (e.g. 60000) or null
    } = {}) {
        this.maxHistory = maxHistory;
        this.historyTTL = historyTTL;
    }

    /* =========================
       Middleware
    ========================== */

    use(fn) {
        if (typeof fn === 'function') {
            this.#middleware.push(fn);
        }
    }

    /* =========================
       Subscriptions
    ========================== */

    subscribe(channel, callback, { replay = 0 } = {}) {
        if (!this.#channels.has(channel)) {
            this.#channels.set(channel, new Set());
        }

        const sub = { callback };
        this.#channels.get(channel).add(sub);

        // Replay history
        if (replay > 0) {
            this.getHistory(channel, replay)
                .forEach(msg =>
                    callback(msg.data, channel, msg.timestamp)
                );
        }

        // Return safe unsubscribe token
        return () => this.unsubscribe(channel, sub);
    }

    once(channel, callback) {
        const off = this.subscribe(channel, (data, ch, ts) => {
            off();
            callback(data, ch, ts);
        });
    }

    unsubscribe(channel, sub) {
        const set = this.#channels.get(channel);
        if (!set) return;

        set.delete(sub);
        if (set.size === 0) {
            this.#channels.delete(channel);
        }
    }

    /* =========================
       Publishing
    ========================== */

    async publish(channel, data) {
        if (this.#paused.has(channel)) return 0;

        const message = { data, timestamp: Date.now() };

        this.#storeHistory(channel, message);

        // Run middleware
        for (const mw of this.#middleware) {
            const result = await mw(channel, message);
            if (result === false) return 0;
        }

        const subs = this.#matchSubscribers(channel);
        let count = 0;

        for (const sub of subs) {
            try {
                await sub.callback(data, channel, message.timestamp);
                count++;
            } catch (err) {
                console.error(`[PubSub:${channel}]`, err);
            }
        }

        return count;
    }

    /* =========================
       History
    ========================== */

    #storeHistory(channel, message) {
        if (!this.#history.has(channel)) {
            this.#history.set(channel, []);
        }

        const history = this.#history.get(channel);
        history.push(message);

        if (history.length > this.maxHistory) {
            history.shift();
        }

        if (this.historyTTL) {
            const now = Date.now();
            while (history[0] && now - history[0].timestamp > this.historyTTL) {
                history.shift();
            }
        }
    }

    getHistory(channel, limit = 10) {
        return (this.#history.get(channel) || []).slice(-limit);
    }

    clearHistory(channel = null) {
        channel ? this.#history.delete(channel) : this.#history.clear();
    }

    /* =========================
       Channel Control
    ========================== */

    pause(channel) {
        this.#paused.add(channel);
    }

    resume(channel) {
        this.#paused.delete(channel);
    }

    /* =========================
       Utilities
    ========================== */

    #matchSubscribers(channel) {
        const matched = new Set();

        for (const [key, subs] of this.#channels.entries()) {
            if (
                key === channel ||
                key === '*' ||
                (key.endsWith('*') && channel.startsWith(key.slice(0, -1)))
            ) {
                subs.forEach(s => matched.add(s));
            }
        }
        return matched;
    }

    getSubscriberCount(channel = null) {
        if (channel) {
            return this.#channels.get(channel)?.size || 0;
        }
        return [...this.#channels.values()]
            .reduce((n, s) => n + s.size, 0);
    }

    getChannels() {
        return [...this.#channels.keys()];
    }

    reset() {
        this.#channels.clear();
        this.#history.clear();
        this.#paused.clear();
    }
}

module.exports = PubSub;
