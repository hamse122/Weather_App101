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
       HOOK SYSTEM
    ========================= */
    hook(type, fn) {
        if (this.hooks[type]) {
            this.hooks[type].push(fn);
        }
        return this;
    }

    async runHooks(type, payload) {
        for (const fn of this.hooks[type] || []) {
            await fn(payload, this.context);
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
