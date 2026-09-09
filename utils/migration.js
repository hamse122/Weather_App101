/**
 * Migration System v6
 * - Safe registration
 * - Version validation
 * - Sequential migrations
 * - Transaction-style version updates
 * - Concurrent migration protection
 * - Migration context
 * - Strict rollback handling
 * - History tracking
 * - Migration locking
 * - Progress events
 * - Dry-run support
 * - Migration validation
 * - History metadata
 */

export class MigrationManager {
    constructor(initialVersion = 0) {
        this.migrations = new Map();
        this.version = this.#validateVersion(initialVersion);
        this.history = [];
        this.running = false;
        this.locked = false;
        this.listeners = new Map();
    }

    /* =========================
       REGISTRATION
    ========================== */

    register(version, up, down = null, metadata = {}) {
        this.#ensureUnlocked();

        version = this.#validateVersion(version);

        if (this.migrations.has(version)) {
            throw new Error(`Migration ${version} already exists`);
        }

        if (typeof up !== "function") {
            throw new TypeError("Migration 'up' must be a function");
        }

        if (down !== null && typeof down !== "function") {
            throw new TypeError(
                "Migration 'down' must be a function or null"
            );
        }

        this.migrations.set(version, {
            version,
            up,
            down,
            metadata: { ...metadata }
        });

        this.#emit("registered", {
            version,
            metadata
        });

        return this;
    }

    unregister(version) {
        this.#ensureUnlocked();

        version = this.#validateVersion(version);

        if (!this.migrations.has(version)) {
            return false;
        }

        this.migrations.delete(version);
        return true;
    }

    /* =========================
       VERSION
    ========================== */

    getVersion() {
        return this.version;
    }

    setVersion(version) {
        if (this.running) {
            throw new Error(
                "Cannot change version while migration is running"
            );
        }

        this.#ensureUnlocked();

        this.version = this.#validateVersion(version);
        return this;
    }

    /* =========================
       MIGRATION
    ========================== */

    async migrate(targetVersion, context = {}, options = {}) {
        targetVersion = this.#validateVersion(targetVersion);

        if (this.running) {
            throw new Error("A migration is already running");
        }

        if (targetVersion === this.version) {
            return this.version;
        }

        const {
            dryRun = false,
            stopOnError = true
        } = options;

        this.running = true;

        const startedAt = Date.now();
        const fromVersion = this.version;

        this.#emit("start", {
            from: fromVersion,
            to: targetVersion,
            dryRun
        });

        try {
            if (targetVersion > this.version) {
                await this.#up(
                    targetVersion,
                    context,
                    { dryRun, stopOnError }
                );
            } else {
                await this.#down(
                    targetVersion,
                    context,
                    { dryRun, stopOnError }
                );
            }

            this.#emit("complete", {
                from: fromVersion,
                to: this.version,
                duration: Date.now() - startedAt,
                dryRun
            });

            return this.version;
        } finally {
            this.running = false;
        }
    }

    async #up(targetVersion, context, options) {
        const migrations = this.getMigrations().filter(
            migration =>
                migration.version > this.version &&
                migration.version <= targetVersion
        );

        for (const migration of migrations) {
            const from = this.version;

            this.#emit("before", {
                version: migration.version,
                direction: "up"
            });

            try {
                if (!options.dryRun) {
                    await migration.up({
                        from,
                        to: migration.version,
                        version: migration.version,
                        direction: "up",
                        ...context
                    });

                    this.version = migration.version;

                    this.history.push({
                        version: migration.version,
                        from,
                        to: migration.version,
                        direction: "up",
                        metadata: { ...migration.metadata },
                        timestamp: Date.now()
                    });
                }

                this.#emit("after", {
                    version: migration.version,
                    direction: "up",
                    dryRun: options.dryRun
                });
            } catch (error) {
                this.#emit("error", {
                    version: migration.version,
                    direction: "up",
                    error
                });

                throw new Error(
                    `Migration ${migration.version} failed: ${error.message}`,
                    { cause: error }
                );
            }
        }
    }

    async #down(targetVersion, context, options) {
        const migrations = this.getMigrations()
            .filter(
                migration =>
                    migration.version > targetVersion &&
                    migration.version <= this.version
            )
            .sort((a, b) => b.version - a.version);

        for (const migration of migrations) {
            if (typeof migration.down !== "function") {
                throw new Error(
                    `Migration ${migration.version} cannot be rolled back: no down migration`
                );
            }

            const from = this.version;
            const to = migration.version - 1;

            this.#emit("before", {
                version: migration.version,
                direction: "down"
            });

            try {
                if (!options.dryRun) {
                    await migration.down({
                        from,
                        to,
                        version: migration.version,
                        direction: "down",
                        ...context
                    });

                    this.version = to;

                    this.history.push({
                        version: migration.version,
                        from,
                        to,
                        direction: "down",
                        metadata: { ...migration.metadata },
                        timestamp: Date.now()
                    });
                }

                this.#emit("after", {
                    version: migration.version,
                    direction: "down",
                    dryRun: options.dryRun
                });
            } catch (error) {
                this.#emit("error", {
                    version: migration.version,
                    direction: "down",
                    error
                });

                throw new Error(
                    `Rollback ${migration.version} failed: ${error.message}`,
                    { cause: error }
                );
            }
        }
    }

    /* =========================
       INSPECTION
    ========================== */

    getMigrations() {
        return [...this.migrations.values()]
            .sort((a, b) => a.version - b.version);
    }

    getPending(targetVersion = Infinity) {
        targetVersion = this.#validateVersion(
            targetVersion === Infinity ? Number.MAX_SAFE_INTEGER : targetVersion
        );

        return this.getMigrations().filter(
            migration =>
                migration.version > this.version &&
                migration.version <= targetVersion
        );
    }

    getHistory() {
        return this.history.map(entry => ({
            ...entry,
            metadata: { ...entry.metadata }
        }));
    }

    getAppliedMigrations() {
        return this.getMigrations().filter(
            migration => migration.version <= this.version
        );
    }

    needsMigration(targetVersion) {
        return this.version !== this.#validateVersion(targetVersion);
    }

    validate(targetVersion = Infinity) {
        const migrations = this.getMigrations();
        const errors = [];

        for (let i = 1; i < migrations.length; i++) {
            if (migrations[i].version <= migrations[i - 1].version) {
                errors.push(
                    `Invalid migration order at version ${migrations[i].version}`
                );
            }
        }

        if (
            targetVersion !== Infinity &&
            !migrations.some(
                migration => migration.version === targetVersion
            ) &&
            targetVersion !== this.version
        ) {
            errors.push(
                `Target version ${targetVersion} is not registered`
            );
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /* =========================
       HISTORY
    ========================== */

    resetHistory() {
        this.#ensureUnlocked();
        this.history.length = 0;
        return this;
    }

    /* =========================
       EVENTS
    ========================== */

    on(event, listener) {
        if (typeof listener !== "function") {
            throw new TypeError("Listener must be a function");
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event).add(listener);

        return () => this.off(event, listener);
    }

    off(event, listener) {
        this.listeners.get(event)?.delete(listener);
        return this;
    }

    #emit(event, payload) {
        this.listeners.get(event)?.forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                console.error(
                    `[MigrationManager] ${event} listener failed:`,
                    error
                );
            }
        });
    }

    /* =========================
       LOCKING
    ========================== */

    lock() {
        if (this.running) {
            throw new Error(
                "Cannot lock migration manager while running"
            );
        }

        this.locked = true;
        return this;
    }

    unlock() {
        if (this.running) {
            throw new Error(
                "Cannot unlock migration manager while running"
            );
        }

        this.locked = false;
        return this;
    }

    #ensureUnlocked() {
        if (this.locked) {
            throw new Error("Migration manager is locked");
        }
    }

    /* =========================
       UTILITIES
    ========================== */

    #validateVersion(version) {
        if (!Number.isInteger(version) || version < 0) {
            throw new TypeError(
                "Migration version must be a non-negative integer"
            );
        }

        return version;
    }
}

