/**
 * Animation Utility Functions
 * Provides useful animation and timing functions
 */

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {number}
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Ease-in-out cubic function
 * @param {number} t - Input value (0 to 1)
 * @returns {number}
 */
export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animate a value over time
 * @param {(value: number) => void} callback - Receives the current animated value
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Duration in ms
 * @param {(t: number) => number} easing - Easing function
 * @returns {Promise<void>}
 */
export function animate(callback, start, end, duration, easing = (t) => t) {
  return new Promise((resolve) => {
    const startTime = performance.now();

    const loop = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easing(progress);
      const currentValue = lerp(start, end, eased);

      callback(currentValue);

      if (progress < 1) {
        requestAnimationFrame(loop);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(loop);
  });
}

/**
 * Fade in an element
 * @param {HTMLElement} element
 * @param {number} duration
 * @returns {Promise<void>}
 */
export function fadeIn(element, duration = 300) {
  if (!element) return Promise.resolve();

  element.style.opacity = 0;
  element.style.display = element.style.display || 'block';
  
  return animate(
    (value) => {
      element.style.opacity = value.toString();
    },
    0,
    1,
    duration,
    easeInOutCubic
  );
}

/**
 * Fade out an element
 * @param {HTMLElement} element
 * @param {number} duration
 * @returns {Promise<void>}
 */
export function fadeOut(element, duration = 300) {
  if (!element) return Promise.resolve();

  return animate(
    (value) => {
      element.style.opacity = value.toString();
    },
    1,
    0,
    duration,
    easeInOutCubic
  ).then(() => {
    element.style.display = 'none';
  });
}
