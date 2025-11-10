/**
 * Configuration Manager Utility
 * Configuration management system for application settings
 */

/**
 * ConfigurationManager class for managing configuration
 */
export class ConfigurationManager {
    constructor() {
        this.config = {};
        this.defaults = {};
        this.listeners = [];
    }
    
    /**
     * Set a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     */
    set(key, value) {
        this.config[key] = value;
        this.notifyListeners(key, value);
    }
    
    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - Configuration value
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
     * Set default value
     * @param {string} key - Configuration key
     * @param {*} value - Default value
     */
    setDefault(key, value) {
        this.defaults[key] = value;
    }
    
    /**
     * Check if a configuration key exists
     * @param {string} key - Configuration key
     * @returns {boolean} - True if key exists
     */
    has(key) {
        return key in this.config || key in this.defaults;
    }
    
    /**
     * Remove a configuration key
     * @param {string} key - Configuration key
     */
    remove(key) {
        delete this.config[key];
        this.notifyListeners(key, undefined);
    }
    
    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     * @param {boolean} merge - Whether to merge with existing config
     */
    load(config, merge = true) {
        if (merge) {
            this.config = { ...this.config, ...config };
        } else {
            this.config = { ...config };
        }
        this.notifyListeners(null, null, 'load');
    }
    
    /**
     * Get all configuration
     * @returns {Object} - Configuration object
     */
    getAll() {
        return { ...this.defaults, ...this.config };
    }
    
    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = {};
        this.notifyListeners(null, null, 'reset');
    }
    
    /**
     * Subscribe to configuration changes
     * @param {Function} listener - Listener function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) this.listeners.splice(index, 1);
        };
    }
    
    /**
     * Notify all listeners
     * @param {string|null} key - Configuration key
     * @param {*} value - Configuration value
     * @param {string} action - Action type
     */
    notifyListeners(key, value, action = 'set') {
        this.listeners.forEach(listener => {
            listener({ key, value, action, config: this.getAll() });
        });
    }
    
    /**
     * Save configuration to localStorage
     * @param {string} key - localStorage key
     */
    saveToLocalStorage(key = 'app_config') {
        try {
            localStorage.setItem(key, JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save configuration to localStorage:', error);
        }
    }
    
    /**
     * Load configuration from localStorage
     * @param {string} key - localStorage key
     */
    loadFromLocalStorage(key = 'app_config') {
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                this.load(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load configuration from localStorage:', error);
        }
    }
}

// Global configuration manager instance
export const configManager = new ConfigurationManager();
