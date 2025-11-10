/**
 * Notification System Utility
 * Notification system for managing and displaying notifications
 */

/**
 * NotificationSystem class for managing notifications
 */
export class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.listeners = [];
        this.maxNotifications = 10;
    }
    
    /**
     * Add a notification
     * @param {Object} notification - Notification object with type, message, and optional duration
     */
    notify(notification) {
        const notif = {
            id: Date.now() + Math.random(),
            type: notification.type || 'info',
            message: notification.message,
            duration: notification.duration || 5000,
            timestamp: new Date(),
            ...notification
        };
        
        this.notifications.push(notif);
        
        if (this.notifications.length > this.maxNotifications) {
            this.notifications.shift();
        }
        
        this.notifyListeners(notif);
        
        if (notif.duration > 0) {
            setTimeout(() => {
                this.remove(notif.id);
            }, notif.duration);
        }
        
        return notif.id;
    }
    
    /**
     * Remove a notification by ID
     * @param {number} id - Notification ID
     */
    remove(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index > -1) {
            this.notifications.splice(index, 1);
            this.notifyListeners(null, 'remove');
        }
    }
    
    /**
     * Clear all notifications
     */
    clear() {
        this.notifications = [];
        this.notifyListeners(null, 'clear');
    }
    
    /**
     * Get all notifications
     * @returns {Array} - Array of notifications
     */
    getAll() {
        return [...this.notifications];
    }
    
    /**
     * Subscribe to notification changes
     * @param {Function} listener - Listener function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify all listeners
     * @param {Object|null} notification - Notification object
     * @param {string} action - Action type
     */
    notifyListeners(notification, action = 'add') {
        this.listeners.forEach(listener => {
            listener({ notification, action, notifications: this.getAll() });
        });
    }
    
    /**
     * Create helper methods
     */
    success(message, duration = 5000) {
        return this.notify({ type: 'success', message, duration });
    }
    
    error(message, duration = 7000) {
        return this.notify({ type: 'error', message, duration });
    }
    
    warning(message, duration = 6000) {
        return this.notify({ type: 'warning', message, duration });
    }
    
    info(message, duration = 5000) {
        return this.notify({ type: 'info', message, duration });
    }
}
