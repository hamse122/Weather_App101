// Advanced feature management with A/B testing
class FeatureManager {
    constructor() {
        this.features = new Map();
        this.groups = new Map();
        this.experiments = new Map();
    }

    defineFeature(name, config = {}) {
        this.features.set(name, {
            enabled: config.enabled || false,
            percentage: config.percentage ?? 100,
            groups: config.groups || [],
            users: config.users || [],
            rules: config.rules || []
        });
        return this;
    }

    isEnabled(featureName, context = {}) {
        const feature = this.features.get(featureName);
        if (!feature || !feature.enabled) {
            return false;
        }

        if (context.userId && feature.users.includes(context.userId)) {
            return true;
        }

        if (context.groups && feature.groups.some(group => context.groups.includes(group))) {
            return true;
        }

        for (const rule of feature.rules) {
            if (typeof rule.condition === 'function' && rule.condition(context)) {
                return Boolean(rule.enabled);
            }
        }

        if (feature.percentage < 100) {
            const identifier = context.userId || JSON.stringify(context);
            const hash = this.hashCode(identifier);
            return (hash % 100) < feature.percentage;
        }

        return true;
    }

    enableForUsers(featureName, userIds) {
        const feature = this.features.get(featureName);
        if (feature) {
            feature.users = [...new Set([...feature.users, ...userIds])];
        }
        return this;
    }

    enableForGroups(featureName, groups) {
        const feature = this.features.get(featureName);
        if (feature) {
            feature.groups = [...new Set([...feature.groups, ...groups])];
        }
        return this;
    }

    setPercentage(featureName, percentage) {
        const feature = this.features.get(featureName);
        if (feature) {
            feature.percentage = Math.max(0, Math.min(100, percentage));
        }
        return this;
    }

    createExperiment(name, variants) {
        if (!Array.isArray(variants) || variants.length === 0) {
            throw new Error('Experiment variants must be a non-empty array');
        }
        this.experiments.set(name, {
            variants,
            assignments: new Map()
        });
        return this;
    }

    getVariant(experimentName, userId) {
        const experiment = this.experiments.get(experimentName);
        if (!experiment || !userId) {
            return null;
        }

        if (experiment.assignments.has(userId)) {
            return experiment.assignments.get(userId);
        }

        const hash = this.hashCode(userId);
        const variantIndex = hash % experiment.variants.length;
        const variant = experiment.variants[variantIndex];
        experiment.assignments.set(userId, variant);
        return variant;
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    getFeatureStatus(featureName, context = {}) {
        const feature = this.features.get(featureName);
        if (!feature) {
            return { exists: false };
        }
        return {
            exists: true,
            enabled: feature.enabled,
            enabledForContext: this.isEnabled(featureName, context),
            config: { ...feature }
        };
    }
}

module.exports = FeatureManager;

