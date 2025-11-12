// GraphQL resolver utilities
class GraphQLResolver {
    constructor() {
        this.resolvers = new Map();
        this.directives = new Map();
        this.middleware = [];
    }

    addResolver(type, field, resolver) {
        if (!this.resolvers.has(type)) {
            this.resolvers.set(type, new Map());
        }
        this.resolvers.get(type).set(field, resolver);
        return this;
    }

    getResolver(type, field) {
        return this.resolvers.get(type)?.get(field);
    }

    addDirective(name, directive) {
        this.directives.set(name, directive);
        return this;
    }

    use(middleware) {
        this.middleware.push(middleware);
        return this;
    }

    async resolve(parent, args, context, info) {
        const { parentType, fieldName } = info;
        const resolver = this.getResolver(parentType.name, fieldName);

        if (!resolver) {
            return parent ? parent[fieldName] : undefined;
        }

        let index = 0;
        const next = async () => {
            if (index < this.middleware.length) {
                const middleware = this.middleware[index++];
                return await middleware(parent, args, context, info, next);
            }
            return await resolver(parent, args, context, info);
        };

        return await next();
    }

    buildResolvers() {
        const resolvers = {};

        for (const [typeName, fields] of this.resolvers) {
            resolvers[typeName] = {};
            for (const [fieldName] of fields) {
                resolvers[typeName][fieldName] = (parent, args, context, info) =>
                    this.resolve(parent, args, context, info);
            }
        }

        return resolvers;
    }
}

module.exports = GraphQLResolver;

