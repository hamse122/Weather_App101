const crypto = require('crypto');

class AuditLogger {
  constructor(options = {}) {
    this.transports = options.transports || [this.createConsoleTransport()];
    this.maskFields = new Set(options.maskFields || ['password', 'token', 'apiKey']);
    this.maskPaths = options.maskPaths || [];
    this.contextTransformers = [];
    this.retentionMs = options.retentionMs || null;
    this.maxRecords = options.maxRecords || null;
    this.secret = options.secret || null; // for hashing/signing
    this.records = [];
  }

  addTransformer(transformer) {
    this.contextTransformers.push(transformer);
    return this;
  }

  async log(action, context = {}, meta = {}) {
    const timestamp = new Date();

    let safeContext = this.cloneAndMask(context);
    for (const transformer of this.contextTransformers) {
      safeContext = transformer(safeContext) || safeContext;
    }

    const entry = Object.freeze({
      id: crypto.randomUUID(),
      action,
      level: meta.level || 'INFO',
      actor: meta.actor || null,
      requestId: meta.requestId || null,
      context: safeContext,
      timestamp,
      hash: this.secret ? this.sign(action, timestamp, safeContext) : null
    });

    this.records.push(entry);
    this.enforceRetention();

    await Promise.all(
      this.transports.map(t => Promise.resolve(t(entry)))
    );

    return entry;
  }

  cloneAndMask(value, seen = new WeakMap(), path = '') {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return '[CIRCULAR]';

    const output = Array.isArray(value) ? [] : {};
    seen.set(value, output);

    for (const key of Object.keys(value)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (this.maskFields.has(key) || this.maskPaths.includes(currentPath)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = this.cloneAndMask(value[key], seen, currentPath);
      }
    }

    return output;
  }

  sign(action, timestamp, context) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(action + timestamp.toISOString() + JSON.stringify(context))
      .digest('hex');
  }

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

  enforceRetention() {
    if (this.retentionMs) {
      const cutoff = Date.now() - this.retentionMs;
      this.records = this.records.filter(
        r => r.timestamp.getTime() >= cutoff
      );
    }

    if (this.maxRecords && this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  list({ limit = 100, filter } = {}) {
    let entries = [...this.records];
    if (filter) entries = entries.filter(filter);
    return entries.slice(-limit);
  }
}

module.exports = AuditLogger;
