// Advanced GraphQL Resolver Utility
class GraphQLResolver {
    constructor(options = {}) {
        this.resolvers = new Map();          // type -> field -> config
        this.directives = new Map();         // name -> fn
        this.globalMiddleware = [];

        this.enableCache = options.cache ?? false;
        this.cache = new Map();
        this.onError = options.onError || null;
    }

    // -------------------------
    // RESOLVERS
    // -------------------------
    addResolver(type, field, resolver, options = {}) {
        if (!this.resolvers.has(type)) {
            this.resolvers.set(type, new Map());
        }

        this.resolvers.get(type).set(field, {
            resolver,
            middleware: options.middleware || [],
            cache: options.cache ?? false
        });

        return this;
    }

    getResolver(type, field) {
        return this.resolvers.get(type)?.get(field);
    }

    // -------------------------
    // MIDDLEWARE
    // -------------------------
    use(middleware) {
        this.globalMiddleware.push(middleware);
        return this;
    }

    // -------------------------
    // DIRECTIVES
    // -------------------------
    addDirective(name, directiveFn) {
        this.directives.set(name, directiveFn);
        return this;
    }

    async applyDirectives(resolverFn, parent, args, ctx, info) {
        const fieldDirectives = info?.fieldNodes?.[0]?.directives || [];

        let fn = resolverFn;

        for (const dir of fieldDirectives) {
            const directive = this.directives.get(dir.name.value);
            if (directive) {
                fn = directive(fn, dir, ctx);
            }
        }

        return fn(parent, args, ctx, info);
    }

    // -------------------------
    // EXECUTION PIPELINE
    // -------------------------
    async executeMiddleware(stack, parent, args, ctx, info, resolverFn) {
        let index = 0;

        const next = async () => {
            if (index < stack.length) {
                return stack[index++](parent, args, ctx, info, next);
            }
            return resolverFn(parent, args, ctx, info);
        };

        return next();
    }

    async resolve(parent, args, context, info) {
        const { parentType, fieldName } = info;
        const config = this.getResolver(parentType.name, fieldName);

        if (!config) {
            return parent?.[fieldName];
        }

        const cacheKey = `${parentType.name}.${fieldName}:${JSON.stringify(args)}`;

        if (this.enableCache && config.cache && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const resolverFn = async (p, a, c, i) =>
                this.applyDirectives(config.resolver, p, a, c, i);

            const result = await this.executeMiddleware(
                [...this.globalMiddleware, ...config.middleware],
                parent,
                args,
                context,
                info,
                resolverFn
            );

            if (this.enableCache && config.cache) {
                this.cache.set(cacheKey, result);
            }

            return result;
        } catch (error) {
            if (this.onError) {
                this.onError(error, { parent, args, context, info });
            }
            throw error;
        }
    }

    // -------------------------
    // BUILD GRAPHQL RESOLVERS
    // -------------------------
    buildResolvers() {
        const resolvers = {};

        for (const [typeName, fields] of this.resolvers) {
            resolvers[typeName] = {};
            for (const fieldName of fields.keys()) {
                resolvers[typeName][fieldName] = (parent, args, ctx, info) =>
                    this.resolve(parent, args, ctx, info);
            }
        }

        return resolvers;
    }

    // -------------------------
    // UTILITIES
    // -------------------------
    clearCache() {
        this.cache.clear();
    }
}

module.exports = GraphQLResolver;
