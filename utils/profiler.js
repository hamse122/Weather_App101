/**
 * Advanced Profiler Utility
 * - High-precision sync & async profiling
 * - Nested call tracking
 * - Error tracking
 * - Memory-safe metrics
 * - Slow-call detection
 * - Configurable history
 * - Runtime statistics
 */

const now = () =>
    typeof performance !== "undefined"
        ? performance.now()
        : Date.now();

export class Profiler {
    constructor({
        enabled = true,
        slowThreshold = 50,
        maxProfiles = 10000,
        trackErrors = true
    } = {}) {
        this.enabled = enabled;
        this.slowThreshold = slowThreshold;
        this.maxProfiles = maxProfiles;
        this.trackErrors = trackErrors;

        this.profiles = new Map();
        this.stackDepth = 0;
    }

    /* ---------------------------------- */
    /* Control */
    /* ---------------------------------- */

    start({ reset = true } = {}) {
        if (reset) this.reset();
        this.enabled = true;
        return this;
    }

    stop() {
        this.enabled = false;
        return this;
    }

    reset() {
        this.profiles.clear();
        this.stackDepth = 0;
        return this;
    }

    /* ---------------------------------- */
    /* Core Profiling */
    /* ---------------------------------- */

    profile(name, fn) {
        if (typeof fn !== "function") {
            throw new TypeError("Profiler requires a function");
        }

        const profiler = this;

        return function profiledFunction(...args) {
            if (!profiler.enabled) {
                return fn.apply(this, args);
            }

            const start = now();
            const depth = profiler.stackDepth++;

            let result;

            try {
                result = fn.apply(this, args);

                if (result && typeof result.then === "function") {
                    return Promise.resolve(result)
                        .then(value => {
                            profiler._record(name, start, depth, false);
                            return value;
                        })
                        .catch(error => {
                            profiler._record(name, start, depth, true);
                            throw error;
                        })
                        .finally(() => {
                            profiler.stackDepth--;
                        });
                }

                profiler._record(name, start, depth, false);
                return result;
            } catch (error) {
                profiler._record(name, start, depth, true);
                throw error;
            } finally {
                if (!result || typeof result.then !== "function") {
                    profiler.stackDepth--;
                }
            }
        };
    }

    /* ---------------------------------- */
    /* Internal Metrics */
    /* ---------------------------------- */

    _getProfile(name) {
        if (!this.profiles.has(name)) {
            if (this.profiles.size >= this.maxProfiles) {
                const oldest = this.profiles.keys().next().value;
                if (oldest !== undefined) {
                    this.profiles.delete(oldest);
                }
            }

            this.profiles.set(name, {
                name,
                callCount: 0,
                errorCount: 0,
                slowCalls: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                averageTime: 0,
                lastTime: 0,
                lastCalledAt: null,
                maxDepth: 0
            });
        }

        return this.profiles.get(name);
    }

    _record(name, start, depth, failed = false) {
        const duration = Math.max(0, now() - start);
        const profile = this._getProfile(name);

        profile.callCount++;
        profile.totalTime += duration;
        profile.lastTime = duration;
        profile.minTime = Math.min(profile.minTime, duration);
        profile.maxTime = Math.max(profile.maxTime, duration);
        profile.averageTime =
            profile.totalTime / profile.callCount;

        profile.maxDepth = Math.max(profile.maxDepth, depth);

        if (failed && this.trackErrors) {
            profile.errorCount++;
        }

        if (duration >= this.slowThreshold) {
            profile.slowCalls++;
        }

        profile.lastCalledAt = Date.now();
    }

    /* ---------------------------------- */
    /* Results */
    /* ---------------------------------- */

    getResults() {
        const results = Array.from(this.profiles.values());

        const totalRuntime = results.reduce(
            (sum, profile) => sum + profile.totalTime,
            0
        );

        return results
            .map(profile => ({
                ...profile,
                minTime:
                    profile.minTime === Infinity
                        ? 0
                        : profile.minTime,
                percentTime:
                    totalRuntime > 0
                        ? (profile.totalTime / totalRuntime) * 100
                        : 0
            }))
            .sort((a, b) => b.totalTime - a.totalTime);
    }

    get(name) {
        const profile = this.profiles.get(name);

        if (!profile) return null;

        return {
            ...profile,
            minTime:
                profile.minTime === Infinity
                    ? 0
                    : profile.minTime
        };
    }

    getSummary() {
        const results = this.getResults();

        return {
            functions: results.length,
            calls: results.reduce(
                (sum, p) => sum + p.callCount,
                0
            ),
            errors: results.reduce(
                (sum, p) => sum + p.errorCount,
                0
            ),
            slowCalls: results.reduce(
                (sum, p) => sum + p.slowCalls,
                0
            ),
            totalTime: results.reduce(
                (sum, p) => sum + p.totalTime,
                0
            )
        };
    }

    /* ---------------------------------- */
    /* Reporting */
    /* ---------------------------------- */

    getReport() {
        const results = this.getResults();

        let report = "Profiler Report\n";
        report += "============================\n\n";

        if (!results.length) {
            return report + "No profiling data available.\n";
        }

        for (const p of results) {
            report += `${p.name}\n`;
            report += `  Calls        : ${p.callCount}\n`;
            report += `  Errors       : ${p.errorCount}\n`;
            report += `  Total Time   : ${p.totalTime.toFixed(3)} ms\n`;
            report += `  Avg Time     : ${p.averageTime.toFixed(3)} ms\n`;
            report += `  Min Time     : ${p.minTime.toFixed(3)} ms\n`;
            report += `  Max Time     : ${p.maxTime.toFixed(3)} ms\n`;
            report += `  Last Time    : ${p.lastTime.toFixed(3)} ms\n`;
            report += `  % Runtime    : ${p.percentTime.toFixed(2)}%\n`;
            report += `  Slow Calls   : ${p.slowCalls}\n`;
            report += `  Max Depth    : ${p.maxDepth}\n\n`;
        }

        return report;
    }

    /* ---------------------------------- */
    /* Debug Helpers */
    /* ---------------------------------- */

    log() {
        const results = this.getResults();

        if (typeof console.table === "function") {
            console.table(results);
        } else {
            console.log(results);
        }

        return results;
    }
}

/* ---------------------------------- */
/* Global Instance */
/* ---------------------------------- */

export const profiler = new Profiler();
