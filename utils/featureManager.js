const murmurhash = require('murmurhash');

class FeatureManager {
    constructor(options = {}) {
        this.features = new Map();
        this.experiments = new Map();
        this.segments = new Map();

        this.logger = options.logger || console;
        this.storage = options.storage || null; // async: get/set
        this.debug = options.debug || false;
        this.killed = false;
    }

    /* ============================
       Utilities
    ============================ */

    _clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    _hash(key) {
        return murmurhash.v3(String(key));
    }

    async _persist(key, value) {
        if (this.storage?.set) {
            await this.storage.set(key, value);
        }
    }

    async _load(key) {
        if (this.storage?.get) {
            return this.storage.get(key);
        }
        return null;
    }

    /* ============================
       Segments
    ============================ */

    defineSegment(name, fn) {
        if (typeof fn !== 'function') {
            throw new Error('Segment must be a function');
        }
        this.segments.set(name, fn);
        return this;
    }

    /* ============================
       Feature Definition
    ============================ */

    defineFeature(name, config = {}) {
        const feature = {
            enabled: config.enabled ?? false,
            percentage: config.percentage ?? 100,
            users: new Set(config.users || []),
            groups: new Set(config.groups || []),
            segments: new Set(config.segments || []),
            rules: (config.rules || []).sort((a, b) => (b.priority || 0) - (a.priority || 0)),
            startAt: config.startAt || null,
            endAt: config.endAt || null,
            priority: config.priority || 1,
            killSwitch: false,
            metadata: config.metadata || {},
            createdAt: Date.now()
        };

        this.features.set(name, feature);
        this.logger.log(`[FeatureManager] Feature defined: ${name}`);
        return this;
    }

    updateFeature(name, patch = {}) {
        const feature = this.features.get(name);
        if (!feature) throw new Error(`Feature '${name}' does not exist`);
        Object.assign(feature, patch);
        return this;
    }

    enable(name) { return this.updateFeature(name, { enabled: true }); }
    disable(name) { return this.updateFeature(name, { enabled: false }); }

    kill(name) { return this.updateFeature(name, { killSwitch: true }); }
    revive(name) { return this.updateFeature(name, { killSwitch: false }); }

    setPercentage(name, pct) {
        return this.updateFeature(name, {
            percentage: Math.max(0, Math.min(100, pct))
        });
    }

    /* ============================
       Evaluation
    ============================ */

    isEnabled(name, context = {}) {
        if (this.killed) return false;

        const feature = this.features.get(name);
        if (!feature || feature.killSwitch) return false;

        const now = Date.now();
        if (feature.startAt && now < feature.startAt) return false;
        if (feature.endAt && now > feature.endAt) return false;

        if (feature.priority > 1) return feature.enabled;
        if (!feature.enabled) return false;

        if (context.userId && feature.users.has(context.userId)) {
            return true;
        }

        if (
            context.groups &&
            [...feature.groups].some(g => context.groups.includes(g))
        ) {
            return true;
        }

        for (const seg of feature.segments) {
            const fn = this.segments.get(seg);
            if (fn?.(context)) return true;
        }

        for (const rule of feature.rules) {
            if (rule.condition?.(context)) {
                return Boolean(rule.enabled);
            }
        }

        if (feature.percentage < 100) {
            const key = context.userId ?? JSON.stringify(context);
            return (this._hash(key) % 100) < feature.percentage;
        }

        return true;
    }

    getFeatureStatus(name, context = {}) {
        const feature = this.features.get(name);
        if (!feature) return { exists: false };

        return {
            exists: true,
            enabledForContext: this.isEnabled(name, context),
            config: this._clone({
                ...feature,
                users: [...feature.users],
                groups: [...feature.groups],
                segments: [...feature.segments]
            })
        };
    }

    /* ============================
       Experiments (A/B/n)
    ============================ */

    createExperiment(name, variants, options = {}) {
        if (!Array.isArray(variants) || variants.length < 2) {
            throw new Error('Experiment must have >= 2 variants');
        }

        const normalized = variants.map(v => ({
            name: v.name,
            weight: v.weight ?? 1
        }));

        this.experiments.set(name, {
            variants: normalized,
            exposures: new Set(),
            analyticsHook: options.analyticsHook || null,
            createdAt: Date.now()
        });

        return this;
    }

    getVariant(experimentName, userId) {
        const exp = this.experiments.get(experimentName);
        if (!exp || !userId) return null;

        const total = exp.variants.reduce((s, v) => s + v.weight, 0);
        const hash = this._hash(userId) % total;

        let acc = 0;
        let chosen;

        for (const v of exp.variants) {
            acc += v.weight;
            if (hash < acc) {
                chosen = v.name;
                break;
            }
        }

        if (!exp.exposures.has(userId)) {
            exp.exposures.add(userId);
            exp.analyticsHook?.({
                experiment: experimentName,
                userId,
                variant: chosen
            });
        }

        return chosen;
    }

    /* ============================
       Global Controls
    ============================ */

    killAll() {
        this.killed = true;
    }

    reviveAll() {
        this.killed = false;
    }

    reset() {
        this.features.clear();
        this.experiments.clear();
        this.segments.clear();
        this.killed = false;
    }
}

module.exports = FeatureManager;
