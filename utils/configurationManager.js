/**
 * Advanced Configuration Manager
 * 2026 Edition
 *
 * Features:
 * - Defaults + runtime configuration
 * - Deep merge
 * - Nested paths
 * - Per-key validation
 * - Global validation
 * - localStorage / sessionStorage / custom storage
 * - Async storage support
 * - Auto persistence
 * - Change subscriptions
 * - Per-key subscriptions
 * - Transactions
 * - Batch updates
 * - Reset / clear
 * - Locking
 * - Immutable snapshots
 * - Safe listener execution
 * - Import / export
 * - Versioning
 */

export class ConfigurationManager {
    constructor(options = {}) {
        this.config = {};
        this.defaults = options.defaults || {};

        this.storageKey = options.storageKey || "app_config";
        this.storage = this.resolveStorage(options.storage);

        this.autoSave = options.autoSave ?? false;
        this.deepMergeEnabled = options.deepMerge ?? true;

        this.listeners = new Set();
        this.keyListeners = new Map();
        this.validators = new Map();

        this.globalValidators = new Set();

        this.locked = false;
        this.transactionDepth = 0;
        this.transactionChanges = [];

        this.version = 0;

        this.onError =
            options.onError ||
            ((error) => {
                console.error("[ConfigurationManager]", error);
            });
    }

    /* ============================================================
       STORAGE
    ============================================================ */

    resolveStorage(storage) {
        if (storage !== undefined) return storage;

        if (typeof window !== "undefined") {
            try {
                return window.localStorage;
            } catch {
                return null;
            }
        }

        return null;
    }

