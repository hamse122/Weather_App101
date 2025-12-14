/**
 * Advanced Analytics & Event Tracking System
 * Production-ready, resilient, extensible
 */

class Analytics {
    constructor(options = {}) {
        this.endpoint = options.endpoint || "/analytics";
        this.maxQueueSize = options.maxQueueSize ?? 100;
        this.flushInterval = options.flushInterval ?? 30000;
        this.retryLimit = options.retryLimit ?? 3;
        this.retryDelay = options.retryDelay ?? 1000;
        this.debug = options.debug ?? false;

        this.fetchImpl = options.fetch || (typeof fetch === "function" ? fetch : null);
        if (!this.fetchImpl) {
            throw new Error("Analytics requires a fetch implementation");
        }

        this.queueKey = options.queueKey || "analytics_queue";
        this.sessionKey = options.sessionKey || "analytics_session_id";

        this.enabled = options.enabled !== false;
        this.isFlushing = false;
        this.retryCount = 0;

        this.middlewares = [];
        this.context = options.context || {};

        this.queue = this.loadQueue();

        if (this.flushInterval > 0) {
            this.timer = setInterval(() => this.flush(), this.flushInterval);
            this.timer.unref?.();
        }

        this.attachLifecycleEvents();
    }

    /* -------------------------------------------------- */
    /* PUBLIC API                                         */
    /* -------------------------------------------------- */

    track(event, properties = {}) {
        if (!this.enabled) return null;

        let payload = {
            id: this.generateId(),
            event,
            properties,
            context: this.getContext(),
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
        };

        payload = this.runMiddlewares(payload);
        if (!payload) return null;

        this.queue.push(payload);
        this.persistQueue();

        if (this.queue.length >= this.maxQueueSize) {
            this.flush();
        }

        return payload;
    }

    pageView(page, properties = {}) {
        return this.track("page_view", { page, ...properties });
    }

    identify(userId, traits = {}) {
        return this.track("identify", { userId, traits });
    }

    flush() {
        if (this.isFlushing || this.queue.length === 0) return;
        this.sendBatch([...this.queue]);
    }

    clearQueue() {
        this.queue = [];
        this.persistQueue();
    }

    getQueueSize() {
        return this.queue.length;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    setContext(ctx) {
        this.context = { ...this.context, ...ctx };
    }

    /* -------------------------------------------------- */
    /* INTERNALS                                          */
    /* -------------------------------------------------- */

    async sendBatch(events) {
        this.isFlushing = true;

        try {
            await this.sendEvents(events);
            this.queue.splice(0, events.length);
            this.persistQueue();
            this.retryCount = 0;
        } catch (err) {
            if (this.debug) console.error("[Analytics] send failed", err);

            if (this.retryCount < this.retryLimit) {
                this.retryCount++;
                setTimeout(() => this.sendBatch(events),
                    this.retryDelay * this.retryCount
                );
            }
        } finally {
            this.isFlushing = false;
        }
    }

    async sendEvents(events) {
        if (navigator?.sendBeacon) {
            const blob = new Blob(
                [JSON.stringify({ events })],
                { type: "application/json" }
            );
            navigator.sendBeacon(this.endpoint, blob);
            return;
        }

        const res = await this.fetchImpl(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        return res.json();
    }

    runMiddlewares(payload) {
        let result = payload;
        for (const mw of this.middlewares) {
            result = mw(result);
            if (!result) return null; // allow drop
        }
        return result;
    }

    getContext() {
        return {
            ...this.context,
            url: typeof window !== "undefined" ? window.location.href : "server",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
        };
    }

    getSessionId() {
        if (typeof sessionStorage === "undefined") {
            return this.generateId();
        }

        let id = sessionStorage.getItem(this.sessionKey);
        if (!id) {
            id = this.generateId();
            sessionStorage.setItem(this.sessionKey, id);
        }
        return id;
    }

    loadQueue() {
        try {
            const raw = localStorage.getItem(this.queueKey);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    persistQueue() {
        try {
            localStorage.setItem(this.queueKey, JSON.stringify(this.queue));
        } catch {}
    }

    attachLifecycleEvents() {
        if (typeof window === "undefined") return;

        window.addEventListener("beforeunload", () => this.flush());
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                this.flush();
            }
        });
    }

    generateId() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}

module.exports = Analytics;
