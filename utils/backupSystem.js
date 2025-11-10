/**
 * Backup System Utility
 * Provides simple backup and restore helpers for in-memory data
 */

/**
 * BackupSystem handles snapshotting data and restoring older versions
 */
export class BackupSystem {
    constructor() {
        this.backups = [];
        this.maxBackups = 10;
        this.storage = null;
    }

    /**
     * Set a storage provider (must implement getItem/setItem)
     * @param {Storage} storage
     */
    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Create a new backup snapshot
     * @param {string} key - Identifier for the backup
     * @param {any} data - Data to backup
     * @param {object} metadata - Optional metadata
     * @returns {object} - Backup record
     */
    createBackup(key, data, metadata = {}) {
        const record = {
            id: this.#generateId(),
            key,
            data: structuredClone(data),
            metadata: {
                ...metadata,
                createdAt: new Date().toISOString()
            }
        };

        this.backups.push(record);
        if (this.backups.length > this.maxBackups) {
            this.backups.shift();
        }

        this.#persist();
        return record;
    }

    /**
     * Restore a backup by ID
     * @param {string} id
     * @returns {any}
     */
    restoreBackup(id) {
        const backup = this.backups.find(b => b.id === id);
        if (!backup) {
            throw new Error(`Backup ${id} not found`);
        }
        return structuredClone(backup.data);
    }

    /**
     * Get the latest backup optionally filtered by key
     * @param {string} [key]
     * @returns {object | null}
     */
    getLatestBackup(key) {
        const backups = key ? this.backups.filter(b => b.key === key) : this.backups;
        if (backups.length === 0) return null;
        return backups.reduce((latest, current) =>
            new Date(current.metadata.createdAt) > new Date(latest.metadata.createdAt)
                ? current
                : latest
        );
    }

    /**
     * List backups (optionally filtered)
     * @param {string} [key]
     * @returns {Array<object>}
     */
    listBackups(key) {
        return this.backups.filter(b => !key || b.key === key);
    }

    /**
     * Delete a backup
     * @param {string} id
     */
    deleteBackup(id) {
        this.backups = this.backups.filter(b => b.id !== id);
        this.#persist();
    }

    /**
     * Clear backups
     * @param {string} [key]
     */
    clearBackups(key) {
        if (key) {
            this.backups = this.backups.filter(b => b.key !== key);
        } else {
            this.backups = [];
        }
        this.#persist();
    }

    /**
     * Set maximum number of kept backups
     * @param {number} max
     */
    setMaxBackups(max) {
        this.maxBackups = max;
        if (this.backups.length > this.maxBackups) {
            this.backups = this.backups.slice(-this.maxBackups);
            this.#persist();
        }
    }

    /**
     * Load backups from storage
     */
    loadFromStorage() {
        if (!this.storage) return;
        try {
            const raw = this.storage.getItem('backups');
            if (raw) {
                const parsed = JSON.parse(raw);
                this.backups = parsed;
            }
        } catch (error) {
            console.warn('Failed to load backups from storage:', error);
        }
    }

    #persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem('backups', JSON.stringify(this.backups));
        } catch (error) {
            console.warn('Failed to persist backups:', error);
        }
    }

    #generateId() {
        return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
}

export const backupSystem = new BackupSystem();
