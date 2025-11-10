/**
 * Feature Toggle Utility
 * Feature flag system for enabling/disabling features
 */

/**
 * FeatureToggle class for managing feature flags
 */
export class FeatureToggle {
    constructor() {
        this.features = new Map();
        this.listeners = [];
    }
    
    /**
     * Register a feature
     * @param {string} name - Feature name
     * @param {boolean} enabled - Initial enabled state
     * @param {Object} metadata - Feature metadata
     */
    register(name, enabled = false, metadata = {}) {
        this.features.set(name, {
            enabled,
            metadata,
            createdAt: new Date()
        });
        this.notifyListeners(name, enabled);
    }
    
    /**
     * Enable a feature
     * @param {string} name - Feature name
     */
    enable(name) {
        const feature = this.features.get(name);
        if (feature) {
            feature.enabled = true;
            this.notifyListeners(name, true);
        }
    }
    
    /**
     * Disable a feature
     * @param {string} name - Feature name
     */
    disable(name) {
        const feature = this.features.get(name);
        if (feature) {
            feature.enabled = false;
            this.notifyListeners(name, false);
        }
    }
    
    /**
     * Check if a feature is enabled
     * @param {string} name - Feature name
     * @returns {boolean} - True if feature is enabled
     */
    isEnabled(name) {
        const feature = this.features.get(name);
        return feature ? feature.enabled : false;
    }
    
    /**
     * Toggle a feature
     * @param {string} name - Feature name
     */
    toggle(name) {
        const feature = this.features.get(name);
        if (feature) {
            feature.enabled = !feature.enabled;
            this.notifyListeners(name, feature.enabled);
        }
    }
    
    /**
     * Get all features
     * @returns {Object} - Object with all features
     */
    getAll() {
        const result = {};
        this.features.forEach((feature, name) => {
            result[name] = {
                enabled: feature.enabled,
                ...feature.metadata
            };
        });
        return result;
    }
    
    /**
     * Subscribe to feature changes
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
     * @param {string} name - Feature name
     * @param {boolean} enabled - Enabled state
     */
    notifyListeners(name, enabled) {
        this.listeners.forEach(listener => {
            listener({ name, enabled, feature: this.features.get(name) });
        });
    }
    
    /**
     * Load features from configuration
     * @param {Object} config - Configuration object
     */
    load(config) {
        Object.entries(config).forEach(([name, enabled]) => {
            this.register(name, enabled);
        });
    }
}

// Global feature toggle instance
export const featureToggle = new FeatureToggle();
