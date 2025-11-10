/**
 * Migration Utility
 * Provides simple versioned migration execution helpers
 */

/**
 * Migration manager for registering and executing migrations
 */
export class MigrationManager {
    constructor() {
        this.migrations = [];
        this.currentVersion = 0;
    }

    /**
     * Register a migration
     * @param {number} version - Migration version number
     * @param {Function} up - Function to run when migrating up
     * @param {Function} down - Function to run when migrating down
     */
    register(version, up, down = null) {
        this.migrations.push({ version, up, down });
        this.migrations.sort((a, b) => a.version - b.version);
    }

    /**
     * Migrate to a target version
     * @param {number} targetVersion
     * @returns {Promise<number>} - Final version after migration
     */
    async migrate(targetVersion) {
        if (targetVersion === this.currentVersion) return this.currentVersion;

        if (targetVersion > this.currentVersion) {
            return this.#migrateUp(targetVersion);
        }
        return this.#migrateDown(targetVersion);
    }

    async #migrateUp(targetVersion) {
        const pending = this.migrations.filter(
            m => m.version > this.currentVersion && m.version <= targetVersion
        );

        for (const migration of pending) {
            try {
                await migration.up();
                this.currentVersion = migration.version;
            } catch (error) {
                throw new Error(`Migration ${migration.version} failed: ${error.message}`);
            }
        }
        return this.currentVersion;
    }

    async #migrateDown(targetVersion) {
        const pending = this.migrations
            .filter(m => m.version <= this.currentVersion && m.version > targetVersion)
            .sort((a, b) => b.version - a.version);

        for (const migration of pending) {
            try {
                if (migration.down) {
                    await migration.down();
                }
                this.currentVersion = migration.version - 1;
            } catch (error) {
                throw new Error(`Migration ${migration.version} rollback failed: ${error.message}`);
            }
        }
        return this.currentVersion;
    }

    /**
     * Get pending migrations
     * @returns {Array}
     */
    getPending() {
        return this.migrations.filter(m => m.version > this.currentVersion);
    }

    /**
     * Get migration history
     * @returns {Array}
     */
    getHistory() {
        return this.migrations.filter(m => m.version <= this.currentVersion);
    }
}

/**
 * DataMigration helper for transforming data structures
 */
export class DataMigration {
    /**
     * Migrate data using mapping rules
     * @param {Record<string, any>} data
     * @param {Record<string, string | string[] | Function>} mapping
     * @returns {Record<string, any>}
     */
    static migrate(data, mapping) {
        const result = {};

        Object.entries(mapping).forEach(([newKey, rule]) => {
            if (typeof rule === 'function') {
                result[newKey] = rule(data);
            } else if (Array.isArray(rule)) {
                result[newKey] = rule.reduce((acc, key) => {
                    if (data[key] !== undefined) {
                        acc[key] = data[key];
                    }
                    return acc;
                }, {});
            } else if (data[rule] !== undefined) {
                result[newKey] = data[rule];
            }
        });

        return result;
    }

    /**
     * Transform an array of items
     * @param {Array} items
     * @param {Function} transformer
     * @returns {Array}
     */
    static transformArray(items, transformer) {
        return items.map(transformer);
    }

    /**
     * Merge old and new structures
     * @param {Record<string, any>} oldData
     * @param {Record<string, any>} newData
     * @returns {Record<string, any>}
     */
    static merge(oldData, newData) {
        return { ...oldData, ...newData };
    }
}

export const migrationManager = new MigrationManager();
