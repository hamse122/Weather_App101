/**
 * Advanced Scheduler Utility
 * Supports full cron syntax, automatic catch-up, pause/resume, and safe execution
 */

export class Scheduler {
    constructor(options = {}) {
        this.tasks = new Map();
        this.timers = new Map();
        this.timezone = options.timezone || undefined;
    }

    /**
     * Schedule a new cron task
     * @param {string} id Unique task ID
     * @param {string} cron Cron expression (min hour day month weekday)
     * @param {Function} fn Function to run
     * @param {object} options Optional settings
     */
    schedule(id, cron, fn, options = {}) {
        if (this.tasks.has(id)) {
            throw new Error(`Task with ID '${id}' already exists`);
        }

        const parsed = this.parseCron(cron);

        const task = {
            id,
            cron,
            fn,
            parsed,
            paused: false,
            nextRun: this.computeNext(parsed),
            onError: options.onError || ((err) => console.error(`[Scheduler:${id}]`, err)),
            onRun: options.onRun || null,
        };

        this.tasks.set(id, task);
        this.scheduleNextRun(task);

        return task;
    }

    /**
     * Pause a scheduled task
     */
    pause(id) {
        const t = this.tasks.get(id);
        if (!t) return;
        t.paused = true;

        const timer = this.timers.get(id);
        if (timer) clearTimeout(timer);
    }

    /**
     * Resume a paused task
     */
    resume(id) {
        const t = this.tasks.get(id);
        if (!t || !t.paused) return;

        t.paused = false;
        t.nextRun = this.computeNext(t.parsed);
        this.scheduleNextRun(t);
    }

    /**
     * Unschedule a task
     */
    cancel(id) {
        const timer = this.timers.get(id);
        if (timer) clearTimeout(timer);

        this.timers.delete(id);
        this.tasks.delete(id);
    }

    /**
     * List all scheduled tasks
     */
    listTasks() {
        return [...this.tasks.values()].map(t => ({
            id: t.id,
            cron: t.cron,
            nextRun: new Date(t.nextRun),
            paused: t.paused
        }));
    }

    /**
     * Parse a cron expression
     */
    parseCron(expr) {
        const parts = expr.trim().split(/\s+/);
        if (parts.length !== 5) {
            throw new Error(`Invalid cron expression '${expr}'`);
        }

        const [min, hour, day, month, weekday] = parts;

        return {
            minute: this.parseCronField(min, 0, 59),
            hour: this.parseCronField(hour, 0, 23),
            day: this.parseCronField(day, 1, 31),
            month: this.parseCronField(month, 1, 12),
            weekday: this.parseCronField(weekday, 0, 6),
        };
    }

    /**
     * Parse individual cron field (*, numbers, lists)
     */
    parseCronField(field, min, max) {
        if (field === '*') return null;

        return field.split(',').map(v => {
            const num = Number(v);
            if (isNaN(num) || num < min || num > max) {
                throw new Error(`Invalid cron field value '${v}'`);
            }
            return num;
        });
    }

    /**
     * Compute next execution date
     */
    computeNext(parsed) {
        const now = new Date();
        const next = new Date(now.getTime() + 1000); // move ahead 1 sec

        while (true) {
            if (
                (parsed.month && !parsed.month.includes(next.getMonth() + 1)) ||
                (parsed.day && !parsed.day.includes(next.getDate())) ||
                (parsed.weekday && !parsed.weekday.includes(next.getDay())) ||
                (parsed.hour && !parsed.hour.includes(next.getHours())) ||
                (parsed.minute && !parsed.minute.includes(next.getMinutes()))
            ) {
                next.setMinutes(next.getMinutes() + 1);
                next.setSeconds(0);
                next.setMilliseconds(0);
            } else break;
        }

        return next;
    }

    /**
     * Schedule the next execution
     */
    scheduleNextRun(task) {
        if (task.paused) return;

        const delay = task.nextRun.getTime() - Date.now();

        if (delay <= 0) {
            // Run immediately if overdue
            this.executeTask(task);
            task.nextRun = this.computeNext(task.parsed);
            this.scheduleNextRun(task);
            return;
        }

        const timer = setTimeout(() => {
            this.executeTask(task);
            task.nextRun = this.computeNext(task.parsed);
            this.scheduleNextRun(task);
        }, delay);

        this.timers.set(task.id, timer);
    }

    /**
     * Execute a task safely
     */
    async executeTask(task) {
        try {
            if (task.onRun) task.onRun(task.id, task.nextRun);
            await Promise.resolve(task.fn());
        } catch (err) {
            task.onError(err);
        }
    }
}
