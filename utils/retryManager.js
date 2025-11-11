/**
 * Retry Manager Utility
 * Retry manager for handling failed operations with exponential backoff
 */

/**
 * RetryManager class for managing retry logic
 */
export class RetryManager {
    /**
     * Execute a function with retry logic
     * @param {Function} fn - Function to execute
     * @param {Object} options - Retry options
     * @returns {Promise} - Promise that resolves with function result
     */
    static async execute(fn, options = {}) {
        const {
            maxRetries = 3,
            delay = 1000,
            backoff = 'exponential',
            backoffMultiplier = 2,
            onRetry = null,
            shouldRetry = null
        } = options;
        
        let lastError;
        let currentDelay = delay;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (shouldRetry && !shouldRetry(error, attempt)) {
                    throw error;
                }
                
                if (attempt < maxRetries) {
                    if (onRetry) {
                        onRetry(error, attempt + 1, maxRetries);
                    }
                    
                    await this.delay(currentDelay);
                    
                    if (backoff === 'exponential') {
                        currentDelay *= backoffMultiplier;
                    } else if (backoff === 'linear') {
                        currentDelay += delay;
                    }
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Delay execution
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after delay
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Create a retryable function
     * @param {Function} fn - Function to make retryable
     * @param {Object} options - Retry options
     * @returns {Function} - Retryable function
     */
    static createRetryable(fn, options = {}) {
        return (...args) => this.execute(() => fn(...args), options);
    }
}

/**
 * Retryable decorator for class methods
 */
export function retryable(options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args) {
            return RetryManager.execute(() => originalMethod.apply(this, args), options);
        };
        return descriptor;
    };
}
