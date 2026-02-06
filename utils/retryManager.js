/**
 * Retry Manager Utility (Upgraded)
 * Robust retry handling with backoff, jitter, timeout, and abort support
 */

export class RetryManager {
    static async execute(fn, options = {}) {
        const {
            retries = 3,
            initialDelay = 1000,
            maxDelay = 30_000,
            backoff = 'exponential', // exponential | linear | fixed
            backoffMultiplier = 2,
            jitter = true,
            timeout = null, // ms per attempt
            signal = null, // AbortSignal
            onRetry = null,
            shouldRetry = null
        } = options;

        let attempt = 0;
        let delay = initialDelay;
        let lastError;

        const abortIfNeeded = () => {
            if (signal?.aborted) {
                throw new DOMException('Retry aborted', 'AbortError');
            }
        };

        while (attempt <= retries) {
            abortIfNeeded();

            try {
                return await this.withTimeout(fn, timeout);
            } catch (error) {
                lastError = error;

                abortIfNeeded();

                const retryAllowed = shouldRetry
                    ? await shouldRetry(error, attempt)
                    : true;

                if (!retryAllowed || attempt === retries) {
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

                await this.sleep(finalDelay);

                if (backoff === 'exponential') {
                    delay *= backoffMultiplier;
                } else if (backoff === 'linear') {
                    delay += initialDelay;
                }

                delay = Math.min(delay, maxDelay);
                attempt++;
            }
        }

        throw lastError;
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static applyJitter(delay) {
        const variance = delay * 0.3;
        return delay - variance + Math.random() * variance * 2;
    }

    static async withTimeout(fn, timeout) {
        if (!timeout) return fn();

        return Promise.race([
            fn(),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error('Retry attempt timed out')),
                    timeout
                )
            )
        ]);
    }

    static createRetryable(fn, options = {}) {
        return (...args) =>
            RetryManager.execute(() => fn(...args), options);
    }
}

/**
 * Retryable decorator for class methods
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
