export class FeatureToggle {

    constructor({
        environment = "production",
        cacheTTL = 0,
        enableLogs = false
    } = {}) {
        this.environment = environment;
        this.cacheTTL = cacheTTL;
        this.enableLogs = enableLogs;

        this.features = new Map();
        this.listeners = new Set();
        this.cache = new Map();
        this.segments = new Map(); // ✅ NEW
        this.frozen = false;

        this.exposureHook = null;
        this.auditLog = []; // ✅ NEW
    }

    /* ==================================================
       SEGMENTS (Reusable targeting)
    ================================================== */

    defineSegment(name, fn) {
        this.ensureMutable();
        if (typeof fn !== "function") {
            throw new Error("Segment must be a function");
        }
        this.segments.set(name, fn);
    }

    matchSegment(name, context) {
        const fn = this.segments.get(name);
        return fn ? !!fn(context) : false;
    }

    /* ==================================================
       REGISTRATION
    ================================================== */

    register(name, options = {}) {
        this.ensureMutable();

        if (!name || typeof name !== "string") {
            throw new Error("Feature name must be a string");
        }

        if (this.features.has(name)) {
            throw new Error(`Feature '${name}' already exists`);
        }

        const feature = {
            name,
            enabled: !!options.enabled,
            rules: options.rules || [],
            variants: options.variants || null,
            metadata: options.metadata || {},
            killSwitch: !!options.killSwitch, // ✅ NEW
            createdAt: new Date(),
            updatedAt: null
        };

        this.features.set(name, feature);
        this.invalidateCache(name);

        return this;
    }

    /* ==================================================
       EVALUATION
    ================================================== */

    async evaluate(name, context = {}) {
        const feature = this.features.get(name);
        if (!feature) return { active: false, variant: null };

        // 🚨 Kill switch (hard override)
        if (feature.killSwitch) {
            return { active: false, variant: null };
        }

        const cacheKey = this.buildCacheKey(name, context);

        if (this.cacheTTL > 0) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.time < this.cacheTTL) {
                return cached.value;
            }
        }

        let active = feature.enabled;
        let variant = null;

        const rules = [...feature.rules]
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // ⚡ Parallel evaluation (faster)
        const results = await Promise.all(
            rules.map(r => this.evaluateRule(r, context))
        );

        if (results.some(Boolean)) {
            active = true;
        }

        // 🎯 Variant selection (sticky)
        if (active && feature.variants) {
            variant = this.pickVariant(feature, context);
        }

        const result = { active, variant };

        this.cache.set(cacheKey, { value: result, time: Date.now() });

        if (active && this.exposureHook) {
            this.safeCall(() =>
                this.exposureHook({ name, context, variant })
            );
        }

        this.log(name, context, result);

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

            case "segment": // ✅ NEW
                return this.matchSegment(rule.name, context);

            case "custom":
                if (typeof rule.fn === "function") {
                    const res = rule.fn(context);
                    return res instanceof Promise ? await res : !!res;
                }
                return false;

            case "group":
                return this.evaluateGroup(rule, context);

            default:
                return false;
        }
    }

    async evaluateGroup(rule, context) {
        if (!Array.isArray(rule.rules)) return false;

        if (rule.operator === "AND") {
            for (const r of rule.rules) {
                if (!(await this.evaluateRule(r, context))) return false;
            }
            return true;
        } else {
            for (const r of rule.rules) {
                if (await this.evaluateRule(r, context)) return true;
            }
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

        if (!key) return false;

        const bucket = this.stableHash(key) % 100;
        return bucket < rule.percentage;
    }

    pickVariant(feature, context) {
        const key = String(context.rolloutKey || context.userId || "");

        // ✅ Sticky variant (stable even if weights change)
        const hash = this.stableHash(feature.name + ":" + key);

        const total = feature.variants.reduce((s, v) => s + v.weight, 0);
        const bucket = hash % total;

        let cumulative = 0;
        for (const v of feature.variants) {
            cumulative += v.weight;
            if (bucket < cumulative) return v.name;
        }

        return null;
    }

    /* ==================================================
       CACHE
    ================================================== */

    invalidateCache(featureName = null) {
        if (!featureName) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.startsWith(featureName + ":")) {
                this.cache.delete(key);
            }
        }
    }

    /* ==================================================
       ADMIN
    ================================================== */

    enable(name) {
        const f = this.ensureFeature(name);
        f.enabled = true;
        f.updatedAt = new Date();
        this.invalidateCache(name);
    }

    disable(name) {
        const f = this.ensureFeature(name);
        f.enabled = false;
        f.updatedAt = new Date();
        this.invalidateCache(name);
    }

    setKillSwitch(name, value) {
        const f = this.ensureFeature(name);
        f.killSwitch = !!value;
        this.invalidateCache(name);
    }

    freeze() {
        this.frozen = true;
    }

    unfreeze() {
        this.frozen = false;
    }

    /* ==================================================
       AUDIT LOGGING (NEW)
    ================================================== */

    log(name, context, result) {
        if (!this.enableLogs) return;

        this.auditLog.push({
            name,
            context,
            result,
            time: Date.now()
        });

        // prevent memory leak
        if (this.auditLog.length > 1000) {
            this.auditLog.shift();
        }
    }

    getLogs() {
        return this.auditLog;
    }

    /* ==================================================
       HELPERS
    ================================================== */

    ensureFeature(name) {
        const f = this.features.get(name);
        if (!f) throw new Error(`Feature '${name}' not found`);
        return f;
    }

    ensureMutable() {
        if (this.frozen) {
            throw new Error("System is frozen");
        }
    }

    stableHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    buildCacheKey(name, context) {
        return name + ":" + JSON.stringify(context);
    }

    safeCall(fn) {
        try { fn(); } catch (e) {
            console.error("[FeatureToggle]", e);
        }
    }
}

export const featureToggle = new FeatureToggle();
