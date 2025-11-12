// Middleware pipeline system
class Middleware {
    constructor() {
        this.middlewares = [];
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    async execute(context, finalHandler) {
        let index = 0;

        const next = async () => {
            if (index < this.middlewares.length) {
                const middleware = this.middlewares[index++];
                await middleware(context, next);
            } else if (finalHandler) {
                await finalHandler(context);
            }
        };

        await next();
        return context;
    }

    compose() {
        return (context, finalHandler) => this.execute(context, finalHandler);
    }

    clear() {
        this.middlewares = [];
    }
}

module.exports = Middleware;

