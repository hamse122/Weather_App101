/**
 * Advanced Command Bus (v2)
 * - Middleware pipeline
 * - Async execution
 * - Timeout & cancellation
 * - Retry with exponential backoff
 * - Lifecycle hooks
 * - Error middleware
 * - Execution metrics
 * - Command validation
 * - Idempotency support
 * - Safe cleanup
 */

class CommandBus {
    constructor({
        defaultTimeout = 0,
        maxRetries = 0,
        retryDelay = 250,
        maxRetryDelay = 10000,
        backoffFactor = 2
    } = {}) {
        this.handlers = new Map();
        this.middleware = [];
        this.errorMiddleware = [];

        this.defaultTimeout = defaultTimeout;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.maxRetryDelay = maxRetryDelay;
        this.backoffFactor = backoffFactor;

        this.inFlight = new Map();
        this.idempotencyKeys = new Map();

        this.stats = {
            executed: 0,
            succeeded: 0,
            failed: 0,
            retried: 0,
            cancelled: 0,
            timedOut: 0
        };

        this.hooks = {
            beforeExecute: [],
            afterExecute: [],
            onError: [],
            onRetry: [],
            onCancel: []
        };
    }

    /* ============================
       COMMAND REGISTRATION
    ============================ */

    static resolveCommandName(command) {
        if (typeof command === "string" && command.trim()) {
            return command.trim();
        }

        if (typeof command === "function" && command.name) {
            return command.name;
        }

        if (command?.constructor?.name &&
            command.constructor.name !== "Object") {
            return command.constructor.name;
        }

        throw new TypeError("Invalid command identifier");
    }

    register(command, handler, { overwrite = false } = {}) {
        const name = CommandBus.resolveCommandName(command);

        if (!handler || typeof handler.handle !== "function") {
            throw new TypeError(
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
        return this.handlers.delete(
            CommandBus.resolveCommandName(command)
        );
    }

    has(command) {
        return this.handlers.has(
            CommandBus.resolveCommandName(command)
        );
    }

    /* ============================
       MIDDLEWARE
    ============================ */

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

        if (typeof fn !== "function") {
            throw new TypeError("Hook must be a function");
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
            (next, mw) => async ctx => {
                let called = false;

                return mw(
                    ctx.command,
                    async () => {
                        if (called) {
                            throw new Error(
                                "next() called multiple times"
                            );
                        }

                        called = true;
                        return next(ctx);
                    },
                    ctx
                );
            },
            async ctx => handler(ctx.command, ctx)
        );
    }

    /* ============================
       EXECUTION
    ============================ */

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
            metadata = {},
            idempotencyKey
        } = options;

        if (!Number.isInteger(retries) || retries < 0) {
            throw new TypeError("Retries must be a non-negative integer");
        }

        if (idempotencyKey != null) {
            if (typeof idempotencyKey !== "string" ||
                !idempotencyKey.trim()) {
                throw new TypeError("Invalid idempotency key");
            }

            if (this.idempotencyKeys.has(idempotencyKey)) {
                return this.idempotencyKeys.get(idempotencyKey);
            }
        }

        if (signal?.aborted) {
            throw new Error("Command aborted");
        }

        const startedAt = Date.now();

        const context = {
            commandName,
            metadata,
            startedAt,
            attempt: 0,
            retries,
            signal,
            aborted: false
        };

        const executionId =
            `${commandName}:${startedAt}:${Math.random().toString(36).slice(2)}`;

        const pipeline = this.compose(
            this.middleware,
            handler.handle.bind(handler)
        );

        let timeoutId;
        let abortListener;

        const executeAttempt = async () => {
            if (signal?.aborted) {
                throw new Error("Command aborted");
            }

            return pipeline({
                command,
                ...context,
                executionId
            });
        };

        const execution = (async () => {
            try {
                await this.runHooks("beforeExecute", context);

                let result;

                for (let attempt = 0; ; attempt++) {
                    context.attempt = attempt + 1;

                    try {
                        result = await executeAttempt();
                        break;
                    } catch (error) {
                        if (signal?.aborted) {
                            throw error;
                        }

                        if (attempt >= retries) {
                            throw error;
                        }

                        this.stats.retried++;

                        const delay = Math.min(
                            this.retryDelay *
                            Math.pow(this.backoffFactor, attempt),
                            this.maxRetryDelay
                        );

                        await this.runHooks("onRetry", {
                            ...context,
                            error,
                            delay
                        });

                        await new Promise((resolve, reject) => {
                            const timer = setTimeout(resolve, delay);

                            if (signal) {
                                const onAbort = () => {
                                    clearTimeout(timer);
                                    reject(new Error("Command aborted"));
                                };

                                signal.addEventListener(
                                    "abort",
                                    onAbort,
                                    { once: true }
                                );
                            }
                        });
                    }
                }

                context.result = result;
                context.finishedAt = Date.now();
                context.durationMs =
                    context.finishedAt - startedAt;

                this.stats.succeeded++;

                await this.runHooks("afterExecute", context);

                return result;

            } catch (error) {
                context.error = error;
                context.finishedAt = Date.now();
                context.durationMs =
                    context.finishedAt - startedAt;

                this.stats.failed++;

                if (signal?.aborted) {
                    this.stats.cancelled++;
                    await this.runHooks("onCancel", context);
                }

                if (error?.message === "Command timed out") {
                    this.stats.timedOut++;
                }

                for (const mw of this.errorMiddleware) {
                    try {
                        await mw(error, command, context);
                    } catch (middlewareError) {
                        error.middlewareError ??= middlewareError;
                    }
                }

                await this.runHooks("onError", context);

                throw error;

            } finally {
                this.stats.executed++;
            }
        })();

        let finalExecution = execution;

        if (timeout > 0) {
            finalExecution = Promise.race([
                execution,
                new Promise((_, reject) => {
                    timeoutId = setTimeout(
                        () => reject(new Error("Command timed out")),
                        timeout
                    );
                })
            ]);
        }

        if (signal) {
            abortListener = () => {
                context.aborted = true;
            };

            signal.addEventListener("abort", abortListener, {
                once: true
            });
        }

        const tracked = finalExecution.finally(() => {
            clearTimeout(timeoutId);

            if (signal && abortListener) {
                signal.removeEventListener(
                    "abort",
                    abortListener
                );
            }

            this.inFlight.delete(executionId);
        });

        this.inFlight.set(executionId, tracked);

        if (idempotencyKey) {
            this.idempotencyKeys.set(idempotencyKey, tracked);

            tracked.catch(() => {
                if (this.idempotencyKeys.get(idempotencyKey) === tracked) {
                    this.idempotencyKeys.delete(idempotencyKey);
                }
            });
        }

        return tracked;
    }

    /* ============================
       MONITORING
    ============================ */

    getStats() {
        const total = this.stats.executed;

        return {
            ...this.stats,
            registeredHandlers: this.handlers.size,
            middleware: this.middleware.length,
            errorMiddleware: this.errorMiddleware.length,
            inFlight: this.inFlight.size,
            successRate: total
                ? this.stats.succeeded / total
                : 0
        };
    }

    async drain() {
        await Promise.allSettled([...this.inFlight.values()]);
    }

    /* ============================
       CLEANUP
    ============================ */

    clear() {
        this.handlers.clear();
        this.middleware.length = 0;
        this.errorMiddleware.length = 0;

        for (const hooks of Object.values(this.hooks)) {
            hooks.length = 0;
        }

        this.idempotencyKeys.clear();

        return this;
    }
}

module.exports = CommandBus;
