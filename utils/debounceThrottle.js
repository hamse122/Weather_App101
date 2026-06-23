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
 * Advanced Debounce
 * ============================================================
 */

export function debounce(
  fn,
  wait = 0,
  options = {}
) {
  const metrics = new PerformanceMetrics();

  let timer = null;
  let lastArgs;
  let lastThis;

  const {
    leading = false,
    trailing = true,
    signal
  } = options;

  const invoke = () => {
    const start = performance.now();

    const result = fn.apply(
      lastThis,
      lastArgs
    );

    metrics.recordExecution(
      performance.now() - start
    );

    lastArgs = lastThis = null;

    return result;
  };

  const debounced = function (...args) {
    metrics.recordCall();

    lastArgs = args;
    lastThis = this;

    const callNow =
      leading && !timer;

    clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;

      if (trailing && lastArgs) {
        invoke();
      }
    }, wait);

    if (callNow) {
      return invoke();
    }
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;

    metrics.recordCancellation();
  };

  debounced.metrics = () =>
    metrics.snapshot();

  signal?.addEventListener(
    "abort",
    debounced.cancel
  );

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
