// Enhanced Command Bus with middleware pipeline
class CommandBus {
    constructor() {
        this.handlers = new Map();
        this.middleware = [];
    }

    // Register a handler for a specific command
    register(commandName, handler) {
        if (!commandName || typeof commandName !== "string") {
            throw new Error("Command name must be a non-empty string");
        }

        if (this.handlers.has(commandName)) {
            throw new Error(`Handler for "${commandName}" is already registered`);
        }

        if (!handler || typeof handler.handle !== "function") {
            throw new Error(`Handler for "${commandName}" must implement a handle(command) method`);
        }

        this.handlers.set(commandName, handler);
        return this;
    }

    // Add middleware to the pipeline
    use(middleware) {
        if (typeof middleware !== "function") {
            throw new Error("Middleware must be a function: (command, next, context) => {}");
        }

        if (this.middleware.includes(middleware)) {
            console.warn("Attempted to add duplicate middleware. Skipping.");
            return this;
        }

        this.middleware.push(middleware);
        return this;
    }

    // Execute a command through middleware -> handler pipeline
    async execute(command) {
        if (!command || !command.constructor?.name) {
            throw new Error("Invalid command: must have a constructor with a name");
        }

        const commandName = command.constructor.name;
        const handler = this.handlers.get(commandName);

        if (!handler) {
            throw new Error(`No handler registered for command "${commandName}"`);
        }

        let index = 0;
        const context = {}; // optional shared state for middleware

        const next = async () => {
            if (index < this.middleware.length) {
                const middleware = this.middleware[index++];
                try {
                    return await middleware(command, next, context);
                } catch (err) {
                    console.error(`Middleware error in command "${commandName}":`, err);
                    throw err;
                }
            }

            try {
                return await handler.handle(command, context);
            } catch (err) {
                console.error(`Handler error in "${commandName}":`, err);
                throw err;
            }
        };

        return await next();
    }

    // Remove handler
    unregister(commandName) {
        this.handlers.delete(commandName);
        return this;
    }
}

module.exports = CommandBus;
