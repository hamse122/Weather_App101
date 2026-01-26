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

    registerHook(type, fn) {
        if (!this.hooks[type]) throw new Error(`Invalid hook: ${type}`);
        this.hooks[type].push(fn);
        return this;
    }

    async runHooks(type, data, context) {
        for (const hook of this.hooks[type]) {
            await hook(data, context);
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

    async withRetryAndTimeout(fn, { retries = 0, timeout } = {}) {
        let attempt = 0;

        const run = async () => {
            attempt++;
            try {
                if (!timeout) return await fn();

                return await Promise.race([
                    fn(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout exceeded')), timeout)
                    )
                ]);
            } catch (err) {
                if (attempt > retries) throw err;
                return run();
            }
        };

        return run();
    }

    unregisterAll() {
        this.commandHandlers.clear();
        this.queryHandlers.clear();
        this.eventHandlers.clear();
    }

    stats() {
        return {
            commands: this.commandHandlers.size,
            queries: this.queryHandlers.size,
            events: [...this.eventHandlers.entries()]
                .reduce((a, [k, v]) => ({ ...a, [k]: v.length }), {})
        };
    }
}

module.exports = CQRS;

