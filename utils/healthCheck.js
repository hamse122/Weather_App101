const { EventEmitter } = require("events");

class HealthCheck extends EventEmitter {

    constructor(options = {}) {
        super();

        this.checks = new Map();

        this.timeout = options.timeout ?? 5000;
        this.concurrency = options.concurrency ?? 5;
        this.cacheTTL = options.cacheTTL ?? 0;

        this.metrics = {
            totalRuns: 0,
            passes: 0,
            warns: 0,
            fails: 0,
            totalDuration: 0,
            avgDuration: 0
        };
    }

    register(name, checkFn, options = {}) {

        if (!name || typeof name !== "string")
            throw new Error("Name must be string");

        if (this.checks.has(name))
            throw new Error(`Check "${name}" exists`);

        this.checks.set(name, {
            name,
            checkFn,
            critical: options.critical !== false,
            tags: options.tags ?? [],
            timeout: options.timeout ?? this.timeout,
            retries: options.retries ?? 0,
            retryDelay: options.retryDelay ?? 0,
            dependsOn: options.dependsOn ?? [],
            lastCheckedAt: null,
            lastResult: null
        });

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

        const results = await this.runQueue(checks);

        this.metrics.totalRuns++;

        return {
            status: this.aggregateStatus(results),
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            details: Object.fromEntries(results.map(r => [r.name, r]))
        };
    }

    async runQueue(checks) {

        const results = [];
        const queue = [...checks];
        const workers = [];

        const worker = async () => {
            while (queue.length) {
                const check = queue.shift();
                const res = await this.executeIfReady(check);
                results.push(res);
            }
        };

        for (let i = 0; i < this.concurrency; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
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

        // dependency check
        for (const dep of check.dependsOn) {
            const d = this.checks.get(dep);

            if (!d) {
                return {
                    name: check.name,
                    status: "fail",
                    error: { message: `Missing dependency: ${dep}` }
                };
            }

            if (!d.lastResult) {
                await this.executeCheck(d);
            }

            if (d.lastResult.status === "fail") {
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

        const started = Date.now();
        let attempt = 0;
        let error = null;
        let status = "pass";

        this.emit("start", check.name);

        const controller = new AbortController();

        while (attempt <= check.retries) {
            attempt++;

            try {
                const result = await this.withTimeout(
                    check.checkFn({ signal: controller.signal }),
                    check.timeout,
                    controller
                );

                if (result === false) {
                    status = check.critical ? "fail" : "warn";
                }

                break;

            } catch (err) {
                error = err;

                if (attempt > check.retries) {
                    status = check.critical ? "fail" : "warn";
                } else {
                    await this.sleep(check.retryDelay);
                }
            }
        }

        const duration = Date.now() - started;

        const output = {
            name: check.name,
            status,
            duration,
            attempts: attempt,
            error: error
                ? {
                    message: error.message,
                    stack: error.stack
                }
                : null,
            timestamp: new Date().toISOString()
        };

        check.lastCheckedAt = Date.now();
        check.lastResult = output;

        this.updateMetrics(duration, status);

        this.emit(status === "pass" ? "success" : "failure", output);

        return output;
    }

    updateMetrics(duration, status) {

        if (status === "pass") this.metrics.passes++;
        if (status === "warn") this.metrics.warns++;
        if (status === "fail") this.metrics.fails++;

        this.metrics.totalDuration += duration;

        this.metrics.avgDuration =
            this.metrics.totalDuration /
            (this.metrics.passes + this.metrics.warns + this.metrics.fails);
    }

    aggregateStatus(results) {

        if (results.some(r => r.status === "fail" && r.critical !== false))
            return "fail";

        if (results.some(r => r.status === "warn"))
            return "warn";

        return "pass";
    }

    async withTimeout(promise, timeout, controller) {

        let timer;

        return Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(new Error("timeout exceeded"));
                }, timeout);
            })
        ]).finally(() => clearTimeout(timer));
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    isHealthy() {
        return ![...this.checks.values()]
            .some(c => c.lastResult?.status === "fail" && c.critical);
    }

    summary() {
        return Object.fromEntries(
            [...this.checks.entries()].map(([name, c]) => [
                name,
                {
                    status: c.lastResult?.status ?? "unknown",
                    lastCheckedAt: c.lastCheckedAt
                        ? new Date(c.lastCheckedAt).toISOString()
                        : null
                }
            ])
        );
    }
}

module.exports = HealthCheck;
