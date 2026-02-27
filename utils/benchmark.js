/**
 * Advanced Benchmark Utility (2026 Edition)
 * High precision, percentiles, ops/sec, memory tracking, trimming, margin of error
 */

const isNode = typeof process !== "undefined" && process.versions?.node;
let perf = globalThis.performance;

if (!perf && isNode) {
    const { performance } = require("perf_hooks");
    perf = performance;
}

function now() {
    return perf.now();
}

export class Benchmark {

    static async measure(fn, {
        iterations = 100,
        warmup = 10,
        trim = 0, // % trimming (e.g., 0.05 = remove 5% extremes)
        trackMemory = false
    } = {}) {

        if (typeof fn !== "function") {
            throw new Error("Benchmark.measure: fn must be a function");
        }

        const times = [];
        let memStart = null;

        // Warmup
        for (let i = 0; i < warmup; i++) {
            await fn();
        }

        if (trackMemory && isNode) {
            global.gc?.();
            memStart = process.memoryUsage().heapUsed;
        }

        // Measurement
        for (let i = 0; i < iterations; i++) {
            const start = now();
            const result = fn();
            if (result?.then) await result;
            const end = now();
            times.push(end - start);
        }

        let memEnd = null;
        if (trackMemory && isNode) {
            global.gc?.();
            memEnd = process.memoryUsage().heapUsed;
        }

        return this._stats(times, {
            trim,
            memoryUsed: memStart && memEnd ? memEnd - memStart : null
        });
    }

    static _stats(times, { trim = 0, memoryUsed = null } = {}) {
        let data = [...times].sort((a, b) => a - b);

        // Optional trimming
        if (trim > 0) {
            const cut = Math.floor(data.length * trim);
            data = data.slice(cut, data.length - cut);
        }

        const n = data.length;
        const total = data.reduce((a, b) => a + b, 0);
        const avg = total / n;

        const median =
            n % 2 === 0
                ? (data[n / 2 - 1] + data[n / 2]) / 2
                : data[Math.floor(n / 2)];

        const variance =
            data.reduce((a, t) => a + (t - avg) ** 2, 0) / n;

        const std = Math.sqrt(variance);

        const percentile = p =>
            data[Math.floor((p / 100) * n)];

        const marginOfError =
            (1.96 * std) / Math.sqrt(n);

        return {
            iterations: n,
            totalTime: total,
            averageTime: avg,
            medianTime: median,
            minTime: data[0],
            maxTime: data[n - 1],
            variance,
            stdDeviation: std,
            marginOfError,
            opsPerSec: 1000 / avg,
            p90: percentile(90),
            p95: percentile(95),
            p99: percentile(99),
            memoryUsed,
            times: data
        };
    }

    static async compare(fn1, fn2, options = {}) {
        const r1 = await this.measure(fn1, options);
        const r2 = await this.measure(fn2, options);

        const faster = r1.averageTime < r2.averageTime ? "fn1" : "fn2";
        const speedup = (
            Math.max(r1.averageTime, r2.averageTime) /
            Math.min(r1.averageTime, r2.averageTime)
        );

        return {
            fn1: r1,
            fn2: r2,
            faster,
            speedup: Number(speedup.toFixed(2)),
            difference: Math.abs(r1.averageTime - r2.averageTime),
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

    add(name, fn, options = {}) {
        this.benchmarks.push({ name, fn, options });
        return this;
    }

    async run() {
        const results = [];

        for (const b of this.benchmarks) {
            const r = await Benchmark.measure(b.fn, b.options);
            results.push({ name: b.name, ...r });
        }

        return results.sort((a, b) => a.averageTime - b.averageTime);
    }

    async runAndFormat() {
        const results = await this.run();
        let output = "\n🚀 Benchmark Results\n\n";

        for (const r of results) {
            output += `${r.name}\n`;
            output += `  Avg:    ${r.averageTime.toFixed(4)} ms\n`;
            output += `  Ops/s:  ${r.opsPerSec.toFixed(2)}\n`;
            output += `  Med:    ${r.medianTime.toFixed(4)} ms\n`;
            output += `  P95:    ${r.p95.toFixed(4)} ms\n`;
            output += `  Min:    ${r.minTime.toFixed(4)} ms\n`;
            output += `  Max:    ${r.maxTime.toFixed(4)} ms\n`;
            output += `  StdDev: ${r.stdDeviation.toFixed(4)} ms\n`;
            output += `  MoE:    ±${r.marginOfError.toFixed(4)} ms\n`;

            if (r.memoryUsed !== null) {
                output += `  Memory: ${(r.memoryUsed / 1024).toFixed(2)} KB\n`;
            }

            output += "\n";
        }

        return output;
    }

    async runAsTable() {
        const results = await this.run();
        console.table(
            results.map(r => ({
                Name: r.name,
                Avg_ms: r.averageTime.toFixed(4),
                Ops_sec: r.opsPerSec.toFixed(2),
                P95_ms: r.p95.toFixed(4),
                Min_ms: r.minTime.toFixed(4),
                Max_ms: r.maxTime.toFixed(4),
                StdDev: r.stdDeviation.toFixed(4),
                Iter: r.iterations
            }))
        );
    }
}
