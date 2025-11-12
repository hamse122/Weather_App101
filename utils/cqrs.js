// CQRS pattern implementation
class CQRS {
    constructor() {
        this.commandHandlers = new Map();
        this.queryHandlers = new Map();
        this.eventHandlers = new Map();
    }

    registerCommand(commandName, handler) {
        if (!handler || typeof handler.execute !== 'function') {
            throw new Error(`Command handler for ${commandName} must implement an execute method`);
        }
        this.commandHandlers.set(commandName, handler);
        return this;
    }

    async executeCommand(command) {
        const commandName = command.constructor?.name;
        if (!commandName) {
            throw new Error('Command must have a constructor with a name');
        }
        const handler = this.commandHandlers.get(commandName);
        if (!handler) {
            throw new Error(`No handler for command: ${commandName}`);
        }
        return await handler.execute(command);
    }

    registerQuery(queryName, handler) {
        if (!handler || typeof handler.handle !== 'function') {
            throw new Error(`Query handler for ${queryName} must implement a handle method`);
        }
        this.queryHandlers.set(queryName, handler);
        return this;
    }

    async executeQuery(query) {
        const queryName = query.constructor?.name;
        if (!queryName) {
            throw new Error('Query must have a constructor with a name');
        }
        const handler = this.queryHandlers.get(queryName);
        if (!handler) {
            throw new Error(`No handler for query: ${queryName}`);
        }
        return await handler.handle(query);
    }

    registerEvent(eventName, handler) {
        if (!handler || typeof handler.handle !== 'function') {
            throw new Error(`Event handler for ${eventName} must implement a handle method`);
        }
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
        return this;
    }

    async publishEvent(event) {
        const eventName = event.constructor?.name;
        if (!eventName) {
            throw new Error('Event must have a constructor with a name');
        }
        const handlers = this.eventHandlers.get(eventName) || [];
        const results = [];

        for (const handler of handlers) {
            try {
                const result = await handler.handle(event);
                results.push(result);
            } catch (error) {
                console.error('Event handling error:', error);
            }
        }

        return results;
    }
}

module.exports = CQRS;

