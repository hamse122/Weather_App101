/**
 * Backup System Utility
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
     * Set storage backend
     * @param {Object} storage - Storage object with getItem and setItem methods
     */
    setStorage(storage) {
        this.storage = storage;
    }
    
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


