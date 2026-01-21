/**
 * =====================================================
 * Performance Utilities – Upgraded (2025 Edition)
 * Debounce • Throttle • RAF Throttle • Smart Rate Limit
 * =====================================================
 */

/* ---------------------------------------
 * Debounce (Promise-aware, maxWait-safe)
 * ------------------------------------- */
export function debounce(
  func,
  wait = 0,
  {
    leading = false,
    trailing = true,
    maxWait,
    signal,
  } = {}
) {
  if (typeof func !== "function") {
    throw new TypeError("Expected a function");
  }

  let timeoutId;
  let maxTimeoutId;
  let lastArgs;
  let lastThis;
  let lastInvokeTime = 0;
  let result;

  const invoke = (time) => {
    lastInvokeTime = time;
    result = func.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
    return result;
  };

  const startTimer = (fn, delay) => setTimeout(fn, delay);

  const cancelTimers = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (maxTimeoutId) clearTimeout(maxTimeoutId);
    timeoutId = maxTimeoutId = null;
  };

  const trailingEdge = () => {
    cancelTimers();
    if (trailing && lastArgs) {
      return invoke(Date.now());
    }
    lastArgs = lastThis = null;
    return result;
  };

  const debounced = function (...args) {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;

    const shouldCallNow = leading && !timeoutId;

    if (!timeoutId) {
      timeoutId = startTimer(trailingEdge, wait);

      if (maxWait != null && !maxTimeoutId) {
        maxTimeoutId = startTimer(() => {
          if (timeoutId) trailingEdge();
        }, maxWait);
      }
    }

    if (shouldCallNow) {
      return invoke(now);
    }

    return result;
  };

  debounced.cancel = () => {
    cancelTimers();
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    return timeoutId ? trailingEdge() : result;
  };

  debounced.pending = () => !!timeoutId;

  if (signal) {
    signal.addEventListener("abort", debounced.cancel, { once: true });
  }

  return debounced;
}

/* ---------------------------------------
 * Throttle (Time-based, cancelable)
 * ------------------------------------- */
export function throttle(
  func,
  wait = 0,
  { leading = true, trailing = true } = {}
) {
  let timeoutId = null;
  let lastArgs;
  let lastThis;
  let lastCallTime = 0;

  const invoke = (time) => {
    lastCallTime = time;
    func.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
  };

  const trailingEdge = () => {
    timeoutId = null;
    if (trailing && lastArgs) {
      invoke(Date.now());
    }
  };

  const throttled = function (...args) {
    const now = Date.now();
    if (!lastCallTime && !leading) {
      lastCallTime = now;
    }

    const remaining = wait - (now - lastCallTime);
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      invoke(now);
    } else if (!timeoutId && trailing) {
      timeoutId = setTimeout(trailingEdge, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = lastArgs = lastThis = null;
    lastCallTime = 0;
  };

  throttled.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      trailingEdge();
    }
  };

  return throttled;
}

/* ---------------------------------------
 * Throttle via requestAnimationFrame
 * (Scroll / resize / mousemove)
 * ------------------------------------- */
export function throttleRAF(func) {
  let ticking = false;
  let lastArgs;
  let lastThis;
  let rafId = null;

  const invoke = () => {
    ticking = false;
    func.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
  };

  const throttled = function (...args) {
    lastArgs = args;
    lastThis = this;

    if (!ticking) {
      ticking = true;
      rafId = requestAnimationFrame(invoke);
    }
  };

  throttled.cancel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    ticking = false;
    rafId = lastArgs = lastThis = null;
  };

  return throttled;
}

/* ---------------------------------------
 * Smart Rate Limit
 * Auto-picks best strategy
 * ------------------------------------- */
export function smartRateLimit(func, wait = 0, opts = {}) {
  if (typeof func !== "function") {
    throw new TypeError("Expected a function");
  }

  if (wait <= 0) return throttleRAF(func);
  if (opts.throttle) return throttle(func, wait, opts);
  return debounce(func, wait, opts);
}
