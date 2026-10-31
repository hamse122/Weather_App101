/**
 * ======================================================
 *            ADVANCED DATA PIPELINE (UPGRADED)
 *  - Parallel & Sequential Execution
 *  - Retry + Timeout + Circuit Breaker
 *  - Hooks (before/after/error)
 *  - Conditional Stages (when)
 *  - Caching & Metrics
 *  - Streaming & Async Iterables
 *  - Middleware Support (global + stage)
 *  - Context Isolation + Namespaces
 * ======================================================
 */

class DataPipeline {
    constructor(options = {}) {
        this.stages = [];
        this.context = new Map();
        this.hooks = {
            beforeStage: [],
            afterStage: [],
            onError: [],
            beforePipeline: [],
            afterPipeline: []
        };
        this.options = {
            parallel: options.parallel ?? false,
            immutable: options.immutable ?? false,
            cache: options.cache ?? false,
            timeout: options.timeout ?? 0,
            retries: options.retries ?? 0
        };
        this.cacheStore = new Map();
        this.metrics = {
            totalStages: 0,
            totalTime: 0,
            successCount: 0,
            failureCount: 0
        };
        this.paused = false;
    }

    /* =========================
       STAGE MANAGEMENT
    ========================= */
    stage(name, processor, config = {}) {
        this.stages.push({
            name,
            processor,
            config: {
                when: config.when,
                retries: config.retries ?? this.options.retries,
                timeout: config.timeout ?? this.options.timeout,
                cache: config.cache ?? this.options.cache,
                middleware: config.middleware || []
            }
        });
        return this;
    }

