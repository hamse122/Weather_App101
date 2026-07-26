const crypto = require("crypto");

class AuditLogger {
    constructor(options = {}) {
        this.transports = [...(options.transports || [this.createConsoleTransport()])];

        this.maskFields = new Set([
            "password",
            "token",
            "apiKey",
            "accessToken",
            "refreshToken",
            ...(options.maskFields || [])
        ]);

        this.maskPaths = new Set(options.maskPaths || []);

        this.contextTransformers = [];
        this.retentionMs = options.retentionMs ?? null;
        this.maxRecords = options.maxRecords ?? null;
        this.secret = options.secret ?? null;

        this.records = [];
        this.index = new Map();

        if (this.retentionMs) {
            this._retentionTimer = setInterval(
                () => this.enforceRetention(),
                Math.min(this.retentionMs, 60000)
            );

            this._retentionTimer.unref?.();
        }
    }

    /* =========================
       Registration
    ========================= */

    addTransformer(transformer) {
        if (typeof transformer !== "function") {
            throw new TypeError("Transformer must be a function");
        }

        this.contextTransformers.push(transformer);
        return this;
    }

    addTransport(transport) {
        if (typeof transport !== "function") {
            throw new TypeError("Transport must be a function");
        }

        this.transports.push(transport);
        return this;
    }

    /* =========================
       Logging
    ========================= */

    async log(action, context = {}, meta = {}) {
        const timestamp = new Date();

        let safeContext = this.cloneAndMask(context);

        for (const transformer of this.contextTransformers) {
            const transformed = await transformer(safeContext);

            if (transformed !== undefined) {
                safeContext = transformed;
            }
        }

        const entry = Object.freeze({
            id: crypto.randomUUID(),
            action,
            level: meta.level ?? "INFO",
            actor: meta.actor ?? null,
            requestId: meta.requestId ?? null,
            sessionId: meta.sessionId ?? null,
            tags: Object.freeze([...(meta.tags || [])]),
            context: safeContext,
            timestamp,
            hash: this.secret
                ? this.sign(action, timestamp, safeContext)
                : null
        });

        this.records.push(entry);
        this.index.set(entry.id, entry);

        this.enforceRetention();

        await Promise.allSettled(
            this.transports.map(t => Promise.resolve().then(() => t(entry)))
        );

        return entry;
    }

    /* =========================
       Masking
    ========================= */

    cloneAndMask(value, seen = new WeakMap(), path = "") {
        if (value === null || typeof value !== "object") {
            return value;
        }

        if (seen.has(value)) {
            return "[CIRCULAR]";
        }

        const output = Array.isArray(value) ? [] : {};
        seen.set(value, output);

        for (const key of Object.keys(value)) {
            const currentPath = path ? `${path}.${key}` : key;

            if (
                this.maskFields.has(key) ||
                this.maskPaths.has(currentPath)
            ) {
                output[key] = "[REDACTED]";
            } else {
                output[key] = this.cloneAndMask(
                    value[key],
                    seen,
                    currentPath
                );
            }
        }

        return output;
    }

    /* =========================
       Integrity
    ========================= */

    sign(action, timestamp, context) {
        return crypto
            .createHmac("sha256", this.secret)
            .update(
                JSON.stringify({
                    action,
                    timestamp: timestamp.toISOString(),
                    context
                })
            )
            .digest("hex");
    }

    verify(entry) {
        if (!this.secret || !entry.hash) return false;

        return (
            this.sign(entry.action, entry.timestamp, entry.context) ===
            entry.hash
        );
    }

    /* =========================
       Transport
    ========================= */

    createConsoleTransport() {
        return entry => {
            console.info(`[AUDIT:${entry.level}] ${entry.action}`, {
                id: entry.id,
                actor: entry.actor,
                requestId: entry.requestId,
                timestamp: entry.timestamp.toISOString(),
                context: entry.context
            });
        };
    }

    /* =========================
       Retention
    ========================= */

    enforceRetention() {
        if (this.retentionMs) {
            const cutoff = Date.now() - this.retentionMs;

            this.records = this.records.filter(entry => {
                const keep = entry.timestamp.getTime() >= cutoff;

                if (!keep) {
                    this.index.delete(entry.id);
                }

                return keep;
            });
        }

        if (
            this.maxRecords &&
            this.records.length > this.maxRecords
        ) {
            const removed = this.records.splice(
                0,
                this.records.length - this.maxRecords
            );

            removed.forEach(r => this.index.delete(r.id));
        }
    }

    /* =========================
       Queries
    ========================= */

    get(id) {
        return this.index.get(id) ?? null;
    }

    list({ limit = 100, filter } = {}) {
        let entries = this.records;

        if (typeof filter === "function") {
            entries = entries.filter(filter);
        }

        return entries.slice(-limit);
    }

    clear() {
        this.records.length = 0;
        this.index.clear();
    }

    export() {
        return structuredClone(this.records);
    }

    destroy() {
        clearInterval(this._retentionTimer);
        this.clear();
    }
}
