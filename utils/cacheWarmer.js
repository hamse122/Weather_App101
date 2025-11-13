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
        this.metrics = {
            warmupsStarted: 0,
            warmupsCompleted: 0,
            warmupsFailed: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        this.eventHandlers = {
            'warmup:start': [],
            'warmup:success': [],
            'warmup:error': [],
            'cache:hit': [],
            'cache:miss': []
        };
    }

    addStrategy(key, fetchFn, options = {}) {
        if (typeof fetchFn !== 'function') {
            throw new Error('fetchFn must be a function');
        }

        const { 
            ttl = 3600000, 
            preload = true, 
            refreshInterval = null,
            priority = 1,
            dependencies = [],
            retryAttempts = 3,
            retryDelay = 1000,
            warmOnDemand = true,
            staleWhileRevalidate = false
        } = options;

        this.warmingStrategies.set(key, {
            fetchFn,
            ttl,
            preload,
            refreshInterval,
            priority: Math.max(1, Math.min(10, priority)), // Clamp between 1-10
            dependencies,
            retryAttempts,
            retryDelay,
            warmOnDemand,
            staleWhileRevalidate,
            lastFetched: null,
            lastError: null,
            fetchCount: 0,
            errorCount: 0
        });

        if (preload) {
            this.warmupQueue.push({ key, priority });
            // Sort by priority (higher first)
            this.warmupQueue.sort((a, b) => b.priority - a.priority);
        }

        if (refreshInterval) {
            const intervalId = setInterval(() => this.warmKey(key), refreshInterval);
            // Store interval ID for cleanup
            strategy.intervalId = intervalId;
            if (intervalId.unref) intervalId.unref();
        }

        return this;
    }

    async warmKey(key, options = {}) {
        const strategy = this.warmingStrategies.get(key);
        if (!strategy) {
            throw new Error(`No warming strategy found for key: ${key}`);
        }

        // Check dependencies first
        if (strategy.dependencies.length > 0 && !options.skipDependencies) {
            await this.warmDependencies(strategy.dependencies);
        }

        this.emit('warmup:start', { key, strategy });
        this.metrics.warmupsStarted++;

        let lastError;
        for (let attempt = 1; attempt <= strategy.retryAttempts; attempt++) {
            try {
                const data = await strategy.fetchFn();
                this.cacheManager.set(key, data, strategy.ttl);
                
                strategy.lastFetched = new Date();
                strategy.lastError = null;
                strategy.fetchCount++;
                
                this.emit('warmup:success', { 
                    key, 
                    data, 
                    attempt,
                    timestamp: new Date()
                });
                this.metrics.warmupsCompleted++;
                
                return data;
            } catch (error) {
                lastError = error;
                strategy.lastError = error;
                strategy.errorCount++;
                
                console.error(`Cache warming attempt ${attempt}/${strategy.retryAttempts} failed for ${key}:`, error);
                
                if (attempt < strategy.retryAttempts) {
                    await this.delay(strategy.retryDelay * attempt); // Exponential backoff
                }
            }
        }

        this.emit('warmup:error', { key, error: lastError, attempts: strategy.retryAttempts });
        this.metrics.warmupsFailed++;
        
        // If staleWhileRevalidate is enabled and we have stale data, return it
        if (strategy.staleWhileRevalidate) {
            const staleData = this.cacheManager.get(key);
            if (staleData !== undefined && staleData !== null) {
                console.warn(`Returning stale data for ${key} after warmup failure`);
                return staleData;
            }
        }
        
        throw lastError;
    }

    async warmDependencies(dependencies) {
        const results = [];
        for (const depKey of dependencies) {
            try {
                const result = await this.warmKey(depKey, { skipDependencies: true });
                results.push({ key: depKey, success: true, result });
            } catch (error) {
                results.push({ key: depKey, success: false, error });
                throw new Error(`Dependency ${depKey} failed to warm: ${error.message}`);
            }
        }
        return results;
    }

    async warmAll(options = {}) {
        if (this.isWarming) {
            throw new Error('Warmup already in progress');
        }

        const { 
            concurrency = 3,
            priorityThreshold = 0 
        } = options;

        this.isWarming = true;
        const results = [];
        const queue = this.warmupQueue
            .filter(item => item.priority >= priorityThreshold)
            .map(item => item.key);

        console.log(`Starting cache warmup for ${queue.length} items with concurrency ${concurrency}`);

        // Process queue with concurrency control
        const processBatch = async (batch) => {
            const batchResults = await Promise.allSettled(
                batch.map(key => this.warmKey(key))
            );
            
            batchResults.forEach((result, index) => {
                const key = batch[index];
                if (result.status === 'fulfilled') {
                    results.push({ key, success: true, result: result.value });
                } else {
                    results.push({ key, success: false, error: result.reason.message });
                }
            });
        };

        // Process in batches
        for (let i = 0; i < queue.length; i += concurrency) {
            const batch = queue.slice(i, i + concurrency);
            await processBatch(batch);
            
            // Small delay between batches to prevent thundering herd
            if (i + concurrency < queue.length) {
                await this.delay(100);
            }
        }

        this.isWarming = false;
        console.log(`Cache warmup completed. Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
        
        return results;
    }

    async get(key, options = {}) {
        const { forceRefresh = false, warmIfMissing = true } = options;
        const strategy = this.warmingStrategies.get(key);

        let data = this.cacheManager.get(key);
        
        if (data === undefined || data === null || forceRefresh) {
            this.metrics.cacheMisses++;
            this.emit('cache:miss', { key, forceRefresh });
            
            if (warmIfMissing && strategy?.warmOnDemand) {
                data = await this.warmKey(key);
            } else if (strategy?.fetchFn) {
                // Direct fetch without warming strategy
                data = await strategy.fetchFn();
                this.cacheManager.set(key, data, strategy.ttl);
            } else {
                throw new Error(`No data in cache and no warming strategy for key: ${key}`);
            }
        } else {
            this.metrics.cacheHits++;
            this.emit('cache:hit', { key, data });
            
            // Background refresh if data is getting stale
            if (strategy?.staleWhileRevalidate && this.isDataStale(key)) {
                this.warmKey(key).catch(error => 
                    console.error(`Background refresh failed for ${key}:`, error)
                );
            }
        }

        return data;
    }

    isDataStale(key) {
        const strategy = this.warmingStrategies.get(key);
        if (!strategy?.lastFetched) return true;
        
        const age = Date.now() - strategy.lastFetched.getTime();
        return age > (strategy.ttl * 0.8); // Consider stale at 80% of TTL
    }

    getWarmupStatus() {
        const status = {};
        this.warmingStrategies.forEach((strategy, key) => {
            status[key] = {
                preload: strategy.preload,
                priority: strategy.priority,
                lastFetched: strategy.lastFetched,
                lastError: strategy.lastError?.message,
                refreshInterval: strategy.refreshInterval,
                fetchCount: strategy.fetchCount,
                errorCount: strategy.errorCount,
                inCache: this.cacheManager.get(key) !== undefined && this.cacheManager.get(key) !== null,
                isStale: this.isDataStale(key),
                dependencies: strategy.dependencies
            };
        });
        return status;
    }

    getMetrics() {
        return {
            ...this.metrics,
            strategiesCount: this.warmingStrategies.size,
            queueLength: this.warmupQueue.length,
            isWarming: this.isWarming,
            hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
        };
    }

    resetMetrics() {
        this.metrics = {
            warmupsStarted: 0,
            warmupsCompleted: 0,
            warmupsFailed: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    removeStrategy(key) {
        const strategy = this.warmingStrategies.get(key);
        if (strategy?.intervalId) {
            clearInterval(strategy.intervalId);
        }
        
        this.warmingStrategies.delete(key);
        this.warmupQueue = this.warmupQueue.filter(item => item.key !== key);
        
        return this;
    }

    clearAllStrategies() {
        this.warmingStrategies.forEach((strategy, key) => {
            if (strategy.intervalId) {
                clearInterval(strategy.intervalId);
            }
        });
        this.warmingStrategies.clear();
        this.warmupQueue = [];
        return this;
    }

    // Event handling
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
        return this;
    }

    off(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
        }
        return this;
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Preload specific keys with custom options
    async preloadKeys(keys, options = {}) {
        const results = [];
        for (const key of keys) {
            try {
                const data = await this.warmKey(key, options);
                results.push({ key, success: true, data });
            } catch (error) {
                results.push({ key, success: false, error: error.message });
            }
        }
        return results;
    }

    // Health check
    healthCheck() {
        const status = this.getWarmupStatus();
        const failedStrategies = Object.values(status).filter(s => s.lastError).length;
        const staleStrategies = Object.values(status).filter(s => s.isStale).length;
        
        return {
            healthy: failedStrategies === 0,
            strategies: this.warmingStrategies.size,
            failed: failedStrategies,
            stale: staleStrategies,
            warming: this.isWarming
        };
    }
}

module.exports = CacheWarmer;
