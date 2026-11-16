const { EventEmitter } = require("events");

class HealthCheck extends EventEmitter {
    constructor(options = {}) {
        super();

        this.checks = new Map();

        this.timeout = options.timeout ?? 5000;
        this.concurrency = Math.max(1, options.concurrency ?? 5);
        this.cacheTTL = Math.max(0, options.cacheTTL ?? 0);
        this.failFast = options.failFast ?? false;

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
        this.destroyed = false;
        this.currentRun = null;
    }

    /* ============================================
       REGISTRATION
    ============================================ */

    register(name, checkFn, options = {}) {
        this.ensureActive();

        if (typeof name !== "string" || !name.trim()) {
            throw new TypeError("Health check name must be a non-empty string");
        }

        if (typeof checkFn !== "function") {
            throw new TypeError(`Health check "${name}" must be a function`);
        }

        if (this.checks.has(name)) {
            throw new Error(`Check "${name}" already exists`);
        }

        const check = {
            name,
            checkFn,
            critical: options.critical !== false,
            tags: [...new Set(options.tags || [])],
            timeout: options.timeout ?? this.timeout,
            retries: Math.max(0, options.retries ?? 0),
            retryDelay: Math.max(0, options.retryDelay ?? 0),
            dependsOn: [...new Set(options.dependsOn || [])],

            lastCheckedAt: null,
            lastResult: null,
            inFlight: null
        };

        this.checks.set(name, check);

        return this;
    }

    unregister(name) {
        this.ensureActive();
        return this.checks.delete(name);
    }

    /* ============================================
       EXECUTION
    ============================================ */

    async run(filter = {}) {
        this.ensureActive();

        if (this.running) {
            throw new Error("A health check run is already in progress");
        }

        const checks = this.selectChecks(filter);

        this.running = true;
        const started = Date.now();

        this.currentRun = this._executeRun(checks, started);

        try {
            return await this.currentRun;
        } finally {
            this.running = false;
            this.currentRun = null;
        }
    }

    selectChecks(filter) {
        let checks = [...this.checks.values()];

        if (typeof filter === "string") {
            const check = this.checks.get(filter);

            if (!check) {
                throw new Error(`Check "${filter}" not found`);
            }

            return [check];
        }

        if (filter.tags?.length) {
            checks = checks.filter(check =>
                check.tags.some(tag => filter.tags.includes(tag))
            );
        }

        return checks;
    }

    async _executeRun(checks, started) {
        const results = [];
        const completed = new Map();

        try {
            const pending = new Map(checks.map(check => [check.name, check]));

            while (pending.size > 0) {
                const ready = [...pending.values()].filter(check =>
                    check.dependsOn.every(dep =>
                        completed.has(dep) ||
                        !this.checks.has(dep)
                    )
                );

                if (!ready.length) {
                    for (const check of pending.values()) {
                        const result = this.createFailure(
                            check.name,
                            "Circular dependency or unresolved dependency detected"
                        );

                        results.push(result);
                        completed.set(check.name, result);
                    }

                    break;
                }

                const batch = ready.slice(0, this.concurrency);

                const batchResults = await Promise.all(
                    batch.map(async check => {
                        const missing = check.dependsOn.find(
                            dep => !this.checks.has(dep)
                        );

                        if (missing) {
                            return this.createFailure(
                                check.name,
                                `Missing dependency: ${missing}`
                            );
                        }

                        const failedDependency = check.dependsOn.find(dep =>
                            completed.get(dep)?.status === "fail" ||
                            completed.get(dep)?.status === "skipped"
                        );

                        if (failedDependency) {
                            return {
                                name: check.name,
                                status: "skipped",
                                reason: `Dependency "${failedDependency}" failed`,
                                timestamp: new Date().toISOString()
                            };
                        }

                        return this.executeCheck(check);
                    })
                );

                for (let i = 0; i < batch.length; i++) {
                    const check = batch[i];
                    const result = batchResults[i];

                    results.push(result);
                    completed.set(check.name, result);
                    pending.delete(check.name);
                }
            }

            this.metrics.totalRuns++;
            this.metrics.lastRunAt = new Date().toISOString();

            const output = {
                status: this.aggregateStatus(results),
                duration: Date.now() - started,
                timestamp: new Date().toISOString(),
                metrics: this.getMetrics(),
                details: Object.fromEntries(
                    results.map(result => [result.name, result])
                )
            };

            this.emit("complete", output);

            return output;
        } catch (error) {
            this.emit("error", error);
            throw error;
        }
    }

