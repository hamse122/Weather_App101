/**
 * Advanced PubSub v2 (Upgraded)
 * - Priority subscribers
 * - Middleware pipeline (next)
 * - Parallel / sequential publish
 * - Dead-letter queue
 * - Pattern cache
 * - Global pause
 */

class PubSub {
    #channels = new Map();
    #history = new Map();
    #paused = new Set();
    #middleware = [];
    #deadLetters = [];
    #patternCache = new Map();
    #globallyPaused = false;

    constructor({
        maxHistory = 100,
        historyTTL = null,
        parallel = true
    } = {}) {
        this.maxHistory = maxHistory;
        this.historyTTL = historyTTL;
        this.parallel = parallel;
    }

    /* =========================
       Middleware (Koa-style)
    ========================== */

    use(fn) {
        if (typeof fn !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.#middleware.push(fn);
    }

    async #runMiddleware(ctx, final) {
        let index = -1;
        const dispatch = async i => {
            if (i <= index) throw new Error('next() called twice');
            index = i;
            const fn = this.#middleware[i] || final;
            if (!fn) return;
            return fn(ctx, () => dispatch(i + 1));
        };
        return dispatch(0);
    }

    /* =========================
       Subscriptions
    ========================== */

    subscribe(channel, callback, { replay = 0, priority = 0 } = {}) {
        if (!this.#channels.has(channel)) {
            this.#channels.set(channel, new Set());
            this.#patternCache.clear();
        }

        const sub = { callback, priority };
        this.#channels.get(channel).add(sub);

        if (replay > 0) {
            this.getHistory(channel, replay)
                .forEach(m => callback(m.data, channel, m.timestamp));
        }

        return () => this.unsubscribe(channel, sub);
    }

    once(channel, callback, opts = {}) {
        const off = this.subscribe(channel, (d, c, t) => {
            off();
            callback(d, c, t);
        }, opts);
    }

    unsubscribe(channel, sub) {
        const set = this.#channels.get(channel);
        if (!set) return;
        set.delete(sub);
        if (!set.size) {
            this.#channels.delete(channel);
            this.#patternCache.clear();
        }
    }

    /* =========================
       Publishing
    ========================== */

    async publish(channel, data) {
        if (this.#globallyPaused || this.#paused.has(channel)) {
            return { delivered: 0, blocked: true };
        }

        const message = {
            channel,
            data,
            timestamp: Date.now()
        };

        this.#storeHistory(channel, message);

        const ctx = { message, cancelled: false };

        const start = performance.now();

        await this.#runMiddleware(ctx, async () => {
            const subs = this.#matchSubscribers(channel)
                .sort((a, b) => b.priority - a.priority);

            const execute = async sub => {
                try {
                    await sub.callback(data, channel, message.timestamp);
                    return true;
                } catch (err) {
                    this.#deadLetters.push({ err, message });
                    return false;
                }
            };

            if (this.parallel) {
                await Promise.all(subs.map(execute));
            } else {
                for (const s of subs) await execute(s);
            }
        });

        return {
            delivered: this.getSubscriberCount(channel),
            duration: performance.now() - start,
            deadLetters: this.#deadLetters.length
        };
    }

    /* =========================
       History
    ========================== */

    #storeHistory(channel, message) {
        let history = this.#history.get(channel);
        if (!history) {
            history = [];
            this.#history.set(channel, history);
        }

        history.push(message);

        while (history.length > this.maxHistory) {
            history.shift();
        }

        if (this.historyTTL) {
            const cutoff = Date.now() - this.historyTTL;
            while (history[0]?.timestamp < cutoff) {
                history.shift();
            }
        }
    }

    getHistory(channel, limit = 10) {
        return (this.#history.get(channel) || []).slice(-limit);
    }

    /* =========================
       Pause Control
    ========================== */

    pause(channel = null) {
        channel ? this.#paused.add(channel) : this.#globallyPaused = true;
    }

    resume(channel = null) {
        channel ? this.#paused.delete(channel) : this.#globallyPaused = false;
    }

    /* =========================
       Matching (Cached)
    ========================== */

    #matchSubscribers(channel) {
        if (this.#patternCache.has(channel)) {
            return this.#patternCache.get(channel);
        }

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

        this.#patternCache.set(channel, [...matched]);
        return [...matched];
    }

    /* =========================
       Utilities
    ========================== */

    getSubscriberCount(channel = null) {
        if (channel) return this.#channels.get(channel)?.size || 0;
        return [...this.#channels.values()].reduce((n, s) => n + s.size, 0);
    }

    getChannels() {
        return [...this.#channels.keys()];
    }

    getDeadLetters() {
        return [...this.#deadLetters];
    }

    reset() {
        this.#channels.clear();
        this.#history.clear();
        this.#paused.clear();
        this.#deadLetters = [];
        this.#patternCache.clear();
        this.#globallyPaused = false;
    }
}

module.exports = PubSub;
