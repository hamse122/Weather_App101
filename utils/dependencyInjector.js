// Dependency Injection container
class DependencyInjector {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
    }

    register(name, implementation, options = {}) {
        const { singleton = false, factory = false, dependencies = [] } = options;

        if (singleton) {
            this.singletons.set(name, { implementation, dependencies });
        } else if (factory) {
            this.factories.set(name, { implementation, dependencies });
        } else {
            this.services.set(name, { implementation, dependencies });
        }

        return this;
    }

    get(name) {
        if (this.singletons.has(name)) {
            const singleton = this.singletons.get(name);
            if (!singleton.instance) {
                singleton.instance = this.createInstance(singleton);
            }
            return singleton.instance;
        }

        if (this.factories.has(name)) {
            const factory = this.factories.get(name);
            return this.createInstance(factory);
        }

        if (this.services.has(name)) {
            const service = this.services.get(name);
            return this.createInstance(service);
        }

        throw new Error(`Service ${name} not found`);
    }

    createInstance(service) {
        const { implementation, dependencies } = service;

        if (typeof implementation === 'function') {
            const resolvedDependencies = (dependencies || []).map(dep => this.get(dep));
            if (this.isClass(implementation)) {
                return new implementation(...resolvedDependencies);
            }
            return implementation(...resolvedDependencies);
        }

        return implementation;
    }

    factory(name, factoryFn, dependencies = []) {
        return this.register(name, factoryFn, { factory: true, dependencies });
    }

    singleton(name, implementation, dependencies = []) {
        return this.register(name, implementation, { singleton: true, dependencies });
    }

    value(name, value) {
        return this.register(name, value);
    }

    has(name) {
        return this.services.has(name) || this.singletons.has(name) || this.factories.has(name);
    }

    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
    }

    isClass(func) {
        return typeof func === 'function' && /^class\s/.test(Function.prototype.toString.call(func));
    }
}

module.exports = DependencyInjector;

