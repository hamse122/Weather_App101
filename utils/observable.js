/**
 * Advanced Observable Pattern — v3
 * - next / error / complete
 * - once()
 * - pause / resume
 * - Safe observer notifications
 * - Pipes & transforms
 * - Observer objects + functions
 * - Terminal-state protection
 * - Error normalization
 * - Cleanup support
 * - Observer count
 */

class Observable {
    constructor() {
        this.observers = new Set();
        this.paused = false;
        this.completed = false;
        this.lastError = null;
        this.onError = null;
    }

    /* ==========================
       SUBSCRIPTION
    ========================== */

    subscribe(observer) {
        if (this.completed) {
            return () => {};
        }

        if (!this._isValidObserver(observer)) {
            throw new TypeError(
                "Observer must be a function or an object with next/update/error/complete methods."
            );
        }

        this.observers.add(observer);

        return () => this.unsubscribe(observer);
    }

    once(observer) {
        let active = true;

        const wrapper = {
            next: value => {
                if (!active) return;

                active = false;
                this.unsubscribe(wrapper);

                this._safeCall(() => {
                    if (typeof observer === "function") {
                        observer(value);
                    } else {
                        observer?.next?.(value);
                        observer?.update?.(value);
                    }
                });
            },

            error: err => {
                if (!active) return;

                active = false;
                this.unsubscribe(wrapper);
                observer?.error?.(err);
            },

            complete: () => {
                if (!active) return;

                active = false;
                this.unsubscribe(wrapper);
                observer?.complete?.();
            }
        };

        this.subscribe(wrapper);

        return () => {
            active = false;
            this.unsubscribe(wrapper);
        };
    }

    unsubscribe(observer) {
        return this.observers.delete(observer);
    }

    clear() {
        this.observers.clear();
    }

    /* ==========================
       PAUSE / RESUME
    ========================== */

    pause() {
        if (this.completed) return this;

        this.paused = true;
        return this;
    }

    resume() {
        if (this.completed) return this;

        this.paused = false;
        return this;
    }

    /* ==========================
       NEXT
    ========================== */

    next(data) {
        if (this.paused || this.completed) return false;

        const observers = [...this.observers];

        for (const observer of observers) {
            this._safeCall(() => {
                if (typeof observer === "function") {
                    observer(data);
                } else {
                    observer?.next?.(data);

                    // Backward compatibility
                    if (!observer?.next && observer?.update) {
                        observer.update(data);
                    }
                }
            });
        }

        return true;
    }

    /* ==========================
       ERROR
    ========================== */

    error(err) {
        if (this.completed) return false;

        const error =
            err instanceof Error
                ? err
                : new Error(String(err));

        this.lastError = error;
        this.completed = true;

        const observers = [...this.observers];
        const failures = [];

        for (const observer of observers) {
            try {
                if (typeof observer !== "function") {
                    observer?.error?.(error);
                }
            } catch (observerError) {
                failures.push(observerError);
            }
        }

        this._safeCall(() => {
            this.onError?.(error, failures);
        });

        this.observers.clear();

        return true;
    }

    /* ==========================
       COMPLETE
    ========================== */

    complete() {
        if (this.completed) return false;

        this.completed = true;

        const observers = [...this.observers];

        for (const observer of observers) {
            this._safeCall(() => {
                if (typeof observer !== "function") {
                    observer?.complete?.();
                }
            });
        }

        this.observers.clear();

        return true;
    }

    /* ==========================
       PIPE
    ========================== */

    pipe(transformFn) {
        if (typeof transformFn !== "function") {
            throw new TypeError("pipe() requires a function");
        }

        const derived = new Observable();

        this.subscribe({
            next: value => {
                try {
                    derived.next(transformFn(value));
                } catch (err) {
                    derived.error(err);
                }
            },

            error: err => derived.error(err),

            complete: () => derived.complete()
        });

        return derived;
    }

    /* ==========================
       UTILITIES
    ========================== */

    _isValidObserver(observer) {
        return (
            typeof observer === "function" ||
            (
                observer &&
                typeof observer === "object" &&
                (
                    typeof observer.next === "function" ||
                    typeof observer.update === "function" ||
                    typeof observer.error === "function" ||
                    typeof observer.complete === "function"
                )
            )
        );
    }

    _safeCall(fn) {
        try {
            fn();
        } catch (err) {
            console.error("[Observable]", err);
        }
    }

    get observerCount() {
        return this.observers.size;
    }

    get isPaused() {
        return this.paused;
    }

    get isCompleted() {
        return this.completed;
    }
}

module.exports = Observable;
