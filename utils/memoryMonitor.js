/**
 * MemoryMonitor PRO (2026 Edition)
 * - Browser + Node.js
 * - Leak detection
 * - EMA smoothing
 * - Percentiles
 * - Adaptive thresholds
 * - Peak tracking
 */
export class MemoryMonitor {

    constructor(options = {}) {
        this.samples = [];
        this.maxSamples = options.maxSamples ?? 200;
        this.intervalId = null;

        this.warnThreshold = options.warnThreshold ?? 0.7;
        this.errorThreshold = options.errorThreshold ?? 0.9;

        this.adaptive = options.adaptive ?? false;
        this.emaAlpha = options.emaAlpha ?? 0.2; // smoothing factor

        this.listeners = {
            sample: new Set(),
            warn: new Set(),
            error: new Set(),
            leak: new Set()
        };

        this.peak = 0;
        this.ema = null;
        this.lastUsed = null;
    }

    // --------------------------------------------------
    // Memory Source Detection
    // --------------------------------------------------

    static getMemoryUsage() {
        if (typeof performance !== "undefined" && performance.memory) {
            const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
            return {
                used: usedJSHeapSize,
                total: totalJSHeapSize,
                limit: jsHeapSizeLimit,
                available: jsHeapSizeLimit - usedJSHeapSize,
                source: "browser"
            };
        }

        if (typeof process !== "undefined" && process.memoryUsage) {
            const mem = process.memoryUsage();
            return {
                used: mem.heapUsed,
                total: mem.heapTotal,
                limit: mem.heapTotal || null,
                available: mem.heapTotal ? mem.heapTotal - mem.heapUsed : null,
                source: "node"
            };
        }

        return null;
    }

    // --------------------------------------------------
    // Control
    // --------------------------------------------------

    start(interval = 1000) {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            const usage = MemoryMonitor.getMemoryUsage();
            if (!usage) return;

            const sample = {
                ...usage,
                timestamp: Date.now()
            };

            this.processSample(sample);
        }, interval);
    }

    stop() {
        if (!this.intervalId) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    pause() {
        this.stop();
    }

    resume(interval = 1000) {
        this.start(interval);
    }

    isRunning() {
        return this.intervalId !== null;
    }

    clear() {
        this.samples = [];
        this.peak = 0;
        this.ema = null;
        this.lastUsed = null;
    }

    // --------------------------------------------------
    // Core Processing
    // --------------------------------------------------

    processSample(sample) {
        this.samples.push(sample);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }

        // Peak tracking
        if (sample.used > this.peak) {
            this.peak = sample.used;
        }

        // EMA smoothing
        if (this.ema == null) {
            this.ema = sample.used;
        } else {
            this.ema =
                this.emaAlpha * sample.used +
                (1 - this.emaAlpha) * this.ema;
        }

        // Rate of change
        let delta = null;
        if (this.lastUsed != null) {
            delta = sample.used - this.lastUsed;
        }
        this.lastUsed = sample.used;

        sample.delta = delta;
        sample.ema = this.ema;

        this.emit("sample", sample);
        this.checkThresholds(sample);
        this.detectLeak();
    }

    // --------------------------------------------------
    // Threshold Logic
    // --------------------------------------------------

    checkThresholds(sample) {
        const base = sample.limit || sample.total;
        if (!base) return;

        let ratio = sample.used / base;

        if (this.adaptive) {
            const dynamicWarn = this.ema / base;
            ratio = dynamicWarn;
        }

        if (ratio >= this.errorThreshold) {
            this.emit("error", { ...sample, ratio });
        } else if (ratio >= this.warnThreshold) {
            this.emit("warn", { ...sample, ratio });
        }
    }

    // --------------------------------------------------
    // Leak Detection (trend-based)
    // --------------------------------------------------

    detectLeak(windowSize = 5) {
        if (this.samples.length < windowSize) return;

        const last = this.samples.slice(-windowSize);
        const increasing = last.every((s, i, arr) =>
            i === 0 || s.used > arr[i - 1].used
        );

        if (increasing) {
            this.emit("leak", {
                message: "Possible memory leak detected (monotonic growth)",
                window: windowSize
            });
        }
    }

    // --------------------------------------------------
    // Statistics
    // --------------------------------------------------

    getStatistics() {
        if (!this.samples.length) return null;

        const used = this.samples.map(s => s.used);

        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

        const percentile = (arr, p) => {
            const sorted = [...arr].sort((a, b) => a - b);
            const index = Math.floor(p * sorted.length);
            return sorted[index];
        };

        return {
            current: this.samples.at(-1),
            average: avg(used),
            min: Math.min(...used),
            max: Math.max(...used),
            peak: this.peak,
            p50: percentile(used, 0.5),
            p95: percentile(used, 0.95),
            samples: this.samples.length
        };
    }

    getTimeline() {
        return [...this.samples];
    }

    exportJSON() {
        return JSON.stringify({
            stats: this.getStatistics(),
            timeline: this.samples
        }, null, 2);
    }

    // --------------------------------------------------
    // Events
    // --------------------------------------------------

    on(type, listener) {
        if (!this.listeners[type]) {
            throw new Error(`Unknown event: ${type}`);
        }
        this.listeners[type].add(listener);
        return () => this.listeners[type].delete(listener);
    }

    emit(type, payload) {
        const set = this.listeners[type];
        if (!set) return;

        for (const fn of set) {
            try {
                fn(payload);
            } catch (err) {
                console.error(`[MemoryMonitor] listener error:`, err);
            }
        }
    }

    // --------------------------------------------------
    // Utils
    // --------------------------------------------------

    static formatBytes(bytes) {
        if (bytes == null) return "N/A";
        if (bytes === 0) return "0 B";

        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }
}
