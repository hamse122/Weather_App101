// CQRS pattern implementation
class CQRS {
    constructor() {
        this.commandHandlers = new Map();
        this.queryHandlers = new Map();
        this.eventHandlers = new Map();
        this.middlewares = {
            command: [],
            query: [],
            event: []
        };
    }

    // Register middleware for commands, queries, or events
    registerMiddleware(type, middleware) {
        if (!this.middlewares[type]) {
            throw new Error(`Invalid middleware type: ${type}. Must be 'command', 'query', or 'event'`);
        }
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.middlewares[type].push(middleware);
        return this;
    }

    // Execute middlewares in sequence
    async executeMiddlewares(type, data, context = {}) {
        for (const middleware of this.middlewares[type]) {
            await middleware(data, context);
        }
    }

    registerCommand(commandName, handler) {
        if (!handler || typeof handler.execute !== 'function') {
            throw new Error(`Command handler for ${commandName} must implement an execute method`);
        }
        this.commandHandlers.set(commandName, handler);
        return this;
    }

    async executeCommand(command, context = {}) {
        const commandName = command.constructor?.name;
        if (!commandName) {
            throw new Error('Command must have a constructor with a name');
        }
        
        // Execute command middlewares
        await this.executeMiddlewares('command', command, context);
        
        const handler = this.commandHandlers.get(commandName);
        if (!handler) {
            throw new Error(`No handler for command: ${commandName}`);
        }
        
        console.log(`Executing command: ${commandName}`, command);
        const result = await handler.execute(command);
        console.log(`Command ${commandName} executed successfully`);
        
        return result;
    }

    registerQuery(queryName, handler) {
        if (!handler || typeof handler.handle !== 'function') {
            throw new Error(`Query handler for ${queryName} must implement a handle method`);
        }
        this.queryHandlers.set(queryName, handler);
        return this;
    }

    async executeQuery(query, context = {}) {
        const queryName = query.constructor?.name;
        if (!queryName) {
            throw new Error('Query must have a constructor with a name');
        }
        
        // Execute query middlewares
        await this.executeMiddlewares('query', query, context);
        
        const handler = this.queryHandlers.get(queryName);
        if (!handler) {
            throw new Error(`No handler for query: ${queryName}`);
        }
        
        console.log(`Executing query: ${queryName}`, query);
        const result = await handler.handle(query);
        console.log(`Query ${queryName} executed successfully`);
        
        return result;
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

    async publishEvent(event, context = {}) {
        const eventName = event.constructor?.name;
        if (!eventName) {
            throw new Error('Event must have a constructor with a name');
        }
        
        // Execute event middlewares
        await this.executeMiddlewares('event', event, context);
        
        const handlers = this.eventHandlers.get(eventName) || [];
        const results = [];

        console.log(`Publishing event: ${eventName} to ${handlers.length} handlers`, event);

        for (const handler of handlers) {
            try {
                console.log(`Processing event ${eventName} with handler: ${handler.constructor?.name}`);
                const result = await handler.handle(event);
                results.push(result);
                console.log(`Event ${eventName} handled successfully by ${handler.constructor?.name}`);
            } catch (error) {
                console.error(`Event handling error for ${eventName}:`, error);
                // Optionally re-throw or continue based on requirements
            }
        }

        console.log(`Event ${eventName} published to all handlers`);
        return results;
    }

    // Get statistics about registered handlers
    getStats() {
        return {
            commands: this.commandHandlers.size,
            queries: this.queryHandlers.size,
            events: Array.from(this.eventHandlers.entries()).reduce((acc, [key, handlers]) => {
                acc[key] = handlers.length;
                return acc;
            }, {}),
            middlewares: {
                command: this.middlewares.command.length,
                query: this.middlewares.query.length,
                event: this.middlewares.event.length
            }
        };
    }

    // Clear all handlers (useful for testing)
    clear() {
        this.commandHandlers.clear();
        this.queryHandlers.clear();
        this.eventHandlers.clear();
        this.middlewares.command = [];
        this.middlewares.query = [];
        this.middlewares.event = [];
        console.log('CQRS system cleared');
    }

    // List all registered handlers
    listHandlers() {
        return {
            commands: Array.from(this.commandHandlers.keys()),
            queries: Array.from(this.queryHandlers.keys()),
            events: Array.from(this.eventHandlers.keys())
        };
    }
}

module.exports = CQRS;
