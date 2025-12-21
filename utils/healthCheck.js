/**
 * HealthCheck Manager – v2 (Production Ready)
 */
class HealthCheck {
    constructor(options = {}) {
        this.checks = new Map();
        this.timeout = options.timeout ?? 5000;
        this.parallel = options.parallel !== false;
        this.cacheTTL = options.cacheTTL ?? 0; // ms
        this.hooks = {
            onStart: options.onStart,
            onSuccess: options.onSuccess,
            onFailure: options.onFailure
        };
    }

    register(name, checkFn, options = {}) {
        if (!name || typeof name !== "string") {
            throw new Error("Health check name must be a non-empty string");
        }
        if (this.checks.has(name)) {
            throw new Error(`Health check "${name}" already registered`);
        }
        if (typeof checkFn !== "function") {
            throw new Error("Health check must be a function");
        }

        this.checks.set(name, {
            name,
            checkFn,
            critical: options.critical !== false,
            tags: options.tags ?? [],
            timeout: options.timeout ?? this.timeout,
            retries: options.retries ?? 0,
            retryDelay: options.retryDelay ?? 0,
            cooldown: options.cooldown ?? 0,
            lastCheckedAt: null,
            lastResult: null
        });

        return this;
    }

    unregister(name) {
        this.checks.delete(name);
        return this;
    }

    /**
     * Run checks
     * @param {object|string} input
     */
    async run(input) {
        let targetChecks = [...this.checks.values()];

        if (typeof input === "string") {
            const check = this.checks.get(input);
            if (!check) throw new Error(`Health check "${input}" not registered`);
            targetChecks = [check];
        }

        if (input?.tags?.length) {
            targetChecks = targetChecks.filter(c =>
                c.tags.some(t => input.tags.includes(t))
            );
        }

        const tasks = targetChecks.map(check =>
            this.parallel
                ? this.executeIfReady(check)
                : () => this.executeIfReady(check)
        );

        const results = this.parallel
            ? await Promise.all(tasks)
            : await this.runSequential(tasks);

        const details = {};
        results.forEach(r => details[r.name] = r);

        return {
            status: this.aggregateStatus(results),
            timestamp: new Date().toISOString(),
            details
        };
    }

    async runSequential(tasks) {
        const results = [];
        for (const task of tasks) {
            results.push(await task());
        }
        return results;
    }

    async executeIfReady(check) {
        const now = Date.now();

        if (
            check.lastResult &&
            this.cacheTTL &&
            now - check.lastCheckedAt < this.cacheTTL
        ) {
            return { ...check.lastResult, cached: true };
        }

        if (
            check.lastCheckedAt &&
            now - check.lastCheckedAt < check.cooldown
        ) {
            return { ...check.lastResult, skipped: true };
        }

        return this.executeCheck(check);
    }

    async executeCheck(check) {
        const startedAt = Date.now();
        let attempt = 0;
        let error = null;
        let status = "pass";

        this.hooks.onStart?.(check.name);

        while (attempt <= check.retries) {
            try {
                attempt++;
                const result = await this.withTimeout(
                    Promise.resolve().then(check.checkFn),
                    check.timeout
                );

                if (result === false) {
                    status = check.critical ? "fail" : "warn";
                    break;
                }

                status = "pass";
                break;
            } catch (err) {
                error = err;
                if (attempt > check.retries) {
                    status = check.critical ? "fail" : "warn";
                } else if (check.retryDelay) {
                    await this.sleep(check.retryDelay);
                }
            }
        }

        const output = Object.freeze({
            name: check.name,
            status,
            critical: check.critical,
            duration: Date.now() - startedAt,
            attempts: attempt,
            tags: [...check.tags],
            error: error
                ? { message: error.message, stack: error.stack }
                : null,
            timestamp: new Date().toISOString()
        });

        check.lastCheckedAt = Date.now();
        check.lastResult = output;

        if (status === "pass") this.hooks.onSuccess?.(output);
        else this.hooks.onFailure?.(output);

        return output;
    }

    aggregateStatus(results) {
        if (results.some(r => r.status === "fail")) return "fail";
        if (results.some(r => r.status === "warn")) return "warn";
        return "pass";
    }

    async withTimeout(promise, timeout) {
        let timer;
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Health check timeout exceeded")),
                    timeout
                );
            })
        ]).finally(() => clearTimeout(timer));
    }

    sleep(ms) {
        return new Promise(res => setTimeout(res, ms));
    }

    isHealthy() {
        return ![...this.checks.values()]
            .some(c => c.lastResult?.status === "fail");
    }

    summary() {
        const out = {};
        for (const [name, c] of this.checks) {
            out[name] = {
                status: c.lastResult?.status ?? "unknown",
                lastCheckedAt: c.lastCheckedAt
                    ? new Date(c.lastCheckedAt).toISOString()
                    : null,
                critical: c.critical,
                tags: c.tags
            };
        }
        return out;
    }
}

module.exports = HealthCheck;
