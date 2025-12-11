/**
 * Memory Monitor Utility (Upgraded)
 * - Works in browser and Node.js
 * - Tracks samples, stats, thresholds, subscriptions
 */

export class MemoryMonitor {
    /**
     * @param {Object} [options]
     * @param {number} [options.maxSamples=100]  Max samples kept in memory
     * @param {number} [options.warnThreshold=0.7]  0–1 (70% of limit/heap)
     * @param {number} [options.errorThreshold=0.9] 0–1 (90% of limit/heap)
     */
    constructor(options = {}) {
        this.samples = [];
        this.maxSamples = options.maxSamples ?? 100;
        this.intervalId = null;

        this.warnThreshold = options.warnThreshold ?? 0.7;
        this.errorThreshold = options.errorThreshold ?? 0.9;

        this.listeners = {
            sample: new Set(),
            warn: new Set(),
            error: new Set()
        };
    }

    /**
     * Try to get current memory usage (browser OR Node.js)
     * @returns {Object|null}
     */
    static getMemoryUsage() {
        // Browser: performance.memory
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

        // Node.js: process.memoryUsage()
        if (typeof process !== "undefined" && process.memoryUsage) {
            const mem = process.memoryUsage();
            const used = mem.heapUsed;
            const total = mem.heapTotal;
            // Node has no strict heap limit exposed; approximate with rss if useful, else null
            return {
                used,
                total,
                limit: total || null,
                available: total ? total - used : null,
                source: "node"
            };
        }

        return null;
    }

    /**
     * Start monitoring memory at interval (ms)
     * @param {number} [interval=1000]
     */
    start(interval = 1000) {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            const usage = MemoryMonitor.getMemoryUsage();
            if (!usage) return;

            const sample = {
                ...usage,
                timestamp: Date.now()
            };

            this.samples.push(sample);
            if (this.samples.length > this.maxSamples) {
                this.samples.shift();
            }

            this.emit("sample", sample);
            this.checkThresholds(sample);
        }, interval);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.intervalId) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    /**
     * Is the monitor currently running?
     * @returns {boolean}
     */
    isRunning() {
        return this.intervalId !== null;
    }

    /**
     * Subscribe to events: 'sample' | 'warn' | 'error'
     * @param {'sample'|'warn'|'error'} type
     * @param {(sample: Object) => void} listener
     * @returns {() => void} unsubscribe function
     */
    on(type, listener) {
        if (!this.listeners[type]) {
            throw new Error(`Unknown event type: ${type}`);
        }
        this.listeners[type].add(listener);
        return () => this.listeners[type].delete(listener);
    }

    emit(type, payload) {
        const set = this.listeners[type];
        if (!set) return;
        set.forEach(fn => {
            try {
                fn(payload);
            } catch (err) {
                // Prevent single bad listener from breaking others
                console.error(`[MemoryMonitor] listener error on '${type}':`, err);
            }
        });
    }

    /**
     * Check thresholds and emit warn/error events if necessary
     * @param {Object} sample
     * @private
     */
    checkThresholds(sample) {
        const { used, limit, total } = sample;
        const base = limit || total;
        if (!base) return;

        const ratio = used / base;
        if (ratio >= this.errorThreshold) {
            this.emit("error", { ...sample, ratio });
        } else if (ratio >= this.warnThreshold) {
            this.emit("warn", { ...sample, ratio });
        }
    }

    /**
     * Get memory statistics over collected samples
     * @returns {Object|null}
     */
    getStatistics() {
        if (this.samples.length === 0) return null;

        const usedArr = this.samples.map(s => s.used);
        const totalArr = this.samples.map(s => s.total).filter(Boolean);

        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

        return {
            current: this.samples[this.samples.length - 1],
            average: {
                used: avg(usedArr),
                total: totalArr.length ? avg(totalArr) : null
            },
            min: {
                used: Math.min(...usedArr),
                total: totalArr.length ? Math.min(...totalArr) : null
            },
            max: {
                used: Math.max(...usedArr),
                total: totalArr.length ? Math.max(...totalArr) : null
            },
            samples: this.samples.length
        };
    }

    /**
     * Get copy of raw samples timeline
     * @returns {Array<Object>}
     */
    getTimeline() {
        return this.samples.slice();
    }

    /**
     * Formatted memory report
     * @returns {string}
     */
    getReport() {
        const stats = this.getStatistics();
        if (!stats) return "No memory data available";

        const fmt = MemoryMonitor.formatBytes;

        const totalCurrent = stats.current.total
            ? `${fmt(stats.current.total)}`
            : "N/A";
        const avgTotal = stats.average.total
            ? `${fmt(stats.average.total)}`
            : "N/A";
        const minTotal = stats.min.total
            ? `${fmt(stats.min.total)}`
            : "N/A";
        const maxTotal = stats.max.total
            ? `${fmt(stats.max.total)}`
            : "N/A";

        let report = "Memory Monitor Report\n";
        report += "---------------------\n";
        report += `Current: ${fmt(stats.current.used)} / ${totalCurrent}\n`;
        report += `Average: ${fmt(stats.average.used)} / ${avgTotal}\n`;
        report += `Min:     ${fmt(stats.min.used)} / ${minTotal}\n`;
        report += `Max:     ${fmt(stats.max.used)} / ${maxTotal}\n`;
        report += `Samples: ${stats.samples}\n`;

        return report;
    }

    /**
     * Reset samples
     */
    clear() {
        this.samples = [];
    }

    /**
     * Human-readable bytes
     * @param {number|null} bytes
     * @returns {string}
     */
    static formatBytes(bytes) {
        if (bytes == null) return "N/A";
        if (bytes === 0) return "0 B";

        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const value = bytes / Math.pow(k, i);

        return `${value.toFixed(2)} ${sizes[i]}`;
    }
}
