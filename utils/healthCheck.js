const { EventEmitter } = require("events");

/**
 * HealthCheck Manager – v3 (Advanced Production)
 */
class HealthCheck extends EventEmitter {

    constructor(options = {}) {
        super();

        this.checks = new Map();

        this.timeout = options.timeout ?? 5000;
        this.parallel = options.parallel !== false;
        this.concurrency = options.concurrency ?? Infinity;
        this.cacheTTL = options.cacheTTL ?? 0;

        this.metrics = {
            totalRuns: 0,
            passes: 0,
            warns: 0,
            fails: 0,
            avgDuration: 0
        };
    }

    register(name, checkFn, options = {}) {

        if (!name || typeof name !== "string")
            throw new Error("Health check name must be string");

        if (this.checks.has(name))
            throw new Error(`Health check "${name}" already exists`);

        if (typeof checkFn !== "function")
            throw new Error("checkFn must be function");

        this.checks.set(name, {

            name,
            checkFn,

            critical: options.critical !== false,
            tags: options.tags ?? [],

            timeout: options.timeout ?? this.timeout,
            retries: options.retries ?? 0,
            retryDelay: options.retryDelay ?? 0,

            cooldown: options.cooldown ?? 0,
            dependsOn: options.dependsOn ?? [],

            lastCheckedAt: null,
            lastResult: null
        });

        return this;
    }

    unregister(name) {
        this.checks.delete(name);
        return this;
    }

    async run(filter = {}) {

        let checks = [...this.checks.values()];

        if (typeof filter === "string") {
            const c = this.checks.get(filter);
            if (!c) throw new Error(`Check "${filter}" not found`);
            checks = [c];
        }

        if (filter.tags?.length) {
            checks = checks.filter(c =>
                c.tags.some(t => filter.tags.includes(t))
            );
        }

        const results = this.parallel
            ? await this.runParallel(checks)
            : await this.runSequential(checks);

        const details = {};
        results.forEach(r => details[r.name] = r);

        this.metrics.totalRuns++;

        return {
            status: this.aggregateStatus(results),
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            details
        };
    }

    async runSequential(checks) {

        const results = [];

        for (const check of checks) {
            results.push(await this.executeIfReady(check));
        }

        return results;
    }

    async runParallel(checks) {

        const results = [];
        const pool = [];

        for (const check of checks) {

            const task = this.executeIfReady(check)
                .then(r => results.push(r));

            pool.push(task);

            if (pool.length >= this.concurrency) {
                await Promise.race(pool);
                pool.splice(pool.findIndex(p => p === task), 1);
            }
        }

        await Promise.all(pool);
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

        for (const dep of check.dependsOn) {
            const depCheck = this.checks.get(dep);
            if (depCheck?.lastResult?.status === "fail") {
                return {
                    name: check.name,
                    status: "skipped",
                    reason: `dependency ${dep} failed`
                };
            }
        }

        return this.executeCheck(check);
    }

    async executeCheck(check) {

        const startedAt = Date.now();
        let attempt = 0;
        let error = null;
        let status = "pass";

        this.emit("start", check.name);

        const controller = new AbortController();

        while (attempt <= check.retries) {

            try {

                attempt++;

                const result = await this.withTimeout(
                    Promise.resolve().then(() =>
                        check.checkFn({ signal: controller.signal })
                    ),
                    check.timeout
                );

                if (result === false) {
                    status = check.critical ? "fail" : "warn";
                }

                break;

            } catch (err) {

                error = err;

                if (err.message.includes("timeout"))
                    status = "timeout";

                if (attempt > check.retries) {
                    status = check.critical ? "fail" : "warn";
                } else if (check.retryDelay) {
                    await this.sleep(check.retryDelay);
                }
            }
        }

        const duration = Date.now() - startedAt;

        const output = Object.freeze({
            name: check.name,
            status,
            critical: check.critical,
            duration,
            attempts: attempt,
            tags: [...check.tags],
            error: error
                ? { message: error.message }
                : null,
            timestamp: new Date().toISOString()
        });

        check.lastCheckedAt = Date.now();
        check.lastResult = output;

        this.updateMetrics(output);

        if (status === "pass") this.emit("success", output);
        else this.emit("failure", output);

        return output;
    }

    updateMetrics(result) {

        if (result.status === "pass") this.metrics.passes++;
        if (result.status === "warn") this.metrics.warns++;
        if (result.status === "fail") this.metrics.fails++;

        this.metrics.avgDuration =
            (this.metrics.avgDuration + result.duration) / 2;
    }

    aggregateStatus(results) {

        if (results.some(r => r.status === "fail")) return "fail";
        if (results.some(r => r.status === "warn")) return "warn";
        if (results.some(r => r.status === "timeout")) return "warn";

        return "pass";
    }

    async withTimeout(promise, timeout) {

        let timer;

        return Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("timeout exceeded")),
                    timeout
                );
            })
        ]).finally(() => clearTimeout(timer));
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
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
