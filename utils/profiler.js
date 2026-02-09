/**
 * Advanced Profiler Utility
 * High-precision profiler for sync & async functions
 */

const now = () =>
  typeof performance !== 'undefined'
    ? performance.now()
    : Date.now();

export class Profiler {
  constructor({
    enabled = true,
    slowThreshold = 50 // ms
  } = {}) {
    this.enabled = enabled;
    this.slowThreshold = slowThreshold;
    this.profiles = new Map();
    this.stackDepth = 0;
  }

  /* ---------------------------------- */
  /* Control */
  /* ---------------------------------- */
  start() {
    this.enabled = true;
    this.reset();
  }

  stop() {
    this.enabled = false;
  }

  reset() {
    this.profiles.clear();
  }

  /* ---------------------------------- */
  /* Core Profiling */
  /* ---------------------------------- */
  profile(name, fn) {
    const profiler = this;

    return function profiledFunction(...args) {
      if (!profiler.enabled) {
        return fn.apply(this, args);
      }

      const start = now();
      profiler.stackDepth++;

      let result;
      let error;

      try {
        result = fn.apply(this, args);

        // Handle async functions
        if (result instanceof Promise) {
          return result
            .then(res => {
              profiler._record(name, start);
              return res;
            })
            .catch(err => {
              profiler._record(name, start);
              throw err;
            });
        }

        return result;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        if (!(result instanceof Promise)) {
          profiler._record(name, start);
        }
        profiler.stackDepth--;
      }
    };
  }

  /* ---------------------------------- */
  /* Internal Metrics */
  /* ---------------------------------- */
  _record(name, start) {
    const duration = now() - start;

    if (!this.profiles.has(name)) {
      this.profiles.set(name, {
        name,
        callCount: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        averageTime: 0,
        slowCalls: 0
      });
    }

    const p = this.profiles.get(name);

    p.callCount++;
    p.totalTime += duration;
    p.minTime = Math.min(p.minTime, duration);
    p.maxTime = Math.max(p.maxTime, duration);
    p.averageTime = p.totalTime / p.callCount;

    if (duration >= this.slowThreshold) {
      p.slowCalls++;
    }
  }

  /* ---------------------------------- */
  /* Results */
  /* ---------------------------------- */
  getResults() {
    const results = Array.from(this.profiles.values());
    const totalRuntime = results.reduce(
      (sum, p) => sum + p.totalTime,
      0
    );

    return results
      .map(p => ({
        ...p,
        percentTime:
          totalRuntime === 0
            ? 0
            : (p.totalTime / totalRuntime) * 100
      }))
      .sort((a, b) => b.totalTime - a.totalTime);
  }

  /* ---------------------------------- */
  /* Reporting */
  /* ---------------------------------- */
  getReport() {
    const results = this.getResults();

    let report = `Profiler Report\n`;
    report += `============================\n\n`;

    results.forEach(p => {
      report += `${p.name}\n`;
      report += `  Calls        : ${p.callCount}\n`;
      report += `  Total Time   : ${p.totalTime.toFixed(3)} ms\n`;
      report += `  Avg Time     : ${p.averageTime.toFixed(3)} ms\n`;
      report += `  Min Time     : ${p.minTime.toFixed(3)} ms\n`;
      report += `  Max Time     : ${p.maxTime.toFixed(3)} ms\n`;
      report += `  % Runtime    : ${p.percentTime.toFixed(2)}%\n`;
      report += `  Slow Calls   : ${p.slowCalls}\n\n`;
    });

    return report;
  }

  /* ---------------------------------- */
  /* Debug Helpers */
  /* ---------------------------------- */
  log() {
    console.table(this.getResults());
  }
}

/* ---------------------------------- */
/* Global Instance */
/* ---------------------------------- */
export const profiler = new Profiler();
