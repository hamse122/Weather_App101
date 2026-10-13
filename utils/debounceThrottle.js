/**
 * ============================================================
 * Performance Utilities vNext
 * ------------------------------------------------------------
 * Features:
 * - Debounce
 * - Throttle
 * - RAF Throttle
 * - Adaptive Rate Limiter
 * - Token Bucket
 * - Idle Scheduler
 * - Promise Queue
 * - Concurrency Limiter
 * - Metrics
 * - AbortController Support
 * ============================================================
 */

export class PerformanceMetrics {
  constructor() {
    this.calls = 0;
    this.executions = 0;
    this.cancellations = 0;
    this.totalExecutionTime = 0;
  }

  recordCall() {
    this.calls++;
  }

  recordExecution(duration) {
    this.executions++;
    this.totalExecutionTime += duration;
  }

  recordCancellation() {
    this.cancellations++;
  }

  snapshot() {
    return {
      calls: this.calls,
      executions: this.executions,
      cancellations: this.cancellations,
      avgExecutionTime:
        this.executions > 0
          ? this.totalExecutionTime /
            this.executions
          : 0
    };
  }
}

/* ============================================================
 * Advanced Debounce (v2)
 * - Leading and trailing execution
 * - maxWait support
 * - AbortSignal support
 * - Cancel, flush, and pending controls
 * - Promise-safe return values
 * - Performance metrics
 * ============================================================
 */

export function debounce(fn, wait = 0, options = {}) {
    if (typeof fn !== "function") {
        throw new TypeError("Expected a function");
    }

    if (!Number.isFinite(wait) || wait < 0) {
        throw new RangeError("wait must be a non-negative number");
    }

    const {
        leading = false,
        trailing = true,
        maxWait,
        signal
    } = options;

    if (
        maxWait !== undefined &&
        (!Number.isFinite(maxWait) || maxWait < 0)
    ) {
        throw new RangeError("maxWait must be a non-negative number");
    }

    const metrics = new PerformanceMetrics();

    let timer = null;
    let maxTimer = null;
    let lastArgs;
    let lastThis;
    let lastCallTime = 0;
    let lastInvokeTime = 0;
    let leadingInvoked = false;
    let lastResult;
    let cancelled = false;

    const now = () => globalThis.performance?.now?.() ?? Date.now();

    function clearTimers() {
        if (timer !== null) clearTimeout(timer);
        if (maxTimer !== null) clearTimeout(maxTimer);

        timer = null;
        maxTimer = null;
    }

    function invoke() {
        if (!lastArgs) return lastResult;

        const args = lastArgs;
        const context = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = now();

        const start = now();

        try {
            lastResult = fn.apply(context, args);
            return lastResult;
        } finally {
            metrics.recordExecution(now() - start);
        }
    }

    function reset() {
        clearTimers();
        lastArgs = lastThis = undefined;
        leadingInvoked = false;
    }

    function onWaitEnd() {
        timer = null;

        if (trailing && lastArgs && !cancelled) {
            invoke();
        }

        if (maxTimer !== null) {
            clearTimeout(maxTimer);
            maxTimer = null;
        }

        leadingInvoked = false;
    }

    function onMaxWait() {
        maxTimer = null;

        if (lastArgs && !cancelled) {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }

            invoke();
            leadingInvoked = true;

            timer = setTimeout(onWaitEnd, wait);
        }
    }

    function debounced(...args) {
        if (signal?.aborted || cancelled) return lastResult;

        metrics.recordCall();

        const time = now();
        const isFirstCall = timer === null;

        lastArgs = args;
        lastThis = this;
        lastCallTime = time;

        if (isFirstCall) {
            if (leading && !leadingInvoked) {
                leadingInvoked = true;
                lastInvokeTime = time;
                invoke();
            }

            timer = setTimeout(onWaitEnd, wait);

            if (maxWait !== undefined && maxTimer === null) {
                maxTimer = setTimeout(onMaxWait, maxWait);
            }
        } else {
            clearTimeout(timer);
            timer = setTimeout(onWaitEnd, wait);
        }

        return lastResult;
    }

    debounced.cancel = () => {
        clearTimers();
        lastArgs = lastThis = undefined;
        leadingInvoked = false;
        cancelled = false;

        metrics.recordCancellation();
    };

    debounced.flush = () => {
        if (timer === null) return lastResult;

        clearTimers();

        if (trailing && lastArgs && !cancelled) {
            return invoke();
        }

        lastArgs = lastThis = undefined;
        leadingInvoked = false;

        return lastResult;
    };

    debounced.pending = () => timer !== null;

    debounced.metrics = () => metrics.snapshot();

    debounced.lastCallTime = () => lastCallTime;
    debounced.lastInvokeTime = () => lastInvokeTime;

    if (signal) {
        if (signal.aborted) {
            cancelled = true;
        } else {
            signal.addEventListener("abort", () => {
                cancelled = true;
                clearTimers();
                lastArgs = lastThis = undefined;
            }, { once: true });
        }
    }

    return debounced;
}

