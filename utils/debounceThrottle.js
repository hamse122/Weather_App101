/**
 * =====================================================
 * Performance Utilities – Upgraded (2025 Edition)
 * Debounce • Throttle • RAF Throttle • Advanced Controls
 * =====================================================
 */

/* ---------------------------------------
 * Debounce (Modern, Safe, Promise-aware)
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

  let timeout = null;
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

  const startTimer = (pending, delay) => {
    timeout = setTimeout(pending, delay);
  };

  const shouldInvoke = (time) =>
    lastInvokeTime === 0 ||
    time - lastInvokeTime >= wait ||
    (maxWait && time - lastInvokeTime >= maxWait);

  const trailingEdge = (time) => {
    timeout = null;
    if (trailing && lastArgs) {
      return invoke(time);
    }
    lastArgs = lastThis = null;
    return result;
  };

  const timerExpired = () => {
    const now = Date.now();
    if (shouldInvoke(now)) {
      return trailingEdge(now);
    }
    startTimer(timerExpired, wait - (now - lastInvokeTime));
  };

  const debounced = function (...args) {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;

    if (!timeout) {
      if (leading) {
        invoke(now);
      }
      startTimer(timerExpired, wait);
    }

    return result;
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    return timeout ? trailingEdge(Date.now()) : result;
  };

  debounced.pending = () => !!timeout;

  if (signal) {
    signal.addEventListener("abort", debounced.cancel, { once: true });
  }

  return debounced;
}

/* ---------------------------------------
 * Throttle (Time-based)
 * ------------------------------------- */
export function throttle(
  func,
  wait = 0,
  { leading = true, trailing = true } = {}
) {
  let timeout = null;
  let lastArgs;
  let lastThis;
  let lastCallTime = 0;

  const invoke = (time) => {
    lastCallTime = time;
    func.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
  };

  const trailingEdge = () => {
    timeout = null;
    if (trailing && lastArgs) {
      invoke(Date.now());
    }
  };

  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - lastCallTime);

    lastArgs = args;
    lastThis = this;

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke(now);
    } else if (!timeout && trailing) {
      timeout = setTimeout(trailingEdge, remaining);
    }
  };
}

/* ---------------------------------------
 * Throttle via requestAnimationFrame
 * (Perfect for scroll / resize / mousemove)
 * ------------------------------------- */
export function throttleRAF(func) {
  let ticking = false;
  let lastArgs;
  let lastThis;

  return function (...args) {
    lastArgs = args;
    lastThis = this;

    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        func.apply(lastThis, lastArgs);
      });
    }
  };
}

/* ---------------------------------------
 * Combined Utility
 * Auto picks best strategy
 * ------------------------------------- */
export function smartRateLimit(func, wait = 0, opts = {}) {
  if (wait === 0) return throttleRAF(func);
  if (opts.throttle) return throttle(func, wait, opts);
  return debounce(func, wait, opts);
}
