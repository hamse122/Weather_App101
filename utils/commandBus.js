class CommandBus {
    constructor({
        defaultTimeout = 0,
        maxRetries = 0
    } = {}) {
        this.handlers = new Map();
        this.middleware = [];
        this.errorMiddleware = [];

        this.defaultTimeout = defaultTimeout;
        this.maxRetries = maxRetries;

        this.stats = {
            executed: 0,
            succeeded: 0,
            failed: 0
        };

        this.hooks = {
            beforeExecute: [],
            afterExecute: [],
            onError: []
        };
    }

    static resolveCommandName(command) {
        if (typeof command === "string") return command;
        if (typeof command === "function") return command.name;
        if (command?.constructor?.name) return command.constructor.name;

        throw new Error("Invalid command identifier");
    }

    register(command, handler, { overwrite = false } = {}) {
        const name = CommandBus.resolveCommandName(command);

        if (!handler || typeof handler.handle !== "function") {
            throw new Error(
                `Handler "${name}" must implement handle(command, context)`
            );
        }

        if (!overwrite && this.handlers.has(name)) {
            throw new Error(`Handler "${name}" already exists`);
        }

        this.handlers.set(name, handler);
        return this;
    }

    unregister(command) {
        const name = CommandBus.resolveCommandName(command);
        return this.handlers.delete(name);
    }

    has(command) {
        const name = CommandBus.resolveCommandName(command);
        return this.handlers.has(name);
    }

    use(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("Middleware must be a function");
        }

        this.middleware.push(fn);
        return this;
    }

    useError(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("Error middleware must be a function");
        }

        this.errorMiddleware.push(fn);
        return this;
    }

    hook(event, fn) {
        if (!this.hooks[event]) {
            throw new Error(`Unknown hook "${event}"`);
        }

        this.hooks[event].push(fn);
        return this;
    }

    async runHooks(name, payload) {
        for (const hook of this.hooks[name]) {
            await hook(payload);
        }
    }

    compose(middleware, handler) {
        return middleware.reduceRight(
            (next, mw) => {
                return async (ctx) => {
                    let called = false;

                    return mw(ctx.command, async () => {
                        if (called) {
                            throw new Error(
                                "next() called multiple times"
                            );
                        }

                        called = true;
                        return next(ctx);
                    }, ctx);
                };
            },
            async (ctx) => handler(ctx.command, ctx)
        );
    }

    async execute(command, options = {}) {
        const commandName = CommandBus.resolveCommandName(command);
        const handler = this.handlers.get(commandName);

        if (!handler) {
            throw new Error(
                `No handler registered for "${commandName}"`
            );
        }

        const {
            timeout = this.defaultTimeout,
            retries = this.maxRetries,
            signal,
            metadata = {}
        } = options;

        const context = {
            commandName,
            metadata,
            startedAt: Date.now(),
            aborted: false,
            retries
        };

        let abortListener;

        if (signal) {
            if (signal.aborted) {
                throw new Error("Command aborted");
            }

            abortListener = () => {
                context.aborted = true;
            };

            signal.addEventListener("abort", abortListener);
        }

        const pipeline = this.compose(
            this.middleware,
            handler.handle.bind(handler)
        );

        const run = async () => {
            if (context.aborted) {
                throw new Error("Command aborted");
            }

            return pipeline({
                command,
                ...context
            });
        };

        try {
            await this.runHooks("beforeExecute", context);

            let attempt = 0;

            while (true) {
                try {
                    let result;

                    if (timeout > 0) {
                        result = await Promise.race([
                            run(),
                            new Promise((_, reject) =>
                                setTimeout(
                                    () =>
                                        reject(
                                            new Error(
                                                "Command timed out"
                                            )
                                        ),
                                    timeout
                                )
                            )
                        ]);
                    } else {
                        result = await run();
                    }

                    context.result = result;
                    context.finishedAt = Date.now();
                    context.durationMs =
                        context.finishedAt -
                        context.startedAt;

                    this.stats.executed++;
                    this.stats.succeeded++;

                    await this.runHooks(
                        "afterExecute",
                        context
                    );

                    return result;
                } catch (err) {
                    attempt++;

                    if (attempt > retries) {
                        throw err;
                    }
                }
            }
        } catch (err) {
            this.stats.executed++;
            this.stats.failed++;

            context.error = err;

            for (const mw of this.errorMiddleware) {
                await mw(err, command, context);
            }

            await this.runHooks("onError", context);

            throw err;
        } finally {
            if (signal && abortListener) {
                signal.removeEventListener(
                    "abort",
                    abortListener
                );
            }
        }
    }

    getStats() {
        return {
            ...this.stats,
            registeredHandlers: this.handlers.size,
            middleware: this.middleware.length
        };
    }

    clear() {
        this.handlers.clear();
        this.middleware.length = 0;
        this.errorMiddleware.length = 0;

        return this;
    }
}

module.exports = CommandBus;
