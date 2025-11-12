// Advanced performance monitoring
class PerformanceMonitor {
    constructor(options = {}) {
        this.metrics = new Map();
        this.thresholds = options.thresholds || {};
        this.reportingEndpoint = options.reportingEndpoint || null;
        this.samplingRate = options.samplingRate || 1.0;
        this.observers = new Map();
        this.fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch : null);
    }

    start() {
        this.observeNavigationTiming();
        this.observeResourceTiming();
        this.observeLongTasks();
        this.observeLayoutShifts();
        this.observeLargestContentfulPaint();
        this.monitorCLS();
        this.monitorFID();
        this.monitorLCP();
        return this;
    }

    observeNavigationTiming() {
        if (!performance.getEntriesByType) {
            return;
        }
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        if (navigationEntry) {
            this.metrics.set('navigation', {
                dns: navigationEntry.domainLookupEnd - navigationEntry.domainLookupStart,
                tcp: navigationEntry.connectEnd - navigationEntry.connectStart,
                ttfb: navigationEntry.responseStart - navigationEntry.requestStart,
                download: navigationEntry.responseEnd - navigationEntry.responseStart,
                domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
                load: navigationEntry.loadEventEnd - navigationEntry.loadEventStart
            });
        }
    }

    observeResourceTiming() {
        if (!performance.getEntriesByType) {
            return;
        }
        const resources = performance.getEntriesByType('resource');
        const resourceMetrics = {};
        resources.forEach(resource => {
            const key = resource.name.split('/').pop() || 'unknown';
            resourceMetrics[key] = {
                duration: resource.duration,
                size: resource.transferSize || 0,
                type: resource.initiatorType
            };
        });
        this.metrics.set('resources', resourceMetrics);
    }

    observeLongTasks() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        const observer = new PerformanceObserver(list => {
            const longTasks = list.getEntries().filter(entry => entry.duration > 50);
            this.metrics.set('longTasks', longTasks);
        });
        observer.observe({ entryTypes: ['longtask'] });
        this.observers.set('longTask', observer);
    }

    observeLayoutShifts() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        let cls = 0;
        const observer = new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                if (!entry.hadRecentInput) {
                    cls += entry.value;
                }
            });
            this.metrics.set('CLS', cls);
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layoutShift', observer);
    }

    observeLargestContentfulPaint() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        const observer = new PerformanceObserver(list => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
                this.metrics.set('LCP', lastEntry.startTime);
            }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', observer);
    }

    monitorCLS() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        let cls = 0;
        const observer = new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                if (!entry.hadRecentInput) {
                    cls += entry.value;
                }
            });
            this.metrics.set('CLS', cls);
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('clsMonitor', observer);
    }

    monitorFID() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        const observer = new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                const fid = entry.processingStart - entry.startTime;
                this.metrics.set('FID', fid);
            });
        });
        observer.observe({ entryTypes: ['first-input'] });
        this.observers.set('fidMonitor', observer);
    }

    monitorLCP() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        const observer = new PerformanceObserver(list => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
                this.metrics.set('LCP', lastEntry.startTime);
            }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcpMonitor', observer);
    }

    getMetrics() {
        const metrics = {};
        this.metrics.forEach((value, key) => {
            metrics[key] = value;
        });
        if (performance.memory) {
            metrics.memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return metrics;
    }

    checkThresholds() {
        const violations = [];
        const metrics = this.getMetrics();
        Object.keys(this.thresholds).forEach(metric => {
            const value = metrics[metric];
            const threshold = this.thresholds[metric];
            if (value !== undefined && value > threshold) {
                violations.push({
                    metric,
                    value,
                    threshold,
                    severity: 'high'
                });
            }
        });
        return violations;
    }

    async report() {
        if (!this.reportingEndpoint || Math.random() > this.samplingRate || !this.fetchImpl) {
            return;
        }
        const report = {
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : 'server',
            metrics: this.getMetrics(),
            thresholds: this.checkThresholds(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        };
        try {
            await this.fetchImpl(this.reportingEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(report)
            });
        } catch (error) {
            console.error('Performance report failed:', error);
        }
    }

    destroy() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.metrics.clear();
    }
}

module.exports = PerformanceMonitor;
/**
 * Performance Monitor Utility
 * Performance monitoring and metrics collection
 */

/**
 * PerformanceMonitor class for monitoring performance
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
    }
    
    /**
     * Start performance measurement
     * @param {string} name - Measurement name
     * @returns {Function} - Stop function
     */
    startMeasurement(name) {
        const start = performance.now();
        
        return () => {
            const end = performance.now();
            const duration = end - start;
            
            if (!this.metrics.has(name)) {
                this.metrics.set(name, []);
            }
            
            this.metrics.get(name).push({
                duration,
                timestamp: Date.now()
            });
        };
    }
    
    /**
     * Measure function execution time
     * @param {string} name - Measurement name
     * @param {Function} fn - Function to measure
     * @returns {*} - Function result
     */
    async measure(name, fn) {
        const stop = this.startMeasurement(name);
        try {
            const result = await fn();
            return result;
        } finally {
            stop();
        }
    }
    
    /**
     * Get metrics for a measurement
     * @param {string} name - Measurement name
     * @returns {Object|null} - Metrics object
     */
    getMetrics(name) {
        const measurements = this.metrics.get(name) || [];
        
        if (measurements.length === 0) {
            return null;
        }
        
        const durations = measurements.map(m => m.duration);
        
        return {
            name,
            count: measurements.length,
            total: durations.reduce((a, b) => a + b, 0),
            average: durations.reduce((a, b) => a + b, 0) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            measurements
        };
    }
    
    /**
     * Get all metrics
     * @returns {Object} - Object with all metrics
     */
    getAllMetrics() {
        const result = {};
        this.metrics.forEach((measurements, name) => {
            result[name] = this.getMetrics(name);
        });
        return result;
    }
    
    /**
     * Clear metrics
     * @param {string|null} name - Optional measurement name to clear
     */
    clear(name = null) {
        if (name) {
            this.metrics.delete(name);
        } else {
            this.metrics.clear();
        }
    }
    
    /**
     * Monitor resource loading
     */
    monitorResources() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                const name = entry.name;
                if (!this.metrics.has(name)) {
                    this.metrics.set(name, []);
                }
                
                this.metrics.get(name).push({
                    duration: entry.duration,
                    timestamp: entry.startTime,
                    type: entry.entryType
                });
            });
        });
        
        try {
            observer.observe({ entryTypes: ['resource', 'navigation', 'paint'] });
            this.observers.push(observer);
        } catch (error) {
            console.warn('PerformanceObserver not fully supported:', error);
        }
    }
    
    /**
     * Get Web Vitals metrics
     * @returns {Promise<Object>} - Web Vitals metrics
     */
    async getWebVitals() {
        const vitals = {};
        
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        vitals.fid = entry.processingStart - entry.startTime;
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    vitals.cls = clsValue;
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (error) {
                console.warn('Web Vitals not supported:', error);
            }
        }
        
        return vitals;
    }
    
    /**
     * Cleanup observers
     */
    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();