    /* ============================================
       INDIVIDUAL CHECK EXECUTION
    ============================================ */

    async executeCheck(check) {
        if (check.inFlight) {
            return check.inFlight;
        }

        const execution = this._executeWithRetries(check);

        check.inFlight = execution;

        try {
            return await execution;
        } finally {
            check.inFlight = null;
        }
    }

    async _executeWithRetries(check) {
        const started = Date.now();

        let attempt = 0;
        let lastError = null;
        let status = "pass";
        let output = null;

        this.emit("start", check.name);

        while (attempt <= check.retries) {
            attempt++;

            const controller = new AbortController();

            try {
                const result = await this.withTimeout(
                    Promise.resolve().then(() =>
                        check.checkFn({
                            signal: controller.signal,
                            name: check.name,
                            attempt
                        })
                    ),
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

                    await this.sleep(check.retryDelay * attempt);
                } else {
                    status = check.critical ? "fail" : "warn";
                }
            }
        }

        const duration = Date.now() - started;

        output = {
            name: check.name,
            status,
            critical: check.critical,
            duration,
            attempts: attempt,
            cached: false,
            error: lastError
                ? {
                    name: lastError.name,
                    message: lastError.message
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

    /* ============================================
       TIMEOUT MANAGEMENT
    ============================================ */

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

                        const error = new Error(
                            "Health check timeout exceeded"
                        );

                        error.name = "TimeoutError";
                        reject(error);
                    }, timeout);
                })
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    /* ============================================
       METRICS
    ============================================ */

    updateMetrics(duration, status) {
        if (status === "pass") this.metrics.passes++;
        else if (status === "warn") this.metrics.warns++;
        else if (status === "fail") this.metrics.fails++;
        else if (status === "skipped") this.metrics.skipped++;

        this.metrics.totalDuration += duration;

        const completed =
            this.metrics.passes +
            this.metrics.warns +
            this.metrics.fails;

        this.metrics.avgDuration = completed
            ? Number(
                (this.metrics.totalDuration / completed).toFixed(2)
            )
            : 0;
    }

    getMetrics() {
        return Object.freeze({
            ...this.metrics
        });
    }

    /* ============================================
       STATUS
    ============================================ */

    aggregateStatus(results) {
        if (results.some(r =>
            r.status === "fail" && r.critical !== false
        )) {
            return "fail";
        }

        if (results.some(r =>
            r.status === "fail" || r.status === "warn"
        )) {
            return "warn";
        }

        if (results.some(r => r.status === "skipped")) {
            return "warn";
        }

        return "pass";
    }

    isHealthy() {
        return ![...this.checks.values()].some(check =>
            check.critical &&
            check.lastResult?.status === "fail"
        );
    }

    /* ============================================
       UTILITIES
    ============================================ */

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

    sleep(ms) {
        if (!ms) return Promise.resolve();

        return new Promise(resolve => setTimeout(resolve, ms));
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

    ensureActive() {
        if (this.destroyed) {
            throw new Error("HealthCheck instance has been destroyed");
        }
    }

    destroy() {
        if (this.running) {
            throw new Error("Cannot destroy while checks are running");
        }

        this.checks.clear();
        this.removeAllListeners();

        this.destroyed = true;
    }
}

module.exports = HealthCheck;
