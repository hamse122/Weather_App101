/**
 * Advanced Dependency Injection Container (v2 - 2026 Edition)
 * ------------------------------------------------------------
 * Features:
 * - Singleton / Transient / Scoped lifetimes
 * - True factory providers
 * - Child scopes
 * - Async providers
 * - Circular dependency detection
 * - Lifecycle hooks (onInit / onDestroy)
 * - Aliases
 * - Strict mode
 * - Resolution caching per-scope
 */

class DependencyInjector {
    constructor({ strict = false, parent = null } = {}) {
        this.providers = new Map();
        this.singletons = parent ? parent.singletons : new Map();
        this.scopedCache = new Map();
        this.aliases = new Map();
        this.strict = strict;
        this.parent = parent;
        this.locked = false;
    }

    /* =========================
       REGISTRATION
    ========================== */

    register(name, implementation, options = {}) {
        this.ensureUnlocked();

        const {
            lifetime = "transient", // singleton | transient | scoped
            dependencies = null,
            factory = false,
            onInit = null,
            onDestroy = null
        } = options;

        this.providers.set(name, {
            name,
            implementation,
            lifetime,
            dependencies,
            factory,
            onInit,
            onDestroy
        });

        return this;
    }

    singleton(name, impl, dependencies = []) {
        return this.register(name, impl, {
            lifetime: "singleton",
            dependencies
        });
    }

    scoped(name, impl, dependencies = []) {
        return this.register(name, impl, {
            lifetime: "scoped",
            dependencies
        });
    }

    transient(name, impl, dependencies = []) {
        return this.register(name, impl, {
            lifetime: "transient",
            dependencies
        });
    }

    factory(name, impl, dependencies = []) {
        return this.register(name, impl, {
            lifetime: "transient",
            dependencies,
            factory: true
        });
    }

    value(name, val) {
        return this.register(name, val, { lifetime: "singleton" });
    }

    alias(aliasName, serviceName) {
        this.ensureUnlocked();
        this.aliases.set(aliasName, serviceName);
    }

    /* =========================
       RESOLUTION
    ========================== */

    async get(name, stack = []) {
        name = this.resolveName(name);

        const provider = this.getProvider(name);

        if (!provider) {
            if (this.strict) {
                throw new Error(`Service '${name}' not found`);
            }
            return null;
        }

        if (stack.includes(name)) {
            throw new Error(
                `Circular dependency detected: ${[...stack, name].join(" -> ")}`
            );
        }

        // SINGLETON
        if (provider.lifetime === "singleton") {
            if (this.singletons.has(name)) {
                return this.singletons.get(name);
            }

            const instance = await this.instantiate(provider, [...stack, name]);
            this.singletons.set(name, instance);
            return instance;
        }

        // SCOPED
        if (provider.lifetime === "scoped") {
            if (this.scopedCache.has(name)) {
                return this.scopedCache.get(name);
            }

            const instance = await this.instantiate(provider, [...stack, name]);
            this.scopedCache.set(name, instance);
            return instance;
        }

        // TRANSIENT
        return this.instantiate(provider, [...stack, name]);
    }

    async instantiate(provider, stack) {
        let { implementation, dependencies, factory, onInit } = provider;

        if (!dependencies && typeof implementation === "function") {
            dependencies = this.extractParamNames(implementation);
        }

        const resolvedDeps = [];

        for (const dep of dependencies || []) {
            resolvedDeps.push(await this.get(dep, stack));
        }

        let instance;

        if (typeof implementation === "function") {
            if (factory) {
                instance = await implementation(...resolvedDeps);
            } else if (this.isClass(implementation)) {
                instance = new implementation(...resolvedDeps);
            } else {
                instance = await implementation(...resolvedDeps);
            }
        } else {
            instance = implementation;
        }

        if (onInit) {
            await onInit(instance);
        }

        return instance;
    }

    /* =========================
       SCOPES
    ========================== */

    createScope() {
        return new DependencyInjector({
            strict: this.strict,
            parent: this
        });
    }

    async destroyScope() {
        for (const [name, provider] of this.providers) {
            if (
                provider.lifetime === "scoped" &&
                provider.onDestroy &&
                this.scopedCache.has(name)
            ) {
                await provider.onDestroy(this.scopedCache.get(name));
            }
        }
        this.scopedCache.clear();
    }

    async destroyAll() {
        for (const [name, provider] of this.providers) {
            if (
                provider.lifetime === "singleton" &&
                provider.onDestroy &&
                this.singletons.has(name)
            ) {
                await provider.onDestroy(this.singletons.get(name));
            }
        }
        this.singletons.clear();
    }

    /* =========================
       INTERNALS
    ========================== */

    getProvider(name) {
        return (
            this.providers.get(name) ||
            this.parent?.getProvider(name) ||
            null
        );
    }

    resolveName(name) {
        return this.aliases.get(name) || name;
    }

    has(name) {
        return !!this.getProvider(name);
    }

    clear() {
        this.ensureUnlocked();
        this.providers.clear();
        this.aliases.clear();
        this.scopedCache.clear();
    }

    lock() {
        this.locked = true;
    }

    ensureUnlocked() {
        if (this.locked) {
            throw new Error("DI container is locked.");
        }
    }

    isClass(fn) {
        return typeof fn === "function" &&
            /^class\s/.test(Function.prototype.toString.call(fn));
    }

    extractParamNames(fn) {
        const fnStr = fn
            .toString()
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");

        const argsMatch = fnStr.match(/\(([^)]*)\)/);
        if (!argsMatch) return [];

        return argsMatch[1]
            .split(",")
            .map(s => s.trim().replace(/=.*$/, ""))
            .filter(Boolean);
    }
}

module.exports = DependencyInjector;
