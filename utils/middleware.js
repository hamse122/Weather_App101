// Advanced Middleware Pipeline (2026)

class Middleware {
    constructor(middlewares = [], options = {}) {
        this.middlewares = [];
        this.frozen = false;
        this.beforeHooks = [];
        this.afterHooks = [];
        this.stats = {
            executions: 0,
            errors: 0
        };

        middlewares.forEach(mw => this.use(mw));

        this.defaultTimeout = options.timeout ?? 0;
    }

    use(fn, options = {}) {
        if (this.frozen) {
            throw new Error("Middleware pipeline is frozen");
        }

        if (typeof fn !== "function") {
            throw new TypeError("Middleware must be a function");
        }

        if (this.middlewares.some(m => m.fn === fn)) {
            return this;
        }

        const middleware = {
            fn,
            name: options.name ?? fn.name ?? "anonymous",
            priority: options.priority ?? 0
        };

        this.middlewares.push(middleware);
        this.middlewares.sort((a, b) => b.priority - a.priority);

        return this;
    }

    remove(fn) {
        if (this.frozen) {
            throw new Error("Middleware pipeline is frozen");
        }

        this.middlewares = this.middlewares.filter(m => m.fn !== fn);
        return this;
    }

    clear() {
        if (this.frozen) {
            throw new Error("Middleware pipeline is frozen");
        }

        this.middlewares.length = 0;
        return this;
    }

    freeze() {
        this.frozen = true;
        return this;
    }

    clone() {
        const copy = new Middleware([], {
            timeout: this.defaultTimeout
        });

        copy.middlewares = this.middlewares.map(m => ({ ...m }));
        copy.beforeHooks = [...this.beforeHooks];
        copy.afterHooks = [...this.afterHooks];

        return copy;
    }

    before(fn) {
        this.beforeHooks.push(fn);
        return this;
    }

    after(fn) {
        this.afterHooks.push(fn);
        return this;
    }

    compose() {
        const pipeline = [...this.middlewares];

        return async (
            context = {},
            finalHandler,
            {
                signal,
                timeout = this.defaultTimeout
            } = {}
        ) => {
            let index = -1;

            const dispatch = async i => {
                if (i <= index) {
                    throw new Error("next() called multiple times");
                }

                if (signal?.aborted) {
                    throw new Error("Middleware execution aborted");
                }

                index = i;

                const layer =
                    i < pipeline.length
                        ? pipeline[i].fn
                        : finalHandler;

                if (!layer) return;

                return Promise.resolve(
                    layer(context, () => dispatch(i + 1))
                );
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
                if (timeout > 0) {
                    return await Promise.race([
                        runner(),
                        new Promise((_, reject) =>
                            setTimeout(
                                () =>
                                    reject(
                                        new Error(
                                            `Middleware timeout (${timeout}ms)`
                                        )
                                    ),
                                timeout
                            )
                        )
                    ]);
                }

                return await runner();
            } catch (err) {
                this.stats.errors++;
                context.error = err;
                throw err;
            }
        };
    }

    async execute(context = {}, finalHandler, options = {}) {
        return this.compose()(context, finalHandler, options);
    }

    getStats() {
        return Object.freeze({
            ...this.stats,
            registered: this.middlewares.length
        });
    }
}

module.exports = Middleware;
