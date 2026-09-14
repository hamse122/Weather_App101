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
    if (obj == null) return obj;

    // Modern browsers / Node.js 17+
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(obj);
        } catch {
            // Fall through
        }
    }

    // Fallback for plain JSON objects
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch {
        // Last resort (shallow copy)
        if (Array.isArray(obj)) {
            return [...obj];
        }

        if (typeof obj === "object") {
            return { ...obj };
        }

        return obj;
    }
}

_hash(key) {
    const input =
        typeof key === "string"
            ? key
            : JSON.stringify(
                  key,
                  Object.keys(key || {}).sort()
              );

    return murmurhash.v3(input);
}

async _persist(key, value, options = {}) {
    if (typeof this.storage?.set !== "function") {
        return false;
    }

    try {
        if (value == null && typeof this.storage.delete === "function") {
            await this.storage.delete(key);
            return true;
        }

        await this.storage.set(key, value, options);
        return true;
    } catch (err) {
        this.logger?.error?.("Persist failed:", err);
        return false;
    }
}

async _load(key, defaultValue = null) {
    if (typeof this.storage?.get !== "function") {
        return defaultValue;
    }

    try {
        const value = await this.storage.get(key);
        return value ?? defaultValue;
    } catch (err) {
        this.logger?.error?.("Load failed:", err);
        return defaultValue;
    }
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
    if (!name || typeof name !== "string") {
        throw new TypeError("Experiment name must be a non-empty string");
    }

    if (!Array.isArray(variants) || variants.length < 2) {
        throw new Error("Experiment must have at least 2 variants");
    }

    const normalized = variants.map((variant, index) => {
        if (!variant?.name || typeof variant.name !== "string") {
            throw new Error(`Invalid variant at index ${index}`);
        }

        const weight = Number(variant.weight ?? 1);

        if (!Number.isFinite(weight) || weight <= 0) {
            throw new Error(`Invalid weight for variant '${variant.name}'`);
        }

        return Object.freeze({
            name: variant.name,
            weight
        });
    });

    const names = new Set(normalized.map(v => v.name));

    if (names.size !== normalized.length) {
        throw new Error("Experiment variants must have unique names");
    }

    this.experiments.set(name, {
        name,
        variants: normalized,
        exposures: new Set(),
        analyticsHook:
            typeof options.analyticsHook === "function"
                ? options.analyticsHook
                : null,
        createdAt: Date.now(),
        metadata: options.metadata || {}
    });

    return this;
}

getVariant(experimentName, userId) {
    const exp = this.experiments.get(experimentName);

    if (!exp || userId === undefined || userId === null) {
        return null;
    }

    const id = String(userId);

    const total = exp.variants.reduce(
        (sum, variant) => sum + variant.weight,
        0
    );

    const hash = this._hash(`${experimentName}:${id}`);
    const bucket = hash % total;

    let cumulative = 0;
    let chosen = null;

    for (const variant of exp.variants) {
        cumulative += variant.weight;

        if (bucket < cumulative) {
            chosen = variant.name;
            break;
        }
    }

    if (!chosen) {
        chosen = exp.variants.at(-1).name;
    }

    if (!exp.exposures.has(id)) {
        exp.exposures.add(id);

        if (exp.analyticsHook) {
            try {
                exp.analyticsHook({
                    experiment: experimentName,
                    userId: id,
                    variant: chosen,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error(
                    `[Experiment] Analytics hook failed for "${experimentName}":`,
                    error
                );
            }
        }
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
