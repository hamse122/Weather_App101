// Health check manager for coordinating application health probes
class HealthCheck {
    constructor(options = {}) {
        this.checks = new Map();
        this.timeout = options.timeout || 5000;
    }

    register(name, checkFn, options = {}) {
        if (this.checks.has(name)) {
            throw new Error(`Health check ${name} already registered`);
        }
        if (typeof checkFn !== 'function') {
            throw new Error('Health check must be a function returning boolean or throwing on failure');
        }
        this.checks.set(name, {
            check: checkFn,
            critical: options.critical !== false,
            lastResult: null,
            lastCheckedAt: null
        });
        return this;
    }

    unregister(name) {
        this.checks.delete(name);
        return this;
    }

    async run(name) {
        if (name) {
            const check = this.checks.get(name);
            if (!check) {
                throw new Error(`Health check ${name} not registered`);
            }
            const result = await this.executeCheck(name, check);
            return { status: this.aggregateStatus([result]), details: { [name]: result } };
        }

        const results = {};
        for (const [checkName, check] of this.checks) {
            results[checkName] = await this.executeCheck(checkName, check);
        }

        return {
            status: this.aggregateStatus(Object.values(results)),
            details: results
        };
    }

    async executeCheck(name, check) {
        const start = Date.now();
        let status = 'pass';
        let error = null;
        try {
            const value = await this.withTimeout(check.check(), this.timeout);
            if (value === false) {
                status = check.critical ? 'fail' : 'warn';
            }
        } catch (err) {
            status = check.critical ? 'fail' : 'warn';
            error = err;
        }

        const duration = Date.now() - start;
        const result = {
            status,
            critical: check.critical,
            duration,
            error: error ? error.message : null,
            timestamp: new Date()
        };

        check.lastResult = result;
        check.lastCheckedAt = new Date();
        return result;
    }

    aggregateStatus(results) {
        if (results.some(result => result.status === 'fail')) {
            return 'fail';
        }
        if (results.some(result => result.status === 'warn')) {
            return 'warn';
        }
        return 'pass';
    }

    async withTimeout(promise, timeout) {
        let timer;
        return Promise.race([
            Promise.resolve(promise),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Health check timeout exceeded')), timeout);
            })
        ]).finally(() => clearTimeout(timer));
    }

    summary() {
        const details = {};
        for (const [name, check] of this.checks) {
            details[name] = {
                lastResult: check.lastResult,
                lastCheckedAt: check.lastCheckedAt,
                critical: check.critical
            };
        }
        return details;
    }
}

module.exports = HealthCheck;

