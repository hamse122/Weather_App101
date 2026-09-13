const { EventEmitter } = require("events");

class HealthCheck extends EventEmitter {
    constructor(options = {}) {
        super();

        this.checks = new Map();

        this.timeout = options.timeout ?? 5000;
        this.concurrency = Math.max(1, options.concurrency ?? 5);
        this.cacheTTL = Math.max(0, options.cacheTTL ?? 0);

        this.metrics = {
            totalRuns: 0,
            passes: 0,
            warns: 0,
            fails: 0,
            skipped: 0,
            totalDuration: 0,
            avgDuration: 0,
            lastRunAt: null
        };

        this.running = false;
    }

    register(name, checkFn, options = {}) {
        if (!name || typeof name !== "string") {
            throw new TypeError("Health check name must be a string");
        }

        if (typeof checkFn !== "function") {
            throw new TypeError(`Health check "${name}" must be a function`);
        }

        if (this.checks.has(name)) {
            throw new Error(`Check "${name}" already exists`);
        }

        this.checks.set(name, {
            name,
            checkFn,
            critical: options.critical !== false,
            tags: Array.isArray(options.tags) ? [...options.tags] : [],
            timeout: options.timeout ?? this.timeout,
            retries: Math.max(0, options.retries ?? 0),
            retryDelay: Math.max(0, options.retryDelay ?? 0),
            dependsOn: Array.isArray(options.dependsOn)
                ? [...options.dependsOn]
                : [],

            lastCheckedAt: null,
            lastResult: null
        });

        return this;
    }

    unregister(name) {
        return this.checks.delete(name);
    }

    async run(filter = {}) {
        let checks = [...this.checks.values()];

        if (typeof filter === "string") {
            const check = this.checks.get(filter);

            if (!check) {
                throw new Error(`Check "${filter}" not found`);
            }

            checks = [check];
        }

        if (filter.tags?.length) {
            checks = checks.filter(check =>
                check.tags.some(tag => filter.tags.includes(tag))
            );
        }

        const started = Date.now();

        this.running = true;

        try {
            const results = await this.runQueue(checks);

            this.metrics.totalRuns++;
            this.metrics.lastRunAt = new Date().toISOString();

            return {
                status: this.aggregateStatus(results),
                duration: Date.now() - started,
                timestamp: new Date().toISOString(),
                metrics: { ...this.metrics },
                details: Object.fromEntries(
                    results.map(result => [result.name, result])
                )
            };
        } finally {
            this.running = false;
        }
    }

    async runQueue(checks) {
        const results = [];
        const queue = [...checks];
        const running = new Set();

        const worker = async () => {
            while (queue.length) {
                const check = queue.shift();

                if (!check) continue;

                const promise = this.executeIfReady(check);

                running.add(promise);

                try {
                    results.push(await promise);
                } finally {
                    running.delete(promise);
                }
            }
        };

        const workers = Array.from(
            { length: Math.min(this.concurrency, checks.length) },
            () => worker()
        );

        await Promise.all(workers);

        return results;
    }

    async executeIfReady(check, stack = []) {
        if (stack.includes(check.name)) {
            return {
                name: check.name,
                status: "fail",
                duration: 0,
                attempts: 0,
                error: {
                    message:
                        `Circular dependency detected: ` +
                        [...stack, check.name].join(" -> ")
                },
                timestamp: new Date().toISOString()
            };
        }

        const now = Date.now();

        if (
            check.lastResult &&
            this.cacheTTL > 0 &&
            check.lastCheckedAt &&
            now - check.lastCheckedAt < this.cacheTTL
        ) {
            return {
                ...check.lastResult,
                cached: true
            };
        }

        for (const dependencyName of check.dependsOn) {
            const dependency = this.checks.get(dependencyName);

            if (!dependency) {
                return this.createFailure(
                    check.name,
                    `Missing dependency: ${dependencyName}`
                );
            }

            const dependencyResult = await this.executeIfReady(
                dependency,
                [...stack, check.name]
            );

            if (
                dependencyResult.status === "fail" ||
                dependencyResult.status === "skipped"
            ) {
                this.metrics.skipped++;

                return {
                    name: check.name,
                    status: "skipped",
                    reason: `Dependency "${dependencyName}" is ${dependencyResult.status}`,
                    timestamp: new Date().toISOString()
                };
            }
        }

        return this.executeCheck(check);
    }

