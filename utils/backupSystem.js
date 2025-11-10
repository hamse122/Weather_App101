/**
 * Backup System Utility
 * Provides simple backup and restore helpers for in-memory data
 */

/**
 * BackupSystem handles snapshotting data and restoring older versions
 * Backup and restore system for data backup management
 */

/**
 * BackupSystem class for managing backups
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
    
    /**
     * Set storage backend
     * @param {Object} storage - Storage object with getItem and setItem methods
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
    
    /**
     * Create a backup
     * @param {string} key - Backup key
     * @param {*} data - Data to backup
     * @param {Object} metadata - Backup metadata
     * @returns {Object} - Backup object
     */
    createBackup(key, data, metadata = {}) {
        const backup = {
            id: this.generateBackupId(),
            key,
            data: JSON.parse(JSON.stringify(data)), // Deep clone
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString(),
                version: metadata.version || '1.0.0'
            }
        };
        
        this.backups.push(backup);
        
        // Limit number of backups
        if (this.backups.length > this.maxBackups) {
            this.backups.shift();
        }
        
        // Save to storage if available
        if (this.storage) {
            this.saveToStorage();
        }
        
        return backup;
    }
    
    /**
     * Restore a backup
     * @param {string} backupId - Backup ID
     * @returns {*} - Restored data
     */
    restoreBackup(backupId) {
        const backup = this.backups.find(b => b.id === backupId);
        if (!backup) {
            throw new Error(`Backup ${backupId} not found`);
        }
        
        return JSON.parse(JSON.stringify(backup.data)); // Deep clone
    }
    
    /**
     * Get all backups
     * @param {string} key - Optional key to filter by
     * @returns {Array} - Array of backups
     */
    getBackups(key = null) {
        if (key) {
            return this.backups.filter(b => b.key === key);
        }
        return [...this.backups];
    }
    
    /**
     * Get latest backup
     * @param {string} key - Optional key to filter by
     * @returns {Object|null} - Latest backup or null
     */
    getLatestBackup(key = null) {
        const backups = this.getBackups(key);
        if (backups.length === 0) return null;
        
        return backups.reduce((latest, backup) => {
            return new Date(backup.metadata.timestamp) > new Date(latest.metadata.timestamp) 
                ? backup 
                : latest;
        });
    }
    
    /**
     * Delete a backup
     * @param {string} backupId - Backup ID
     */
    deleteBackup(backupId) {
        const index = this.backups.findIndex(b => b.id === backupId);
        if (index > -1) {
            this.backups.splice(index, 1);
            if (this.storage) {
                this.saveToStorage();
            }
        }
    }
    
    /**
     * Clear all backups
     * @param {string} key - Optional key to filter by
     */
    clearBackups(key = null) {
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

        
        if (this.storage) {
            this.saveToStorage();
        }
    }
    
    /**
     * Export backups to JSON
     * @returns {string} - JSON string
     */
    exportBackups() {
        return JSON.stringify(this.backups, null, 2);
    }
    
    /**
     * Import backups from JSON
     * @param {string} json - JSON string
     */
    importBackups(json) {
        try {
            const backups = JSON.parse(json);
            this.backups = backups;
            if (this.storage) {
                this.saveToStorage();
            }
        } catch (error) {
            throw new Error(`Failed to import backups: ${error.message}`);
        }
    }
    
    /**
     * Generate backup ID
     * @returns {string} - Backup ID
     */
    generateBackupId() {
        return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Save backups to storage
     */
    saveToStorage() {
        if (this.storage && typeof this.storage.setItem === 'function') {
            try {
                this.storage.setItem('backups', this.exportBackups());
            } catch (error) {
                console.error('Failed to save backups to storage:', error);
            }
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
        if (this.storage && typeof this.storage.getItem === 'function') {
            try {
                const stored = this.storage.getItem('backups');
                if (stored) {
                    this.importBackups(stored);
                }
            } catch (error) {
                console.error('Failed to load backups from storage:', error);
            }
        }
    }
    
    /**
     * Set maximum number of backups
     * @param {number} max - Maximum number of backups
     */
    setMaxBackups(max) {
        this.maxBackups = max;
        if (this.backups.length > this.maxBackups) {
            this.backups = this.backups.slice(-this.maxBackups);
            if (this.storage) {
                this.saveToStorage();
            }
        }
    }
    
    /**
     * Get backup statistics
     * @returns {Object} - Backup statistics
     */
    getStatistics() {
        return {
            total: this.backups.length,
            maxBackups: this.maxBackups,
            byKey: this.backups.reduce((acc, backup) => {
                acc[backup.key] = (acc[backup.key] || 0) + 1;
                return acc;
            }, {}),
            oldest: this.backups.length > 0 
                ? this.backups.reduce((oldest, backup) => 
                    new Date(backup.metadata.timestamp) < new Date(oldest.metadata.timestamp) 
                        ? backup 
                        : oldest
                  )
                : null,
            newest: this.getLatestBackup()
        };
    }
}

// Global backup system instance
export const backupSystem = new BackupSystem();


