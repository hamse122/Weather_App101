/**
 * Progress Tracker Utility
 * Progress tracking system for monitoring task completion
 */

/**
 * ProgressTracker class for tracking progress
 */
export class ProgressTracker {
    constructor(total = 100) {
        this.total = total;
        this.current = 0;
        this.listeners = [];
        this.startTime = null;
        this.endTime = null;
    }
    
    /**
     * Set total value
     * @param {number} total - Total value
     */
    setTotal(total) {
        this.total = total;
        this.notifyListeners();
    }
    
    /**
     * Set current progress
     * @param {number} current - Current progress value
     */
    setProgress(current) {
        this.current = Math.min(Math.max(0, current), this.total);
        if (!this.startTime) this.startTime = Date.now();
        this.notifyListeners();
        
        if (this.current >= this.total && !this.endTime) {
            this.endTime = Date.now();
        }
    }
    
    /**
     * Increment progress
     * @param {number} amount - Amount to increment
     */
    increment(amount = 1) {
        this.setProgress(this.current + amount);
    }
    
    /**
     * Get progress percentage
     * @returns {number} - Progress percentage (0-100)
     */
    getPercentage() {
        return this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
    }
    
    /**
     * Get progress information
     * @returns {Object} - Progress information object
     */
    getInfo() {
        return {
            current: this.current,
            total: this.total,
            percentage: this.getPercentage(),
            isComplete: this.current >= this.total,
            elapsedTime: this.startTime ? Date.now() - this.startTime : 0,
            totalTime: this.endTime ? this.endTime - this.startTime : null,
            estimatedTimeRemaining: this.getEstimatedTimeRemaining()
        };
    }
    
    /**
     * Get estimated time remaining
     * @returns {number|null} - Estimated time in milliseconds
     */
    getEstimatedTimeRemaining() {
        if (!this.startTime || this.current === 0) return null;
        
        const elapsed = Date.now() - this.startTime;
        const rate = this.current / elapsed;
        const remaining = this.total - this.current;
        
        return remaining / rate;
    }
    
    /**
     * Reset progress tracker
     */
    reset() {
        this.current = 0;
        this.startTime = null;
        this.endTime = null;
        this.notifyListeners();
    }
    
    /**
     * Subscribe to progress changes
     * @param {Function} listener - Listener function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify all listeners
     */
    notifyListeners() {
        const info = this.getInfo();
        this.listeners.forEach(listener => listener(info));
    }
}