/* ============================================================
 * Adaptive Throttle
 * Automatically adjusts under load
 * ============================================================
 */

export function adaptiveThrottle(
  fn,
  {
    minWait = 16,
    maxWait = 500
  } = {}
) {
  let wait = minWait;
  let lastExecution = 0;

  return (...args) => {
    const now = performance.now();

    if (
      now - lastExecution >= wait
    ) {
      const start =
        performance.now();

      fn(...args);

      const duration =
        performance.now() - start;

      wait = Math.min(
        maxWait,
        Math.max(
          minWait,
          duration * 2
        )
      );

      lastExecution = now;
    }
  };
}

/* ============================================================
 * Token Bucket Rate Limiter
 * ============================================================
 */

export class TokenBucket {
  constructor({
    capacity = 10,
    refillRate = 1
  } = {}) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;

    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();

    const elapsed =
      (now - this.lastRefill) / 1000;

    const refillAmount =
      elapsed * this.refillRate;

    this.tokens = Math.min(
      this.capacity,
      this.tokens + refillAmount
    );

    this.lastRefill = now;
  }

  consume(count = 1) {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }
}

/* ============================================================
 * Idle Scheduler
 * ============================================================
 */

export function scheduleIdle(
  callback,
  timeout = 1000
) {
  if (
    typeof requestIdleCallback ===
    "function"
  ) {
    return requestIdleCallback(
      callback,
      { timeout }
    );
  }

  return setTimeout(
    callback,
    timeout
  );
}

/* ============================================================
 * Promise Queue
 * ============================================================
 */

export class AsyncQueue {
  constructor(concurrency = 1) {
    this.concurrency =
      concurrency;

    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise(
      (resolve, reject) => {
        this.queue.push({
          task,
          resolve,
          reject
        });

        this.next();
      }
    );
  }

  async next() {
    if (
      this.running >=
        this.concurrency ||
      !this.queue.length
    ) {
      return;
    }

    const item =
      this.queue.shift();

    this.running++;

    try {
      const result =
        await item.task();

      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.running--;
      this.next();
    }
  }

  clear() {
    this.queue.length = 0;
  }
}

/* ============================================================
 * Scheduler API Wrapper
 * ============================================================
 */

export async function scheduleTask(
  callback,
  priority = "user-visible"
) {
  if (
    globalThis.scheduler?.postTask
  ) {
    return scheduler.postTask(
      callback,
      { priority }
    );
  }

  return Promise.resolve().then(
    callback
  );
}

/* ============================================================
 * Smart Rate Limit 2.0
 * ============================================================
 */

export function smartRateLimit(
  fn,
  wait = 100,
  options = {}
) {
  const {
    mode = "auto"
  } = options;

  switch (mode) {
    case "debounce":
      return debounce(
        fn,
        wait,
        options
      );

    case "adaptive":
      return adaptiveThrottle(
        fn,
        options
      );

    case "raf":
      return throttleRAF(fn);

    default:
      return wait <= 50
        ? throttleRAF(fn)
        : debounce(
            fn,
            wait,
            options
          );
  }
}
