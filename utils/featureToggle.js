/**
 * ==========================================================
 * FEATURE TOGGLE v3 + DASHBOARD UI (Single File)
 * ==========================================================
 */

export class FeatureToggle {

    constructor(options = {}) {
        this.environment = options.environment || "production";
        this.cacheTTL = options.cacheTTL || 0;
        this.enableLogs = options.enableLogs || false;

        this.features = new Map();
        this.segments = new Map();
        this.cache = new Map();
        this.auditLog = [];

        this.listeners = new Set();
        this.middlewares = [];

        this.frozen = false;
        this.circuitBreaker = false; // 🚨 NEW

        this.exposureHook = null;

        // metrics
        this.metrics = new Map();
    }

    /* ==================================================
       MIDDLEWARE PIPELINE
    ================================================== */

    use(fn) {
        this.middlewares.push(fn);
    }

    runMiddleware(context, result) {
        let res = result;

        for (const mw of this.middlewares) {
            try {
                res = mw(context, res) || res;
            } catch (e) {
                console.error("[FeatureToggle middleware]", e);
            }
        }

        return res;
    }

    /* ==================================================
       SEGMENTS
    ================================================== */

    defineSegment(name, fn) {
        this.ensureMutable();
        this.segments.set(name, fn);
    }

    matchSegment(name, context) {
        const fn = this.segments.get(name);
        return fn ? !!fn(context) : false;
    }

    /* ==================================================
       FEATURE REGISTRATION
    ================================================== */

    register(name, options = {}) {
        this.ensureMutable();

        const feature = {
            name,
            enabled: !!options.enabled,
            rules: options.rules || [],
            variants: options.variants || null,
            killSwitch: !!options.killSwitch,
            metadata: options.metadata || {},
            createdAt: Date.now(),
            updatedAt: null
        };

        this.features.set(name, feature);
        this.metrics.set(name, { hits: 0, exposures: 0 });

        return this;
    }

    /* ==================================================
       EVALUATION CORE
    ================================================== */

