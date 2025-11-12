// Plugin system with lifecycle hooks
class PluginSystem {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map();
    }

    register(pluginName, plugin) {
        if (this.plugins.has(pluginName)) {
            throw new Error(`Plugin ${pluginName} already registered`);
        }

        this.plugins.set(pluginName, plugin);

        if (plugin.hooks) {
            Object.keys(plugin.hooks).forEach(hookName => {
                if (!this.hooks.has(hookName)) {
                    this.hooks.set(hookName, []);
                }
                this.hooks.get(hookName).push(plugin.hooks[hookName]);
            });
        }

        if (typeof plugin.init === 'function') {
            plugin.init(this);
        }

        return this;
    }

    unregister(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
            if (plugin.hooks) {
                Object.keys(plugin.hooks).forEach(hookName => {
                    const hooks = this.hooks.get(hookName);
                    if (hooks) {
                        const index = hooks.indexOf(plugin.hooks[hookName]);
                        if (index > -1) {
                            hooks.splice(index, 1);
                        }
                    }
                });
            }

            if (typeof plugin.destroy === 'function') {
                plugin.destroy();
            }

            this.plugins.delete(pluginName);
        }
        return this;
    }

    async executeHook(hookName, ...args) {
        const hooks = this.hooks.get(hookName) || [];
        const results = [];

        for (const hook of hooks) {
            try {
                const result = await hook(...args);
                results.push(result);
            } catch (error) {
                console.error(`Hook ${hookName} execution error:`, error);
            }
        }

        return results;
    }

    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }

    listPlugins() {
        return Array.from(this.plugins.keys());
    }
}

module.exports = PluginSystem;

