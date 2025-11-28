// Upgraded Feature Manager with segmentation, async storage, analytics & A/B testing

const murmurhash = require('murmurhash'); // npm install murmurhash

class FeatureManager {
    constructor(options = {}) {
        this.features = new Map();
        this.experiments = new Map();

        this.logger = options.logger || console;
        this.storage = options.storage || null; // e.g., Redis, Mongo
    }

    // Helper: Clone objects safely
    _clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // ============================
    // FEATURE DEFINITION
    // ============================

    defineFeature(name, config = {}) {
        const featureConfig = {
            enabled: config.enabled ?? false,
            percentage: config.percentage ?? 100,
            users: config.users || [],
            groups: config.groups || [],
            rules: config.rules || [],
            priority: config.priority || 1, // Higher = stronger override
            metadata: config.metadata || {},
            createdAt: Date.now()
        };

        this.features.set(name, featureConfig);
        this.logger.log(`[FeatureManager] Feature defined: ${name}`);
        return this;
    }

    // Update feature properties safely
    updateFeature(name, data = {}) {
        if (!this.features.has(name)) {
            throw new Error(`Feature '${name}' does not exist`);
        }
        const feature = this.features.get(name);
        Object.assign(feature, data);
        return this;
    }

    enable(name) {
        return this.updateFeature(name, { enabled: true });
    }

    disable(name) {
        return this.updateFeature(name, { enabled: false });
    }

    enableForUsers(name, userIds) {
        const feature = this.features.get(name);
        if (feature) {
            feature.users = Array.from(new Set([...feature.users, ...userIds]));
        }
        return this;
    }

    enableForGroups(name, groups) {
        const feature = this.features.get(name);
        if (feature) {
            feature.groups = Array.from(new Set([...feature.groups, ...groups]));
        }
        return this;
    }

    setPercentage(name, percentage) {
        const feature = this.features.get(name);
        if (feature) {
            feature.percentage = Math.max(0, Math.min(100, percentage));
        }
        return this;
    }

    // ============================
    // EVALUATION LOGIC
    // ============================

    isEnabled(name, context = {}) {
        const feature = this.features.get(name);
        if (!feature) return false;

        // High priority override
        if (feature.priority > 1) {
            return feature.enabled;
        }

        if (!feature.enabled) return false;

        // User-level override
        if (context.userId && feature.users.includes(context.userId)) {
            return true;
        }

        // Group-based activation
        if (context.groups && feature.groups.some(g => context.groups.includes(g))) {
            return true;
        }

        // Rule-based evaluation
        for (const rule of feature.rules) {
            if (typeof rule.condition === 'function' && rule.condition(context)) {
                return Boolean(rule.enabled);
            }
        }

        // Percentage rollout
        if (feature.percentage < 100) {
            const key = context.userId || JSON.stringify(context);
            const hash = murmurhash.v3(key);
            return (hash % 100) < feature.percentage;
        }

        return true;
    }

    getFeatureStatus(name, context = {}) {
        const feature = this.features.get(name);
        if (!feature) {
            return { exists: false };
        }

        return {
            exists: true,
            enabled: feature.enabled,
            enabledForContext: this.isEnabled(name, context),
            config: this._clone(feature)
        };
    }

    // ============================
    // A/B TESTING SYSTEM
    // ============================

    createExperiment(name, variants, options = {}) {
        if (!Array.isArray(variants) || variants.length < 2) {
            throw new Error('Experiment must have at least 2 variants');
        }

        this.experiments.set(name, {
            variants,
            assignments: new Map(),
            metadata: options.metadata || {},
            createdAt: Date.now(),
            analyticsHook: options.analyticsHook || null
        });

        this.logger.log(`[FeatureManager] Experiment created: ${name}`);
        return this;
    }

    getVariant(experimentName, userId) {
        const experiment = this.experiments.get(experimentName);
        if (!experiment || !userId) return null;

        // If user is already assigned, return
        if (experiment.assignments.has(userId)) {
            return experiment.assignments.get(userId);
        }

        // Stable hash for deterministic assignment
        const hash = murmurhash.v3(userId);
        const idx = hash % experiment.variants.length;
        const variant = experiment.variants[idx];

        experiment.assignments.set(userId, variant);

        // Fire analytics event if provided
        if (experiment.analyticsHook) {
            experiment.analyticsHook({
                experiment: experimentName,
                userId,
                variant
            });
        }

        return variant;
    }
}

module.exports = FeatureManager;
