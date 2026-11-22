/**
 * Animation Utility Functions (v4 - Production Ready)
 * Features:
 * - Cross-platform RAF fallback
 * - Advanced easing functions
 * - Accurate pause / resume
 * - Cancellation with Promise resolution
 * - Infinite and finite looping
 * - Reverse and alternate directions
 * - Reduced-motion support
 * - DOM animation helpers
 * - Automatic animation cleanup
 */

/* -------------------- Helpers -------------------- */

export function clamp(value, min = 0, max = 1) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, t) {
    return start + (end - start) * clamp(t);
}

export function inverseLerp(start, end, value) {
    return start === end ? 0 : clamp((value - start) / (end - start));
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
    return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

export function round(value, decimals = 3) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/* -------------------- RAF -------------------- */

const getNow = () =>
    globalThis.performance?.now?.() ?? Date.now();

const raf =
    globalThis.requestAnimationFrame?.bind(globalThis) ??
    (callback => setTimeout(() => callback(getNow()), 16));

const caf =
    globalThis.cancelAnimationFrame?.bind(globalThis) ??
    (id => clearTimeout(id));

/* -------------------- Utilities -------------------- */

const clamp = (value, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));

const lerp = (start, end, progress) =>
    start + (end - start) * progress;

const inverseLerp = (start, end, value) =>
    start === end ? 0 : (value - start) / (end - start);

const mapRange = (value, inMin, inMax, outMin, outMax) =>
    lerp(outMin, outMax, clamp(inverseLerp(inMin, inMax, value)));

/* -------------------- Easing -------------------- */

const easeOutBounce = t => {
    const n = 7.5625;
    const d = 2.75;

    if (t < 1 / d) return n * t * t;

    if (t < 2 / d) {
        t -= 1.5 / d;
        return n * t * t + 0.75;
    }

    if (t < 2.5 / d) {
        t -= 2.25 / d;
        return n * t * t + 0.9375;
    }

    t -= 2.625 / d;
    return n * t * t + 0.984375;
};

const easeInBounce = t => 1 - easeOutBounce(1 - t);

const easeOutElastic = t => {
    if (t === 0 || t === 1) return t;

    return (
        2 ** (-10 * t) *
        Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1
    );
};

const easeInElastic = t => {
    if (t === 0 || t === 1) return t;

    return -(
        2 ** (10 * t - 10) *
        Math.sin((t * 10 - 10.75) * (2 * Math.PI / 3))
    );
};

export const easing = Object.freeze({

    /* Basic */
    linear: t => t,

    /* Quadratic */
    easeInQuad: t => t ** 2,
    easeOutQuad: t => 1 - (1 - t) ** 2,
    easeInOutQuad: t =>
        t < 0.5
            ? 2 * t ** 2
            : 1 - (-2 * t + 2) ** 2 / 2,

    /* Cubic */
    easeInCubic: t => t ** 3,
    easeOutCubic: t => 1 - (1 - t) ** 3,
    easeInOutCubic: t =>
        t < 0.5
            ? 4 * t ** 3
            : 1 - (-2 * t + 2) ** 3 / 2,

    /* Quartic */
    easeInQuart: t => t ** 4,
    easeOutQuart: t => 1 - (1 - t) ** 4,
    easeInOutQuart: t =>
        t < 0.5
            ? 8 * t ** 4
            : 1 - (-2 * t + 2) ** 4 / 2,

    /* Quintic */
    easeInQuint: t => t ** 5,
    easeOutQuint: t => 1 - (1 - t) ** 5,
    easeInOutQuint: t =>
        t < 0.5
            ? 16 * t ** 5
            : 1 - (-2 * t + 2) ** 5 / 2,

    /* Sine */
    easeInSine: t => 1 - Math.cos(t * Math.PI / 2),
    easeOutSine: t => Math.sin(t * Math.PI / 2),
    easeInOutSine: t =>
        -(Math.cos(Math.PI * t) - 1) / 2,

    /* Exponential */
    easeInExpo: t => t === 0 ? 0 : 2 ** (10 * t - 10),
    easeOutExpo: t => t === 1 ? 1 : 1 - 2 ** (-10 * t),
    easeInOutExpo: t => {
        if (t === 0 || t === 1) return t;

        return t < 0.5
            ? 2 ** (20 * t - 10) / 2
            : (2 - 2 ** (-20 * t + 10)) / 2;
    },

    /* Circular */
    easeInCirc: t => 1 - Math.sqrt(1 - t ** 2),
    easeOutCirc: t => Math.sqrt(1 - (t - 1) ** 2),
    easeInOutCirc: t =>
        t < 0.5
            ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
            : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,

    /* Back */
    easeInBack: t => {
        const c = 1.70158;
        return (c + 1) * t ** 3 - c * t ** 2;
    },

    easeOutBack: t => {
        const c = 1.70158;
        return 1 + (c + 1) * (t - 1) ** 3 +
            c * (t - 1) ** 2;
    },

    easeInOutBack: t => {
        const c = 1.70158 * 1.525;

        return t < 0.5
            ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2
            : ((2 * t - 2) ** 2 *
                ((c + 1) * (2 * t - 2) + c) + 2) / 2;
    },

    /* Bounce */
    easeInBounce,
    easeOutBounce,
    easeInOutBounce: t =>
        t < 0.5
            ? (1 - easeOutBounce(1 - 2 * t)) / 2
            : (1 + easeOutBounce(2 * t - 1)) / 2,

    /* Elastic */
    easeInElastic,
    easeOutElastic,

    easeInOutElastic: t => {
        if (t === 0 || t === 1) return t;

        const c = (2 * Math.PI) / 4.5;

        return t < 0.5
            ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * c)) / 2
            : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * c)) / 2 + 1;
    }
});

