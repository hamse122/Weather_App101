/**
 * Advanced Feature Toggle System (v2 - 2026 Edition)
 * ---------------------------------------------------
 * - Global enable/disable
 * - Percentage rollout (stable hashing)
 * - User targeting
 * - Tenant targeting
 * - Environment targeting
 * - Custom sync/async rules
 * - Multivariate variants (A/B testing)
 * - Priority-based rule evaluation
 * - Exposure tracking hook
 * - Snapshot import/export
 * - In-memory evaluation cache
 * - Freeze mode
 */

export class FeatureToggle {

    constructor({ environment = "production", cacheTTL = 0 } = {}) {
        this.environment = environment;
        this.cacheTTL = cacheTTL; // ms (0 = disabled)

        this.features = new Map();
        this.listeners = new Set();
        this.cache = new Map();
        this.frozen = false;
        this.exposureHook = null;
    }

    /* ==================================================
       REGISTRATION
    ================================================== */

    register(name, options = {}) {
        this.ensureMutable();

        if (!name || typeof name !== "string") {
            throw new Error("Feature name must be a non-empty string");
        }

        if (this.features.has(name)) {
            throw new Error(`Feature '${name}' already registered`);
        }

        const now = new Date();

        const feature = {
            name,
            enabled: Boolean(options.enabled),
            metadata: options.metadata || {},
            rules: Array.isArray(options.rules) ? options.rules : [],
            variants: Array.isArray(options.variants) ? options.variants : null,
            createdAt: now,
            updatedAt: null
        };

        this.features.set(name, feature);
        this.notify(name, feature.enabled, "register");
        return this;
    }

    /* ==================================================
       EVALUATION
    ================================================== */

    async isActive(name, context = {}) {
        const result = await this.evaluate(name, context);
        return result.active;
    }

    async getVariant(name, context = {}) {
        const result = await this.evaluate(name, context);
        return result.variant;
    }

    async evaluate(name, context = {}) {
        const feature = this.features.get(name);
        if (!feature) return { active: false, variant: null };

        const cacheKey = this.buildCacheKey(name, context);

        if (this.cacheTTL > 0 && this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey);
            if (Date.now() - entry.time < this.cacheTTL) {
                return entry.value;
            }
        }

        let active = feature.enabled;
        let matchedVariant = null;

        // Evaluate rules by priority (higher first)
        const sortedRules = [...feature.rules]
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        for (const rule of sortedRules) {
            const matched = await this.evaluateRule(rule, context);
            if (matched) {
                active = true;
                break;
            }
        }

        // Variant selection (A/B testing)
        if (active && feature.variants?.length) {
            matchedVariant = this.pickVariant(feature.variants, context);
        }

        const result = { active, variant: matchedVariant };

        if (this.cacheTTL > 0) {
            this.cache.set(cacheKey, { value: result, time: Date.now() });
        }

        if (active && this.exposureHook) {
            this.safeCall(() =>
                this.exposureHook({ name, context, variant: matchedVariant })
            );
        }

        return result;
    }

    async evaluateRule(rule, context) {
        if (!rule || !rule.type) return false;

        switch (rule.type) {
            case "percentage":
                return this.matchPercentage(rule, context);

            case "user":
                return rule.users?.includes(String(context.userId));

            case "tenant":
                return rule.tenants?.includes(String(context.tenantId));

            case "environment":
                return rule.environments?.includes(this.environment);

            case "custom":
                if (typeof rule.fn === "function") {
                    const result = rule.fn(context);
                    return result instanceof Promise ? await result : !!result;
                }
                return false;

            case "group": // AND/OR logic
                if (!Array.isArray(rule.rules)) return false;
                if (rule.operator === "AND") {
                    for (const r of rule.rules) {
                        if (!(await this.evaluateRule(r, context))) return false;
                    }
                    return true;
                } else { // OR
                    for (const r of rule.rules) {
                        if (await this.evaluateRule(r, context)) return true;
                    }
                    return false;
                }

            default:
                return false;
        }
    }

    matchPercentage(rule, context) {
        const key = String(
            context.rolloutKey ||
            context.userId ||
            context.tenantId ||
            ""
        );

        if (!key || typeof rule.percentage !== "number") return false;

        const bucket = this.stableHash(key) % 100;
        return bucket < rule.percentage;
    }

    pickVariant(variants, context) {
        const key = String(context.rolloutKey || context.userId || "");
        if (!key) return variants[0]?.name || null;

        const total = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
        if (total === 0) return null;

        const hash = this.stableHash(key) % total;

        let cumulative = 0;
        for (const variant of variants) {
            cumulative += variant.weight || 0;
            if (hash < cumulative) {
                return variant.name;
            }
        }

        return null;
    }

    /* ==================================================
       ADMIN
    ================================================== */

    enable(name) {
        this.ensureMutable();
        const feature = this.ensureFeature(name);
        feature.enabled = true;
        feature.updatedAt = new Date();
        this.notify(name, true, "enable");
    }

    disable(name) {
        this.ensureMutable();
        const feature = this.ensureFeature(name);
        feature.enabled = false;
        feature.updatedAt = new Date();
        this.notify(name, false, "disable");
    }

    freeze() {
        this.frozen = true;
    }

    unfreeze() {
        this.frozen = false;
    }

    setExposureHook(fn) {
        this.exposureHook = typeof fn === "function" ? fn : null;
    }

    snapshot() {
        return JSON.parse(JSON.stringify([...this.features]));
    }

    loadSnapshot(snapshot) {
        this.ensureMutable();
        this.features = new Map(snapshot);
        this.notify("*", true, "load");
    }

    /* ==================================================
       HELPERS
    ================================================== */

    ensureFeature(name) {
        const f = this.features.get(name);
        if (!f) throw new Error(`Feature '${name}' not registered`);
        return f;
    }

    ensureMutable() {
        if (this.frozen) {
            throw new Error("FeatureToggle is frozen.");
        }
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(name, enabled, reason) {
        const event = { name, enabled, feature: this.features.get(name), reason };
        this.listeners.forEach(listener =>
            this.safeCall(() => listener(event))
        );
    }

    safeCall(fn) {
        try { fn(); } catch (err) {
            console.error("[FeatureToggle] listener error:", err);
        }
    }

    stableHash(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = ((hash << 5) - hash) + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    buildCacheKey(name, context) {
        return name + ":" + JSON.stringify(context);
    }
}

export const featureToggle = new FeatureToggle();
