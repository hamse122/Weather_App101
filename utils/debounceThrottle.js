/**
 * Performance Utility Functions (Optimized Version)
 * Debounce, Throttle & Advanced Debounce Helpers
 */

/**
 * Debounce (simple)
 * Delays execution until user stops triggering for `wait` ms
 */
export function debounce(func, wait = 0, immediate = false) {
  let timeout;

  return function debounced(...args) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const shouldCallNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (shouldCallNow) {
      return func.apply(context, args);
    }
  };
}

/**
 * Throttle (simple)
 * Ensures func runs at most once per `limit` ms
 */
export function throttle(func, limit = 0) {
  let inThrottle = false;

  return function throttled(...args) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Throttle (advanced)
 * Supports { leading: Boolean, trailing: Boolean }
 */
export function throttleAdvanced(func, wait = 0, opts = {}) {
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;

  const leading = opts.leading ?? true;
  const trailing = opts.trailing ?? true;

  const invoke = (time) => {
    lastCallTime = time;
    func.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
  };

  const startTimer = (remaining) => {
    timeout = setTimeout(() => {
      timeout = null;
      if (trailing && lastArgs) invoke(Date.now());
    }, remaining);
  };

  return function throttled(...args) {
    const now = Date.now();

    if (!lastCallTime && !leading) {
      lastCallTime = now;
    }

    const remaining = wait - (now - lastCallTime);
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke(now);
    } else if (!timeout && trailing) {
      startTimer(remaining);
    }
  };
}

/**
 * Advanced Debounce
 * Improved clarity, safety, modern JS.
 */
export function debounceAdvanced(func, wait = 0, options = {}) {
  if (typeof func !== "function") {
    throw new TypeError("Expected a function");
  }

  let timeout = null;
  let lastArgs = null;
  let lastThis = null;
  let result;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  const maxing = "maxWait" in options;

  const maxWait = maxing
    ? Math.max(Number(options.maxWait) || 0, wait)
    : null;

  const invokeFunc = (time) => {
    result = func.apply(lastThis, lastArgs);
    lastInvokeTime = time;
    lastArgs = lastThis = null;
    return result;
  };

  const shouldInvoke = (time) => {
    const timeSinceCall = time - lastCallTime;
    const timeSinceInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceCall >= wait ||
      timeSinceCall < 0 ||
      (maxing && timeSinceInvoke >= maxWait)
    );
  };

  const remainingWait = (time) => {
    const timeSinceCall = time - lastCallTime;
    const timeSinceInvoke = time - lastInvokeTime;

    const waitRemaining = wait - timeSinceCall;
    return maxing
      ? Math.min(waitRemaining, maxWait - timeSinceInvoke)
      : waitRemaining;
  };

  const timerExpired = () => {
    const now = Date.now();
    if (shouldInvoke(now)) {
      return trailingEdge(now);
    }
    timeout = setTimeout(timerExpired, remainingWait(now));
  };

  const leadingEdge = (time) => {
    lastInvokeTime = time;
    timeout = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  };

  const trailingEdge = (time) => {
    timeout = null;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }

    lastArgs = lastThis = null;
    return result;
  };

  const debounced = function (...args) {
    const now = Date.now();

    lastCallTime = now;
    lastArgs = args;
    lastThis = this;

    const shouldCall = shouldInvoke(now);

    if (shouldCall) {
      if (!timeout) {
        return leadingEdge(now);
      }
      if (maxing) {
        timeout = setTimeout(timerExpired, wait);
        return invokeFunc(now);
      }
    }

    if (!timeout) {
      timeout = setTimeout(timerExpired, wait);
    }

    return result;
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = lastArgs = lastThis = lastCallTime = lastInvokeTime = null;
  };

  debounced.flush = () => {
    return timeout ? trailingEdge(Date.now()) : result;
  };

  debounced.pending = () => !!timeout;

  return debounced;
}
