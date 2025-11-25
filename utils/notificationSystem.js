/**
 * Advanced Notification System Utility
 * Includes queue logic, listener batching, pause/resume, duplicates filtering, 
 * extended configuration, and safer ID generation.
 */

export class NotificationSystem {
    constructor(options = {}) {
        this.notifications = [];
        this.listeners = [];

        this.maxNotifications = options.maxNotifications || 10;
        this.overflowStrategy = options.overflowStrategy || "fifo"; 
        // fifo = remove oldest, lifo = remove newest
        
        this.allowDuplicates = options.allowDuplicates ?? true;
        this.logHistory = options.logHistory ?? false;

        this.history = [];

        // Internal storage for active timers
        this.timers = new Map();
    }

    /** Generate very strong unique ID */
    static uid() {
        return `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    }

    /**
     * Add a notification
     */
    notify(notification) {
        const notif = {
            id: NotificationSystem.uid(),
            type: notification.type || "info",
            message: notification.message,
            duration: notification.duration ?? 5000,
            timestamp: new Date(),
            meta: notification.meta || {},
            ...notification,
        };

        // Prevent duplicates by message/type (optional)
        if (!this.allowDuplicates) {
            const exists = this.notifications.some(
                (n) => n.message === notif.message && n.type === notif.type
            );
            if (exists) return null;
        }

        // Maintain queue size
        if (this.notifications.length >= this.maxNotifications) {
            if (this.overflowStrategy === "fifo") {
                const removed = this.notifications.shift();
                this._clearTimer(removed.id);
            } else {
                const removed = this.notifications.pop();
                this._clearTimer(removed.id);
            }
        }

        this.notifications.push(notif);

        // Save to history if enabled
        if (this.logHistory) {
            this.history.push(notif);
        }

        // Auto-dismiss timer
        if (notif.duration > 0) {
            const timer = setTimeout(() => this.remove(notif.id), notif.duration);
            this.timers.set(notif.id, timer);
        }

        this._emit("add", notif);
        return notif.id;
    }

    /**
     * Remove a notification by ID
     */
    remove(id) {
        const index = this.notifications.findIndex((n) => n.id === id);
        if (index > -1) {
            const removed = this.notifications.splice(index, 1)[0];
            this._clearTimer(id);
            this._emit("remove", removed);
        }
    }

    /**
     * Clear all notifications
     */
    clear() {
        this.notifications.forEach((n) => this._clearTimer(n.id));
        this.notifications = [];
        this._emit("clear", null);
    }

    /**
     * Pause auto-dismiss timer
     */
    pause(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
            this._emit("pause", this.get(id));
        }
    }

    /**
     * Resume auto-dismiss timer
     */
    resume(id) {
        const notif = this.get(id);
        if (notif && notif.duration > 0 && !this.timers.has(id)) {
            const timer = setTimeout(() => this.remove(id), notif.duration);
            this.timers.set(id, timer);
            this._emit("resume", notif);
        }
    }

    /**
     * Get notification by ID
     */
    get(id) {
        return this.notifications.find((n) => n.id === id) || null;
    }

    /**
     * Get all notifications
     */
    getAll() {
        return [...this.notifications];
    }

    /**
     * Get log history (if enabled)
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Subscribe to notification changes
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx > -1) this.listeners.splice(idx, 1);
        };
    }

    /**
     * Internal emit wrapper
     */
    _emit(action, notification) {
        const payload = {
            action,
            notification,
            notifications: this.getAll(),
            timestamp: new Date(),
        };

        this.listeners.forEach((listener) => listener(payload));
    }

    /**
     * Clear timer
     */
    _clearTimer(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
    }

    /** Helper methods */
    success(message, duration = 5000, meta = {}) {
        return this.notify({ type: "success", message, duration, meta });
    }

    error(message, duration = 7000, meta = {}) {
        return this.notify({ type: "error", message, duration, meta });
    }

    warning(message, duration = 6000, meta = {}) {
        return this.notify({ type: "warning", message, duration, meta });
    }

    info(message, duration = 5000, meta = {}) {
        return this.notify({ type: "info", message, duration, meta });
    }
}
