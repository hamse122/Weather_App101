// Advanced Plugin System (v3 - Production Ready)

class PluginSystem {
    constructor({
        hookTimeout = 5000,
        continueOnError = true,
        maxPlugins = Infinity,
        maxHookExecutions = 10000
    } = {}) {
        this.plugins = new Map();
        this.hooks = new Map();
        this.disabledPlugins = new Set();

        this.hookTimeout = hookTimeout;
        this.continueOnError = continueOnError;
        this.maxPlugins = maxPlugins;
        this.maxHookExecutions = maxHookExecutions;

        this.locked = false;
        this.initializing = new Set();

        this.metrics = {
            executedHooks: 0,
            failedHooks: 0,
            timedOutHooks: 0,
            pluginErrors: 0,
            totalExecutionTime: 0
        };
    }

    /* ==============================
       REGISTRATION
    ============================== */

    async register(pluginName, plugin = {}) {
        this._ensureUnlocked();

        if (typeof pluginName !== "string" || !pluginName.trim()) {
            throw new TypeError("Invalid plugin name");
        }

        if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
            throw new TypeError("Plugin must be an object");
        }

        if (this.plugins.has(pluginName)) {
            throw new Error(`Plugin '${pluginName}' already registered`);
        }

        if (this.plugins.size >= this.maxPlugins) {
            throw new Error("Maximum plugin limit reached");
        }

        if (this.initializing.has(pluginName)) {
            throw new Error(`Circular plugin dependency: ${pluginName}`);
        }

        const dependencies = plugin.dependencies || [];

        for (const dep of dependencies) {
            if (!this.plugins.has(dep)) {
                throw new Error(
                    `Plugin '${pluginName}' requires '${dep}'`
                );
            }
        }

        this.initializing.add(pluginName);

        const meta = {
            ...plugin,
            name: pluginName,
            version: plugin.version ?? "1.0.0",
            author: plugin.author ?? null,
            enabled: true,
            registeredAt: Date.now(),
            dependencies: [...dependencies]
        };

