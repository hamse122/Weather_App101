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
 * Data migration utilities for versioning and migrating data structures
 */

/**
 * Migration class for managing data migrations
 */
export class Migration {
    constructor() {
        this.migrations = [];
        this.version = 0;
    }
    
    /**
     * Register a migration
     * @param {number} version - Migration version
     * @param {Function} up - Up migration function
     * @param {Function} down - Down migration function (optional)
     */
    register(version, up, down = null) {
        this.migrations.push({
            version,
            up,
            down
        });
        this.migrations.sort((a, b) => a.version - b.version);
    }
    
    /**
     * Get current version
     * @returns {number} - Current version
     */
    getVersion() {
        return this.version;
    }
    
    /**
     * Set current version
     * @param {number} version - Version number
     */
    setVersion(version) {
        this.version = version;
    }
    
    /**
     * Migrate to a specific version
     * @param {number} targetVersion - Target version
     * @returns {Promise<number>} - Final version
     */
    async migrate(targetVersion) {
        if (targetVersion > this.version) {
            return await this.up(targetVersion);
        } else if (targetVersion < this.version) {
            return await this.down(targetVersion);
        }
        return this.version;
    }
    
    /**
     * Run up migrations
     * @param {number} targetVersion - Target version
     * @returns {Promise<number>} - Final version
     */
    async up(targetVersion) {
        const migrationsToRun = this.migrations.filter(m => 
            m.version > this.version && m.version <= targetVersion
        );
        
        for (const migration of migrationsToRun) {
            try {
                await migration.up();
                this.version = migration.version;
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
        
        return this.version;
    }
    
    /**
     * Run down migrations
     * @param {number} targetVersion - Target version
     * @returns {Promise<number>} - Final version
     */
    async down(targetVersion) {
        const migrationsToRun = this.migrations
            .filter(m => m.version > targetVersion && m.version <= this.version)
            .reverse();
        
        for (const migration of migrationsToRun) {
            try {
                if (migration.down) {
                    await migration.down();
                }
                this.currentVersion = migration.version - 1;
                this.version = migration.version - 1;
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
        
        return this.version;
    }
    
    /**
     * Get pending migrations
     * @returns {Array} - Array of pending migrations
     */
    getPending() {
        return this.migrations.filter(m => m.version > this.version);
    }
    
    /**
     * Get migration history
     * @returns {Array} - Array of migration history
     */
    getHistory() {
        return this.migrations.filter(m => m.version <= this.version);
    }
    
    /**
     * Check if migration is needed
     * @param {number} targetVersion - Target version
     * @returns {boolean} - True if migration is needed
     */
    needsMigration(targetVersion) {
        return this.version !== targetVersion;
    }
}

/**
 * DataMigration class for migrating data structures
 */
export class DataMigration {
    /**
     * Migrate object to new structure
     * @param {Object} data - Data to migrate
     * @param {Object} mapping - Field mapping object
     * @returns {Object} - Migrated data
     */
    static migrateStructure(data, mapping) {
        const migrated = {};
        
        Object.entries(mapping).forEach(([newKey, oldKey]) => {
            if (typeof oldKey === 'function') {
                migrated[newKey] = oldKey(data);
            } else if (Array.isArray(oldKey)) {
                migrated[newKey] = oldKey.reduce((obj, key) => {
                    if (data[key] !== undefined) {
                        obj[key] = data[key];
                    }
                    return obj;
                }, {});
            } else if (data[oldKey] !== undefined) {
                migrated[newKey] = data[oldKey];
            }
        });
        
        return migrated;
    }
    
    /**
     * Transform array of objects
     * @param {Array} data - Array of objects to transform
     * @param {Function} transformer - Transformer function
     * @returns {Array} - Transformed array
     */
    static transformArray(data, transformer) {
        return data.map(transformer);
    }
    
    /**
     * Merge old and new data structures
     * @param {Object} oldData - Old data structure
     * @param {Object} newData - New data structure
     * @returns {Object} - Merged data
     */
    static mergeStructures(oldData, newData) {
        return { ...oldData, ...newData };
    }
}

export const migrationManager = new MigrationManager();
// Global migration instance
export const migration = new Migration();


