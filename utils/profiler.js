/**
 * Profiler Utility
 * Code profiler for tracking function performance and call counts
 */

/**
 * Profiler class for profiling code execution
 */
export class Profiler {
    constructor() {
        this.profiles = new Map();
        this.active = false;
    }
    
    /**
     * Start profiling
     */
    start() {
        this.active = true;
        this.profiles.clear();
    }
    
    /**
     * Stop profiling
     */
    stop() {
        this.active = false;
    }
    
    /**
     * Profile a function
     * @param {string} name - Function name
     * @param {Function} fn - Function to profile
     * @returns {Function} - Profiled function
     */
    profile(name, fn) {
        return (...args) => {
            if (!this.active) return fn(...args);
            
            const start = performance.now();
            const result = fn(...args);
            const end = performance.now();
            const duration = end - start;
            
            if (!this.profiles.has(name)) {
                this.profiles.set(name, {
                    name,
                    callCount: 0,
                    totalTime: 0,
                    minTime: Infinity,
                    maxTime: 0,
                    averageTime: 0
                });
            }
            
            const profile = this.profiles.get(name);
            profile.callCount++;
            profile.totalTime += duration;
            profile.minTime = Math.min(profile.minTime, duration);
            profile.maxTime = Math.max(profile.maxTime, duration);
            profile.averageTime = profile.totalTime / profile.callCount;
            
            return result;
        };
    }
    
    /**
     * Get profile results
     * @returns {Array} - Array of profile results
     */
    getResults() {
        return Array.from(this.profiles.values()).sort((a, b) => b.totalTime - a.totalTime);
    }
    
    /**
     * Get formatted profile report
     * @returns {string} - Formatted report
     */
    getReport() {
        const results = this.getResults();
        let report = 'Profiler Report:\n\n';
        
        results.forEach(profile => {
            report += `${profile.name}:\n`;
            report += `  Calls: ${profile.callCount}\n`;
            report += `  Total Time: ${profile.totalTime.toFixed(4)}ms\n`;
            report += `  Average Time: ${profile.averageTime.toFixed(4)}ms\n`;
            report += `  Min Time: ${profile.minTime.toFixed(4)}ms\n`;
            report += `  Max Time: ${profile.maxTime.toFixed(4)}ms\n\n`;
        });
        
        return report;
    }
    
    /**
     * Clear all profiles
     */
    clear() {
        this.profiles.clear();
    }
}

// Global profiler instance
export const profiler = new Profiler();