        try {
            if (typeof meta.init === "function") {
                await meta.init(this);
            }

            this.plugins.set(pluginName, meta);
            this._registerHooks(pluginName, meta.hooks || {});

            return this;
        } catch (error) {
            this.metrics.pluginErrors++;
            throw error;
        } finally {
            this.initializing.delete(pluginName);
        }
    }

    _registerHooks(pluginName, definitions) {
        for (const [hookName, definition] of Object.entries(definitions)) {
            const config =
                typeof definition === "function"
                    ? { fn: definition }
                    : definition;

            if (typeof config?.fn !== "function") {
                throw new TypeError(
                    `Invalid hook '${hookName}' in '${pluginName}'`
                );
            }

            if (!this.hooks.has(hookName)) {
                this.hooks.set(hookName, []);
            }

            this.hooks.get(hookName).push({
                fn: config.fn,
                priority: config.priority ?? 0,
                once: !!config.once,
                timeout: config.timeout ?? this.hookTimeout,
                pluginName
            });

            this.hooks.get(hookName).sort(
                (a, b) => b.priority - a.priority
            );
        }
    }

    /* ==============================
       UNREGISTRATION
    ============================== */

    async unregister(pluginName, { force = false } = {}) {
        this._ensureUnlocked();

        const plugin = this.plugins.get(pluginName);
        if (!plugin) return false;

        const dependents = [...this.plugins.values()].filter(
            p => p.dependencies.includes(pluginName)
        );

        if (dependents.length && !force) {
            throw new Error(
                `Cannot remove '${pluginName}': required by ${dependents
                    .map(p => p.name)
                    .join(", ")}`
            );
        }

        if (force) {
            for (const dependent of dependents) {
                await this.unregister(dependent.name, { force: true });
            }
        }

        this._removePluginHooks(pluginName);

        try {
            if (typeof plugin.destroy === "function") {
                await plugin.destroy();
            }
        } catch (error) {
            this.metrics.pluginErrors++;
            throw error;
        } finally {
            this.plugins.delete(pluginName);
            this.disabledPlugins.delete(pluginName);
        }

        return true;
    }

    _removePluginHooks(pluginName) {
        for (const [name, hooks] of this.hooks) {
            const remaining = hooks.filter(
                hook => hook.pluginName !== pluginName
            );

            if (remaining.length) {
                this.hooks.set(name, remaining);
            } else {
                this.hooks.delete(name);
            }
        }
    }

    /* ==============================
       HOOK EXECUTION
    ============================== */

    async executeHook(hookName, context = {}, ...args) {
        const hooks = [...(this.hooks.get(hookName) || [])];
        const results = [];

        for (const hook of hooks) {
            if (
                this.disabledPlugins.has(hook.pluginName) ||
                !this.plugins.has(hook.pluginName)
            ) {
                continue;
            }

            const start = Date.now();

            try {
                const result = await this._withTimeout(
                    Promise.resolve().then(() =>
                        hook.fn(context, ...args)
                    ),
                    hook.timeout
                );

                this.metrics.executedHooks++;
                results.push({
                    plugin: hook.pluginName,
                    result
                });

                if (hook.once) {
                    this._removeSingleHook(hookName, hook);
                }

            } catch (error) {
                this.metrics.failedHooks++;

                if (error.code === "HOOK_TIMEOUT") {
                    this.metrics.timedOutHooks++;
                }

                if (!this.continueOnError) {
                    throw error;
                }

                console.error(
                    `[PluginSystem] Hook '${hookName}' failed:`,
                    error
                );

            } finally {
                this.metrics.totalExecutionTime += Date.now() - start;
            }
        }

        return results;
    }

    _withTimeout(promise, timeout) {
        if (!timeout || timeout <= 0) return promise;

        let timer;

        return Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const error = new Error("Hook execution timed out");
                    error.code = "HOOK_TIMEOUT";
                    reject(error);
                }, timeout);
            })
        ]).finally(() => clearTimeout(timer));
    }

    _removeSingleHook(hookName, hook) {
        const hooks = this.hooks.get(hookName);
        if (!hooks) return;

        const index = hooks.indexOf(hook);

        if (index !== -1) {
            hooks.splice(index, 1);
        }

        if (!hooks.length) {
            this.hooks.delete(hookName);
        }
    }

    /* ==============================
       PLUGIN CONTROLS
    ============================== */

    enable(pluginName) {
        this._ensurePlugin(pluginName);
        this.disabledPlugins.delete(pluginName);
        return this;
    }

    disable(pluginName) {
        this._ensurePlugin(pluginName);
        this.disabledPlugins.add(pluginName);
        return this;
    }

    isEnabled(pluginName) {
        return (
            this.plugins.has(pluginName) &&
            !this.disabledPlugins.has(pluginName)
        );
    }

    /* ==============================
       INSPECTION
    ============================== */

    getPlugin(pluginName) {
        return this.plugins.get(pluginName) ?? null;
    }

    hasPlugin(pluginName) {
        return this.plugins.has(pluginName);
    }

    listPlugins() {
        return [...this.plugins.values()].map(plugin => ({
            name: plugin.name,
            version: plugin.version,
            author: plugin.author,
            enabled: this.isEnabled(plugin.name),
            dependencies: [...plugin.dependencies]
        }));
    }

    listHooks() {
        return [...this.hooks.entries()].map(([name, hooks]) => ({
            name,
            count: hooks.length,
            plugins: hooks.map(h => h.pluginName)
        }));
    }

    getMetrics() {
        const total = this.metrics.executedHooks +
            this.metrics.failedHooks;

        return {
            ...this.metrics,
            plugins: this.plugins.size,
            disabledPlugins: this.disabledPlugins.size,
            hooks: [...this.hooks.values()].reduce(
                (total, hooks) => total + hooks.length,
                0
            ),
            successRate: total
                ? this.metrics.executedHooks / total
                : 0
        };
    }

    /* ==============================
       SYSTEM MANAGEMENT
    ============================== */

    lock() {
        this.locked = true;
        return this;
    }

    unlock() {
        this.locked = false;
        return this;
    }

    async destroy() {
        this.unlock();

        const names = [...this.plugins.keys()].reverse();

        for (const name of names) {
            await this.unregister(name, { force: true });
        }

        this.hooks.clear();
        this.disabledPlugins.clear();

        return this;
    }

    /* ==============================
       INTERNAL UTILITIES
    ============================== */

    _ensurePlugin(name) {
        if (!this.plugins.has(name)) {
            throw new Error(`Plugin '${name}' not found`);
        }
    }

    _ensureUnlocked() {
        if (this.locked) {
            throw new Error("Plugin system is locked");
        }
    }
}

module.exports = PluginSystem;