/* -------------------- Animation Engine -------------------- */

export function animate({
    from = 0,
    to = 1,
    duration = 1000,
    easing: easingName = "easeOutCubic",
    onUpdate = () => {},
    onComplete = () => {},
    onCancel = () => {},
    signal
} = {}) {
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
        throw new TypeError("Animation values must be finite numbers");
    }

    if (!Number.isFinite(duration) || duration < 0) {
        throw new RangeError("Duration must be a non-negative number");
    }

    if (typeof onUpdate !== "function" ||
        typeof onComplete !== "function" ||
        typeof onCancel !== "function") {
        throw new TypeError("Animation callbacks must be functions");
    }

    const ease = typeof easingName === "function"
        ? easingName
        : easing[easingName];

    if (typeof ease !== "function") {
        throw new Error(`Unknown easing function: ${easingName}`);
    }

    let frameId = null;
    let cancelled = false;
    let startedAt = null;

    const cleanup = () => {
        if (frameId !== null) {
            caf(frameId);
            frameId = null;
        }

        signal?.removeEventListener("abort", cancel);
    };

    const cancel = () => {
        if (cancelled) return;

        cancelled = true;
        cleanup();
        onCancel();
    };

    const finish = () => {
        if (cancelled) return;

        cleanup();
        onComplete(to);
    };

    const tick = timestamp => {
        if (cancelled) return;

        if (startedAt === null) startedAt = timestamp;

        const elapsed = Math.max(0, timestamp - startedAt);
        const progress = duration === 0
            ? 1
            : clamp(elapsed / duration);

        const eased = ease(progress);

        onUpdate(lerp(from, to, eased), progress);

        if (progress >= 1) {
            finish();
            return;
        }

        frameId = raf(tick);
    };

    if (signal?.aborted) {
        cancelled = true;
        onCancel();
    } else if (duration === 0) {
        onUpdate(to, 1);
        finish();
    } else {
        signal?.addEventListener("abort", cancel, { once: true });
        frameId = raf(tick);
    }

    return Object.freeze({
        cancel,
        get cancelled() {
            return cancelled;
        }
    });
}

/* -------------------- Exports -------------------- */

export const animationUtils = Object.freeze({
    getNow,
    raf,
    caf,
    clamp,
    lerp,
    inverseLerp,
    mapRange,
    animate,
    easing
});

/* -------------------- Core Animation -------------------- */

