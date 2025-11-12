// Command bus with middleware support
class CommandBus {
    constructor() {
        this.handlers = new Map();
        this.middleware = [];
    }

    register(commandName, handler) {
        if (this.handlers.has(commandName)) {
            throw new Error(`Handler for ${commandName} already registered`);
        }
        if (!handler || typeof handler.handle !== 'function') {
            throw new Error(`Handler for ${commandName} must implement a handle method`);
        }
        this.handlers.set(commandName, handler);
        return this;
    }

    use(middleware) {
        this.middleware.push(middleware);
        return this;
    }

    async execute(command) {
        const commandName = command.constructor?.name;
        if (!commandName) {
            throw new Error('Command must have a constructor with a name');
        }

        const handler = this.handlers.get(commandName);

        if (!handler) {
            throw new Error(`No handler registered for ${commandName}`);
        }

        let index = 0;
        const next = async () => {
            if (index < this.middleware.length) {
                const middleware = this.middleware[index++];
                return await middleware(command, next);
            }
            return await handler.handle(command);
        };

        return await next();
    }

    unregister(commandName) {
        this.handlers.delete(commandName);
        return this;
    }
}

module.exports = CommandBus;

