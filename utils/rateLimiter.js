/**
 * Rate Limiter Utility
 * Rate limiting system for controlling request frequency
 */

/**
 * RateLimiter class for managing rate limits
 */
export class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = new Map();
    }
    
    /**
     * Check if a request is allowed
     * @param {string} key - Unique identifier for the requester
     * @returns {Object} - Object with allowed status, remaining requests, and reset time
     */
    check(key) {
        const now = Date.now();
        const userRequests = this.requests.get(key) || [];
        
        // Clean old requests
        const recentRequests = userRequests.filter(time => now - time < this.timeWindow);
        
        if (recentRequests.length >= this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: recentRequests[0] + this.timeWindow
            };
        }
        
        recentRequests.push(now);
        this.requests.set(key, recentRequests);
        
        return {
            allowed: true,
            remaining: this.maxRequests - recentRequests.length,
            resetTime: now + this.timeWindow
        };
    }
    
    /**
     * Clean up old requests from memory
     */
    cleanup() {
        const now = Date.now();
        for (const [key, requests] of this.requests) {
            const recentRequests = requests.filter(time => now - time < this.timeWindow);
            if (recentRequests.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, recentRequests);
            }
        }
    }
}


