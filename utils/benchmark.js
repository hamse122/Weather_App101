
/**
 * Advanced Benchmark Utility (v3 - 2026 Edition)
 * Features:
 * - High precision timing
 * - Sync and async execution
 * - Warmup iterations
 * - Percentile analysis (P50/P90/P95/P99)
 * - Ops/sec and throughput
 * - Memory tracking (Node.js)
 * - Outlier trimming
 * - Margin of error
 * - Benchmark comparison
 * - Multiple benchmark suites
 * - AbortSignal support
 * - Detailed statistics
 */

const isNode =
    typeof process !== "undefined" &&
    !!process.versions?.node;

let perf = globalThis.performance;

if (!perf && isNode) {
    perf = require("perf_hooks").performance;
}

if (!perf) {
    throw new Error("High-resolution performance API is unavailable");
}

function now() {
    return perf.now();
}

export class Benchmark {

    static async measure(fn, {
        iterations = 100,
        warmup = 10,
        trim = 0,
        trackMemory = false,
        signal = null
    } = {}) {

        if (typeof fn !== "function") {
            throw new TypeError("Benchmark.measure: fn must be a function");
        }

        if (!Number.isInteger(iterations) || iterations < 1) {
            throw new RangeError("iterations must be a positive integer");
        }

        if (!Number.isInteger(warmup) || warmup < 0) {
            throw new RangeError("warmup must be a non-negative integer");
        }

        if (!Number.isFinite(trim) || trim < 0 || trim >= 0.5) {
            throw new RangeError("trim must be between 0 and 0.5");
        }

        const checkAbort = () => {
            if (signal?.aborted) {
                throw signal.reason ??
                    new Error("Benchmark aborted");
            }
        };

        const times = [];

        let memoryStart = null;
        let memoryEnd = null;

        // Warmup
        for (let i = 0; i < warmup; i++) {
            checkAbort();
            await fn();
        }

        // Memory tracking
        if (trackMemory && isNode) {
            if (global.gc) global.gc();
            memoryStart = process.memoryUsage().heapUsed;
        }

        // Measurement
        for (let i = 0; i < iterations; i++) {
            checkAbort();

            const start = now();

            await fn();

            const end = now();

            times.push(end - start);
        }

        if (trackMemory && isNode) {
            if (global.gc) global.gc();
            memoryEnd = process.memoryUsage().heapUsed;
        }

        return this._stats(times, {
            trim,
            memoryUsed:
                memoryStart !== null && memoryEnd !== null
                    ? memoryEnd - memoryStart
                    : null
        });
    }

    /* ==========================
       STATISTICS
    ========================== */

    static _stats(times, {
        trim = 0,
        memoryUsed = null
    } = {}) {

        if (!times.length) {
            throw new Error("No benchmark measurements available");
        }

        const sorted = [...times].sort((a, b) => a - b);

        const cut = Math.floor(sorted.length * trim);

        const data = sorted.slice(
            cut,
            sorted.length - cut
        );

        const n = data.length;

        const total = data.reduce((a, b) => a + b, 0);
        const avg = total / n;

        const percentile = p => {
            const index = (p / 100) * (n - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);

            if (lower === upper) return data[lower];

            const fraction = index - lower;

            return data[lower] +
                (data[upper] - data[lower]) * fraction;
        };

        const median = percentile(50);

        const variance = data.reduce(
            (sum, value) => sum + (value - avg) ** 2,
            0
        ) / n;

        const std = Math.sqrt(variance);

        const standardError = n > 1
            ? std / Math.sqrt(n)
            : 0;

        const marginOfError = 1.96 * standardError;

        return {
            iterations: n,
            originalIterations: times.length,

            totalTime: total,
            averageTime: avg,
            medianTime: median,

            minTime: data[0],
            maxTime: data[n - 1],

            variance,
            stdDeviation: std,
            standardError,
            marginOfError,

            opsPerSec: avg > 0 ? 1000 / avg : Infinity,

            p50: median,
            p90: percentile(90),
            p95: percentile(95),
            p99: percentile(99),

            memoryUsed,
            memoryUsedKB:
                memoryUsed !== null
                    ? memoryUsed / 1024
                    : null,

            times: [...data]
        };
    }

