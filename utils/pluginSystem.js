// Advanced Plugin System (2026 Edition)
class PluginSystem {
    constructor({
        hookTimeout = 5000,
        continueOnError = true
    } = {}) {
        this.plugins = new Map();
        this.hooks = new Map();

        this.hookTimeout = hookTimeout;
        this.continueOnError = continueOnError;

        this.disabledPlugins = new Set();
        this.metrics = {
            executedHooks: 0,
            failedHooks: 0,
            pluginErrors: 0
        };
    }

    async register(pluginName, plugin = {}) {
        if (this.plugins.has(pluginName)) {
            throw new Error(`Plugin '${pluginName}' already registered`);
        }

        // Dependency check
        for (const dep of plugin.dependencies || []) {
            if (!this.plugins.has(dep)) {
                throw new Error(
                    `Plugin '${pluginName}' requires '${dep}'`
                );
            }
        }

        const meta = {
            name: pluginName,
            version: plugin.version ?? "1.0.0",
            author: plugin.author ?? null,
            enabled: true,
            registeredAt: Date.now(),
            ...plugin
        };

        this.plugins.set(pluginName, meta);

        // Register hooks
        if (meta.hooks) {
            for (const [hookName, hookDef] of Object.entries(meta.hooks)) {
                if (!this.hooks.has(hookName)) {
                    this.hooks.set(hookName, []);
                }

                this.hooks.get(hookName).push({
                    fn: hookDef.fn || hookDef,
                    priority: hookDef.priority ?? 0,
                    once: !!hookDef.once,
                    timeout: hookDef.timeout ?? this.hookTimeout,
                    pluginName
                });

                this.hooks.get(hookName)
                    .sort((a, b) => b.priority - a.priority);
            }
        }

        if (typeof meta.init === "function") {
            await Promise.resolve(meta.init(this));
        }

        return this;
    }

    async unregister(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) return this;

        for (const [hookName, hooks] of this.hooks) {
            const filtered = hooks.filter(
                h => h.pluginName !== pluginName
            );

            if (filtered.length) {
                this.hooks.set(hookName, filtered);
            } else {
                this.hooks.delete(hookName);
            }
        }

        if (typeof plugin.destroy === "function") {
            await Promise.resolve(plugin.destroy());
        }

        this.plugins.delete(pluginName);
        this.disabledPlugins.delete(pluginName);

        return this;
    }

    async executeHook(hookName, context = {}, ...args) {
        const hooks = [...(this.hooks.get(hookName) || [])];
        const results = [];

        for (const hook of hooks) {
            if (this.disabledPlugins.has(hook.pluginName)) {
                continue;
            }

            try {
                const execution = Promise.resolve(
                    hook.fn(context, ...args)
                );

                const result = await Promise.race([
                    execution,
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Hook timeout")),
                            hook.timeout
                        )
                    )
                ]);

                this.metrics.executedHooks++;
                results.push(result);

                if (hook.once) {
                    await this.unregister(hook.pluginName);
                }

            } catch (err) {
                this.metrics.failedHooks++;

                console.error(
                    `Hook '${hookName}' failed in '${hook.pluginName}':`,
                    err
                );

                if (!this.continueOnError) {
                    throw err;
                }
            }
        }

        return results;
    }

    enable(pluginName) {
        this.disabledPlugins.delete(pluginName);
        return this;
    }

    disable(pluginName) {
        this.disabledPlugins.add(pluginName);
        return this;
    }

    isEnabled(pluginName) {
        return !this.disabledPlugins.has(pluginName);
    }

    getPlugin(pluginName) {
        return this.plugins.get(pluginName) ?? null;
    }

    hasPlugin(pluginName) {
        return this.plugins.has(pluginName);
    }

    listPlugins() {
        return [...this.plugins.values()].map(p => ({
            name: p.name,
            version: p.version,
            enabled: this.isEnabled(p.name)
        }));
    }

    listHooks() {
        return [...this.hooks.keys()];
    }

    getMetrics() {
        return {
            ...this.metrics,
            plugins: this.plugins.size,
            hooks: [...this.hooks.values()]
                .reduce((t, h) => t + h.length, 0)
        };
    }
}

module.exports = PluginSystem;
