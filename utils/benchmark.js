/**
 * Benchmark Utility
 * Advanced performance benchmarking tool for measuring function execution time
 */

export class Benchmark {

    /**
     * Measure execution time of a function (supports sync/async)
     * @param {Function} fn
     * @param {number} iterations
     * @param {number} warmup - ignored initial runs
     * @returns {Object}
     */
    static async measure(fn, iterations = 1, warmup = 0) {
        if (typeof fn !== "function") {
            throw new Error("Benchmark.measure: 'fn' must be a function");
        }
        if (iterations < 1) iterations = 1;
        if (warmup < 0) warmup = 0;

        const times = [];

        // Warm-up runs (ignored)
        for (let i = 0; i < warmup; i++) {
            const r = fn();
            if (r instanceof Promise) await r;
        }

        // Actual benchmark
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const result = fn();
            if (result instanceof Promise) {
                await result;
            }
            const end = performance.now();
            times.push(end - start);
        }

        return this._stats(times);
    }

    /**
     * Fast synchronous-only measurement
     * Avoids async checks for better accuracy
     */
    static measureSync(fn, iterations = 1, warmup = 0) {
        if (typeof fn !== "function") {
            throw new Error("Benchmark.measureSync: 'fn' must be a function");
        }

        const times = [];

        for (let i = 0; i < warmup; i++) fn();

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            fn();
            const end = performance.now();
            times.push(end - start);
        }

        return this._stats(times);
    }

    /**
     * Calculate statistics from timing array
     */
    static _stats(times) {
        const total = times.reduce((a, b) => a + b, 0);
        const average = total / times.length;

        const sorted = [...times].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];

        const variance = times.map(t => (t - average) ** 2).reduce((a, b) => a + b, 0) / times.length;
        const stdDeviation = Math.sqrt(variance);

        return {
            iterations: times.length,
            totalTime: total,
            averageTime: average,
            medianTime: median,
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            stdDeviation,
            variance,
            times
        };
    }

    /**
     * Compare two benchmark functions
     */
    static async compare(fn1, fn2, iterations = 100, warmup = 10) {
        const r1 = await this.measure(fn1, iterations, warmup);
        const r2 = await this.measure(fn2, iterations, warmup);

        const faster = r1.averageTime < r2.averageTime ? "fn1" : "fn2";
        const slow = faster === "fn1" ? r2 : r1;
        const fast = faster === "fn1" ? r1 : r2;

        return {
            fn1: r1,
            fn2: r2,
            faster,
            speedup: Number((slow.averageTime / fast.averageTime).toFixed(2)),
            difference: Number(Math.abs(r1.averageTime - r2.averageTime).toFixed(4)),
        };
    }

    static createSuite() {
        return new BenchmarkSuite();
    }
}

export class BenchmarkSuite {
    constructor() {
        this.benchmarks = [];
    }

    add(name, fn, iterations = 100, warmup = 10) {
        this.benchmarks.push({ name, fn, iterations, warmup });
    }

    /**
     * Run all benchmarks
     */
    async run() {
        const results = [];
        for (const b of this.benchmarks) {
            const result = await Benchmark.measure(b.fn, b.iterations, b.warmup);
            results.push({ name: b.name, ...result });
        }
        return results;
    }

    /**
     * Pretty formatted text report
     */
    async runAndFormat() {
        const results = await this.run();
        let output = "Benchmark Results:\n\n";

        for (const r of results) {
            output += `${r.name}:\n`;
            output += `  Avg:   ${r.averageTime.toFixed(4)} ms\n`;
            output += `  Med:   ${r.medianTime.toFixed(4)} ms\n`;
            output += `  Min:   ${r.minTime.toFixed(4)} ms\n`;
            output += `  Max:   ${r.maxTime.toFixed(4)} ms\n`;
            output += `  Total: ${r.totalTime.toFixed(4)} ms\n`;
            output += `  Std:   ${r.stdDeviation.toFixed(4)} ms\n\n`;
        }

        return output;
    }

    /**
     * Return results as a console table
     */
    async runAsTable() {
        const results = await this.run();
        console.table(
            results.map(r => ({
                Name: r.name,
                Avg: r.averageTime.toFixed(4),
                Med: r.medianTime.toFixed(4),
                Min: r.minTime.toFixed(4),
                Max: r.maxTime.toFixed(4),
                Total: r.totalTime.toFixed(4),
                StDev: r.stdDeviation.toFixed(4),
                Iterations: r.iterations,
            }))
        );
    }
}
