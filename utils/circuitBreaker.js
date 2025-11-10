/**
 * Circuit Breaker Utility
 * Circuit breaker pattern for preventing cascading failures
 */

/**
 * CircuitBreaker class for implementing circuit breaker pattern
 */
export class CircuitBreaker {
    constructor(fn, options = {}) {
        this.fn = fn;
        this.threshold = options.threshold || 5;
        this.timeout = options.timeout || 60000;
        this.resetTimeout = options.resetTimeout || 30000;
        
        this.failureCount = 0;
        this.state = 'CLOSED';
        this.nextAttempt = Date.now();
        this.successCount = 0;
    }
    
    /**
     * Execute the function with circuit breaker
     * @param {...any} args - Function arguments
     * @returns {Promise} - Promise that resolves with function result
     */
    async execute(...args) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
            this.successCount = 0;
        }
        
        try {
            const result = await Promise.race([
                this.fn(...args),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), this.timeout))
            ]);
            
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    /**
     * Handle successful execution
     */
    onSuccess() {
        this.failureCount = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.threshold) {
                this.state = 'CLOSED';
                this.successCount = 0;
            }
        }
    }
    
    /**
     * Handle failed execution
     */
    onFailure() {
        this.failureCount++;
        
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
        }
    }
    
    /**
     * Get current state
     * @returns {Object} - Current state information
     */
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            nextAttempt: this.nextAttempt
        };
    }
    
    /**
     * Reset circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();
    }
}

/**
 * Create a circuit breaker for a function
 * @param {Function} fn - Function to protect
 * @param {Object} options - Circuit breaker options
 * @returns {CircuitBreaker} - Circuit breaker instance
 */
export function createCircuitBreaker(fn, options = {}) {
    return new CircuitBreaker(fn, options);
}
