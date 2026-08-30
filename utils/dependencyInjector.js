/**
 * Advanced Dependency Injection Container (v3 - 2026 Edition)
 * ------------------------------------------------------------
 * Features:
 * - Singleton / Transient / Scoped lifetimes
 * - Async-safe singleton and scoped resolution
 * - Factory providers
 * - Child scopes
 * - Async providers
 * - Circular dependency detection
 * - Lifecycle hooks
 * - Aliases with circular alias detection
 * - Strict mode
 * - Concurrent resolution deduplication
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
        this.destroyed = false;
    }

    /* =========================
       REGISTRATION
    ========================== */

    register(name, implementation, options = {}) {
        this.ensureUnlocked();
        this.ensureAlive();

        if (!name || typeof name !== "string") {
            throw new TypeError("Service name must be a non-empty string");
        }

        const {
            lifetime = "transient",
            dependencies = null,
            factory = false,
            onInit = null,
            onDestroy = null
        } = options;

        if (!["singleton", "transient", "scoped"].includes(lifetime)) {
            throw new Error(`Invalid lifetime '${lifetime}'`);
        }

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
        return this.register(name, val, {
            lifetime: "singleton"
        });
    }

    alias(aliasName, serviceName) {
        this.ensureUnlocked();

        if (!aliasName || !serviceName) {
            throw new Error("Alias and service name are required");
        }

        this.aliases.set(aliasName, serviceName);
        return this;
    }

    /* =========================
       RESOLUTION
    ========================== */

    async get(name, stack = []) {
        this.ensureAlive();

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

        // SINGLETON — cache the Promise immediately
        if (provider.lifetime === "singleton") {
            if (this.singletons.has(name)) {
                return this.singletons.get(name);
            }

            const promise = this.instantiate(provider, [...stack, name])
                .then(instance => {
                    this.singletons.set(name, instance);
                    return instance;
                })
                .catch(error => {
                    this.singletons.delete(name);
                    throw error;
                });

            this.singletons.set(name, promise);

            return promise;
        }

        // SCOPED — cache Promise immediately
        if (provider.lifetime === "scoped") {
            if (this.scopedCache.has(name)) {
                return this.scopedCache.get(name);
            }

            const promise = this.instantiate(provider, [...stack, name])
                .then(instance => {
                    this.scopedCache.set(name, instance);
                    return instance;
                })
                .catch(error => {
                    this.scopedCache.delete(name);
                    throw error;
                });

            this.scopedCache.set(name, promise);

            return promise;
        }

        // TRANSIENT
        return this.instantiate(provider, [...stack, name]);
    }

    async instantiate(provider, stack) {
        let {
            implementation,
            dependencies,
            factory,
            onInit
        } = provider;

        if (!dependencies && typeof implementation === "function") {
            dependencies = this.extractParamNames(implementation);
        }

        const resolvedDeps = [];

        for (const dependency of dependencies || []) {
            resolvedDeps.push(await this.get(dependency, stack));
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

        if (typeof onInit === "function") {
            await onInit(instance);
        }

        return instance;
    }

    /* =========================
       SCOPES
    ========================== */

    createScope() {
        this.ensureAlive();

        return new DependencyInjector({
            strict: this.strict,
            parent: this
        });
    }

    async destroyScope() {
        if (this.destroyed) return;

        for (const [name, instance] of this.scopedCache) {
            const provider = this.getProvider(name);

            if (!provider || !provider.onDestroy) continue;

            try {
                const resolvedInstance = await instance;

                await provider.onDestroy(resolvedInstance);
            } catch (error) {
                console.error(
                    `Failed to destroy scoped service '${name}':`,
                    error
                );
            }
        }

        this.scopedCache.clear();
        this.destroyed = true;
    }

    async destroyAll() {
        if (this.parent) {
            throw new Error(
                "destroyAll() can only be called on the root container"
            );
        }

        for (const [name, instance] of this.singletons) {
            const provider = this.getProvider(name);

            if (!provider || !provider.onDestroy) continue;

            try {
                const resolvedInstance = await instance;

                await provider.onDestroy(resolvedInstance);
            } catch (error) {
                console.error(
                    `Failed to destroy singleton '${name}':`,
                    error
                );
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
        const visited = new Set();
        let current = name;

        while (this.aliases.has(current)) {
            if (visited.has(current)) {
                throw new Error(
                    `Circular alias detected: ${[...visited, current].join(" -> ")}`
                );
            }

            visited.add(current);
            current = this.aliases.get(current);
        }

        if (this.parent && !this.providers.has(current)) {
            return this.parent.resolveName(current);
        }

        return current;
    }

    has(name) {
        name = this.resolveName(name);
        return !!this.getProvider(name);
    }

    clear() {
        this.ensureUnlocked();

        this.providers.clear();
        this.aliases.clear();
        this.scopedCache.clear();

        return this;
    }

    lock() {
        this.locked = true;
        return this;
    }

    unlock() {
        this.locked = false;
        return this;
    }

    ensureUnlocked() {
        if (this.locked) {
            throw new Error("DI container is locked.");
        }
    }

    ensureAlive() {
        if (this.destroyed) {
            throw new Error("DI container scope has been destroyed.");
        }
    }

    isClass(fn) {
        return (
            typeof fn === "function" &&
            /^class\s/.test(
                Function.prototype.toString.call(fn)
            )
        );
    }

    extractParamNames(fn) {
        const fnStr = fn
            .toString()
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");

        const argsMatch =
            fnStr.match(/^[^(]*\(([^)]*)\)/) ||
            fnStr.match(/^([A-Za-z_$][\w$]*)\s*=>/);

        if (!argsMatch) return [];

        const args = argsMatch[1] || argsMatch[0];

        return args
            .split(",")
            .map(arg =>
                arg
                    .trim()
                    .replace(/=.*$/, "")
                    .trim()
            )
            .filter(Boolean);
    }
}

module.exports = DependencyInjector;
