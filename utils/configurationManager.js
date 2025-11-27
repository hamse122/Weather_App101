/**
 * Configuration Manager Utility
 * Advanced configuration management system for application settings
 */

/**
 * @template {Record<string, any>} T
 */
export class ConfigurationManager {
    /**
     * @param {Object} [options]
     * @param {T} [options.defaults] - Initial default configuration
     * @param {string} [options.storageKey] - Default storage key
     * @param {Storage|null} [options.storage] - Custom storage (e.g. localStorage, sessionStorage)
     */
    constructor(options = {}) {
        /** @type {T} */
        this.config = /** @type {T} */ ({});
        /** @type {T} */
        this.defaults = /** @type {T} */ (options.defaults || {});
        
        /** @type {Set<Function>} */
        this.listeners = new Set();
        /** @type {Map<string, Set<Function>>} */
        this.keyListeners = new Map(); // per-key listeners

        this.storageKey = options.storageKey || 'app_config';
        this.storage = typeof window !== 'undefined' && options.storage !== null
            ? (options.storage || window.localStorage)
            : null;

        /** @type {Map<string, (value: any) => boolean>} */
        this.validators = new Map(); // optional per-key validators
    }

    // ############## INTERNAL HELPERS ##############

    /**
     * @param {any} value
     * @returns {boolean}
     */
    static isPlainObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    /**
     * Deep merge utility (mutates target)
     * @param {Object} target
     * @param {Object} source
     * @returns {Object}
     */
    static deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            const srcVal = source[key];
            const tgtVal = target[key];

