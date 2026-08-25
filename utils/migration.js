/**
 * Migration System v5
 * - Safe registration
 * - Version validation
 * - Sequential migrations
 * - Transaction-style version updates
 * - Concurrent migration protection
 * - Migration context
 * - Strict rollback handling
 * - History tracking
 */

export class MigrationManager {
    constructor(initialVersion = 0) {
        this.migrations = new Map();
        this.version = this.#validateVersion(initialVersion);
        this.history = [];
        this.running = false;
    }

    register(version, up, down = null) {
        version = this.#validateVersion(version);

        if (this.migrations.has(version)) {
            throw new Error(`Migration ${version} already exists`);
        }

        if (typeof up !== "function") {
            throw new TypeError("Migration 'up' must be a function");
        }

        if (down !== null && typeof down !== "function") {
            throw new TypeError("Migration 'down' must be a function or null");
        }

        this.migrations.set(version, { version, up, down });
        return this;
    }

    getVersion() {
        return this.version;
    }

    setVersion(version) {
        if (this.running) {
            throw new Error("Cannot change version while migration is running");
        }

        this.version = this.#validateVersion(version);
        return this;
    }

    async migrate(targetVersion, context = {}) {
        targetVersion = this.#validateVersion(targetVersion);

        if (this.running) {
            throw new Error("A migration is already running");
        }

        if (targetVersion === this.version) {
            return this.version;
        }

        this.running = true;

        try {
            if (targetVersion > this.version) {
                await this.#up(targetVersion, context);
            } else {
                await this.#down(targetVersion, context);
            }

            return this.version;
        } finally {
            this.running = false;
        }
    }

    async #up(targetVersion, context) {
        const migrations = this.getMigrations()
            .filter(
                migration =>
                    migration.version > this.version &&
                    migration.version <= targetVersion
            );

        for (const migration of migrations) {
            try {
                await migration.up({
                    from: this.version,
                    to: migration.version,
                    ...context
                });

                this.history.push({
                    version: migration.version,
                    direction: "up",
                    timestamp: Date.now()
                });

                this.version = migration.version;
            } catch (error) {
                throw new Error(
                    `Migration ${migration.version} failed: ${error.message}`,
                    { cause: error }
                );
            }
        }
    }

    async #down(targetVersion, context) {
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

            try {
                await migration.down({
                    from: this.version,
                    to: migration.version - 1,
                    ...context
                });

                this.history.push({
                    version: migration.version,
                    direction: "down",
                    timestamp: Date.now()
                });

                this.version = migration.version - 1;
            } catch (error) {
                throw new Error(
                    `Rollback ${migration.version} failed: ${error.message}`,
                    { cause: error }
                );
            }
        }
    }

    getMigrations() {
        return [...this.migrations.values()]
            .sort((a, b) => a.version - b.version);
    }

    getPending(targetVersion = Infinity) {
        return this.getMigrations().filter(
            migration =>
                migration.version > this.version &&
                migration.version <= targetVersion
        );
    }

    getHistory() {
        return [...this.history];
    }

    getAppliedMigrations() {
        return this.getMigrations().filter(
            migration => migration.version <= this.version
        );
    }

    needsMigration(targetVersion) {
        return this.version !== targetVersion;
    }

    resetHistory() {
        this.history.length = 0;
        return this;
    }

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
        if (!data || typeof data !== "object") {
            throw new TypeError("Data must be an object");
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

        return Promise.all(items.map(fn));
    }

    static merge(oldData = {}, newData = {}) {
        return {
            ...oldData,
            ...newData
        };
    }

    static clone(data) {
        return typeof structuredClone === "function"
            ? structuredClone(data)
            : JSON.parse(JSON.stringify(data));
    }
}

/**
 * Singleton instance
 */
export const migrationManager = new MigrationManager();
