// Metrics collector for application performance and health monitoring
class MetricsCollector {
    constructor(options = {}) {
        this.metrics = new Map();
        this.exporters = [];
        this.defaultLabels = options.defaultLabels || {};
        this.collectionInterval = options.collectionInterval || null;

        if (this.collectionInterval) {
            this.startAutoExport();
        }
    }

    registerExporter(exporter) {
        this.exporters.push(exporter);
        return this;
    }

    counter(name, description = '') {
        return this.getOrCreateMetric(name, 'counter', { description, value: 0 });
    }

    gauge(name, description = '') {
        return this.getOrCreateMetric(name, 'gauge', { description, value: 0 });
    }

    histogram(name, description = '', buckets = [0.1, 0.5, 1, 2, 5, 10]) {
        return this.getOrCreateMetric(name, 'histogram', {
            description,
            buckets: buckets.sort((a, b) => a - b),
            counts: new Array(buckets.length + 1).fill(0),
            sum: 0,
            count: 0
        });
    }

    increment(name, value = 1, labels = {}) {
        const metric = this.counter(name);
        metric.value += value;
        this.record(name, metric, labels);
    }

    setGauge(name, value, labels = {}) {
        const metric = this.gauge(name);
        metric.value = value;
        this.record(name, metric, labels);
    }

    observe(name, value, labels = {}) {
        const metric = this.histogram(name);
        metric.sum += value;
        metric.count += 1;
        const index = metric.buckets.findIndex(bucket => value <= bucket);
        const bucketIndex = index === -1 ? metric.counts.length - 1 : index;
        metric.counts[bucketIndex] += 1;
        this.record(name, metric, labels);
    }

    record(name, metric, labels) {
        const timestamp = Date.now();
        metric.lastUpdated = timestamp;
        const entry = {
            name,
            type: metric.type,
            value: metric.value,
            sum: metric.sum,
            count: metric.count,
            counts: metric.counts,
            buckets: metric.buckets,
            labels: { ...this.defaultLabels, ...labels },
            timestamp
        };
        this.export(entry);
    }

    export(entry) {
        for (const exporter of this.exporters) {
            try {
                exporter(entry);
            } catch (error) {
                console.error('Metrics exporter error:', error);
            }
        }
    }

    startAutoExport() {
        if (!this.collectionInterval) {
            return;
        }
        this.timer = setInterval(() => {
            for (const [name, metric] of this.metrics) {
                this.record(name, metric, {});
            }
        }, this.collectionInterval);
        this.timer.unref?.();
    }

    stopAutoExport() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    snapshot() {
        const now = Date.now();
        return Array.from(this.metrics.entries()).map(([name, metric]) => ({
            name,
            type: metric.type,
            description: metric.description,
            value: metric.value,
            sum: metric.sum,
            count: metric.count,
            counts: metric.counts,
            buckets: metric.buckets,
            lastUpdated: metric.lastUpdated,
            age: now - (metric.lastUpdated || now)
        }));
    }

    getOrCreateMetric(name, type, defaults) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, { type, ...defaults });
        }
        return this.metrics.get(name);
    }
}

module.exports = MetricsCollector;

