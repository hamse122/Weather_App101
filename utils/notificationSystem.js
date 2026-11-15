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
// CORE (v2)
// =====================

notify(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("Notification input must be an object");
    }

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

    if (typeof notification.message !== "string") {
        throw new TypeError("Notification message must be a string");
    }

    if (
        !Number.isFinite(notification.duration) ||
        notification.duration < 0
    ) {
        throw new RangeError("Notification duration must be non-negative");
    }

    notification.priority = Number.isFinite(notification.priority)
        ? notification.priority
        : 0;

    notification.meta = {
        ...(notification.meta || {})
    };

    // Middleware pipeline
    for (const mw of this.middlewares) {
        const result = mw(notification);

        if (result && typeof result === "object") {
            notification = {
                ...notification,
                ...result
            };
        }
    }

    // Duplicate handling
    if (!this.options.allowDuplicates) {
        for (const existing of this.notifications.values()) {
            if (
                existing.message === notification.message &&
                existing.type === notification.type
            ) {
                if (this.options.duplicateStrategy === "update") {
                    this.update(existing.id, {
                        ...notification,
                        id: existing.id,
                        createdAt: existing.createdAt
                    });

                    return existing.id;
                }

                return null;
            }
        }
    }

    // Enforce notification limits
    this._enforceLimits(notification);

    // Store notification
    this.notifications.set(notification.id, notification);

    // History tracking
    if (this.options.logHistory) {
        this.history.push({ ...notification });

        if (this.options.maxHistory > 0) {
            while (this.history.length > this.options.maxHistory) {
                this.history.shift();
            }
        }
    }

    // Schedule automatic dismissal
    if (notification.duration > 0) {
        this._schedule(notification);
    }

    this._emit("add", notification);

    return notification.id;
}

update(id, patch = {}) {
    const notification = this.notifications.get(id);

    if (!notification) return false;

    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new TypeError("Notification patch must be an object");
    }

    const updated = {
        ...notification,
        ...patch,
        id: notification.id,
        createdAt: notification.createdAt,
        updatedAt: Date.now()
    };

    if (typeof updated.message !== "string") {
        throw new TypeError("Notification message must be a string");
    }

    if (
        !Number.isFinite(updated.duration) ||
        updated.duration < 0
    ) {
        throw new RangeError("Notification duration must be non-negative");
    }

    // Reset timer when duration changes
    if (patch.duration !== undefined) {
        this._clearTimer(id);
        updated.remaining = null;

        if (updated.duration > 0) {
            this._schedule(updated);
        }
    }

    this.notifications.set(id, updated);

    this._emit("update", updated);

    return true;
}

remove(id) {
    const notification = this.notifications.get(id);

    if (!notification) return false;

    this._clearTimer(id);
    this.notifications.delete(id);

    this._emit("remove", notification);

    return true;
}

clear() {
    for (const timer of this.timers.values()) {
        clearTimeout(timer);
    }

    this.timers.clear();

    const removed = Array.from(this.notifications.values());

    this.notifications.clear();

    this._emit("clear", {
        count: removed.length,
        notifications: removed
    });

    return removed.length;
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
