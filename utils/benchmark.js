/**
 * Benchmark Utility
 * Performance benchmarking tool for measuring function execution time
 */

/**
 * Benchmark class for performance measurement
 */
export class Benchmark {

    /**
     * Measure execution time of a function (supports sync/async)
     * @param {Function} fn - Function to benchmark
     * @param {number} iterations - Number of iterations
     * @returns {Object} Benchmark results
     */
    static async measure(fn, iterations = 1) {
        if (typeof fn !== "function") {
            throw new Error("Benchmark.measure: 'fn' must be a function");
        }
        if (iterations < 1) iterations = 1;

        const times = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();

            const result = fn();
            if (result instanceof Promise) {
                await result; // support async functions
            }

            const end = performance.now();
            times.push(end - start);
        }

        const totalTime = times.reduce((a, b) => a + b, 0);

        return {
            iterations,
            totalTime,
            averageTime: totalTime / iterations,
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            times
        };
    }

    /**
     * Compare two functions (supports async)
     * @param {Function} fn1
     * @param {Function} fn2
     * @param {number} iterations
     * @returns {Object} Comparison results
     */
    static async compare(fn1, fn2, iterations = 100) {
        const result1 = await this.measure(fn1, iterations);
        const result2 = await this.measure(fn2, iterations);

        const faster = result1.averageTime < result2.averageTime ? "fn1" : "fn2";

        const speedup =
            faster === "fn1"
                ? result2.averageTime / result1.averageTime
                : result1.averageTime / result2.averageTime;

        return {
            fn1: result1,
            fn2: result2,
            faster,
            speedup: Number(speedup.toFixed(2)),
            difference: Number(
                Math.abs(result1.averageTime - result2.averageTime).toFixed(4)
            )
        };
    }

    /**
     * Create a benchmark suite
     * @returns {BenchmarkSuite}
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
     * @param {string} name
     * @param {Function} fn
     * @param {number} iterations
     */
    add(name, fn, iterations = 100) {
        this.benchmarks.push({ name, fn, iterations });
    }

    /**
     * Run all benchmarks (supports async)
     * @returns {Promise<Array>}
     */
    async run() {
        const results = [];

        for (const b of this.benchmarks) {
            const result = await Benchmark.measure(b.fn, b.iterations);
            results.push({ name: b.name, ...result });
        }

        return results;
    }

    /**
     * Run benchmarks and return nicely formatted results
     * @returns {Promise<string>}
     */
    async runAndFormat() {
        const results = await this.run();
        let output = "Benchmark Results:\n\n";

        results.forEach(result => {
            output += `${result.name}:\n`;
            output += `  Average: ${result.averageTime.toFixed(4)}ms\n`;
            output += `  Min:     ${result.minTime.toFixed(4)}ms\n`;
            output += `  Max:     ${result.maxTime.toFixed(4)}ms\n`;
            output += `  Total:   ${result.totalTime.toFixed(4)}ms\n\n`;
        });

        return output;
    }
}
