/**
 * Advanced Retry Manager (Production Ready)
 */

export class RetryManager {
    static async execute(fn, options = {}) {
        const {
            retries = 3,
            initialDelay = 1000,
            maxDelay = 30000,
            backoff = 'exponential', // exponential | linear | fixed
            backoffMultiplier = 2,
            jitter = true,
            timeout = null,
            signal = null,
            maxTotalTime = null,

            // hooks
            onRetry = null,
            onSuccess = null,
            onFailure = null,

            // logic
            shouldRetry = RetryManager.defaultShouldRetry
        } = options;

        let attempt = 0;
        let delay = initialDelay;
        let startTime = Date.now();
        let lastError;

        const abortIfNeeded = () => {
            if (signal?.aborted) {
                throw new DOMException('Retry aborted', 'AbortError');
            }
        };

        while (attempt <= retries) {
            abortIfNeeded();

            // check total time limit
            if (maxTotalTime && Date.now() - startTime > maxTotalTime) {
                throw new Error('Retry total time exceeded');
            }

            try {
                const result = await this.withTimeout(fn, timeout, signal);

                onSuccess?.({
                    attempt: attempt + 1,
                    retries
                });

                return result;

            } catch (error) {
                lastError = error;

                abortIfNeeded();

                const retryAllowed = await shouldRetry(error, attempt);

                if (!retryAllowed || attempt === retries) {
                    onFailure?.({
                        error,
                        attempt: attempt + 1
                    });
                    throw error;
                }

                const finalDelay = jitter
                    ? this.applyJitter(delay)
                    : delay;

                onRetry?.({
                    error,
                    attempt: attempt + 1,
                    retries,
                    nextDelay: finalDelay
                });

                await this.sleep(finalDelay, signal);

                delay = this.calculateNextDelay(
                    delay,
                    initialDelay,
                    backoff,
                    backoffMultiplier,
                    maxDelay
                );

                attempt++;
            }
        }

        throw lastError;
    }

    /**
     * Delay with Abort support
     */
    static sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(resolve, ms);

            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(id);
                    reject(new DOMException('Sleep aborted', 'AbortError'));
                }, { once: true });
            }
        });
    }

    /**
     * Backoff calculation
     */
    static calculateNextDelay(delay, initialDelay, backoff, multiplier, maxDelay) {
        let next;

        switch (backoff) {
            case 'exponential':
                next = delay * multiplier;
                break;
            case 'linear':
                next = delay + initialDelay;
                break;
            case 'fixed':
            default:
                next = delay;
        }

        return Math.min(next, maxDelay);
    }

    /**
     * Jitter (prevents thundering herd problem)
     */
    static applyJitter(delay) {
        const variance = delay * 0.3;
        return delay - variance + Math.random() * variance * 2;
    }

    /**
     * Timeout with cleanup
     */
    static async withTimeout(fn, timeout, signal) {
        if (!timeout) return fn();

        let timer;

        return new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                reject(new Error('Retry attempt timed out'));
            }, timeout);

            Promise.resolve()
                .then(fn)
                .then((res) => {
                    clearTimeout(timer);
                    resolve(res);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });

            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }
        });
    }

    /**
     * Default retry logic (smart)
     */
    static defaultShouldRetry(error) {
        // Network errors
        if (error?.name === 'AbortError') return false;

        // Timeout errors
        if (error?.message?.includes('timed out')) return true;

        // Fetch/network issues
        if (error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND') {
            return true;
        }

        // HTTP errors (if attached)
        if (error?.status) {
            return error.status >= 500; // retry only server errors
        }

        return true;
    }

    /**
     * Wrap function
     */
    static createRetryable(fn, options = {}) {
        return (...args) =>
            RetryManager.execute(() => fn(...args), options);
    }
}

/**
 * Decorator
 */
export function retryable(options = {}) {
    return function (target, propertyKey, descriptor) {
        const original = descriptor.value;

        descriptor.value = function (...args) {
            return RetryManager.execute(
                () => original.apply(this, args),
                options
            );
        };

        return descriptor;
    };
}
