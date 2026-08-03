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

_schedule(notification) {
    if (
        !notification ||
        notification.duration <= 0 ||
        this.paused ||
        notification.remaining <= 0
    ) {
        return;
    }

    // Prevent duplicate timers
    this._clearTimer(notification.id);

    notification.remaining ??= notification.duration;
    notification._startedAt = performance?.now?.() ?? Date.now();
    notification._paused = false;

    const timer = setTimeout(() => {
        this.timers.delete(notification.id);
        this.remove(notification.id);
    }, notification.remaining);

    this.timers.set(notification.id, timer);
}

pause(id = null) {
    if (id === null) {
        if (this.paused) return;

        this.paused = true;

        for (const notification of this.notifications.values()) {
            this.pause(notification.id);
        }

        return;
    }

    const notification = this.notifications.get(id);

    if (
        !notification ||
        notification._paused ||
        !this.timers.has(id)
    ) {
        return;
    }

    const now = performance?.now?.() ?? Date.now();

    this._clearTimer(id);

    notification.remaining = Math.max(
        0,
        notification.remaining - (now - notification._startedAt)
    );

    notification._paused = true;

    this._emit("pause", notification);
}

resume(id = null) {
    if (id === null) {
        if (!this.paused) return;

        this.paused = false;

        for (const notification of this.notifications.values()) {
            this.resume(notification.id);
        }

        return;
    }

    const notification = this.notifications.get(id);

    if (
        !notification ||
        !notification._paused ||
        notification.remaining <= 0
    ) {
        return;
    }

    notification._paused = false;

    this._schedule(notification);

    this._emit("resume", notification);
}

_clearTimer(id) {
    const timer = this.timers.get(id);

    if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
    }
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
