/**
 * Feature Toggle Utility
 * Advanced feature flag system with per-user rollout & listeners
 */

/**
 * @typedef {Object} FeatureRule
 * @property {'percentage'|'user'|'custom'} type
 * @property {number} [percentage]  // 0–100
 * @property {string[]} [users]     // user IDs
 * @property {(context: any) => boolean} [fn] // custom matcher
 */

/**
 * @typedef {Object} FeatureDefinition
 * @property {string} name
 * @property {boolean} enabled             // global default
 * @property {Object} metadata
 * @property {Date} createdAt
 * @property {Date|null} updatedAt
 * @property {FeatureRule[]} rules
 */

/**
 * @typedef {Object} FeatureChangeEvent
 * @property {string} name
 * @property {boolean} enabled
 * @property {FeatureDefinition} feature
 * @property {'register'|'enable'|'disable'|'toggle'|'update'|'load'} reason
 */

export class FeatureToggle {
    constructor() {
        /** @type {Map<string, FeatureDefinition>} */
        this.features = new Map();
        /** @type {Function[]} */
        this.listeners = [];
    }

    /**
     * Register a feature
     * @param {string} name - Feature name
     * @param {boolean} [enabled=false] - Initial global enabled state
     * @param {Object} [metadata={}] - Arbitrary metadata (description, owner, etc.)
     * @param {FeatureRule[]} [rules=[]] - Optional rollout rules
     */
    register(name, enabled = false, metadata = {}, rules = []) {
        if (!name || typeof name !== 'string') {
            throw new Error('Feature name must be a non-empty string');
        }
        if (this.features.has(name)) {
            throw new Error(`Feature '${name}' is already registered`);
        }

        const now = new Date();
        const feature = {
            name,
            enabled: Boolean(enabled),
            metadata: metadata || {},
            createdAt: now,
            updatedAt: null,
            rules: Array.isArray(rules) ? rules : []
        };

        this.features.set(name, feature);
        this.notifyListeners(name, feature.enabled, 'register');
        return this;
    }

    /**
     * Ensure feature exists or throw
     * @private
     */
    ensureFeature(name) {
        const feature = this.features.get(name);
        if (!feature) {
            throw new Error(`Feature '${name}' is not registered`);
        }
        return feature;
    }

    /**
     * Enable a feature globally
     * @param {string} name - Feature name
     */
    enable(name) {
        const feature = this.ensureFeature(name);
        if (!feature.enabled) {
            feature.enabled = true;
            feature.updatedAt = new Date();
            this.notifyListeners(name, true, 'enable');
        }
    }

    /**
     * Disable a feature globally
     * @param {string} name - Feature name
     */
    disable(name) {
        const feature = this.ensureFeature(name);
        if (feature.enabled) {
            feature.enabled = false;
            feature.updatedAt = new Date();
            this.notifyListeners(name, false, 'disable');
        }
    }

    /**
     * Toggle a feature globally
     * @param {string} name - Feature name
     */
    toggle(name) {
        const feature = this.ensureFeature(name);
        feature.enabled = !feature.enabled;
        feature.updatedAt = new Date();
        this.notifyListeners(name, feature.enabled, 'toggle');
    }

    /**
     * Check if a feature is enabled (global only, no context)
     * @param {string} name - Feature name
     * @returns {boolean}
     */
    isEnabled(name) {
        const feature = this.features.get(name);
        return feature ? feature.enabled : false;
    }

    /**
     * Check if a feature is active for a given context (user, tenant, etc.)
     * - Uses global flag AND rules.
     * @param {string} name - Feature name
     * @param {Object} [context] - e.g. { userId, tenantId, ... }
     * @returns {boolean}
     */
    isActive(name, context = {}) {
        const feature = this.features.get(name);
        if (!feature) return false;

        // If globally off and there are no rules, short-circuit.
        if (!feature.enabled && (!feature.rules || feature.rules.length === 0)) {
            return false;
        }

        // If there are rules, evaluate them. Any rule that returns true activates the feature.
        if (feature.rules && feature.rules.length > 0) {
            for (const rule of feature.rules) {
                if (this.evaluateRule(rule, context)) {
                    return true;
                }
            }
            // If no rules match, fall back to global default
            return feature.enabled;
        }

        // No rules → just global enabled
        return feature.enabled;
    }

