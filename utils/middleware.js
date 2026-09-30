// Advanced Middleware Pipeline (2026+)

class Middleware {
    constructor(middlewares = [], options = {}) {
        this.middlewares = [];
        this.frozen = false;

        this.beforeHooks = [];
        this.afterHooks = [];
        this.errorHooks = [];

        this.defaultTimeout = options.timeout ?? 0;
        this.strict = options.strict ?? true;

        this.stats = {
            executions: 0,
            completed: 0,
            errors: 0,
            aborted: 0,
            timeouts: 0
        };

        middlewares.forEach(mw =>
            typeof mw === "function"
                ? this.use(mw)
                : this.use(mw.fn, mw)
        );
    }

    /* ==================================================
       REGISTRATION
    ================================================== */

    use(fn, options = {}) {
        this.ensureMutable();

        if (typeof fn !== "function") {
            throw new TypeError("Middleware must be a function");
        }

        if (this.middlewares.some(m => m.fn === fn)) {
            return this;
        }

        this.middlewares.push({
            fn,
            name: options.name ?? fn.name ?? "anonymous",
            priority: Number(options.priority ?? 0),
            timeout: options.timeout ?? 0,
            metadata: options.metadata ?? {}
        });

        this.middlewares.sort((a, b) => b.priority - a.priority);

        return this;
    }

    remove(fnOrName) {
        this.ensureMutable();

        this.middlewares = this.middlewares.filter(
            middleware =>
                middleware.fn !== fnOrName &&
                middleware.name !== fnOrName
        );

        return this;
    }

    clear() {
        this.ensureMutable();
        this.middlewares.length = 0;
        return this;
    }

    freeze() {
        this.frozen = true;
        return this;
    }

    unfreeze() {
        this.frozen = false;
        return this;
    }

    /* ==================================================
       CLONING
    ================================================== */

    clone() {
        const copy = new Middleware([], {
            timeout: this.defaultTimeout,
            strict: this.strict
        });

        copy.middlewares = this.middlewares.map(m => ({
            ...m,
            metadata: { ...m.metadata }
        }));

        copy.beforeHooks = [...this.beforeHooks];
        copy.afterHooks = [...this.afterHooks];
        copy.errorHooks = [...this.errorHooks];

        return copy;
    }

    /* ==================================================
       HOOKS
    ================================================== */

    before(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("Before hook must be a function");
        }

        this.beforeHooks.push(fn);
        return this;
    }

    after(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("After hook must be a function");
        }

        this.afterHooks.push(fn);
        return this;
    }

    onError(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("Error hook must be a function");
        }

        this.errorHooks.push(fn);
        return this;
    }

    /* ==================================================
       COMPOSITION
    ================================================== */

    compose() {
        const pipeline = [...this.middlewares];

        return async (
            context = {},
            finalHandler,
            options = {}
        ) => {
            const {
                signal,
                timeout = this.defaultTimeout
            } = options;

            const executionId =
                context.executionId ??
                `mw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

            context.executionId = executionId;

            let index = -1;

            const abortError = () =>
                new Error("Middleware execution aborted");

            const dispatch = async i => {
                if (i <= index) {
                    throw new Error("next() called multiple times");
                }

                if (signal?.aborted) {
                    this.stats.aborted++;
                    throw abortError();
                }

                index = i;

                const middleware =
                    i < pipeline.length
                        ? pipeline[i]
                        : null;

                const layer =
                    middleware?.fn ??
                    finalHandler;

                if (!layer) {
                    if (this.strict) {
                        throw new Error(
                            "No final middleware or finalHandler provided"
                        );
                    }

                    return;
                }

                const next = () => dispatch(i + 1);

                const execution = Promise.resolve(
                    layer(context, next)
                );

                if (middleware?.timeout > 0) {
                    return this._withTimeout(
                        execution,
                        middleware.timeout,
                        `Middleware "${middleware.name}" timeout`
                    );
                }

                return execution;
            };

            const runner = async () => {
                for (const hook of this.beforeHooks) {
                    await hook(context);
                }

                await dispatch(0);

                for (const hook of this.afterHooks) {
                    await hook(context);
                }

                return context;
            };

            this.stats.executions++;

            try {
                const result =
                    timeout > 0
                        ? await this._withTimeout(
                            runner(),
                            timeout,
                            `Middleware pipeline timeout (${timeout}ms)`
                        )
                        : await runner();

                this.stats.completed++;

                return result;
            } catch (error) {
                if (
                    error?.message?.includes("timeout")
                ) {
                    this.stats.timeouts++;
                }

                this.stats.errors++;
                context.error = error;

                await this._runErrorHooks(error, context);

                throw error;
            }
        };
    }

    /* ==================================================
       EXECUTION
    ================================================== */

    async execute(context = {}, finalHandler, options = {}) {
        return this.compose()(
            context,
            finalHandler,
            options
        );
    }

    /* ==================================================
       INTERNAL HELPERS
    ================================================== */

    async _withTimeout(promise, timeout, message) {
        let timer;

        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error(message));
                    }, timeout);
                })
            ]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    async _runErrorHooks(error, context) {
        for (const hook of this.errorHooks) {
            try {
                await hook(error, context);
            } catch (hookError) {
                // Preserve the original middleware error.
                console.error(
                    "[Middleware] Error hook failed:",
                    hookError
                );
            }
        }
    }

    ensureMutable() {
        if (this.frozen) {
            throw new Error("Middleware pipeline is frozen");
        }
    }

    /* ==================================================
       INSPECTION
       ================================================== */

    getMiddleware(name) {
        return this.middlewares.find(
            middleware => middleware.name === name
        ) ?? null;
    }

    has(name) {
        return !!this.getMiddleware(name);
    }

    list() {
        return this.middlewares.map(
            ({ fn, ...metadata }) => ({ ...metadata })
        );
    }

    getStats() {
        return Object.freeze({
            ...this.stats,
            registered: this.middlewares.length,
            frozen: this.frozen
        });
    }

    resetStats() {
        this.stats = {
            executions: 0,
            completed: 0,
            errors: 0,
            aborted: 0,
            timeouts: 0
        };

        return this;
    }
}

module.exports = Middleware;
