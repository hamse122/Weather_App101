/**
 * Debounce and Throttle Utility Functions
 * Provides performance optimization functions for event handling
 */

/**
 * Debounce a function - delays execution until after wait time has passed
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - If true, trigger on leading edge instead of trailing
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

/**
 * Throttle a function - limits execution to at most once per wait time
 * @param {Function} func - The function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Debounce with leading and trailing options
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Options object with leading and trailing flags
 * @returns {Function} - Debounced function
 */
export function debounceAdvanced(func, wait, options = {}) {
  let timeout;
  let maxWait;
  let maxWaitTimeout;
  let lastCallTime;
  let lastInvokeTime = 0;
  let leading = false;
  let maxing = false;
  let trailing = true;

  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }

  wait = Number(wait) || 0;
  if (typeof options === 'object') {
    leading = !!options.leading;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
    maxing = 'maxWait' in options;
    maxWait = maxing ? Math.max(Number(options.maxWait) || 0, wait) : maxWait;
  }

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeout = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxing
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeout = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timeout = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    if (maxWaitTimeout !== undefined) {
      clearTimeout(maxWaitTimeout);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeout = undefined;
  }

  function flush() {
    return timeout === undefined ? result : trailingEdge(Date.now());
  }

  function pending() {
    return timeout !== undefined;
  }

  let lastArgs, lastThis, result;
  return {
    cancel,
    flush,
    pending,
    (...args) => {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);

      lastArgs = args;
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timeout === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (maxing) {
          timeout = setTimeout(timerExpired, wait);
          return invokeFunc(lastCallTime);
        }
      }
      if (timeout === undefined) {
        timeout = setTimeout(timerExpired, wait);
      }
      return result;
    },
  };
}

