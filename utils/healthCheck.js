/**
 * HealthCheck Manager
 * A more advanced and production-ready implementation
 * supporting cooldown, parallel execution, tagging, and rich output.
 */
class HealthCheck {
    constructor(options = {}) {
        this.checks = new Map();
        this.timeout = options.timeout || 5000;
        this.parallel = options.parallel !== false; // default: run in parallel
    }

    /**
     * Register a health check
     * @param {string} name 
     * @param {Function} checkFn must return true/false or throw on failure
     * @param {object} options 
     */
    register(name, checkFn, options = {}) {
        if (!name || typeof name !== "string") {
            throw new Error("Health check name must be a non-empty string");
        }
        if (this.checks.has(name)) {
            throw new Error(`Health check ${name} already registered`);
        }
        if (typeof checkFn !== "function") {
            throw new Error("Health check must be a function");
        }

        this.checks.set(name, {
            name,
            checkFn,
            critical: options.critical !== false,
            cooldown: options.cooldown || 0, // ms before allowed to re-check
            tags: options.tags || [],
            lastCheckedAt: null,
            lastResult: null
        });

        return this;
    }

    /**
     * Unregister a health check
     */
    unregister(name) {
        this.checks.delete(name);
        return this;
    }

    /**
     * Returns a check instance by name
     */
    getCheck(name) {
        return this.checks.get(name) || null;
    }

    /**
     * Run a single check or all checks
     */
    async run(name) {
        if (name) {
            const check = this.getCheck(name);
            if (!check) throw new Error(`Health check ${name} not registered`);

            const result = await this.executeIfReady(check);

            return {
                status: this.aggregateStatus([result]),
                details: { [name]: result }
            };
        }

        const tasks = [];
        const arr = [...this.checks.values()];

        for (const check of arr) {
            if (this.parallel)
                tasks.push(this.executeIfReady(check));
            else
                tasks.push(await this.executeIfReady(check));
        }

        const results = this.parallel ? await Promise.all(tasks) : tasks;

        const response = {};
        arr.forEach((check, i) => response[check.name] = results[i]);

        return {
            status: this.aggregateStatus(results),
            details: response
        };
    }

    /**
     * Execute check only if cooldown expired
     */
    async executeIfReady(check) {
        const now = Date.now();
        if (check.lastCheckedAt && (now - check.lastCheckedAt) < check.cooldown) {
            // Return cached result
            return check.lastResult;
        }
        return this.executeCheck(check);
    }

    /**
     * Run the actual health check
     */
    async executeCheck(check) {
        const start = Date.now();
        let status = "pass";
        let error = null;

        try {
            const result = await this.withTimeout(check.checkFn(), this.timeout);
            if (result === false) {
                status = check.critical ? "fail" : "warn";
            }
        } catch (err) {
            status = check.critical ? "fail" : "warn";
            error = {
                message: err.message,
                stack: err.stack
            };
        }

        const duration = Date.now() - start;

        const output = {
            name: check.name,
            status,
            critical: check.critical,
            duration,
            error,
            tags: check.tags,
            timestamp: new Date()
        };

        check.lastCheckedAt = Date.now();
        check.lastResult = output;

        return output;
    }

    /**
     * Determine global status
     */
    aggregateStatus(results) {
        if (results.some(r => r.status === "fail")) return "fail";
        if (results.some(r => r.status === "warn")) return "warn";
        return "pass";
    }

    /**
     * Promise with timeout wrapper
     */
    async withTimeout(promise, timeout) {
        let timer;
        return Promise.race([
            Promise.resolve(promise),
            new Promise((_, reject) => {
                timer = setTimeout(() => 
                    reject(new Error("Health check timeout exceeded")), timeout);
            })
        ]).finally(() => clearTimeout(timer));
    }

    /**
     * Quick healthy check: true/false
     */
    isHealthy() {
        const results = [...this.checks.values()].map(c => c.lastResult);
        return !results.some(r => r && r.status === "fail");
    }

    /**
     * Returns summary of all checks
     */
    summary() {
        const summary = {};
        for (const [name, check] of this.checks) {
            summary[name] = {
                lastResult: check.lastResult,
                lastCheckedAt: check.lastCheckedAt
                    ? new Date(check.lastCheckedAt)
                    : null,
                critical: check.critical,
                tags: check.tags
            };
        }
        return summary;
    }
}

module.exports = HealthCheck;
