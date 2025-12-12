/**
 * Advanced Dependency Injection Container
 * - Supports Singletons, Factories, Transients, Scopes
 * - Auto dependency resolution via parameter introspection
 * - Async providers
 * - Lifecycle hooks (onInit / onDestroy)
 * - Circular dependency detection
 * - Aliases
 */

class DependencyInjector {
    constructor({ strict = false } = {}) {
        this.providers = new Map();
        this.singletons = new Map();
        this.cache = new Map();
        this.aliases = new Map();
        this.strict = strict;
        this.locked = false;
    }

    /**
     * Register service provider
     * @param {string} name
     * @param {Function|any} implementation
     * @param {Object} options
     */
    register(name, implementation, options = {}) {
        this.ensureUnlocked();

        const {
            singleton = false,
            factory = false,
            scope = "transient",
            dependencies = null,
            onInit = null,
            onDestroy = null
        } = options;

        this.providers.set(name, {
            name,
            implementation,
            singleton,
            factory,
            scope,
            dependencies,
            onInit,
            onDestroy
        });

        return this;
    }

    /**
     * Define an alias for a provider
     */
    alias(aliasName, serviceName) {
        this.ensureUnlocked();
        this.aliases.set(aliasName, serviceName);
    }

    /**
     * Resolve provider by name (supports aliases)
     */
    resolveName(name) {
        return this.aliases.get(name) || name;
    }

    /**
     * Retrieve a service instance
     */
    async get(name, resolvingStack = []) {
        name = this.resolveName(name);

        if (!this.providers.has(name)) {
            throw new Error(`Service '${name}' not found`);
        }

        // Circular dependency detection
        if (resolvingStack.includes(name)) {
            throw new Error(
                `Circular dependency detected: ${resolvingStack.join(" -> ")} -> ${name}`
            );
        }

        const provider = this.providers.get(name);

        // Singleton cache
        if (provider.singleton && this.cache.has(name)) {
            return this.cache.get(name);
        }

        const instance = await this.createInstance(provider, [...resolvingStack, name]);

        if (provider.singleton) {
            this.cache.set(name, instance);
        }

        return instance;
    }

    /**
     * Create a new instance from provider
     */
    async createInstance(provider, stack) {
        let { implementation, dependencies } = provider;

        // Auto-detect dependencies if not provided
        if (!dependencies && typeof implementation === "function") {
            dependencies = this.extractParamNames(implementation);
        }

        const resolvedDeps = [];

        for (const dep of dependencies || []) {
            resolvedDeps.push(await this.get(dep, stack));
        }

        let instance;

        if (typeof implementation === "function") {
            if (this.isClass(implementation)) {
                instance = new implementation(...resolvedDeps);
            } else {
                instance = await implementation(...resolvedDeps);
            }
        } else {
            instance = implementation;
        }

        if (provider.onInit) {
            await provider.onInit(instance);
        }

        return instance;
    }

    /**
     * Extract constructor parameter names
     */
    extractParamNames(fn) {
        const fnStr = fn.toString().replace(/\/\*.*?\*\//g, "");
        const argsMatch = fnStr.match(/(?:constructor\s*\(|^\s*function\s*[^(]*\(|^[^(]*)\(([^)]*)\)/);

        if (!argsMatch) return [];
        return argsMatch[1]
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
    }

    /**
     * Check if value is a class constructor
     */
    isClass(fn) {
        return typeof fn === "function" &&
            /^class\s/.test(Function.prototype.toString.call(fn));
    }

    /**
     * Manually register a singleton
     */
    singleton(name, impl, dependencies = []) {
        return this.register(name, impl, { singleton: true, dependencies });
    }

    /**
     * Factory provider (new instance each call)
     */
    factory(name, impl, dependencies = []) {
        return this.register(name, impl, { factory: true, dependencies });
    }

    /**
     * Register a primitive or non-constructible value
     */
    value(name, val) {
        return this.register(name, val);
    }

    /**
     * Check if provider exists
     */
    has(name) {
        return this.providers.has(name) || this.aliases.has(name);
    }

    /**
     * Remove all registrations
     */
    clear() {
        this.ensureUnlocked();
        this.providers.clear();
        this.cache.clear();
        this.aliases.clear();
    }

    /**
     * Lock DI container (cannot register after this)
     */
    lock() {
        this.locked = true;
    }

    ensureUnlocked() {
        if (this.locked) {
            throw new Error("DI container is locked and cannot accept new registrations.");
        }
    }

    /**
     * Lifecycle destruction
     */
    async destroyAll() {
        for (const [name, provider] of this.providers) {
            if (provider.onDestroy && this.cache.has(name)) {
                await provider.onDestroy(this.cache.get(name));
            }
        }

        this.cache.clear();
    }
}

module.exports = DependencyInjector;
