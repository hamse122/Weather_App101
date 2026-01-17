class CommandBus {
    constructor({ defaultTimeout = 0 } = {}) {
        this.handlers = new Map();
        this.middleware = [];
        this.errorMiddleware = [];
        this.defaultTimeout = defaultTimeout;
    }

    // Resolve command name safely
    static resolveCommandName(command) {
        if (typeof command === "string") return command;
        if (typeof command === "function") return command.name;
        if (command?.constructor?.name) return command.constructor.name;
        throw new Error("Invalid command identifier");
    }

    // Register handler
    register(command, handler, { overwrite = false } = {}) {
        const name = CommandBus.resolveCommandName(command);

        if (!handler || typeof handler.handle !== "function") {
            throw new Error(`Handler for "${name}" must implement handle(command, context)`);
        }

        if (!overwrite && this.handlers.has(name)) {
            throw new Error(`Handler for "${name}" already registered`);
        }

        this.handlers.set(name, handler);
        return this;
    }

    unregister(command) {
        const name = CommandBus.resolveCommandName(command);
        this.handlers.delete(name);
        return this;
    }

    // Standard middleware
    use(fn) {
        if (typeof fn !== "function") {
            throw new Error("Middleware must be a function");
        }
        this.middleware.push(fn);
        return this;
    }

    // Error middleware: (error, command, context) => {}
    useError(fn) {
        if (typeof fn !== "function") {
            throw new Error("Error middleware must be a function");
        }
        this.errorMiddleware.push(fn);
        return this;
    }

    // Compose middleware safely
    compose(middleware, handler) {
        return middleware.reduceRight(
            (next, mw) => async (ctx) => mw(ctx.command, () => next(ctx), ctx),
            async (ctx) => handler(ctx.command, ctx)
        );
    }

    async execute(command, options = {}) {
        const commandName = CommandBus.resolveCommandName(command);
        const handler = this.handlers.get(commandName);

        if (!handler) {
            throw new Error(`No handler registered for "${commandName}"`);
        }

        const {
            timeout = this.defaultTimeout,
            signal,
            metadata = {}
        } = options;

        const context = {
            commandName,
            metadata,
            startedAt: Date.now(),
            aborted: false
        };

        if (signal) {
            if (signal.aborted) throw new Error("Command aborted before execution");
            signal.addEventListener("abort", () => {
                context.aborted = true;
            });
        }

        const pipeline = this.compose(this.middleware, handler.handle.bind(handler));

        const run = async () => {
            const result = await pipeline({ command, ...context });
            context.finishedAt = Date.now();
            context.durationMs = context.finishedAt - context.startedAt;
            context.result = result;
            return result;
        };

        try {
            if (timeout > 0) {
                return await Promise.race([
                    run(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Command timed out")), timeout)
                    )
                ]);
            }
            return await run();
        } catch (err) {
            for (const errorMw of this.errorMiddleware) {
                await errorMw(err, command, context);
            }
            throw err;
        }
    }
}

module.exports = CommandBus;
