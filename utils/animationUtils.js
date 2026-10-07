/**
 * Animation Utility Functions (v3 - Advanced)
 */

/* -------------------- Helpers -------------------- */

export function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, t) {
  return start + (end - start) * clamp(t);
}

/* -------------------- RAF -------------------- */

const raf =
  window.requestAnimationFrame?.bind(window) ||
  ((cb) => setTimeout(() => cb(performance.now()), 16));

const caf =
  window.cancelAnimationFrame?.bind(window) ||
  clearTimeout;

/* -------------------- Easing -------------------- */

export const easing = {
  // Linear
  linear: (t) => t,

  // Quadratic
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) ** 2,
  easeInOutQuad: (t) =>
    t < 0.5
      ? 2 * t ** 2
      : 1 - ((-2 * t + 2) ** 2) / 2,

  // Cubic
  easeInCubic: (t) => t ** 3,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) =>
    t < 0.5
      ? 4 * t ** 3
      : 1 - ((-2 * t + 2) ** 3) / 2,

  // Quartic
  easeInQuart: (t) => t ** 4,
  easeOutQuart: (t) => 1 - (1 - t) ** 4,
  easeInOutQuart: (t) =>
    t < 0.5
      ? 8 * t ** 4
      : 1 - ((-2 * t + 2) ** 4) / 2,

  // Quintic
  easeInQuint: (t) => t ** 5,
  easeOutQuint: (t) => 1 - (1 - t) ** 5,
  easeInOutQuint: (t) =>
    t < 0.5
      ? 16 * t ** 5
      : 1 - ((-2 * t + 2) ** 5) / 2,

  // Sine
  easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Exponential
  easeInExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? 2 ** (20 * t - 10) / 2
      : (2 - 2 ** (-20 * t + 10)) / 2;
  },

  // Circular
  easeInCirc: (t) => 1 - Math.sqrt(1 - t ** 2),
  easeOutCirc: (t) => Math.sqrt(1 - (t - 1) ** 2),
  easeInOutCirc: (t) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,

  // Back
  easeInBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t ** 3 - c1 * t ** 2;
  },

  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },

  easeInOutBack: (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;

    return t < 0.5
      ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
      : (((2 * t - 2) ** 2 *
          ((c2 + 1) * (t * 2 - 2) + c2) +
          2) /
          2);
  },

  // Elastic
  easeInElastic: (t) => {
    if (t === 0 || t === 1) return t;

    const c4 = (2 * Math.PI) / 3;

    return -(2 ** (10 * t - 10)) *
      Math.sin((t * 10 - 10.75) * c4);
  },

  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;

    const c4 = (2 * Math.PI) / 3;

    return (
      2 ** (-10 * t) *
        Math.sin((t * 10 - 0.75) * c4) +
      1
    );
  },

  easeInOutElastic: (t) => {
    if (t === 0 || t === 1) return t;

    const c5 = (2 * Math.PI) / 4.5;

    return t < 0.5
      ? -(2 ** (20 * t - 10) *
          Math.sin((20 * t - 11.125) * c5)) /
          2
      : (2 ** (-20 * t + 10) *
          Math.sin((20 * t - 11.125) * c5)) /
          2 +
          1;
  },

  // Bounce
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    }

    if (t < 2 / d1) {
      t -= 1.5 / d1;
      return n1 * t * t + 0.75;
    }

    if (t < 2.5 / d1) {
      t -= 2.25 / d1;
      return n1 * t * t + 0.9375;
    }

    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  },

  easeInBounce: (t) =>
    1 - easing.easeOutBounce(1 - t),

  easeInOutBounce: (t) =>
    t < 0.5
      ? (1 - easing.easeOutBounce(1 - 2 * t)) / 2
      : (1 + easing.easeOutBounce(2 * t - 1)) / 2,
};

/* -------------------- Core Animation -------------------- */

export function animate({
  from = 0,
  to = 1,
  duration = 300,
  delay = 0,
  easingFn = easing.linear,
  loop = 0, // number or Infinity
  direction = 'normal', // normal | reverse | alternate
  onUpdate,
  onComplete,
} = {}) {
  let startTime = null;
  let frameId = null;
  let paused = false;
  let cancelled = false;
  let loopsDone = 0;
  let reversed = direction === 'reverse';

  let pauseTime = 0;

  const promise = new Promise((resolve) => {
    function loopFrame(now) {
      if (cancelled) return;

      if (paused) {
        frameId = raf(loopFrame);
        return;
      }

      if (!startTime) startTime = now;

      const elapsed = now - startTime - delay;

      if (elapsed < 0) {
        frameId = raf(loopFrame);
        return;
      }

      let progress = clamp(elapsed / duration);
      let eased = easingFn(progress);

      const t = reversed ? 1 - eased : eased;
      const value = lerp(from, to, t);

      onUpdate?.(value, progress);

      if (progress < 1) {
        frameId = raf(loopFrame);
      } else {
        loopsDone++;

        if (loopsDone < loop || loop === Infinity) {
          startTime = null;

          if (direction === 'alternate') {
            reversed = !reversed;
          }

          frameId = raf(loopFrame);
        } else {
          onComplete?.();
          resolve();
        }
      }
    }

    frameId = raf(loopFrame);
  });

  return {
    promise,

    cancel() {
      cancelled = true;
      caf(frameId);
    },

    pause() {
      if (!paused) {
        paused = true;
      }
    },

    resume() {
      if (paused) {
        paused = false;
      }
    },
  };
}

/* -------------------- DOM Animations -------------------- */

export function fadeIn(el, duration = 300) {
  if (!el) return Promise.resolve();

  el.style.opacity = '0';
  el.style.display ||= 'block';

  return animate({
    from: 0,
    to: 1,
    duration,
    easingFn: easing.easeInOutCubic,
    onUpdate: (v) => (el.style.opacity = v),
  }).promise;
}

export function fadeOut(el, duration = 300) {
  if (!el) return Promise.resolve();

  return animate({
    from: 1,
    to: 0,
    duration,
    easingFn: easing.easeInOutCubic,
    onUpdate: (v) => (el.style.opacity = v),
    onComplete: () => {
      el.style.display = 'none';
    },
  }).promise;
}

export function slideY(el, from, to, duration = 300) {
  if (!el) return;

  el.style.willChange = 'transform';

  return animate({
    from,
    to,
    duration,
    easingFn: easing.easeOutCubic,
    onUpdate: (v) => {
      el.style.transform = `translate3d(0, ${v}px, 0)`;
    },
    onComplete: () => {
      el.style.willChange = 'auto';
    },
  });
}
