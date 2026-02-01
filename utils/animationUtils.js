/**
 * Animation Utility Functions (Upgraded)
 * Robust, cancelable, and production-ready
 */

/* -------------------- Helpers -------------------- */

/**
 * Clamp a number between min and max
 */
export function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + (end - start) * clamp(t);
}

/**
 * requestAnimationFrame fallback
 */
const raf =
  window.requestAnimationFrame ||
  ((cb) => setTimeout(() => cb(performance.now()), 16));

/* -------------------- Easing -------------------- */

export const easing = {
  linear: (t) => t,

  easeInCubic: (t) => t * t * t,

  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),

  easeInOutCubic: (t) =>
    t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

/* -------------------- Core Animation -------------------- */

/**
 * Animate a value over time (Cancelable)
 */
export function animate({
  from,
  to,
  duration = 300,
  easingFn = easing.linear,
  onUpdate,
  onComplete,
}) {
  let startTime = null;
  let cancelled = false;

  function loop(now) {
    if (cancelled) return;

    if (!startTime) startTime = now;

    const elapsed = now - startTime;
    const progress = clamp(elapsed / duration);
    const eased = easingFn(progress);
    const value = lerp(from, to, eased);

    onUpdate?.(value);

    if (progress < 1) {
      raf(loop);
    } else {
      onComplete?.();
    }
  }

  raf(loop);

  return {
    cancel() {
      cancelled = true;
    },
  };
}

/* -------------------- DOM Animations -------------------- */

/**
 * Fade in element
 */
export function fadeIn(element, duration = 300) {
  if (!element) return Promise.resolve();

  element.style.opacity = '0';
  element.style.display ||= 'block';

  return new Promise((resolve) => {
    animate({
      from: 0,
      to: 1,
      duration,
      easingFn: easing.easeInOutCubic,
      onUpdate: (v) => (element.style.opacity = v),
      onComplete: resolve,
    });
  });
}

/**
 * Fade out element
 */
export function fadeOut(element, duration = 300) {
  if (!element) return Promise.resolve();

  return new Promise((resolve) => {
    animate({
      from: 1,
      to: 0,
      duration,
      easingFn: easing.easeInOutCubic,
      onUpdate: (v) => (element.style.opacity = v),
      onComplete: () => {
        element.style.display = 'none';
        resolve();
      },
    });
  });
}

/**
 * Slide Y animation (extra utility)
 */
export function slideY(element, from, to, duration = 300) {
  if (!element) return;

  element.style.willChange = 'transform';

  return animate({
    from,
    to,
    duration,
    easingFn: easing.easeOutCubic,
    onUpdate: (v) => {
      element.style.transform = `translateY(${v}px)`;
    },
    onComplete: () => {
      element.style.willChange = 'auto';
    },
  });
}
