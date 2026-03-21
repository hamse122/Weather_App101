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
  linear: (t) => t,
  easeInCubic: (t) => t ** 3,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) =>
    t < 0.5
      ? 4 * t ** 3
      : 1 - ((-2 * t + 2) ** 3) / 2,
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
