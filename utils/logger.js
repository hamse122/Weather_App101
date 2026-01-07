/**
 * Advanced Logger
 * - Structured
 * - Transport-based
 * - Context-aware
 * - Zero dependencies
 */

class Logger {
    constructor(options = {}) {
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        this.level = options.level ?? 'info';
        this.transports = options.transports ?? [];
        this.timestamps = options.timestamps !== false;
        this.context = options.context || {};
        this.silent = false;
    }

    child(context = {}) {
        return new Logger({
            level: this.level,
            transports: this.transports,
            timestamps: this.timestamps,
            context: { ...this.context, ...context }
        });
    }

    setLevel(level) {
        this.level = level;
    }

    mute(value = true) {
        this.silent = value;
    }

    log(level, message, meta = {}) {
        if (this.silent) return;
        if (this.levels[level] > this.levels[this.level]) return;

        const entry = this.#createEntry(level, message, meta);

        for (const transport of this.transports) {
            if (this.levels[level] <= this.levels[transport.level ?? this.level]) {
                transport.write(entry);
            }
        }
    }

    #createEntry(level, message, meta) {
        if (message instanceof Error) {
            meta = { stack: message.stack, ...meta };
            message = message.message;
        }

        return {
            level,
            message,
            timestamp: this.timestamps ? new Date().toISOString() : undefined,
            context: this.context,
            meta
        };
    }

    error(msg, meta) { this.log('error', msg, meta); }
    warn(msg, meta)  { this.log('warn', msg, meta); }
    info(msg, meta)  { this.log('info', msg, meta); }
    debug(msg, meta) { this.log('debug', msg, meta); }
    trace(msg, meta) { this.log('trace', msg, meta); }
}
