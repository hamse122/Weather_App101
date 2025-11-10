/**
 * Error Handler Utility
 * Centralized error handling and logging system
 */

/**
 * ErrorHandler class for managing errors
 */
export class ErrorHandler {
    constructor() {
        this.handlers = new Map();
        this.logger = null;
    }
    
    /**
     * Set custom logger function
     * @param {Function} logger - Logger function
     */
    setLogger(logger) {
        this.logger = logger;
    }
    
    /**
     * Register an error handler for a specific error type
     * @param {string} errorType - Error type
     * @param {Function} handler - Handler function
     */
    registerHandler(errorType, handler) {
        this.handlers.set(errorType, handler);
    }
    
    /**
     * Handle an error
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    handle(error, context = {}) {
        const errorType = error.constructor.name;
        const handler = this.handlers.get(errorType) || this.handlers.get('default');
        
        if (this.logger) {
            this.logger({
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    type: errorType
                },
                context,
                timestamp: new Date().toISOString()
            });
        }
        
        if (handler) {
            return handler(error, context);
        }
        
        console.error('Unhandled error:', error, context);
        return null;
    }
    
    /**
     * Wrap a function with error handling
     * @param {Function} fn - Function to wrap
     * @param {Object} context - Error context
     * @returns {Function} - Wrapped function
     */
    wrap(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                return this.handle(error, { ...context, args });
            }
        };
    }
    
    /**
     * Create error with context
     * @param {string} message - Error message
     * @param {Object} context - Error context
     * @param {Error} originalError - Original error
     * @returns {Error} - Enhanced error
     */
    createError(message, context = {}, originalError = null) {
        const error = new Error(message);
        error.context = context;
        error.originalError = originalError;
        error.timestamp = new Date().toISOString();
        return error;
    }
    
    /**
     * Retry a function with error handling
     * @param {Function} fn - Function to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} delay - Delay between retries in milliseconds
     * @returns {Promise} - Promise that resolves with function result
     */
    async retry(fn, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }
}

// Global error handler instance
export const errorHandler = new ErrorHandler();