            if (ConfigurationManager.isPlainObject(srcVal) && ConfigurationManager.isPlainObject(tgtVal)) {
                ConfigurationManager.deepMerge(tgtVal, srcVal);
            } else {
                target[key] = srcVal;
            }
        }
        return target;
    }

    /**
     * Optional validation before setting a value
     * @param {string} key
     * @param {*} value
     * @throws {Error} if validation fails
     */
    validate(key, value) {
        const validator = this.validators.get(key);
        if (validator && !validator(value)) {
            throw new Error(`Validation failed for configuration key "${key}"`);
        }
    }

    // ############## CORE API ##############

    /**
     * Register a validator for a key
     * @param {string} key
     * @param {(value:any) => boolean} validator
     */
    setValidator(key, validator) {
        this.validators.set(key, validator);
    }

    /**
     * Set a configuration value
     * @param {keyof T & string} key - Configuration key
     * @param {T[keyof T]} value - Configuration value
     * @param {{silent?: boolean}} [options]
     */
    set(key, value, options = {}) {
        this.validate(key, value);
        const previous = this.config[key];
        this.config[key] = value;
        if (!options.silent) {
            this.notifyListeners(key, value, 'set', previous);
        }
    }

    /**
     * Set multiple configuration values at once
     * @param {Partial<T>} values
     * @param {{silent?: boolean}} [options]
     */
    setMany(values, options = {}) {
        const prevAll = this.getAll();
        Object.entries(values).forEach(([key, value]) => {
            // @ts-ignore
            this.validate(key, value);
            // @ts-ignore
            this.config[key] = value;
        });
        if (!options.silent) {
            this.notifyListeners(null, null, 'setMany', prevAll);
        }
    }

    /**
     * Get a configuration value
     * @param {keyof T & string} key - Configuration key
     * @param {T[keyof T] | null} [defaultValue=null] - Default value if key doesn't exist
     * @returns {T[keyof T] | null} - Configuration value
     */
    get(key, defaultValue = null) {
        if (key in this.config) {
            return this.config[key];
        }
        if (key in this.defaults) {
            return this.defaults[key];
        }
        return defaultValue;
    }

    /**
     * Get a nested configuration value via path (e.g. "theme.colors.primary")
     * @param {string} path
     * @param {*} [defaultValue=null]
     * @returns {*}
     */
    getPath(path, defaultValue = null) {
        const keys = path.split('.');
        let obj = this.getAll();
        for (const k of keys) {
            if (obj && typeof obj === 'object' && k in obj) {
                obj = obj[k];
            } else {
                return defaultValue;
            }
        }
        return obj;
    }

    /**
     * Set a nested configuration value via path (e.g. "theme.colors.primary")
     * @param {string} path
     * @param {*} value
     * @param {{silent?: boolean}} [options]
     */
    setPath(path, value, options = {}) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        if (!lastKey) return;

        /** @type {any} */
        let obj = this.config;
        for (const k of keys) {
            if (!ConfigurationManager.isPlainObject(obj[k])) {
                obj[k] = {};
            }
            obj = obj[k];
        }
        const previous = obj[lastKey];
        obj[lastKey] = value;
        if (!options.silent) {
            this.notifyListeners(path, value, 'setPath', previous);
        }
    }

    /**
     * Set default value
     * @param {keyof T & string} key - Configuration key
     * @param {T[keyof T]} value - Default value
     */
    setDefault(key, value) {
        this.defaults[key] = value;
    }

    /**
     * Set many defaults at once
     * @param {Partial<T>} defaults
     */
    setDefaults(defaults) {
        this.defaults = /** @type {T} */ ({
            ...this.defaults,
            ...defaults,
        });
    }

    /**
     * Check if a configuration key exists
     * @param {keyof T & string} key - Configuration key
     * @returns {boolean} - True if key exists
     */
    has(key) {
        return key in this.config || key in this.defaults;
    }

    /**
     * Remove a configuration key
     * @param {keyof T & string} key - Configuration key
     * @param {{silent?: boolean}} [options]
     */
    remove(key, options = {}) {
        const existed = key in this.config;
        const previous = this.config[key];
        delete this.config[key];

        if (existed && !options.silent) {
            this.notifyListeners(key, undefined, 'remove', previous);
        }
    }

    /**
     * Load configuration from object
     * @param {Partial<T>} config - Configuration object
     * @param {Object} [options]
     * @param {boolean} [options.merge=true] - Whether to merge with existing config
     * @param {boolean} [options.deep=true] - Use deep merge
     */
    load(config, { merge = true, deep = true } = {}) {
        if (!merge) {
            this.config = /** @type {T} */ ({ ...config });
        } else if (deep) {
            this.config = ConfigurationManager.deepMerge({ ...this.config }, config);
        } else {
            this.config = /** @type {T} */ ({ ...this.config, ...config });
        }
        this.notifyListeners(null, null, 'load', null);
    }

    /**
     * Get all configuration (defaults overridden by current config)
     * @returns {T} - New object with combined config
     */
    getAll() {
        return /** @type {T} */ ({
            ...this.defaults,
            ...this.config,
        });
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        const prevAll = this.getAll();
        this.config = /** @type {T} */ ({});
        this.notifyListeners(null, null, 'reset', prevAll);
    }

    /**
     * Completely clear config and defaults
     */
    clearAll() {
        const prevAll = this.getAll();
        this.config = /** @type {T} */ ({});
        this.defaults = /** @type {T} */ ({});
        this.notifyListeners(null, null, 'clearAll', prevAll);
    }

    // ############## EVENTS ##############

    /**
     * Subscribe to configuration changes (any key)
     * @param {(event: { key: string|null, value: any, previous: any, action: string, config: T }) => void} listener
     * @returns {Function} - Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Subscribe to changes of a specific key
     * @param {string} key
     * @param {(event: { key: string|null, value: any, previous: any, action: string, config: T }) => void} listener
     * @returns {Function} - Unsubscribe function
     */
    subscribeKey(key, listener) {
        if (!this.keyListeners.has(key)) {
            this.keyListeners.set(key, new Set());
        }
        const set = this.keyListeners.get(key);
        set.add(listener);

        return () => {
            set.delete(listener);
            if (set.size === 0) {
                this.keyListeners.delete(key);
            }
        };
    }

    /**
     * Notify all listeners
     * @param {string|null} key - Configuration key
     * @param {*} value - Configuration value
     * @param {string} action - Action type
     * @param {*} [previous] - Previous value
     */
    notifyListeners(key, value, action = 'set', previous = undefined) {
        const event = {
            key,
            value,
            previous,
            action,
            config: this.getAll(),
        };

        this.listeners.forEach(listener => listener(event));

        if (key && this.keyListeners.has(key)) {
            this.keyListeners.get(key).forEach(listener => listener(event));
        }
    }

    // ############## STORAGE HELPERS ##############

    /**
     * Save configuration to storage (without defaults)
     * @param {string} [key] - Storage key override
     */
    saveToStorage(key = this.storageKey) {
        if (!this.storage) return;
        try {
            this.storage.setItem(key, JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save configuration to storage:', error);
        }
    }

    /**
     * Load configuration from storage
     * @param {string} [key] - Storage key override
     * @param {{merge?: boolean, deep?: boolean}} [options]
     */
    loadFromStorage(key = this.storageKey, options = {}) {
        if (!this.storage) return;
        try {
            const stored = this.storage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.load(parsed, options);
            }
        } catch (error) {
            console.error('Failed to load configuration from storage:', error);
        }
    }

    /**
     * Export configuration (config only, no defaults) as JSON string
     * @returns {string}
     */
    toJSON() {
        return JSON.stringify(this.config);
    }

    /**
     * Import configuration from JSON string
     * @param {string} json
     * @param {{merge?: boolean, deep?: boolean}} [options]
     */
    fromJSON(json, options = {}) {
        try {
            const parsed = JSON.parse(json);
            this.load(parsed, options);
        } catch (error) {
            console.error('Failed to parse configuration JSON:', error);
        }
    }
}

// Global configuration manager instance (generic “any” config)
export const configManager = new ConfigurationManager();
