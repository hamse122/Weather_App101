// Audit logger for tracking security-critical operations
class AuditLogger {
    constructor(options = {}) {
        this.transport = options.transport || this.createConsoleTransport();
        this.maskFields = new Set(options.maskFields || ['password', 'token', 'apiKey']);
        this.contextTransformers = [];
        this.retention = options.retention || null;
        this.records = [];
    }

    addTransformer(transformer) {
        this.contextTransformers.push(transformer);
        return this;
    }

    log(action, context = {}) {
        const timestamp = new Date();
        let safeContext = this.maskSensitive(context);
        for (const transformer of this.contextTransformers) {
            safeContext = transformer(safeContext) || safeContext;
        }

        const entry = {
            id: `${timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
            action,
            context: safeContext,
            timestamp
        };

        this.records.push(entry);
        this.enforceRetention();
        this.transport(entry);

        return entry;
    }

    maskSensitive(context) {
        if (!context || typeof context !== 'object') {
            return context;
        }
        const copy = Array.isArray(context) ? [...context] : { ...context };
        Object.keys(copy).forEach(key => {
            if (this.maskFields.has(key)) {
                copy[key] = '[REDACTED]';
            } else if (copy[key] && typeof copy[key] === 'object') {
                copy[key] = this.maskSensitive(copy[key]);
            }
        });
        return copy;
    }

    createConsoleTransport() {
        return entry => {
            console.info(`[AUDIT] ${entry.action}`, {
                timestamp: entry.timestamp.toISOString(),
                context: entry.context
            });
        };
    }

    enforceRetention() {
        if (!this.retention) {
            return;
        }
        const cutoff = Date.now() - this.retention;
        this.records = this.records.filter(record => record.timestamp.getTime() >= cutoff);
    }

    list({ limit = 100, filter = null } = {}) {
        let entries = [...this.records];
        if (filter) {
            entries = entries.filter(filter);
        }
        return entries.slice(-limit);
    }
}

module.exports = AuditLogger;

