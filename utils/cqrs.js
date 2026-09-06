class CQRS {
    constructor({ logger = console } = {}) {
        this.commandHandlers = new Map();
        this.queryHandlers = new Map();
        this.eventHandlers = new Map();

        this.middlewares = {
            command: [],
            query: [],
            event: []
        };
        

        this.hooks = {
            beforeCommand: [],
            afterCommand: [],
            beforeQuery: [],
            afterQuery: []
        };

        this.logger = logger;
    }

    /* -------------------- Middleware -------------------- */

    registerMiddleware(type, middleware) {
        if (!this.middlewares[type]) {
            throw new Error(`Invalid middleware type: ${type}`);
        }
        this.middlewares[type].push(middleware);
        return this;
    }

    async runMiddlewares(type, payload, context, finalHandler) {
        const stack = this.middlewares[type];

        let index = -1;
        const dispatch = async (i) => {
            if (i <= index) throw new Error('next() called multiple times');
            index = i;
            const fn = stack[i] || finalHandler;
            if (!fn) return;
            return fn(payload, context, () => dispatch(i + 1));
        };

        return dispatch(0);
    }

/* -------------------- Hooks -------------------- */

registerHook(type, fn, options = {}) {
    if (!this.hooks[type]) {
        throw new Error(`Invalid hook: ${type}`);
    }

    if (typeof fn !== "function") {
        throw new TypeError("Hook must be a function");
    }

    const hook = {
        id: options.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        fn,
        priority: options.priority ?? 0,
        once: !!options.once,
        enabled: options.enabled !== false
    };

    this.hooks[type].push(hook);

    // Highest priority runs first
    this.hooks[type].sort((a, b) => b.priority - a.priority);

    return hook.id;
}

async runHooks(type, data, context = {}) {
    const hooks = this.hooks[type];

    if (!hooks?.length) {
        return;
    }

    const remove = [];

    for (const hook of hooks) {

        if (!hook.enabled) continue;

        try {
            await Promise.resolve(
                hook.fn(data, context)
            );

            if (hook.once) {
                remove.push(hook.id);
            }

        } catch (err) {

            if (context?.continueOnError !== true) {
                throw err;
            }

            context.errors ??= [];
            context.errors.push({
                hook: hook.id,
                error: err
            });
        }
    }

    // Remove one-time hooks
    if (remove.length) {
        this.hooks[type] = hooks.filter(
            h => !remove.includes(h.id)
        );
    }
}

    /* -------------------- Commands -------------------- */

    registerCommand(name, handler) {
        if (typeof handler.execute !== 'function') {
            throw new Error(`Command handler ${name} must implement execute()`);
        }
        this.commandHandlers.set(name, handler);
        return this;
    }

    async executeCommand(command, context = {}, options = {}) {
        const name = command.constructor?.name;
        const handler = this.commandHandlers.get(name);
        if (!handler) throw new Error(`No handler for command: ${name}`);

        await this.runHooks('beforeCommand', command, context);

        const exec = async () =>
            this.runMiddlewares('command', command, context, () =>
                handler.execute(command, context)
            );

        const result = await this.withRetryAndTimeout(exec, options);

        await this.runHooks('afterCommand', result, context);
        return result;
    }

    /* -------------------- Queries -------------------- */

    registerQuery(name, handler) {
        if (typeof handler.handle !== 'function') {
            throw new Error(`Query handler ${name} must implement handle()`);
        }
        this.queryHandlers.set(name, handler);
        return this;
    }

    async executeQuery(query, context = {}, options = {}) {
        const name = query.constructor?.name;
        const handler = this.queryHandlers.get(name);
        if (!handler) throw new Error(`No handler for query: ${name}`);

        await this.runHooks('beforeQuery', query, context);

        const exec = async () =>
            this.runMiddlewares('query', query, context, () =>
                handler.handle(query, context)
            );

        const result = await this.withRetryAndTimeout(exec, options);

        await this.runHooks('afterQuery', result, context);
        return result;
    }

    /* -------------------- Events -------------------- */

    registerEvent(name, handler, { once = false } = {}) {
        if (typeof handler.handle !== 'function') {
            throw new Error(`Event handler must implement handle()`);
        }

        if (!this.eventHandlers.has(name)) {
            this.eventHandlers.set(name, []);
        }

        this.eventHandlers.get(name).push({ handler, once });
        return this;
    }

    async publishEvent(event, context = {}) {
        const name = event.constructor?.name;
        const handlers = this.eventHandlers.get(name) || [];

        await this.runMiddlewares('event', event, context, async () => {
            await Promise.all(
                handlers.map(async (wrapper) => {
                    try {
                        await wrapper.handler.handle(event, context);
                    } catch (err) {
                        this.logger.error(`Event error (${name})`, err);
                    }
                })
            );
        });

        this.eventHandlers.set(
            name,
            handlers.filter(h => !h.once)
        );
    }

/* -------------------- Utilities -------------------- */

async withRetryAndTimeout(
    fn,
    {
        retries = 0,
        timeout = 0,
        retryDelay = 0,
        onRetry = null
    } = {}
) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }

    if (!Number.isInteger(retries) || retries < 0) {
        throw new TypeError("retries must be a non-negative integer");
    }

    if (timeout < 0 || retryDelay < 0) {
        throw new TypeError("timeout and retryDelay must be >= 0");
    }

    let attempt = 0;

    const sleep = ms =>
        ms > 0
            ? new Promise(resolve => setTimeout(resolve, ms))
            : Promise.resolve();

    while (attempt <= retries) {
        attempt++;

        let timer = null;

        try {
            const operation = Promise.resolve().then(fn);

            if (timeout > 0) {
                const timeoutPromise = new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        reject(
                            Object.assign(
                                new Error(`Timeout exceeded after ${timeout}ms`),
                                { code: "ETIMEDOUT" }
                            )
                        );
                    }, timeout);
                });

                return await Promise.race([
                    operation,
                    timeoutPromise
                ]);
            }

            return await operation;
        } catch (error) {
            if (attempt > retries) {
                throw error;
            }

            if (typeof onRetry === "function") {
                await onRetry(error, {
                    attempt,
                    retriesRemaining: retries - attempt + 1
                });
            }

            await sleep(retryDelay);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }
}

unregisterAll() {
    this.commandHandlers.clear();
    this.queryHandlers.clear();
    this.eventHandlers.clear();

    return this;
}

stats() {
    const events = {};

    for (const [event, handlers] of this.eventHandlers.entries()) {
        events[event] = Array.isArray(handlers)
            ? handlers.length
            : 0;
    }

    return Object.freeze({
        commands: this.commandHandlers.size,
        queries: this.queryHandlers.size,
        events
    });
}
