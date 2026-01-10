/**
 * Advanced Notification System v2
 * Framework-agnostic (React / Vue / Vanilla)
 */

export class NotificationSystem {
    constructor(options = {}) {
        this.notifications = new Map();
        this.listeners = new Set();
        this.middlewares = [];

        this.options = {
            maxNotifications: 10,
            overflowStrategy: "fifo",
            allowDuplicates: true,
            duplicateStrategy: "ignore", // ignore | update | stack
            logHistory: false,
            perTypeLimit: {},
            batching: true,
            batchInterval: 16,
            ...options
        };

        this.history = [];
        this.timers = new Map();
        this.paused = false;
        this.batchQueue = [];
    }

    // =====================
    // ID
    // =====================
    static uid() {
        if (crypto?.randomUUID) return crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    // =====================
    // CORE
    // =====================
    notify(input) {
        let notification = {
            id: NotificationSystem.uid(),
            type: "info",
            priority: 0,
            message: "",
            duration: 5000,
            meta: {},
            createdAt: Date.now(),
            remaining: null,
            ...input
        };

        // Middleware
        for (const mw of this.middlewares) {
            notification = mw(notification) || notification;
        }

        // Duplicate handling
        if (!this.options.allowDuplicates) {
            for (const n of this.notifications.values()) {
                if (n.message === notification.message && n.type === notification.type) {
                    if (this.options.duplicateStrategy === "update") {
                        this.update(n.id, notification);
                        return n.id;
                    }
                    return null;
                }
            }
        }

        this._enforceLimits(notification);
        this.notifications.set(notification.id, notification);

        if (this.options.logHistory) {
            this.history.push(notification);
        }

        this._schedule(notification);
        this._emit("add", notification);
        return notification.id;
    }

    update(id, patch) {
        const n = this.notifications.get(id);
        if (!n) return;

        Object.assign(n, patch);
        this._emit("update", n);
    }

    remove(id) {
        const n = this.notifications.get(id);
        if (!n) return;

        this._clearTimer(id);
        this.notifications.delete(id);
        this._emit("remove", n);
    }

    clear() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers.clear();
        this.notifications.clear();
        this._emit("clear", null);
    }

    // =====================
    // TIMERS
    // =====================
    _schedule(n) {
        if (n.duration <= 0 || this.paused) return;

        n.remaining ??= n.duration;
        const start = Date.now();

        const timer = setTimeout(() => {
            this.remove(n.id);
        }, n.remaining);

        n._startedAt = start;
        this.timers.set(n.id, timer);
    }

    pause(id = null) {
        if (id === null) {
            this.paused = true;
            this.notifications.forEach(n => this.pause(n.id));
            return;
        }

        const n = this.notifications.get(id);
        if (!n) return;

        this._clearTimer(id);
        n.remaining -= Date.now() - n._startedAt;
        this._emit("pause", n);
    }

    resume(id = null) {
        if (id === null) {
            this.paused = false;
            this.notifications.forEach(n => this.resume(n.id));
            return;
        }

        const n = this.notifications.get(id);
        if (!n || n.remaining <= 0) return;

        this._schedule(n);
        this._emit("resume", n);
    }

    _clearTimer(id) {
        const t = this.timers.get(id);
        if (t) clearTimeout(t);
        this.timers.delete(id);
    }

    // =====================
    // LIMITS
    // =====================
    _enforceLimits(newNotif) {
        const max = this.options.maxNotifications;
        if (this.notifications.size < max) return;

        const sorted = [...this.notifications.values()]
            .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

        const toRemove =
            this.options.overflowStrategy === "lifo"
                ? sorted.pop()
                : sorted.shift();

        this.remove(toRemove.id);
    }

    // =====================
    // SUBSCRIPTIONS
    // =====================
    subscribe(fn, filter = null) {
        const wrapped = (e) => (!filter || filter(e)) && fn(e);
        this.listeners.add(wrapped);
        return () => this.listeners.delete(wrapped);
    }

    use(middleware) {
        this.middlewares.push(middleware);
    }

    _emit(type, notification) {
        const payload = Object.freeze({
            type,
            notification,
            notifications: [...this.notifications.values()],
            timestamp: Date.now()
        });

        if (!this.options.batching) {
            this.listeners.forEach(l => l(payload));
            return;
        }

        this.batchQueue.push(payload);
        if (this.batchQueue.length === 1) {
            setTimeout(() => {
                const batch = this.batchQueue.splice(0);
                this.listeners.forEach(l => l(batch));
            }, this.options.batchInterval);
        }
    }

    // =====================
    // GETTERS
    // =====================
    get(id) {
        return this.notifications.get(id) || null;
    }

    getAll() {
        return [...this.notifications.values()];
    }

    getHistory() {
        return [...this.history];
    }

    // =====================
    // HELPERS
    // =====================
    success(msg, d, m) { return this.notify({ type: "success", message: msg, duration: d, meta: m }); }
    error(msg, d, m)   { return this.notify({ type: "error", message: msg, duration: d, meta: m }); }
    warning(msg, d, m) { return this.notify({ type: "warning", message: msg, duration: d, meta: m }); }
    info(msg, d, m)    { return this.notify({ type: "info", message: msg, duration: d, meta: m }); }
}
