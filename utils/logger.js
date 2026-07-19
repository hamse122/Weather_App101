/**
 * Advanced Logger (v2)
 * - Structured
 * - Transport-based
 * - Context-aware
 * - Async-ready
 * - Hooks
 * - Timing
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

        this.level = options.level ?? "info";
        this.transports = options.transports ?? [];
        this.timestamps = options.timestamps !== false;
        this.context = Object.freeze({ ...(options.context || {}) });

        this.silent = false;

        // NEW
        this.sequence = 0;
        this.beforeHooks = [];
        this.afterHooks = [];
    }

    child(context = {}) {
        return new Logger({
            level: this.level,
            transports: this.transports,
            timestamps: this.timestamps,
            context: {
                ...this.context,
                ...context
            }
        });
    }

    setLevel(level) {
        if (!(level in this.levels)) {
            throw new Error(`Unknown log level: ${level}`);
        }

        this.level = level;
        return this;
    }

    mute(value = true) {
        this.silent = !!value;
        return this;
    }

    addTransport(transport) {
        if (!transport || typeof transport.write !== "function") {
            throw new TypeError(
                "Transport must implement write(entry)"
            );
        }

        this.transports.push(transport);
        return this;
    }

    removeTransport(transport) {
        this.transports = this.transports.filter(
            t => t !== transport
        );
        return this;
    }

    before(fn) {
        if (typeof fn === "function") {
            this.beforeHooks.push(fn);
        }
        return this;
    }

    after(fn) {
        if (typeof fn === "function") {
            this.afterHooks.push(fn);
        }
        return this;
    }

    async log(level, message, meta = {}) {
        if (this.silent) return;

        if (!(level in this.levels)) {
            throw new Error(`Unknown log level: ${level}`);
        }

        if (this.levels[level] > this.levels[this.level]) {
            return;
        }

        const entry = this.#createEntry(level, message, meta);

        try {
            for (const hook of this.beforeHooks) {
                await hook(entry);
            }

            await Promise.all(
                this.transports
                    .filter(
                        t =>
                            this.levels[level] <=
                            this.levels[t.level ?? this.level]
                    )
                    .map(t => Promise.resolve(t.write(entry)))
            );

            for (const hook of this.afterHooks) {
                await hook(entry);
            }

        } catch (err) {
            console.error("[Logger]", err);
        }

        return entry;
    }

    time(label = "default") {
        const start = performance?.now?.() ?? Date.now();

        return () => {
            const end = performance?.now?.() ?? Date.now();

            this.info(label, {
                durationMs: +(end - start).toFixed(3)
            });
        };
    }

    #createEntry(level, message, meta) {
        if (message instanceof Error) {
            meta = {
                stack: message.stack,
                name: message.name,
                cause: message.cause,
                ...meta
            };

            message = message.message;
        }

        return Object.freeze({
            id: ++this.sequence,
            level,
            message,
            timestamp: this.timestamps
                ? new Date().toISOString()
                : undefined,
            pid:
                typeof process !== "undefined"
                    ? process.pid
                    : undefined,
            context: this.context,
            meta
        });
    }

    error(msg, meta) { return this.log("error", msg, meta); }
    warn(msg, meta) { return this.log("warn", msg, meta); }
    info(msg, meta) { return this.log("info", msg, meta); }
    debug(msg, meta) { return this.log("debug", msg, meta); }
    trace(msg, meta) { return this.log("trace", msg, meta); }
}