    /**
     * Evaluate a single rule against the context
     * @param {FeatureRule} rule
     * @param {Object} context
     * @returns {boolean}
     * @private
     */
    evaluateRule(rule, context) {
        if (!rule || !rule.type) return false;

        switch (rule.type) {
            case 'percentage': {
                const userId = String(context.userId || '');
                if (!userId || typeof rule.percentage !== 'number') return false;
                const bucket = this.stableHash(userId) % 100;
                return bucket < rule.percentage;
            }
            case 'user': {
                const userId = String(context.userId || '');
                if (!userId || !Array.isArray(rule.users)) return false;
                return rule.users.includes(userId);
            }
            case 'custom': {
                if (typeof rule.fn !== 'function') return false;
                try {
                    return !!rule.fn(context);
                } catch {
                    return false;
                }
            }
            default:
                return false;
        }
    }

    /**
     * Simple deterministic string hash
     * @param {string} value
     * @returns {number}
     * @private
     */
    stableHash(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = ((hash << 5) - hash) + value.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Get raw feature definition
     * @param {string} name
     * @returns {FeatureDefinition | null}
     */
    get(name) {
        return this.features.get(name) || null;
    }

    /**
     * Update feature metadata (non-destructive merge)
     * @param {string} name
     * @param {Object} metadata
     */
    updateMetadata(name, metadata) {
        const feature = this.ensureFeature(name);
        feature.metadata = { ...feature.metadata, ...metadata };
        feature.updatedAt = new Date();
        this.notifyListeners(name, feature.enabled, 'update');
    }

    /**
     * Replace rollout rules for a feature
     * @param {string} name
     * @param {FeatureRule[]} rules
     */
    setRules(name, rules) {
        const feature = this.ensureFeature(name);
        feature.rules = Array.isArray(rules) ? rules : [];
        feature.updatedAt = new Date();
        this.notifyListeners(name, feature.enabled, 'update');
    }

    /**
     * Get all features
     * @returns {Record<string, any>}
     */
    getAll() {
        const result = {};
        this.features.forEach((feature, name) => {
            result[name] = {
                enabled: feature.enabled,
                metadata: feature.metadata,
                createdAt: feature.createdAt,
                updatedAt: feature.updatedAt,
                rules: feature.rules
            };
        });
        return result;
    }

    /**
     * Subscribe to feature changes
     * @param {(event: FeatureChangeEvent) => void} listener
     * @returns {Function} unsubscribe
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
     * @param {string} name
     * @param {boolean} enabled
     * @param {'register'|'enable'|'disable'|'toggle'|'update'|'load'} reason
     * @private
     */
    notifyListeners(name, enabled, reason) {
        const feature = this.features.get(name) || null;
        const event = { name, enabled, feature, reason };
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (err) {
                // Avoid breaking others if one listener throws
                console.error('[FeatureToggle] listener error', err);
            }
        });
    }

    /**
     * Load features from configuration
     * - Backwards compatible with { featureA: true, featureB: false }
     * - Also supports rich objects: { featureA: { enabled, metadata, rules } }
     * @param {Object} config
     */
    load(config) {
        Object.entries(config || {}).forEach(([name, value]) => {
            if (this.features.has(name)) {
                // Update existing
                if (typeof value === 'boolean') {
                    const feature = this.ensureFeature(name);
                    feature.enabled = value;
                    feature.updatedAt = new Date();
                } else if (value && typeof value === 'object') {
                    const feature = this.ensureFeature(name);
                    if (typeof value.enabled === 'boolean') {
                        feature.enabled = value.enabled;
                    }
                    if (value.metadata) {
                        feature.metadata = { ...feature.metadata, ...value.metadata };
                    }
                    if (Array.isArray(value.rules)) {
                        feature.rules = value.rules;
                    }
                    feature.updatedAt = new Date();
                }
                this.notifyListeners(name, this.isEnabled(name), 'load');
            } else {
                // New feature
                if (typeof value === 'boolean') {
                    this.register(name, value);
                } else if (value && typeof value === 'object') {
                    this.register(
                        name,
                        Boolean(value.enabled),
                        value.metadata || {},
                        Array.isArray(value.rules) ? value.rules : []
                    );
                }
            }
        });
    }
}

// Global instance (same API as before, but more powerful)
export const featureToggle = new FeatureToggle();
