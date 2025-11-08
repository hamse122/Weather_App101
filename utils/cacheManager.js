// Advanced Cache Manager with TTL and size limits
class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }
    
    set(key, value, ttl = this.defaultTTL) {
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt,
            lastAccessed: Date.now()
        });
        
        this.stats.sets++;
        return true;
    }
    
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        item.lastAccessed = Date.now();
        this.stats.hits++;
        return item.value;
    }
    
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) this.stats.deletes++;
        return deleted;
    }
    
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    }
    
    evictLRU() {
        let lruKey = null;
        let lruTime = Infinity;
        
        for (const [key, item] of this.cache) {
            if (item.lastAccessed < lruTime) {
                lruTime = item.lastAccessed;
                lruKey = key;
            }
        }
        
        if (lruKey) {
            this.cache.delete(lruKey);
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }
}

module.exports = CacheManager;

