/**
 * Memory Monitor Utility
 * Memory usage monitoring and tracking
 */

/**
 * MemoryMonitor class for monitoring memory usage
 */
export class MemoryMonitor {
    constructor() {
        this.samples = [];
        this.maxSamples = 100;
        this.intervalId = null;
    }
    
    /**
     * Get current memory usage
     * @returns {Object|null} - Memory usage information
     */
    static getMemoryUsage() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                available: performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize
            };
        }
        return null;
    }
    
    /**
     * Start monitoring memory
     * @param {number} interval - Sampling interval in milliseconds
     */
    start(interval = 1000) {
        if (this.intervalId) return;
        
        this.intervalId = setInterval(() => {
            const usage = MemoryMonitor.getMemoryUsage();
            if (usage) {
                this.samples.push({
                    ...usage,
                    timestamp: Date.now()
                });
                
                if (this.samples.length > this.maxSamples) {
                    this.samples.shift();
                }
            }
        }, interval);
    }
    
    /**
     * Stop monitoring memory
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    /**
     * Get memory statistics
     * @returns {Object|null} - Memory statistics
     */
    getStatistics() {
        if (this.samples.length === 0) {
            return null;
        }
        
        const used = this.samples.map(s => s.used);
        const total = this.samples.map(s => s.total);
        
        return {
            current: this.samples[this.samples.length - 1],
            average: {
                used: used.reduce((a, b) => a + b, 0) / used.length,
                total: total.reduce((a, b) => a + b, 0) / total.length
            },
            min: {
                used: Math.min(...used),
                total: Math.min(...total)
            },
            max: {
                used: Math.max(...used),
                total: Math.max(...total)
            },
            samples: this.samples.length
        };
    }
    
    /**
     * Get formatted memory report
     * @returns {string} - Formatted report
     */
    getReport() {
        const stats = this.getStatistics();
        if (!stats) return 'No memory data available';
        
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        };
        
        let report = 'Memory Monitor Report:\n\n';
        report += `Current Usage: ${formatBytes(stats.current.used)} / ${formatBytes(stats.current.total)}\n`;
        report += `Average Usage: ${formatBytes(stats.average.used)} / ${formatBytes(stats.average.total)}\n`;
        report += `Min Usage: ${formatBytes(stats.min.used)} / ${formatBytes(stats.min.total)}\n`;
        report += `Max Usage: ${formatBytes(stats.max.used)} / ${formatBytes(stats.max.total)}\n`;
        report += `Samples: ${stats.samples}\n`;
        
        return report;
    }
    
    /**
     * Clear all samples
     */
    clear() {
        this.samples = [];
    }
}
