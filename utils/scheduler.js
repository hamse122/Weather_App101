/**
 * Scheduler Utility
 * Task scheduler with cron-like syntax
 */

/**
 * Scheduler class for managing scheduled tasks
 */
export class Scheduler {
    constructor() {
        this.tasks = new Map();
        this.timers = new Map();
    }
    
    /**
     * Schedule a task with cron-like expression
     * @param {string} id - Unique task identifier
     * @param {string} cronExpression - Cron expression (minute hour dayOfMonth month dayOfWeek)
     * @param {Function} task - Task function to execute
     */
    schedule(id, cronExpression, task) {
        const nextRun = this.parseCron(cronExpression);
        this.tasks.set(id, { cronExpression, task, nextRun });
        this.scheduleNextRun(id);
    }
    
    /**
     * Parse cron expression to get next run time
     * @param {string} expression - Cron expression
     * @returns {Date} - Next run time
     */
    parseCron(expression) {
        const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');
        
        const now = new Date();
        const nextRun = new Date(now);
        
        // Simple implementation - adjust as needed
        if (minute !== '*') nextRun.setMinutes(parseInt(minute));
        if (hour !== '*') nextRun.setHours(parseInt(hour));
        
        return nextRun;
    }
    
    /**
     * Schedule the next run for a task
     * @param {string} id - Task identifier
     */
    scheduleNextRun(id) {
        const task = this.tasks.get(id);
        if (!task) return;
        
        const now = Date.now();
        const delay = task.nextRun.getTime() - now;
        
        if (delay > 0) {
            const timer = setTimeout(() => {
                task.task();
                task.nextRun = this.parseCron(task.cronExpression);
                this.scheduleNextRun(id);
            }, delay);
            
            this.timers.set(id, timer);
        }
    }
    
    /**
     * Cancel a scheduled task
     * @param {string} id - Task identifier
     */
    cancel(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
        this.tasks.delete(id);
    }
    
    /**
     * List all scheduled tasks
     * @returns {Array} - Array of task information
     */
    listTasks() {
        return Array.from(this.tasks.entries()).map(([id, task]) => ({
            id,
            cronExpression: task.cronExpression,
            nextRun: task.nextRun
        }));
    }
}


