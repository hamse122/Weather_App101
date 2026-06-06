/**
 * PubSub v2.1 (Hardened + Optimized)
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
        parallel = true,
        maxDeadLetters = 1000
    } = {}) {
        this.maxHistory = maxHistory;
        this.historyTTL = historyTTL;
        this.parallel = parallel;
        this.maxDeadLetters = maxDeadLetters;

        this.now = typeof performance !== "undefined"
            ? () => performance.now()
            : () => Date.now();
    }

    /* ================= Middleware ================= */

    use(fn) {
        if (typeof fn !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.#middleware.push(fn);
        this.#patternCache.clear();
    }

    async #runMiddleware(ctx, final) {
        let index = -1;

        const dispatch = async (i) => {
            if (i <= index) throw new Error('next() called multiple times');
            index = i;

            const fn = this.#middleware[i];
            if (!fn) return final?.();

            try {
                return await fn(ctx, () => dispatch(i + 1));
            } catch (err) {
                ctx.error = err;
                throw err;
            }
        };

        return dispatch(0);
    }

    /* ================= Subscriptions ================= */

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
        let off;
        off = this.subscribe(channel, (d, c, t) => {
            off?.();
            callback(d, c, t);
        }, opts);

        return off;
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

    /* ================= Publish ================= */

    async publish(channel, data) {
        if (this.#globallyPaused || this.#paused.has(channel)) {
            return { delivered: 0, blocked: true };
        }

        const message = { channel, data, timestamp: Date.now() };
        this.#storeHistory(channel, message);

        const ctx = { message };

        const start = this.now();

        let subs;
        try {
            subs = this.#matchSubscribers(channel);
        } catch (err) {
            return { delivered: 0, error: err.message };
        }

        subs.sort((a, b) => b.priority - a.priority);

        const execute = async (sub) => {
            try {
                await sub.callback(data, channel, message.timestamp);
            } catch (err) {
                this.#pushDeadLetter({ err, message });
            }
        };

        await this.#runMiddleware(ctx, async () => {
            if (this.parallel) {
                await Promise.allSettled(subs.map(execute));
            } else {
                for (const s of subs) await execute(s);
            }
        });

        return {
            delivered: subs.length,
            duration: this.now() - start,
            deadLetters: this.#deadLetters.length
        };
    }

    /* ================= History ================= */

    #storeHistory(channel, message) {
        let history = this.#history.get(channel);
        if (!history) {
            history = [];
            this.#history.set(channel, history);
        }

        history.push(message);

        if (history.length > this.maxHistory) {
            history.splice(0, history.length - this.maxHistory);
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

    /* ================= Pause ================= */

    pause(channel = null) {
        channel ? this.#paused.add(channel) : this.#globallyPaused = true;
    }

    resume(channel = null) {
        channel ? this.#paused.delete(channel) : this.#globallyPaused = false;
    }

    /* ================= Matching ================= */

    #matchSubscribers(channel) {
        if (this.#patternCache.has(channel)) {
            return this.#patternCache.get(channel);
        }

        const matched = [];

        for (const [key, subs] of this.#channels.entries()) {
            const isWildcard =
                key === '*' ||
                (key.endsWith('*') && channel.startsWith(key.slice(0, -1)));

            if (key === channel || isWildcard) {
                for (const s of subs) matched.push(s);
            }
        }

        this.#patternCache.set(channel, matched);
        return matched;
    }

    /* ================= Dead Letters ================= */

    #pushDeadLetter(entry) {
        this.#deadLetters.push(entry);

        if (this.#deadLetters.length > this.maxDeadLetters) {
            this.#deadLetters.shift();
        }
    }

    getDeadLetters() {
        return [...this.#deadLetters];
    }

    /* ================= Utils ================= */

    getSubscriberCount(channel = null) {
        if (channel) return this.#channels.get(channel)?.size || 0;
        return [...this.#channels.values()].reduce((n, s) => n + s.size, 0);
    }

    getChannels() {
        return [...this.#channels.keys()];
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
