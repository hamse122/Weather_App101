/**
 * Backup System Utility
 * Provides snapshot, restore, and persistence helpers for in-memory data
 */

export class BackupSystem {
  constructor({
    maxBackups = 10,
    storage = null,
    storageKey = 'backups'
  } = {}) {
    this.backups = [];
    this.maxBackups = maxBackups;
    this.storage = storage;
    this.storageKey = storageKey;

    this.loadFromStorage();
  }

  /* ------------------------------------------------------------------ */
  /* Configuration                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Set a storage provider (must implement getItem/setItem)
   * @param {Storage|Object} storage
   */
  setStorage(storage) {
    this.storage = storage;
    this.loadFromStorage();
  }

  /**
   * Set maximum number of retained backups
   * @param {number} max
   */
  setMaxBackups(max) {
    this.maxBackups = max;
    if (this.backups.length > max) {
      this.backups = this.backups.slice(-max);
      this.#persist();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Backup Operations                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Create a new backup snapshot
   * @param {string} key - Logical identifier
   * @param {*} data - Data to back up
   * @param {Object} metadata - Optional metadata
   * @returns {Object} Backup record
   */
  createBackup(key, data, metadata = {}) {
    const record = {
      id: this.#generateId(),
      key,
      data: this.#clone(data),
      metadata: {
        version: metadata.version ?? '1.0.0',
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
   * @returns {*}
   */
  restoreBackup(id) {
    const backup = this.backups.find(b => b.id === id);
    if (!backup) {
      throw new Error(`Backup "${id}" not found`);
    }
    return this.#clone(backup.data);
  }

  /**
   * Get latest backup (optionally filtered by key)
   * @param {string} [key]
   * @returns {Object|null}
   */
  getLatestBackup(key) {
    const list = key
      ? this.backups.filter(b => b.key === key)
      : this.backups;

    if (list.length === 0) return null;

    return list.reduce((latest, current) =>
      new Date(current.metadata.createdAt) >
      new Date(latest.metadata.createdAt)
        ? current
        : latest
    );
  }

  /**
   * List backups
   * @param {string} [key]
   * @returns {Array<Object>}
   */
  listBackups(key) {
    return key
      ? this.backups.filter(b => b.key === key)
      : [...this.backups];
  }

  /**
   * Delete a backup by ID
   * @param {string} id
   */
  deleteBackup(id) {
    this.backups = this.backups.filter(b => b.id !== id);
    this.#persist();
  }

  /**
   * Clear backups (optionally by key)
   * @param {string} [key]
   */
  clearBackups(key) {
    this.backups = key
      ? this.backups.filter(b => b.key !== key)
      : [];
    this.#persist();
  }

  /* ------------------------------------------------------------------ */
  /* Import / Export                                                    */
  /* ------------------------------------------------------------------ */

  exportBackups() {
    return JSON.stringify(this.backups, null, 2);
  }

  importBackups(json) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid backup format');
      }
      this.backups = parsed;
      this.#persist();
    } catch (err) {
      throw new Error(`Failed to import backups: ${err.message}`);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Storage                                                           */
  /* ------------------------------------------------------------------ */

  saveToStorage() {
    this.#persist();
  }

  loadFromStorage() {
    if (!this.storage?.getItem) return;

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.backups = parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load backups from storage:', err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Statistics                                                         */
  /* ------------------------------------------------------------------ */

  getStatistics() {
    return {
      total: this.backups.length,
      maxBackups: this.maxBackups,
      byKey: this.backups.reduce((acc, b) => {
        acc[b.key] = (acc[b.key] || 0) + 1;
        return acc;
      }, {}),
      oldest: this.backups.length
        ? this.backups.reduce((a, b) =>
            new Date(b.metadata.createdAt) <
            new Date(a.metadata.createdAt)
              ? b
              : a
          )
        : null,
      newest: this.getLatestBackup()
    };
  }

  /* ------------------------------------------------------------------ */
  /* Private Helpers                                                    */
  /* ------------------------------------------------------------------ */

  #persist() {
    if (!this.storage?.setItem) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.backups));
    } catch (err) {
      console.warn('Failed to persist backups:', err);
    }
  }

  #generateId() {
    return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  #clone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }
}

/* Global instance */
export const backupSystem = new BackupSystem();
