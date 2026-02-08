/**
 * Elite Progress Tracker Utility
 * State-aware, ETA-stable, milestone-enabled progress tracking
 */

const now = () =>
    (typeof performance !== "undefined" && performance.now)
        ? performance.now()
        : Date.now();

export class ProgressTracker {
    constructor({
        total = 100,
        precision = 2,
        smoothingFactor = 0.2,
        minSamplesForETA = 5
    } = {}) {
        this.total = Math.max(0, total);
        this.current = 0;

        this.precision = precision;
        this.smoothingFactor = smoothingFactor;
        this.minSamplesForETA = minSamplesForETA;

        this.listeners = [];
        this.completeListeners = [];
        this.milestones = new Map();

        this.startTime = null;
        this.endTime = null;
        this.lastUpdateTime = null;

        this.state = "idle"; // idle | running | paused | completed
        this.smoothedRate = null;
        this.samples = 0;

        this._completionPromise = null;
        this._resolveCompletion = null;
    }

    /* -------------------- State Control -------------------- */

    setTotal(total) {
        this.total = Math.max(0, total);
        this.current = Math.min(this.current, this.total);
        this.notify();
    }

    setProgress(value) {
        if (this.state === "paused" || this.state === "completed") return;

        const timestamp = now();

        if (!this.startTime) {
            this.startTime = timestamp;
            this.lastUpdateTime = timestamp;
            this.state = "running";
        }

        const delta = value - this.current;
        const deltaTime = timestamp - this.lastUpdateTime;

        if (delta > 0 && deltaTime > 0) {
            const rate = delta / deltaTime;
            this.samples++;

            this.smoothedRate = this.smoothedRate == null
                ? rate
                : this.smoothedRate * (1 - this.smoothingFactor) +
                  rate * this.smoothingFactor;
        }

        this.current = Math.min(Math.max(0, value), this.total);
        this.lastUpdateTime = timestamp;

        this.checkMilestones();

        if (this.current >= this.total) {
            this.completeInternal(timestamp);
        }

        this.notify();
    }

    increment(amount = 1) {
        this.setProgress(this.current + amount);
    }

    complete() {
        this.setProgress(this.total);
    }

    reset() {
        this.current = 0;
        this.startTime = null;
        this.endTime = null;
        this.lastUpdateTime = null;
        this.smoothedRate = null;
        this.samples = 0;
        this.state = "idle";
        this._completionPromise = null;
        this._resolveCompletion = null;
        this.notify();
    }

    pause() {
        if (this.state !== "running") return;
        this.state = "paused";
    }

    resume() {
        if (this.state !== "paused") return;
        this.state = "running";
        this.lastUpdateTime = now();
    }

    /* -------------------- Metrics -------------------- */

    getPercentage() {
        return this.total > 0
            ? Number(((this.current / this.total) * 100).toFixed(this.precision))
            : 0;
    }

    getElapsedTime() {
        if (!this.startTime) return 0;
        return (this.endTime ?? now()) - this.startTime;
    }

    getAverageRate() {
        const elapsed = this.getElapsedTime();
        return elapsed > 0 ? this.current / elapsed : null;
    }

    getEstimatedTimeRemaining() {
        if (
            !this.smoothedRate ||
            this.samples < this.minSamplesForETA ||
            this.state !== "running"
        ) {
            return null;
        }

        const remaining = this.total - this.current;
        return remaining / this.smoothedRate;
    }

    getInfo() {
        return Object.freeze({
            state: this.state,
            current: this.current,
            total: this.total,
            percentage: this.getPercentage(),
            elapsedTime: this.getElapsedTime(),
            estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
            averageRate: this.getAverageRate(),
            smoothedRate: this.smoothedRate,
            startTime: this.startTime,
            endTime: this.endTime
        });
    }

    /* -------------------- Milestones -------------------- */

    addMilestone(value, callback) {
        if (value <= 0 || value > this.total) return;
        this.milestones.set(value, callback);
    }

    checkMilestones() {
        for (const [value, callback] of this.milestones) {
            if (this.current >= value) {
                try {
                    callback(this.getInfo());
                } catch (e) {
                    console.error("Milestone error:", e);
                }
                this.milestones.delete(value);
            }
        }
    }

    /* -------------------- Async Completion -------------------- */

    awaitCompletion() {
        if (this.state === "completed") {
            return Promise.resolve(this.getInfo());
        }

        if (!this._completionPromise) {
            this._completionPromise = new Promise(resolve => {
                this._resolveCompletion = resolve;
            });
        }

        return this._completionPromise;
    }

    completeInternal(timestamp) {
        if (this.state === "completed") return;

        this.endTime = timestamp;
        this.state = "completed";

        const info = this.getInfo();

        this.completeListeners.forEach(fn => {
            try {
                fn(info);
            } catch (e) {
                console.error("Completion listener error:", e);
            }
        });

        if (this._resolveCompletion) {
            this._resolveCompletion(info);
        }
    }

    /* -------------------- Listeners -------------------- */

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getInfo());

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    onComplete(listener) {
        this.completeListeners.push(listener);
        return () => {
            this.completeListeners = this.completeListeners.filter(l => l !== listener);
        };
    }

    notify() {
        const info = this.getInfo();
        this.listeners.forEach(fn => {
            try {
                fn(info);
            } catch (e) {
                console.error("Progress listener error:", e);
            }
        });
    }
}
