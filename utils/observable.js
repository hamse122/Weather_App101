/**
 * Enhanced Observable Pattern
 * - Supports next/error/complete
 * - Supports once()
 * - Supports pause/resume
 * - Safe notifications
 * - Pipes & transforms
 */

class Observable {
    constructor() {
        this.observers = new Set();
        this.paused = false;
        this.completed = false;
    }

    /**
     * Subscribe to events
     * @param {Function|Object} observer
     * @returns {Function} unsubscribe function
     */
    subscribe(observer) {
        if (this.completed) {
            console.warn("Observable already completed; ignoring subscription.");
            return () => {};
        }

        this.observers.add(observer);
        return () => this.unsubscribe(observer);
    }

    /**
     * Subscribe only once
     * @param {Function|Object} observer
     */
    once(observer) {
        const wrapper = (data) => {
            this.unsubscribe(wrapper);
            if (typeof observer === "function") observer(data);
            else if (observer?.update) observer.update(data);
        };
        this.subscribe(wrapper);
        return wrapper;
    }

    /**
     * Unsubscribe observer
     */
    unsubscribe(observer) {
        this.observers.delete(observer);
    }

    /**
     * Pause notifications
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume notifications
     */
    resume() {
        this.paused = false;
    }

    /**
     * Emit next data value
     */
    next(data) {
        if (this.paused || this.completed) return;

        this.observers.forEach(observer => {
            try {
                if (typeof observer === "function") {
                    observer(data);
                } else if (observer?.next) {
                    observer.next(data);
                } else if (observer?.update) {
                    observer.update(data);
                }
            } catch (err) {
                console.error("Observer error:", err);
            }
        });
    }

    /**
     * Emit error
     */
    error(err) {
        if (this.completed) return;

        this.observers.forEach(observer => {
            try {
                if (observer?.error) observer.error(err);
            } catch (e) {
                console.error("Observer error handler failed:", e);
            }
        });
    }

    /**
     * Complete stream: notify & stop future subscriptions
     */
    complete() {
        if (this.completed) return;

        this.completed = true;

        this.observers.forEach(observer => {
            try {
                if (observer?.complete) observer.complete();
            } catch (err) {
                console.error("Observer complete handler failed:", err);
            }
        });

        this.observers.clear();
    }

    /**
     * Create a derived Observable using a transform
     */
    pipe(transformFn) {
        const newObs = new Observable();
        this.subscribe((data) => newObs.next(transformFn(data)));
        return newObs;
    }

    /**
     * Clear all observers
     */
    clear() {
        this.observers.clear();
    }

    /**
     * Get number of active observers
     */
    get observerCount() {
        return this.observers.size;
    }
}

module.exports = Observable;
