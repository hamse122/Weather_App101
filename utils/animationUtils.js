/**
 * Animation Utility Functions
 * Provides useful animation and timing functions
 */

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {number} - Interpolated value
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Ease-in-out cubic function
 * @param {number} t - Input value (0 to 1)
 * @returns {number} - Eased value
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animate a value over time
 * @param {Function} callback - Callback function that receives the current value
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Duration in milliseconds
 * @param {Function} easing - Easing function (default: linear)
 * @returns {Promise<void>} - Promise that resolves when animation completes
 */
export function animate(callback, start, end, duration, easing = (t) => t) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const animateFrame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const currentValue = lerp(start, end, easedProgress);
      
      callback(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        resolve();
      }
    };
    animateFrame();
  });
}

/**
 * Fade in effect for an element
 * @param {HTMLElement} element - The element to fade in
 * @param {number} duration - Duration in milliseconds (default: 300)
 * @returns {Promise<void>} - Promise that resolves when animation completes
 */
export function fadeIn(element, duration = 300) {
  element.style.opacity = '0';
  element.style.display = 'block';
  
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
 * Fade out effect for an element
 * @param {HTMLElement} element - The element to fade out
 * @param {number} duration - Duration in milliseconds (default: 300)
 * @returns {Promise<void>} - Promise that resolves when animation completes
 */
export function fadeOut(element, duration = 300) {
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

