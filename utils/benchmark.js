/**
 * Benchmark Utility
 * Performance benchmarking tool for measuring function execution time
 */

/**
 * Benchmark class for performance measurement
 */
export class Benchmark {
    /**
     * Measure execution time of a function
     * @param {Function} fn - Function to benchmark
     * @param {number} iterations - Number of iterations
     * @returns {Object} - Benchmark results
     */
    static measure(fn, iterations = 1) {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            fn();
            const end = performance.now();
            times.push(end - start);
        }
        
        return {
            iterations,
            totalTime: times.reduce((a, b) => a + b, 0),
            averageTime: times.reduce((a, b) => a + b, 0) / iterations,
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            times
        };
    }
    
    /**
     * Compare two functions
     * @param {Function} fn1 - First function
     * @param {Function} fn2 - Second function
     * @param {number} iterations - Number of iterations
     * @returns {Object} - Comparison results
     */
    static compare(fn1, fn2, iterations = 100) {
        const result1 = this.measure(fn1, iterations);
        const result2 = this.measure(fn2, iterations);
        
        const faster = result1.averageTime < result2.averageTime ? 'fn1' : 'fn2';
        const speedup = faster === 'fn1'
            ? result2.averageTime / result1.averageTime
        const speedup = faster === 'fn1' 
            ? result2.averageTime / result1.averageTime 
            : result1.averageTime / result2.averageTime;
        
        return {
            fn1: result1,
            fn2: result2,
            faster,
            speedup: speedup.toFixed(2),
            difference: Math.abs(result1.averageTime - result2.averageTime).toFixed(4)
        };
    }
    
    /**
     * Create a benchmark suite
     * @returns {BenchmarkSuite} - Benchmark suite instance
     */
    static createSuite() {
        return new BenchmarkSuite();
    }
}

/**
 * BenchmarkSuite class for running multiple benchmarks
 */
export class BenchmarkSuite {
    constructor() {
        this.benchmarks = [];
    }
    
    /**
     * Add a benchmark to the suite
     * @param {string} name - Benchmark name
     * @param {Function} fn - Function to benchmark
     * @param {number} iterations - Number of iterations
     */
    add(name, fn, iterations = 100) {
        this.benchmarks.push({ name, fn, iterations });
    }
    
    /**
     * Run all benchmarks
     * @returns {Array} - Array of benchmark results
     */
    run() {
        return this.benchmarks.map(benchmark => ({
            name: benchmark.name,
            ...Benchmark.measure(benchmark.fn, benchmark.iterations)
        }));
    }
    
    /**
     * Run benchmarks and return formatted results
     * @returns {string} - Formatted results string
     */
    runAndFormat() {
        const results = this.run();
        let output = 'Benchmark Results:\n\n';
        
        results.forEach(result => {
            output += `${result.name}:\n`;
            output += `  Average: ${result.averageTime.toFixed(4)}ms\n`;
            output += `  Min: ${result.minTime.toFixed(4)}ms\n`;
            output += `  Max: ${result.maxTime.toFixed(4)}ms\n`;
            output += `  Total: ${result.totalTime.toFixed(4)}ms\n\n`;
        });
        
        return output;
    }
}


