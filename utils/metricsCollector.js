/**
 * Ultra Advanced Metrics Collector
 * Features:
 * - Counters, Gauges, Histograms, Summaries, Timers
 * - Labels (dimensional metrics)
 * - Percentiles (p50, p90, p99)
 * - Batching + async exporters
 * - Rolling window & rate calculation
 * - Namespace + registry
 * - Health metrics (CPU, memory, uptime)
 * - Pull & push export modes
 */

class MetricsCollector {
    constructor(options = {}) {
        this.namespace = options.namespace || "app";
        this.defaultLabels = options.defaultLabels || {};
        this.metrics = new Map();
        this.exporters = [];
        this.batchSize = options.batchSize || 50;
        this.exportInterval = options.exportInterval || null;
        this.buffer = [];
        this.startTime = Date.now();

        if (this.exportInterval) {
            this._startAutoExport();
        }
    }

    /* ---------------- REGISTRY ---------------- */
    _key(name, labels = {}) {
        const labelKey = Object.entries({ ...this.defaultLabels, ...labels })
            .sort()
            .map(([k, v]) => `${k}:${v}`)
            .join("|");
        return `${this.namespace}.${name}|${labelKey}`;
    }

    _getMetric(name, type, config = {}) {
        const key = this._key(name, config.labels);
        if (!this.metrics.has(key)) {
            this.metrics.set(key, {
                name,
                type,
                description: config.description || "",
                labels: { ...this.defaultLabels, ...(config.labels || {}) },
                value: 0,
                count: 0,
                sum: 0,
                min: Infinity,
                max: -Infinity,
                buckets: config.buckets || null,
                counts: config.buckets ? new Array(config.buckets.length + 1).fill(0) : null,
                observations: [],
                lastUpdated: Date.now()
            });
        }
        return this.metrics.get(key);
    }

    /* ---------------- METRIC TYPES ---------------- */
    counter(name, description = "", labels = {}) {
        return this._getMetric(name, "counter", { description, labels });
    }

    gauge(name, description = "", labels = {}) {
        return this._getMetric(name, "gauge", { description, labels });
    }

    histogram(name, description = "", buckets = [0.1, 0.5, 1, 2, 5, 10], labels = {}) {
        buckets = [...buckets].sort((a, b) => a - b);
        return this._getMetric(name, "histogram", { description, buckets, labels });
    }

    summary(name, description = "", labels = {}) {
        return this._getMetric(name, "summary", { description, labels });
    }

    /* ---------------- CORE OPERATIONS ---------------- */
    increment(name, value = 1, labels = {}) {
        const metric = this.counter(name, "", labels);
        metric.value += value;
        metric.count += value;
        this._record(metric);
    }

    setGauge(name, value, labels = {}) {
        const metric = this.gauge(name, "", labels);
        metric.value = value;
        this._record(metric);
    }

    observe(name, value, labels = {}) {
        const metric = this.summary(name, "", labels);
        metric.sum += value;
        metric.count += 1;
        metric.min = Math.min(metric.min, value);
        metric.max = Math.max(metric.max, value);
        metric.observations.push(value);
        if (metric.observations.length > 1000) {
            metric.observations.shift(); // rolling window
        }
        this._record(metric);
    }

    observeHistogram(name, value, buckets, labels = {}) {
        const metric = this.histogram(name, "", buckets, labels);
        metric.sum += value;
        metric.count += 1;

        const idx = metric.buckets.findIndex(b => value <= b);
        const bucketIndex = idx === -1 ? metric.counts.length - 1 : idx;
        metric.counts[bucketIndex]++;

        this._record(metric);
    }

    /* ---------------- TIMER / LATENCY ---------------- */
    startTimer(name, labels = {}) {
        const start = performance.now();
        return () => {
            const duration = performance.now() - start;
            this.observe(`${name}_duration_ms`, duration, labels);
            return duration;
        };
    }

    async timeAsync(name, fn, labels = {}) {
        const end = this.startTimer(name, labels);
        try {
            return await fn();
        } finally {
            end();
        }
    }

    /* ---------------- RATE & PERCENTILES ---------------- */
    _percentile(arr, p) {
        if (!arr.length) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
    }

    getPercentiles(name, labels = {}) {
        const metric = this.summary(name, "", labels);
        const obs = metric.observations;
        return {
            p50: this._percentile(obs, 50),
            p90: this._percentile(obs, 90),
            p99: this._percentile(obs, 99)
        };
    }

    getRate(name, windowMs = 60000, labels = {}) {
        const metric = this.summary(name, "", labels);
        const now = Date.now();
        const recent = metric.observations.filter(
            (_, i) => now - metric.lastUpdated <= windowMs
        );
        return recent.length / (windowMs / 1000);
    }

    /* ---------------- EXPORT SYSTEM ---------------- */
    registerExporter(exporter) {
        this.exporters.push(exporter);
        return this;
    }

    async _flush() {
        if (!this.buffer.length) return;
        const batch = this.buffer.splice(0, this.batchSize);

        await Promise.all(
            this.exporters.map(async (exporter) => {
                try {
                    await exporter(batch);
                } catch (e) {
                    console.error("Exporter failed:", e);
                }
            })
        );
    }

    _record(metric) {
        metric.lastUpdated = Date.now();
        this.buffer.push({ ...metric });

        if (this.buffer.length >= this.batchSize) {
            this._flush();
        }
    }

    _startAutoExport() {
        this.timer = setInterval(() => this._flush(), this.exportInterval);
        this.timer.unref?.();
    }

    stopAutoExport() {
        if (this.timer) clearInterval(this.timer);
    }

    /* ---------------- HEALTH METRICS ---------------- */
    collectSystemMetrics() {
        const uptime = (Date.now() - this.startTime) / 1000;
        this.setGauge("uptime_seconds", uptime);

        if (typeof process !== "undefined") {
            const mem = process.memoryUsage();
            this.setGauge("memory_rss_bytes", mem.rss);
            this.setGauge("heap_used_bytes", mem.heapUsed);
        }
    }

    /* ---------------- SNAPSHOT & EXPORT ---------------- */
    snapshot() {
        const now = Date.now();
        return Array.from(this.metrics.values()).map(m => ({
            ...m,
            age: now - (m.lastUpdated || now),
            percentiles: m.type === "summary"
                ? {
                      p50: this._percentile(m.observations, 50),
                      p90: this._percentile(m.observations, 90),
                      p99: this._percentile(m.observations, 99)
                  }
                : undefined
        }));
    }

    toPrometheus() {
        return this.snapshot()
            .map(m => {
                const labels = Object.entries(m.labels || {})
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(",");
                const labelStr = labels ? `{${labels}}` : "";
                return `${this.namespace}_${m.name}${labelStr} ${m.value || m.sum || 0}`;
            })
            .join("\n");
    }

    clear() {
        this.metrics.clear();
        this.buffer = [];
    }
}

module.exports = MetricsCollector;
