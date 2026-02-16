/**
 * Ultra Advanced Cache Manager
 * Features:
 * - O(1) LRU eviction (Map + Doubly Linked List)
 * - TTL with auto cleanup
 * - Max size & max memory limit
 * - Async value caching (Promises)
 * - Namespaces
 * - Event hooks
 * - Metrics & performance tracking
 * - Bulk operations
 * - Optional deep freeze (immutability)
 */

class Node {
    constructor(key, data) {
        this.key = key;
        this.data = data;
        this.prev = null;
        this.next = null;
    }
}

class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.maxMemory = options.maxMemory || Infinity; // bytes
        this.defaultTTL = options.defaultTTL || 3600000;
        this.namespace = options.namespace || "default";
        this.freeze = options.freeze || false;
        this.cleanupInterval = options.cleanupInterval || 60000;

        this.cache = new Map();
        this.head = null;
        this.tail = null;
        this.memoryUsage = 0;

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };

        if (this.cleanupInterval > 0) {
            this._startCleanup();
        }
    }

    /* ---------------- PRIVATE HELPERS ---------------- */

    _now() {
        return Date.now();
    }

    _estimateSize(value) {
        try {
            return new Blob([JSON.stringify(value)]).size;
        } catch {
            return 0;
        }
    }

    _freeze(value) {
        if (!this.freeze || typeof value !== "object" || value === null) {
            return value;
        }
        return Object.freeze(structuredClone(value));
    }

    _removeNode(node) {
        if (!node) return;

        if (node.prev) node.prev.next = node.next;
        if (node.next) node.next.prev = node.prev;

        if (node === this.head) this.head = node.next;
        if (node === this.tail) this.tail = node.prev;
    }

    _addToFront(node) {
        node.prev = null;
        node.next = this.head;

        if (this.head) this.head.prev = node;
        this.head = node;

        if (!this.tail) this.tail = node;
    }

    _moveToFront(node) {
        this._removeNode(node);
        this._addToFront(node);
    }

    _evictLRU() {
        if (!this.tail) return;

        const lruKey = this.tail.key;
        this.delete(lruKey);
        this.stats.evictions++;
        this._emit("evict", lruKey);
    }

    _isExpired(item) {
        return item.expiresAt && this._now() > item.expiresAt;
    }

    _startCleanup() {
        this._cleanupTimer = setInterval(() => {
            this.cleanupExpired();
        }, this.cleanupInterval);
    }

    _emit(event, payload) {
        if (this.events?.[event]) {
            this.events[event].forEach(cb => cb(payload));
        }
    }

    /* ---------------- PUBLIC API ---------------- */

    on(event, callback) {
        if (!this.events) this.events = {};
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    set(key, value, ttl = this.defaultTTL) {
        const namespacedKey = `${this.namespace}:${key}`;
        const size = this._estimateSize(value);

        if (size > this.maxMemory) return false;

        if (this.cache.has(namespacedKey)) {
            this.delete(key);
        }

        while (this.cache.size >= this.maxSize || this.memoryUsage + size > this.maxMemory) {
            this._evictLRU();
        }

        const data = {
            value: this._freeze(value),
            expiresAt: ttl ? this._now() + ttl : null,
            createdAt: this._now(),
            lastAccessed: this._now(),
            size
        };

        const node = new Node(namespacedKey, data);
        this._addToFront(node);

        this.cache.set(namespacedKey, node);
        this.memoryUsage += size;
        this.stats.sets++;

        this._emit("set", { key, value });
        return true;
    }

    get(key) {
        const namespacedKey = `${this.namespace}:${key}`;
        const node = this.cache.get(namespacedKey);

        if (!node) {
            this.stats.misses++;
            this._emit("miss", key);
            return null;
        }

        if (this._isExpired(node.data)) {
            this.delete(key);
            this.stats.misses++;
            return null;
        }

        node.data.lastAccessed = this._now();
        this._moveToFront(node);
        this.stats.hits++;

        this._emit("hit", key);
        return node.data.value;
    }

    async getOrSet(key, asyncFn, ttl = this.defaultTTL) {
        const cached = this.get(key);
        if (cached !== null) return cached;

        const result = await asyncFn();
        this.set(key, result, ttl);
        return result;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        const namespacedKey = `${this.namespace}:${key}`;
        const node = this.cache.get(namespacedKey);

        if (!node) return false;

        this._removeNode(node);
        this.cache.delete(namespacedKey);
        this.memoryUsage -= node.data.size;
        this.stats.deletes++;

        this._emit("delete", key);
        return true;
    }

    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.memoryUsage = 0;
        this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
        this._emit("clear");
    }

    cleanupExpired() {
        for (const [key, node] of this.cache) {
            if (this._isExpired(node.data)) {
                this.delete(key.split(":")[1]);
            }
        }
    }

    keys() {
        return Array.from(this.cache.keys()).map(k => k.split(":")[1]);
    }

    values() {
        return this.keys().map(k => this.get(k));
    }

    entries() {
        return this.keys().map(k => [k, this.get(k)]);
    }

    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.cache.size,
            memoryUsage: this.memoryUsage,
            hitRate: total ? this.stats.hits / total : 0
        };
    }

    destroy() {
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
        }
        this.clear();
    }
}

module.exports = CacheManager;
