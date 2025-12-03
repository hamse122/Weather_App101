// Advanced Plugin System with priorities, async lifecycles & safe hook execution
class PluginSystem {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map(); // hookName -> [{ fn, priority, once, pluginName }]
    }

    register(pluginName, plugin) {
        if (this.plugins.has(pluginName)) {
            throw new Error(`Plugin '${pluginName}' already registered`);
        }

        this.plugins.set(pluginName, plugin);

        // Register hooks (if any)
        if (plugin.hooks) {
            Object.keys(plugin.hooks).forEach(hookName => {
                const hookDef = plugin.hooks[hookName];
                const hookInfo = {
                    fn: hookDef.fn || hookDef,
                    priority: hookDef.priority || 0,
                    once: hookDef.once || false,
                    pluginName
                };

                if (!this.hooks.has(hookName)) {
                    this.hooks.set(hookName, []);
                }

                this.hooks.get(hookName).push(hookInfo);

                // Sort hooks by priority (higher runs first)
                this.hooks.get(hookName).sort((a, b) => b.priority - a.priority);
            });
        }

        // Async init supported
        if (typeof plugin.init === "function") {
            Promise.resolve(plugin.init(this)).catch(err =>
                console.error(`Plugin '${pluginName}' init error:`, err)
            );
        }

        return this;
    }

    async unregister(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) return this;

        // Remove hooks linked to this plugin
        for (const [hookName, hookList] of this.hooks.entries()) {
            this.hooks.set(
                hookName,
                hookList.filter(h => h.pluginName !== pluginName)
            );

            // Clean empty arrays
            if (this.hooks.get(hookName).length === 0) {
                this.hooks.delete(hookName);
            }
        }

        // Async destroy supported
        if (typeof plugin.destroy === "function") {
            try {
                await plugin.destroy();
            } catch (err) {
                console.error(`Plugin '${pluginName}' destroy error:`, err);
            }
        }

        this.plugins.delete(pluginName);
        return this;
    }

    async executeHook(hookName, context = {}, ...args) {
        const hooks = this.hooks.get(hookName) || [];
        const results = [];

        for (const hookInfo of [...hooks]) {
            try {
                const { fn, once, pluginName } = hookInfo;
                const result = await fn(context, ...args);
                results.push(result);

                // auto-remove once-only hook
                if (once) {
                    this.unregister(pluginName);
                }

            } catch (error) {
                console.error(
                    `Hook '${hookName}' execution error in plugin '${hookInfo.pluginName}':`,
                    error
                );
            }
        }

        return results;
    }

    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }

    listPlugins() {
        return [...this.plugins.keys()];
    }

    listHooks() {
        return [...this.hooks.keys()];
    }
}

module.exports = PluginSystem;