    async persist() {
        if (!this.autoSave || !this.storage) return;

        const data = JSON.stringify(this.config);

        try {
            if (typeof this.storage.setItem === "function") {
                const result = this.storage.setItem(
                    this.storageKey,
                    data
                );

                if (result instanceof Promise) {
                    await result;
                }

                return;
            }

            if (typeof this.storage.set === "function") {
                await this.storage.set(this.storageKey, data);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async loadFromStorage(options = {}) {
        if (!this.storage) return this;

        try {
            let raw;

            if (typeof this.storage.getItem === "function") {
                raw = this.storage.getItem(this.storageKey);
            } else if (typeof this.storage.get === "function") {
                raw = await this.storage.get(this.storageKey);
            }

            if (raw instanceof Promise) {
                raw = await raw;
            }

            if (!raw) return this;

            const parsed =
                typeof raw === "string"
                    ? JSON.parse(raw)
                    : raw;

            this.load(parsed, options);
        } catch (error) {
            this.onError(error);
        }

        return this;
    }

    async clearStorage() {
        if (!this.storage) return;

        try {
            if (typeof this.storage.removeItem === "function") {
                const result = this.storage.removeItem(
                    this.storageKey
                );

                if (result instanceof Promise) {
                    await result;
                }

                return;
            }

            if (typeof this.storage.delete === "function") {
                await this.storage.delete(this.storageKey);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    /* ============================================================
       HELPERS
    ============================================================ */

    static isPlainObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            Object.getPrototypeOf(value) === Object.prototype
        );
    }

    static deepClone(value) {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    }

    static deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (
                ConfigurationManager.isPlainObject(sourceValue) &&
                ConfigurationManager.isPlainObject(targetValue)
            ) {
                ConfigurationManager.deepMerge(
                    targetValue,
                    sourceValue
                );
            } else if (
                ConfigurationManager.isPlainObject(sourceValue)
            ) {
                target[key] = ConfigurationManager.deepMerge(
                    {},
                    sourceValue
                );
            } else {
                target[key] = sourceValue;
            }
        }

        return target;
    }

    getAll() {
        return ConfigurationManager.deepMerge(
            ConfigurationManager.deepClone(this.defaults),
            ConfigurationManager.deepClone(this.config)
        );
    }

    ensureMutable() {
        if (this.locked) {
            throw new Error(
                "ConfigurationManager is locked and cannot be modified."
            );
        }
    }

    validateKey(key) {
        if (
            typeof key !== "string" ||
            !key.trim()
        ) {
            throw new TypeError(
                "Configuration key must be a non-empty string."
            );
        }
    }

    validate(key, value) {
        const validator = this.validators.get(key);

        if (validator && !validator(value)) {
            throw new Error(
                `Validation failed for configuration key "${key}".`
            );
        }

        for (const globalValidator of this.globalValidators) {
            if (!globalValidator(this.getAll(), key, value)) {
                throw new Error(
                    `Global configuration validation failed for "${key}".`
                );
            }
        }
    }

    /* ============================================================
       VALIDATION
    ============================================================ */

    setValidator(key, validator) {
        this.validateKey(key);

        if (typeof validator !== "function") {
            throw new TypeError(
                "Validator must be a function."
            );
        }

        this.validators.set(key, validator);

        return this;
    }

    removeValidator(key) {
        this.validators.delete(key);
        return this;
    }

    addGlobalValidator(validator) {
        if (typeof validator !== "function") {
            throw new TypeError(
                "Global validator must be a function."
            );
        }

        this.globalValidators.add(validator);

        return () => {
            this.globalValidators.delete(validator);
        };
    }

    /* ============================================================
       GET
    ============================================================ */

    get(key, defaultValue = null) {
        this.validateKey(key);

        if (key in this.config) {
            return this.config[key];
        }

        if (key in this.defaults) {
            return this.defaults[key];
        }

        return defaultValue;
    }

    getPath(path, defaultValue = null) {
        this.validateKey(path);

        let current = this.getAll();

        for (const key of path.split(".")) {
            if (
                current === null ||
                current === undefined ||
                typeof current !== "object" ||
                !(key in current)
            ) {
                return defaultValue;
            }

            current = current[key];
        }

        return current;
    }

    has(key) {
        return (
            key in this.config ||
            key in this.defaults
        );
    }

    /* ============================================================
       SET
    ============================================================ */

    async set(key, value, options = {}) {
        this.ensureMutable();
        this.validateKey(key);

        if (key.includes(".")) {
            return this.setPath(key, value, options);
        }

        this.validate(key, value);

        const previous = this.config[key];

        if (
            !options.force &&
            Object.is(previous, value)
        ) {
            return this;
        }

        this.config[key] = value;
        this.version++;

        if (!options.silent) {
            this.notifyListeners(
                key,
                value,
                "set",
                previous
            );
        }

        if (this.transactionDepth === 0) {
            await this.persist();
        }

        return this;
    }

    async setMany(values, options = {}) {
        this.ensureMutable();

        if (
            !values ||
            typeof values !== "object"
        ) {
            throw new TypeError(
                "Configuration values must be an object."
            );
        }

        const previous = this.getAll();

        for (const [key, value] of Object.entries(values)) {
            this.validate(key, value);
        }

        Object.assign(this.config, values);

        this.version++;

        if (!options.silent) {
            this.notifyListeners(
                null,
                values,
                "setMany",
                previous
            );
        }

        if (this.transactionDepth === 0) {
            await this.persist();
        }

        return this;
    }

    async setPath(path, value, options = {}) {
        this.ensureMutable();
        this.validateKey(path);

        const keys = path.split(".");
        const lastKey = keys.pop();

        let target = this.config;

        for (const key of keys) {
            if (
                !ConfigurationManager.isPlainObject(
                    target[key]
                )
            ) {
                target[key] = {};
            }

            target = target[key];
        }

        this.validate(path, value);

        const previous = target[lastKey];

        if (
            !options.force &&
            Object.is(previous, value)
        ) {
            return this;
        }

        target[lastKey] = value;
        this.version++;

        if (!options.silent) {
            this.notifyListeners(
                path,
                value,
                "setPath",
                previous
            );
        }

        if (this.transactionDepth === 0) {
            await this.persist();
        }

        return this;
    }

    /* ============================================================
       REMOVE
    ============================================================ */

    async remove(key, options = {}) {
        this.ensureMutable();
        this.validateKey(key);

        if (key.includes(".")) {
            return this.removePath(key, options);
        }

        if (!(key in this.config)) {
            return this;
        }

        const previous = this.config[key];

        delete this.config[key];
        this.version++;

        if (!options.silent) {
            this.notifyListeners(
                key,
                undefined,
                "remove",
                previous
            );
        }

        if (this.transactionDepth === 0) {
            await this.persist();
        }

        return this;
    }

    async removePath(path, options = {}) {
        this.ensureMutable();

        const keys = path.split(".");
        const lastKey = keys.pop();

        let target = this.config;

        for (const key of keys) {
            if (
                !target ||
                typeof target !== "object" ||
                !(key in target)
            ) {
                return this;
            }

            target = target[key];
        }

        if (!(lastKey in target)) {
            return this;
        }

        const previous = target[lastKey];

        delete target[lastKey];
        this.version++;

        if (!options.silent) {
            this.notifyListeners(
                path,
                undefined,
                "removePath",
                previous
            );
        }

        if (this.transactionDepth === 0) {
            await this.persist();
        }

        return this;
    }

    /* ============================================================
       DEFAULTS
    ============================================================ */

    setDefault(key, value) {
        this.ensureMutable();
        this.validateKey(key);

        this.defaults[key] = value;

        return this;
    }

    setDefaults(defaults, { deep = true } = {}) {
        this.ensureMutable();

        this.defaults = deep
            ? ConfigurationManager.deepMerge(
                  this.defaults,
                  defaults
              )
            : {
                  ...this.defaults,
                  ...defaults
              };

        return this;
    }

    /* ============================================================
       LOAD / RESET
    ============================================================ */

    load(
        config,
        {
            merge = true,
            deep = true,
            silent = false
        } = {}
    ) {
        this.ensureMutable();

        const previous = this.getAll();

        if (!merge) {
            this.config =
                ConfigurationManager.deepClone(config);
        } else if (deep) {
            this.config =
                ConfigurationManager.deepMerge(
                    ConfigurationManager.deepClone(
                        this.config
                    ),
                    config
                );
        } else {
            this.config = {
                ...this.config,
                ...config
            };
        }

        this.version++;

        if (!silent) {
            this.notifyListeners(
                null,
                this.getAll(),
                "load",
                previous
            );
        }

        return this;
    }

    reset({ silent = false } = {}) {
        this.ensureMutable();

        const previous = this.getAll();

        this.config = {};
        this.version++;

        if (!silent) {
            this.notifyListeners(
                null,
                this.getAll(),
                "reset",
                previous
            );
        }

        return this;
    }

    clearAll({ silent = false } = {}) {
        this.ensureMutable();

        const previous = this.getAll();

        this.config = {};
        this.defaults = {};
        this.version++;

        if (!silent) {
            this.notifyListeners(
                null,
                {},
                "clearAll",
                previous
            );
        }

        return this;
    }

    /* ============================================================
       TRANSACTIONS
    ============================================================ */

    async transaction(callback) {
        this.ensureMutable();

        const snapshot =
            ConfigurationManager.deepClone(
                this.config
            );

        this.transactionDepth++;

        try {
            const result = await callback(this);

            this.transactionDepth--;

            if (this.transactionDepth === 0) {
                await this.persist();
            }

            return result;
        } catch (error) {
            this.config = snapshot;
            this.transactionDepth--;

            throw error;
        }
    }

    /* ============================================================
       EVENTS
    ============================================================ */

    subscribe(listener) {
        if (typeof listener !== "function") {
            throw new TypeError(
                "Listener must be a function."
            );
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    subscribeKey(key, listener) {
        this.validateKey(key);

        if (typeof listener !== "function") {
            throw new TypeError(
                "Listener must be a function."
            );
        }

        if (!this.keyListeners.has(key)) {
            this.keyListeners.set(
                key,
                new Set()
            );
        }

        const listeners =
            this.keyListeners.get(key);

        listeners.add(listener);

        return () => {
            listeners.delete(listener);

            if (!listeners.size) {
                this.keyListeners.delete(key);
            }
        };
    }

    notifyListeners(
        key,
        value,
        action,
        previous
    ) {
        const event = Object.freeze({
            key,
            value,
            previous,
            action,
            version: this.version,
            config: this.getAll(),
            timestamp: Date.now()
        });

        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                this.onError(error);
            }
        }

        if (
            key &&
            this.keyListeners.has(key)
        ) {
            for (const listener of this.keyListeners.get(
                key
            )) {
                try {
                    listener(event);
                } catch (error) {
                    this.onError(error);
                }
            }
        }
    }

    /* ============================================================
       LOCKING
    ============================================================ */

    lock() {
        this.locked = true;
        return this;
    }

    unlock() {
        this.locked = false;
        return this;
    }

    isLocked() {
        return this.locked;
    }

    /* ============================================================
       SERIALIZATION
    ============================================================ */

    toJSON() {
        return JSON.stringify(this.config);
    }

    fromJSON(
        json,
        options = {}
    ) {
        try {
            const parsed = JSON.parse(json);

            this.load(
                parsed,
                options
            );

            return this;
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    export() {
        return ConfigurationManager.deepClone(
            this.config
        );
    }

    snapshot() {
        return Object.freeze(
            ConfigurationManager.deepClone(
                this.getAll()
            )
        );
    }

    getVersion() {
        return this.version;
    }
}

/* ================================================================
   GLOBAL INSTANCE
================================================================ */

export const configManager =
    new ConfigurationManager({
        storageKey: "app_config",
        autoSave: true
    });
