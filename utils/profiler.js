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

/* ----------------------------------
   Reporting
---------------------------------- */

getReport() {
    const results = this.getResults();
    const lines = [
        "Profiler Report",
        "=".repeat(60),
        `Generated At : ${new Date().toISOString()}`,
        `Total Profiles: ${results.length}`,
        ""
    ];

    if (!results.length) {
        lines.push("No profiling data available.");
        return lines.join("\n");
    }

    const format = (value, digits = 3) =>
        Number.isFinite(value) ? value.toFixed(digits) : "N/A";

    for (const p of results) {
        lines.push(
            p.name,
            "-".repeat(Math.min(Math.max(String(p.name).length, 10), 60)),
            `  Calls        : ${p.callCount ?? 0}`,
            `  Errors       : ${p.errorCount ?? 0}`,
            `  Total Time   : ${format(p.totalTime)} ms`,
            `  Avg Time     : ${format(p.averageTime)} ms`,
            `  Min Time     : ${format(p.minTime)} ms`,
            `  Max Time     : ${format(p.maxTime)} ms`,
            `  Last Time    : ${format(p.lastTime)} ms`,
            `  % Runtime    : ${format(p.percentTime, 2)}%`,
            `  Slow Calls   : ${p.slowCalls ?? 0}`,
            `  Max Depth    : ${p.maxDepth ?? 0}`,
            ""
        );
    }

    return lines.join("\n");
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
