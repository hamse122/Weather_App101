// Cache warming and preloading system
class CacheWarmer {
    constructor(cacheManager) {
        if (!cacheManager || typeof cacheManager.set !== 'function' || typeof cacheManager.get !== 'function') {
            throw new Error('CacheWarmer requires a cacheManager with get and set methods');
        }
        this.cacheManager = cacheManager;
        this.warmingStrategies = new Map();
        this.warmupQueue = [];
        this.isWarming = false;
    }

    addStrategy(key, fetchFn, options = {}) {
        if (typeof fetchFn !== 'function') {
            throw new Error('fetchFn must be a function');
        }

        const { ttl = 3600000, preload = true, refreshInterval = null } = options;

        this.warmingStrategies.set(key, {
            fetchFn,
            ttl,
            preload,
            refreshInterval,
            lastFetched: null
        });

        if (preload) {
            this.warmupQueue.push(key);
        }

        if (refreshInterval) {
            setInterval(() => this.warmKey(key), refreshInterval).unref?.();
        }

        return this;
    }

    async warmKey(key) {
        const strategy = this.warmingStrategies.get(key);
        if (!strategy) {
            return null;
        }
        try {
            const data = await strategy.fetchFn();
            this.cacheManager.set(key, data, strategy.ttl);
            strategy.lastFetched = new Date();
            return data;
        } catch (error) {
            console.error(`Cache warming failed for ${key}:`, error);
            throw error;
        }
    }

    async warmAll() {
        if (this.isWarming) {
            return [];
        }

        this.isWarming = true;
        const results = [];

        for (const [key, strategy] of this.warmingStrategies) {
            if (!strategy.preload) {
                continue;
            }
            try {
                const result = await this.warmKey(key);
                results.push({ key, success: true, result });
            } catch (error) {
                results.push({ key, success: false, error: error.message });
            }
        }

        this.isWarming = false;
        return results;
    }

    async get(key) {
        let data = this.cacheManager.get(key);
        if (data === undefined || data === null) {
            data = await this.warmKey(key);
        }
        return data;
    }

    getWarmupStatus() {
        const status = {};
        this.warmingStrategies.forEach((strategy, key) => {
            status[key] = {
                preload: strategy.preload,
                lastFetched: strategy.lastFetched,
                refreshInterval: strategy.refreshInterval,
                inCache: this.cacheManager.get(key) !== undefined && this.cacheManager.get(key) !== null
            };
        });
        return status;
    }

    removeStrategy(key) {
        this.warmingStrategies.delete(key);
        this.warmupQueue = this.warmupQueue.filter(existingKey => existingKey !== key);
        return this;
    }
}

module.exports = CacheWarmer;

