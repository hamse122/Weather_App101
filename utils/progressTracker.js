/**
 * Advanced Progress Tracker Utility
 * Accurate, extensible progress tracking with ETA & lifecycle control
 */

export class ProgressTracker {
    constructor({
        total = 100,
        precision = 2,
        smoothingFactor = 0.2
    } = {}) {
        this.total = Math.max(0, total);
        this.current = 0;
        this.precision = precision;
        this.smoothingFactor = smoothingFactor;

        this.listeners = [];
        this.completeListeners = [];

        this.startTime = null;
        this.endTime = null;
        this.lastUpdateTime = null;

        this.paused = false;
        this.smoothedRate = null;
    }

    /* -------------------- Core Controls -------------------- */

    setTotal(total) {
        this.total = Math.max(0, total);
        this.notify();
    }

    setProgress(value) {
        if (this.paused) return;

        const now = performance.now();
        if (!this.startTime) {
            this.startTime = now;
            this.lastUpdateTime = now;
        }

        const delta = value - this.current;
        const deltaTime = now - this.lastUpdateTime;

        if (deltaTime > 0 && delta > 0) {
            const rate = delta / deltaTime;
            this.smoothedRate = this.smoothedRate == null
                ? rate
                : this.smoothedRate * (1 - this.smoothingFactor) + rate * this.smoothingFactor;
        }

        this.current = Math.min(Math.max(0, value), this.total);
        this.lastUpdateTime = now;

        if (this.current >= this.total && !this.endTime) {
            this.endTime = now;
            this.notifyComplete();
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
        this.paused = false;
        this.notify();
    }

    pause() {
        this.paused = true;
    }

    resume() {
        if (!this.paused) return;
        this.paused = false;
        this.lastUpdateTime = performance.now();
    }

    /* -------------------- Info & Metrics -------------------- */

    getPercentage() {
        return this.total > 0
            ? Number(((this.current / this.total) * 100).toFixed(this.precision))
            : 0;
    }

    getElapsedTime() {
        if (!this.startTime) return 0;
        return (this.endTime ?? performance.now()) - this.startTime;
    }

    getEstimatedTimeRemaining() {
        if (!this.smoothedRate || this.current === 0) return null;
        const remaining = this.total - this.current;
        return remaining / this.smoothedRate;
    }

    getInfo() {
        return Object.freeze({
            current: this.current,
            total: this.total,
            percentage: this.getPercentage(),
            isComplete: this.current >= this.total,
            paused: this.paused,
            elapsedTime: this.getElapsedTime(),
            estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
            startTime: this.startTime,
            endTime: this.endTime
        });
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
            } catch (err) {
                console.error("ProgressTracker listener error:", err);
            }
        });
    }

    notifyComplete() {
        const info = this.getInfo();
        this.completeListeners.forEach(fn => {
            try {
                fn(info);
            } catch (err) {
                console.error("ProgressTracker completion listener error:", err);
            }
        });
    }
}
