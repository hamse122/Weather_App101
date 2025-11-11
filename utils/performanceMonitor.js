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