/**
 * Data Migration Utilities
 */

export class DataMigration {
    static map(data = {}, mapping = {}) {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new TypeError("Data must be a plain object");
        }

        if (!mapping || typeof mapping !== "object") {
            throw new TypeError("Mapping must be an object");
        }

        const result = {};

        for (const [newKey, rule] of Object.entries(mapping)) {
            if (typeof rule === "function") {
                result[newKey] = rule(data, newKey);
                continue;
            }

            if (Array.isArray(rule)) {
                result[newKey] = rule.reduce((acc, key) => {
                    if (key in data) {
                        acc[key] = data[key];
                    }
                    return acc;
                }, {});
                continue;
            }

            if (typeof rule === "string" && rule in data) {
                result[newKey] = data[rule];
            }
        }

        return result;
    }

    static transform(items, fn) {
        if (!Array.isArray(items)) {
            throw new TypeError("Items must be an array");
        }

        if (typeof fn !== "function") {
            throw new TypeError("Transform must be a function");
        }

        return items.map(fn);
    }

    static async transformAsync(items, fn) {
        if (!Array.isArray(items)) {
            throw new TypeError("Items must be an array");
        }

        if (typeof fn !== "function") {
            throw new TypeError("Transform must be a function");
        }

        return Promise.all(items.map(fn));
    }

    static merge(oldData = {}, newData = {}) {
        return {
            ...oldData,
            ...newData
        };
    }

    static clone(data) {
        if (typeof structuredClone === "function") {
            return structuredClone(data);
        }

        return JSON.parse(JSON.stringify(data));
    }
}

/**
 * Singleton instance
 */
export const migrationManager = new MigrationManager();