    async executeCheck(check) {
        const started = Date.now();

        let attempt = 0;
        let lastError = null;
        let status = "pass";

        this.emit("start", check.name);

        while (attempt <= check.retries) {
            attempt++;

            const controller = new AbortController();

            try {
                const result = await this.withTimeout(
                    check.checkFn({
                        signal: controller.signal,
                        name: check.name,
                        attempt
                    }),
                    check.timeout,
                    controller
                );

                if (result === false) {
                    status = check.critical ? "fail" : "warn";
                }

                lastError = null;
                break;
            } catch (error) {
                lastError = error;

                if (attempt <= check.retries) {
                    this.emit("retry", {
                        name: check.name,
                        attempt,
                        error
                    });

                    await this.sleep(
                        check.retryDelay * attempt
                    );
                } else {
                    status = check.critical ? "fail" : "warn";
                }
            }
        }

        const duration = Date.now() - started;

        const output = {
            name: check.name,
            status,
            critical: check.critical,
            duration,
            attempts: attempt,
            cached: false,
            error: lastError
                ? {
                    name: lastError.name,
                    message: lastError.message,
                    stack: lastError.stack
                }
                : null,
            timestamp: new Date().toISOString()
        };

        check.lastCheckedAt = Date.now();
        check.lastResult = output;

        this.updateMetrics(duration, status);

        this.emit(
            status === "pass" ? "success" : "failure",
            output
        );

        return output;
    }

    createFailure(name, message) {
        return {
            name,
            status: "fail",
            critical: true,
            duration: 0,
            attempts: 0,
            cached: false,
            error: { message },
            timestamp: new Date().toISOString()
        };
    }

    updateMetrics(duration, status) {
        if (status === "pass") this.metrics.passes++;
        if (status === "warn") this.metrics.warns++;
        if (status === "fail") this.metrics.fails++;

        this.metrics.totalDuration += duration;

        const completed =
            this.metrics.passes +
            this.metrics.warns +
            this.metrics.fails;

        this.metrics.avgDuration =
            completed > 0
                ? Number(
                    (this.metrics.totalDuration / completed).toFixed(2)
                )
                : 0;
    }

    aggregateStatus(results) {
        if (
            results.some(
                result =>
                    result.status === "fail" &&
                    result.critical !== false
            )
        ) {
            return "fail";
        }

        if (results.some(result => result.status === "warn")) {
            return "warn";
        }

        return "pass";
    }

    async withTimeout(promise, timeout, controller) {
        if (!timeout || timeout <= 0) {
            return promise;
        }

        let timer;

        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        controller?.abort();
                        reject(new Error("Health check timeout exceeded"));
                    }, timeout);
                })
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    sleep(ms) {
        if (!ms) return Promise.resolve();

        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );
    }

    isHealthy() {
        return ![...this.checks.values()].some(
            check =>
                check.critical &&
                check.lastResult?.status === "fail"
        );
    }

    getMetrics() {
        return Object.freeze({
            ...this.metrics
        });
    }

    summary() {
        return Object.fromEntries(
            [...this.checks.entries()].map(([name, check]) => [
                name,
                {
                    status: check.lastResult?.status ?? "unknown",
                    critical: check.critical,
                    tags: [...check.tags],
                    lastCheckedAt: check.lastCheckedAt
                        ? new Date(check.lastCheckedAt).toISOString()
                        : null
                }
            ])
        );
    }

    clearCache() {
        for (const check of this.checks.values()) {
            check.lastCheckedAt = null;
            check.lastResult = null;
        }

        return this;
    }
}

module.exports = HealthCheck;