    async evaluate(name, context = {}) {

        if (this.circuitBreaker) {
            return { active: false, variant: null };
        }

        const feature = this.features.get(name);
        if (!feature) return { active: false, variant: null };

        if (feature.killSwitch) {
            return { active: false, variant: null };
        }

        const cacheKey = this.hashKey(name, context);

        if (this.cacheTTL > 0) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.time < this.cacheTTL) {
                return cached.value;
            }
        }

        let active = feature.enabled;
        let variant = null;

        const results = await Promise.all(
            feature.rules.map(r => this.evaluateRule(r, context))
        );

        if (results.includes(true)) active = true;

        if (active && feature.variants) {
            variant = this.pickVariant(feature, context);
        }

        let result = { active, variant };

        // middleware hook
        result = this.runMiddleware({ name, context }, result);

        this.cache.set(cacheKey, { value: result, time: Date.now() });

        this.trackMetrics(name, result);

        this.log(name, context, result);

        if (active && this.exposureHook) {
            this.safe(() =>
                this.exposureHook({ name, context, variant })
            );
        }

        return result;
    }

    /* ==================================================
       RULE ENGINE
    ================================================== */

    async evaluateRule(rule, context) {

        switch (rule.type) {

            case "percentage":
                return this.bucketMatch(rule.percentage, context);

            case "user":
                return rule.users?.includes(String(context.userId));

            case "segment":
                return this.matchSegment(rule.name, context);

            case "environment":
                return rule.env?.includes(this.environment);

            case "custom":
                return rule.fn ? await rule.fn(context) : false;

            case "group":
                return this.evaluateGroup(rule, context);

            default:
                return false;
        }
    }

    async evaluateGroup(rule, context) {

        if (rule.operator === "AND") {
            for (const r of rule.rules) {
                if (!(await this.evaluateRule(r, context))) {
                    return false;
                }
            }
            return true;
        }

        for (const r of rule.rules) {
            if (await this.evaluateRule(r, context)) {
                return true;
            }
        }

        return false;
    }

    /* ==================================================
       VARIANTS
    ================================================== */

    pickVariant(feature, context) {

        const key = String(context.userId || context.tenantId || "");
        const hash = this.hash(feature.name + key);

        const total = feature.variants.reduce((a, v) => a + v.weight, 0);
        let bucket = hash % total;

        for (const v of feature.variants) {
            if (bucket < v.weight) return v.name;
            bucket -= v.weight;
        }

        return null;
    }

    /* ==================================================
       METRICS
    ================================================== */

    trackMetrics(name, result) {

        const m = this.metrics.get(name);
        if (!m) return;

        m.hits++;

        if (result.active) {
            m.exposures++;
        }
    }

    getMetrics(name) {
        return this.metrics.get(name);
    }

    /* ==================================================
       CACHE
    ================================================== */

    invalidate(name) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(name + ":")) {
                this.cache.delete(key);
            }
        }
    }

    /* ==================================================
       ADMIN CONTROLS
    ================================================== */

    enable(name) {
        this.features.get(name).enabled = true;
    }

    disable(name) {
        this.features.get(name).enabled = false;
    }

    killSwitchAll(state) {
        this.circuitBreaker = state;
    }

    /* ==================================================
       LOGGING
    ================================================== */

    log(name, context, result) {

        if (!this.enableLogs) return;

        this.auditLog.push({
            name,
            context,
            result,
            time: Date.now()
        });

        if (this.auditLog.length > 500) {
            this.auditLog.shift();
        }
    }

    /* ==================================================
       HELPERS
    ================================================== */

    bucketMatch(percent, context) {

        const key = context.userId || context.tenantId || "anon";
        const hash = this.hash(key) % 100;

        return hash < percent;
    }

    hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (h * 31 + str.charCodeAt(i)) | 0;
        }
        return Math.abs(h);
    }

    hashKey(name, ctx) {
        return name + ":" + JSON.stringify(ctx);
    }

    safe(fn) {
        try { fn(); } catch {}
    }

    ensureMutable() {
        if (this.frozen) throw new Error("Frozen");
    }
}

/* ==========================================================
   🖥️ SINGLE PAGE DASHBOARD UI (NO FRAMEWORK)
   ========================================================== */

export function createFeatureToggleDashboard(toggle, root = document.body) {

    const el = document.createElement("div");
    el.style.fontFamily = "monospace";
    el.style.padding = "20px";

    function render() {

        el.innerHTML = `
            <h2>🚀 Feature Toggle Dashboard</h2>

            <button id="refresh">Refresh</button>
            <button id="breaker">Toggle Circuit Breaker</button>

            <h3>Features</h3>
            <div id="features"></div>

            <h3>Metrics</h3>
            <pre>${JSON.stringify(Object.fromEntries(toggle.metrics), null, 2)}</pre>

            <h3>Logs</h3>
            <pre>${JSON.stringify(toggle.auditLog.slice(-10), null, 2)}</pre>
        `;

        const container = el.querySelector("#features");

        for (const [name, f] of toggle.features) {

            const div = document.createElement("div");

            div.innerHTML = `
                <b>${name}</b>
                <button data-on="${name}">Enable</button>
                <button data-off="${name}">Disable</button>
            `;

            container.appendChild(div);
        }

        el.querySelector("#refresh").onclick = render;

        el.querySelector("#breaker").onclick = () => {
            toggle.killSwitchAll(!toggle.circuitBreaker);
            render();
        };

        el.querySelectorAll("[data-on]").forEach(btn => {
            btn.onclick = () => {
                toggle.enable(btn.dataset.on);
                render();
            };
        });

        el.querySelectorAll("[data-off]").forEach(btn => {
            btn.onclick = () => {
                toggle.disable(btn.dataset.off);
                render();
            };
        });
    }

    render();
    root.appendChild(el);

    return el;
}

/* ==========================================================
   EXPORT SINGLE INSTANCE
   ========================================================== */

export const featureToggle = new FeatureToggle();