export function animate({
    from = 0,
    to = 1,
    duration = 300,
    delay = 0,
    easingFn = easing.linear,
    loop = 0,
    direction = "normal",
    onUpdate,
    onComplete,
    onCancel,
    onError,
    signal,
    respectReducedMotion = false
} = {}) {
    if (!Number.isFinite(duration) || duration < 0) {
        throw new RangeError("Duration must be a non-negative number");
    }

    if (!Number.isFinite(delay) || delay < 0) {
        throw new RangeError("Delay must be a non-negative number");
    }

    if (!["normal", "reverse", "alternate"].includes(direction)) {
        throw new TypeError("Invalid animation direction");
    }

    if (typeof easingFn !== "function") {
        throw new TypeError("easingFn must be a function");
    }

    if (typeof onUpdate === "function" && !Number.isFinite(from + to)) {
        throw new TypeError("Animation values must be finite numbers");
    }

    const reduced =
        respectReducedMotion &&
        globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const totalLoops = loop === Infinity
        ? Infinity
        : Math.max(1, Math.floor(loop) + 1);

    let frameId = null;
    let startTime = null;
    let pausedAt = null;
    let elapsedBeforePause = 0;
    let loopsDone = 0;
    let cancelled = false;
    let settled = false;
    let reversed = direction === "reverse";

    let resolvePromise;
    let rejectPromise;

    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    const cleanup = () => {
        if (frameId !== null) {
            caf(frameId);
            frameId = null;
        }

        signal?.removeEventListener("abort", abortHandler);
    };

    const finish = (status, error = null) => {
        if (settled) return;

        settled = true;
        cleanup();

        if (status === "completed") {
            try {
                onComplete?.();
                resolvePromise({ status, loops: loopsDone });
            } catch (err) {
                rejectPromise(err);
            }
        } else if (status === "cancelled") {
            onCancel?.();
            resolvePromise({ status, loops: loopsDone });
        } else {
            onError?.(error);
            rejectPromise(error);
        }
    };

    const cancel = () => {
        if (settled) return;
        cancelled = true;
        finish("cancelled");
    };

    const abortHandler = () => cancel();

    const tick = now => {
        if (settled || cancelled || pausedAt !== null) return;

        try {
            if (startTime === null) startTime = now;

            const elapsed = now - startTime + elapsedBeforePause;

            if (elapsed < delay) {
                frameId = raf(tick);
                return;
            }

            const progress = duration === 0
                ? 1
                : clamp((elapsed - delay) / duration);

            const eased = clamp(easingFn(progress), -Infinity, Infinity);
            const t = reversed ? 1 - eased : eased;

            onUpdate?.(lerp(from, to, t), progress);

            if (progress >= 1) {
                loopsDone++;

                if (loopsDone >= totalLoops) {
                    finish("completed");
                    return;
                }

                elapsedBeforePause = 0;
                startTime = null;

                if (direction === "alternate") {
                    reversed = !reversed;
                }
            }

            frameId = raf(tick);
        } catch (error) {
            finish("error", error);
        }
    };

    const controller = {
        promise,

        cancel,

        pause() {
            if (settled || pausedAt !== null) return;

            pausedAt = getNow();

            if (frameId !== null) {
                caf(frameId);
                frameId = null;
            }
        },

        resume() {
            if (settled || pausedAt === null) return;

            if (startTime !== null) {
                elapsedBeforePause += pausedAt - startTime;
                startTime = null;
            }

            pausedAt = null;
            frameId = raf(tick);
        },

        get status() {
            if (settled) return cancelled ? "cancelled" : "finished";
            return pausedAt !== null ? "paused" : "running";
        }
    };

    if (signal?.aborted) {
        cancel();
        return controller;
    }

    signal?.addEventListener("abort", abortHandler, { once: true });

    if (reduced || duration === 0) {
        try {
            onUpdate?.(direction === "reverse" ? from : to, 1);
            loopsDone = 1;
            finish("completed");
        } catch (error) {
            finish("error", error);
        }
    } else {
        frameId = raf(tick);
    }

    return controller;
}

/* -------------------- DOM Animations -------------------- */

function validateElement(el) {
    return !!el && typeof el.style === "object";
}

export function fadeIn(el, duration = 300, options = {}) {
    if (!validateElement(el)) return Promise.resolve();

    el.style.display = options.display ?? "block";
    el.style.opacity = "0";

    const animation = animate({
        from: 0,
        to: 1,
        duration,
        easingFn: easing.easeInOutCubic,
        onUpdate: value => {
            el.style.opacity = String(value);
        },
        ...options
    });

    return animation.promise;
}

export function fadeOut(el, duration = 300, options = {}) {
    if (!validateElement(el)) return Promise.resolve();

    const animation = animate({
        from: Number.parseFloat(el.style.opacity || "1"),
        to: 0,
        duration,
        easingFn: easing.easeInOutCubic,
        onUpdate: value => {
            el.style.opacity = String(value);
        },
        onComplete: () => {
            el.style.display = "none";
            options.onComplete?.();
        },
        ...options
    });

    return animation.promise;
}

export function slideY(el, from, to, duration = 300, options = {}) {
    if (!validateElement(el)) return Promise.resolve();

    const previous = el.style.willChange;
    el.style.willChange = "transform";

    const animation = animate({
        from,
        to,
        duration,
        easingFn: easing.easeOutCubic,
        onUpdate: value => {
            el.style.transform = `translate3d(0, ${value}px, 0)`;
        },
        onComplete: () => {
            el.style.willChange = previous;
            options.onComplete?.();
        },
        onCancel: () => {
            el.style.willChange = previous;
            options.onCancel?.();
        },
        ...options
    });

    return animation;
}

/* -------------------- Scale Animation -------------------- */

export function scale(el, from = 0, to = 1, duration = 300, options = {}) {
    if (!validateElement(el)) return null;

    return animate({
        from,
        to,
        duration,
        easingFn: easing.easeOutBack,
        onUpdate: value => {
            el.style.transform = `scale(${value})`;
        },
        ...options
    });
}

/* -------------------- Cleanup -------------------- */

export function cancelAnimations(animations = []) {
    for (const animation of animations) {
        animation?.cancel?.();
    }
}