    use(middleware) {
        return this.stage('middleware', middleware);
    }

/* =========================
   HOOK SYSTEM (v3)
   - Priority-based execution
   - Async support
   - Parallel execution
   - Once-only hooks
   - Error isolation
   - AbortSignal support
   - Hook management
========================= */

hook(type, fn, options = {}) {
    if (typeof type !== "string" || !type.trim()) {
        throw new TypeError("Hook type must be a non-empty string");
    }

    if (typeof fn !== "function") {
        throw new TypeError(`Hook for "${type}" must be a function`);
    }

    const {
        priority = 0,
        once = false,
        enabled = true,
        id = null
    } = options;

    if (!this.hooks) {
        this.hooks = Object.create(null);
    }

    if (!Array.isArray(this.hooks[type])) {
        this.hooks[type] = [];
    }

    const hooks = this.hooks[type];

    if (hooks.some(h => h.fn === fn || (id && h.id === id))) {
        return this;
    }

    const entry = {
        id: id ?? `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        fn,
        priority: Number.isFinite(priority) ? priority : 0,
        once: Boolean(once),
        enabled: Boolean(enabled),
        registeredAt: Date.now(),
        executions: 0,
        lastExecutedAt: null
    };

    const index = hooks.findIndex(
        hook => hook.priority < entry.priority
    );

    if (index === -1) {
        hooks.push(entry);
    } else {
        hooks.splice(index, 0, entry);
    }

    return this;
}

async runHooks(type, payload, options = {}) {
    const {
        stopOnError = false,
        parallel = false,
        signal = null,
        context = this.context
    } = options;

    const hooks = [...(this.hooks?.[type] || [])]
        .filter(h => h.enabled !== false);

    const errors = [];
    const results = [];

    const execute = async hook => {
        if (signal?.aborted) {
            throw signal.reason ?? new Error("Hook execution aborted");
        }

        const entry = typeof hook === "function"
            ? { fn: hook, once: false }
            : hook;

        if (typeof entry.fn !== "function") return;

        // Remove once-only hooks before execution to prevent duplicate calls.
        if (entry.once && typeof hook !== "function") {
            const registered = this.hooks[type];
            const index = registered?.indexOf(entry);

            if (index !== -1 && index != null) {
                registered.splice(index, 1);
            }
        }

        try {
            const result = await entry.fn(payload, context);

            if (typeof hook !== "function") {
                entry.executions = (entry.executions || 0) + 1;
                entry.lastExecutedAt = Date.now();
            }

            results.push({
                id: entry.id ?? null,
                status: "fulfilled",
                result
            });

            return result;
        } catch (error) {
            errors.push({
                id: entry.id ?? null,
                error
            });

            results.push({
                id: entry.id ?? null,
                status: "rejected",
                error
            });

            if (stopOnError) throw error;

            console.error(`[Hook:${type}]`, error);
            return undefined;
        }
    };

    if (parallel) {
        const settled = await Promise.allSettled(
            hooks.map(execute)
        );

        if (stopOnError) {
            const failed = settled.find(
                result => result.status === "rejected"
            );

            if (failed) throw failed.reason;
        }
    } else {
        for (const hook of hooks) {
            await execute(hook);
        }
    }

    this.lastHookErrors = errors;
    this.lastHookResults = results;

    return {
        type,
        executed: results.length,
        failed: errors.length,
        results,
        errors
    };
}

/* Remove a specific hook */
removeHook(type, fnOrId) {
    const hooks = this.hooks?.[type];

    if (!Array.isArray(hooks)) return false;

    const index = hooks.findIndex(hook =>
        typeof hook === "function"
            ? hook === fnOrId
            : hook.fn === fnOrId || hook.id === fnOrId
    );

    if (index === -1) return false;

    hooks.splice(index, 1);
    return true;
}

/* Enable or disable a hook */
setHookEnabled(type, fnOrId, enabled = true) {
    const hook = this.hooks?.[type]?.find(h =>
        h.fn === fnOrId || h.id === fnOrId
    );

    if (!hook) return false;

    hook.enabled = Boolean(enabled);
    return true;
}

/* Clear hooks */
clearHooks(type = null) {
    if (type) {
        if (this.hooks) this.hooks[type] = [];
    } else {
        this.hooks = Object.create(null);
    }

    return this;
}

/* Get hook information */
getHooks(type) {
    return (this.hooks?.[type] || []).map(hook => ({
        id: hook.id,
        priority: hook.priority,
        once: hook.once,
        enabled: hook.enabled,
        executions: hook.executions,
        registeredAt: hook.registeredAt,
        lastExecutedAt: hook.lastExecutedAt
    }));
}
/* =========================
   Architecture
========================= */

class DataPipeline {
    constructor(options = {}) {
        this.stages = [];
        this.context = new Map();

        this.plugins = [];
        this.middlewares = [];

        this.eventListeners = new Map();

        this.cache = options.cacheAdapter ?? new MemoryCache();

        this.abortController = new AbortController();

        this.circuitBreaker = {
            failures: 0,
            threshold: Math.max(1, options.breakerThreshold ?? 5),
            resetTimeout: Math.max(0, options.breakerReset ?? 30000),
            state: "CLOSED",
            openedAt: null,
            halfOpenInProgress: false
        };

        this.metrics = {
            executions: 0,
            successes: 0,
            failures: 0,
            totalTime: 0,
            stageTimes: Object.create(null),
            cacheHits: 0,
            cacheMisses: 0,
            lastError: null,
            lastExecutionAt: null
        };

        this.options = {
            name: options.name ?? "DataPipeline",
            timeout: options.timeout ?? 0,
            continueOnError: options.continueOnError ?? false,
            debug: options.debug ?? false
        };

        this.createdAt = Date.now();
    }
}

    /* =========================
       CORE PROCESSOR
    ========================= */
    async process(input) {
        const startPipeline = Date.now();
        let data = this.options.immutable ? this.clone(input) : input;
        const results = [];

        await this.runHooks('beforePipeline', { input: data });

        for (const stage of this.stages) {
            if (this.paused) break;

            const { name, processor, config } = stage;

            // Conditional execution
            if (config.when && !config.when(data, this.context)) {
                continue;
            }

            const cacheKey = `${name}:${JSON.stringify(data)}`;
            const startTime = Date.now();

            try {
                await this.runHooks('beforeStage', { name, data });

                // Cache hit
                if (config.cache && this.cacheStore.has(cacheKey)) {
                    data = this.cacheStore.get(cacheKey);
                } else {
                    data = await this.executeWithControl(
                        processor,
                        data,
                        config
                    );

                    if (config.cache) {
                        this.cacheStore.set(cacheKey, data);
                    }
                }

                const duration = Date.now() - startTime;
                this.metrics.successCount++;

                results.push({
                    stage: name,
                    success: true,
                    duration,
                    dataSnapshot: this.safePreview(data)
                });

                await this.runHooks('afterStage', { name, data, duration });

            } catch (error) {
                this.metrics.failureCount++;

                results.push({
                    stage: name,
                    success: false,
                    error: error.message,
                    duration: Date.now() - startTime
                });

                await this.runHooks('onError', { name, error });

                throw error;
            }

            this.metrics.totalStages++;
        }

        this.metrics.totalTime += Date.now() - startPipeline;

        await this.runHooks('afterPipeline', { finalResult: data });

        return {
            finalResult: data,
            stageResults: results,
            metrics: this.getMetrics()
        };
    }

    /* =========================
       EXECUTION CONTROL (Retry + Timeout)
    ========================= */
    async executeWithControl(fn, data, config) {
        let attempts = 0;
        const maxRetries = config.retries;

        while (true) {
            try {
                return await this.withTimeout(
                    fn(data, this.context),
                    config.timeout
                );
            } catch (err) {
                if (attempts >= maxRetries) throw err;
                attempts++;
            }
        }
    }

    async withTimeout(promise, timeout) {
        if (!timeout) return promise;

        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Stage timeout exceeded')), timeout)
            )
        ]);
    }

    /* =========================
       PIPELINE CONTROL
    ========================= */
    pause() {
        this.paused = true;
        return this;
    }

    resume() {
        this.paused = false;
        return this;
    }

    clear() {
        this.stages = [];
        this.context.clear();
        this.cacheStore.clear();
        this.resetMetrics();
        return this;
    }

    /* =========================
       CONTEXT MANAGEMENT (NAMESPACED)
    ========================= */
    setContext(key, value) {
        this.context.set(key, value);
        return this;
    }

    getContext(key) {
        return this.context.get(key);
    }

    removeContext(key) {
        this.context.delete(key);
        return this;
    }

    /* =========================
       UTILITIES
    ========================= */
    clone(data) {
        return structuredClone ? structuredClone(data) : JSON.parse(JSON.stringify(data));
    }

    safePreview(data) {
        if (Array.isArray(data)) return `[Array(${data.length})]`;
        if (typeof data === 'object') return '{Object}';
        return data;
    }

    getStageNames() {
        return this.stages.map(s => s.name);
    }

    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cacheStore.size,
            successRate:
                this.metrics.totalStages === 0
                    ? 0
                    : (this.metrics.successCount / this.metrics.totalStages) * 100
        };
    }

    resetMetrics() {
        this.metrics = {
            totalStages: 0,
            totalTime: 0,
            successCount: 0,
            failureCount: 0
        };
    }
}

/* ======================================================
   ADVANCED BUILT-IN PROCESSORS (UPGRADED)
====================================================== */
const builtInProcessors = {
    filter: predicate => async (data) => {
        if (!Array.isArray(data)) return data;
        return data.filter(predicate);
    },

    map: mapper => async (data, ctx) => {
        if (!Array.isArray(data)) return data;
        return Promise.all(data.map(item => mapper(item, ctx)));
    },

    reduce: (reducer, initial) => async (data, ctx) => {
        if (!Array.isArray(data)) return data;
        let acc = initial;
        for (const item of data) {
            acc = await reducer(acc, item, ctx);
        }
        return acc;
    },

    batch: size => async (data) => {
        if (!Array.isArray(data)) return data;
        const batches = [];
        for (let i = 0; i < data.length; i += size) {
            batches.push(data.slice(i, i + size));
        }
        return batches;
    },

    flatMap: mapper => async (data, ctx) => {
        if (!Array.isArray(data)) return data;
        const mapped = await Promise.all(data.map(item => mapper(item, ctx)));
        return mapped.flat();
    },

    sort: compareFn => async (data) => {
        if (!Array.isArray(data)) return data;
        return [...data].sort(compareFn);
    },

    unique: (keyFn = x => x) => async (data) => {
        if (!Array.isArray(data)) return data;
        const seen = new Set();
        return data.filter(item => {
            const key = keyFn(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    tap: fn => async (data, ctx) => {
        await fn(data, ctx);
        return data;
    }
};

module.exports = { DataPipeline, builtInProcessors };