    /* ==========================
       COMPARISON
    ========================== */

    static async compare(fn1, fn2, options = {}) {

        const r1 = await this.measure(fn1, options);
        const r2 = await this.measure(fn2, options);

        const faster =
            r1.averageTime <= r2.averageTime
                ? "fn1"
                : "fn2";

        const min = Math.min(
            r1.averageTime,
            r2.averageTime
        );

        const max = Math.max(
            r1.averageTime,
            r2.averageTime
        );

        return {
            fn1: r1,
            fn2: r2,

            faster,

            speedup: min > 0
                ? Number((max / min).toFixed(2))
                : null,

            difference: Math.abs(
                r1.averageTime - r2.averageTime
            ),

            improvementPercent: max > 0
                ? Number(((max - min) / max * 100).toFixed(2))
                : 0
        };
    }

    /* ==========================
       SUITE
    ========================== */

    static createSuite() {
        return new BenchmarkSuite();
    }
}

/* ==================================
   BENCHMARK SUITE
================================== */

export class BenchmarkSuite {

    constructor() {
        this.benchmarks = [];
    }

    add(name, fn, options = {}) {

        if (!name || typeof name !== "string") {
            throw new TypeError("Benchmark name must be a string");
        }

        if (typeof fn !== "function") {
            throw new TypeError("Benchmark must be a function");
        }

        this.benchmarks.push({
            name,
            fn,
            options
        });

        return this;
    }

    remove(name) {
        this.benchmarks = this.benchmarks.filter(
            benchmark => benchmark.name !== name
        );

        return this;
    }

    clear() {
        this.benchmarks = [];
        return this;
    }

    async run() {

        const results = [];

        for (const benchmark of this.benchmarks) {

            const result = await Benchmark.measure(
                benchmark.fn,
                benchmark.options
            );

            results.push({
                name: benchmark.name,
                ...result
            });
        }

        return results.sort(
            (a, b) => a.averageTime - b.averageTime
        );
    }

    async runAndFormat() {

        const results = await this.run();

        let output = "\n🚀 BENCHMARK RESULTS\n\n";

        results.forEach((r, index) => {

            output += `${index + 1}. ${r.name}\n`;

            output += `   Average: ${r.averageTime.toFixed(4)} ms\n`;
            output += `   Median:  ${r.medianTime.toFixed(4)} ms\n`;
            output += `   Ops/sec: ${r.opsPerSec.toFixed(2)}\n`;

            output += `   P90:     ${r.p90.toFixed(4)} ms\n`;
            output += `   P95:     ${r.p95.toFixed(4)} ms\n`;
            output += `   P99:     ${r.p99.toFixed(4)} ms\n`;

            output += `   Min:     ${r.minTime.toFixed(4)} ms\n`;
            output += `   Max:     ${r.maxTime.toFixed(4)} ms\n`;

            output += `   StdDev:  ${r.stdDeviation.toFixed(4)} ms\n`;
            output += `   MoE:     ±${r.marginOfError.toFixed(4)} ms\n`;

            if (r.memoryUsed !== null) {
                output += `   Memory:  ${r.memoryUsedKB.toFixed(2)} KB\n`;
            }

            output += "\n";
        });

        return output;
    }

    async runAsTable() {

        const results = await this.run();

        console.table(
            results.map(r => ({
                Name: r.name,
                Average_ms: r.averageTime.toFixed(4),
                Median_ms: r.medianTime.toFixed(4),
                Ops_sec: r.opsPerSec.toFixed(2),
                P95_ms: r.p95.toFixed(4),
                P99_ms: r.p99.toFixed(4),
                Memory_KB: r.memoryUsedKB?.toFixed(2) ?? "N/A",
                Iterations: r.iterations
            }))
        );

        return results;
    }
}
