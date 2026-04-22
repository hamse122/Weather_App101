/**
 * Migration System v4 (Clean, Safe, Unified)
 */

export class MigrationManager {
    constructor(initialVersion = 0) {
        this.migrations = [];
        this.version = initialVersion;
    }

    register(version, up, down = null) {
        if (this.migrations.some(m => m.version === version)) {
            throw new Error(`Migration ${version} already exists`);
        }

        this.migrations.push({ version, up, down });
        this.migrations.sort((a, b) => a.version - b.version);
    }

    getVersion() {
        return this.version;
    }

    setVersion(v) {
        this.version = v;
    }

    async migrate(targetVersion) {
        if (targetVersion === this.version) return this.version;

        if (targetVersion > this.version) {
            return this.#up(targetVersion);
        } else {
            return this.#down(targetVersion);
        }
    }

    async #up(targetVersion) {
        const list = this.migrations.filter(
            m => m.version > this.version && m.version <= targetVersion
        );

        for (const m of list) {
            try {
                await m.up();
                this.version = m.version;
            } catch (err) {
                throw new Error(`Migration ${m.version} failed: ${err.message}`);
            }
        }

        return this.version;
    }

    async #down(targetVersion) {
        const list = this.migrations
            .filter(m => m.version > targetVersion && m.version <= this.version)
            .sort((a, b) => b.version - a.version);

        for (const m of list) {
            try {
                if (m.down) {
                    await m.down();
                }
                this.version = m.version - 1;
            } catch (err) {
                throw new Error(`Rollback ${m.version} failed: ${err.message}`);
            }
        }

        return this.version;
    }

    getPending() {
        return this.migrations.filter(m => m.version > this.version);
    }

    getHistory() {
        return this.migrations.filter(m => m.version <= this.version);
    }

    needsMigration(targetVersion) {
        return this.version !== targetVersion;
    }
}

/**
 * Data Migration Utilities (Fixed)
 */
export class DataMigration {

    static map(data, mapping) {
        const result = {};

        for (const [newKey, rule] of Object.entries(mapping)) {
            if (typeof rule === "function") {
                result[newKey] = rule(data);
            } else if (Array.isArray(rule)) {
                result[newKey] = rule.reduce((acc, key) => {
                    if (data[key] !== undefined) {
                        acc[key] = data[key];
                    }
                    return acc;
                }, {});
            } else {
                if (data[rule] !== undefined) {
                    result[newKey] = data[rule];
                }
            }
        }

        return result;
    }

    static transform(items, fn) {
        return items.map(fn);
    }

    static merge(oldData, newData) {
        return {
            ...oldData,
            ...newData
        };
    }
}

/**
 * Singleton instance
 */
export const migrationManager = new MigrationManager();
