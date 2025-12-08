// upgraded-service-registry.js
const EventEmitter = require("events");

class ServiceRegistry extends EventEmitter {
    constructor(options = {}) {
        super();

        this.services = new Map();
        this.healthChecks = new Map();
        this.roundRobinIndex = new Map();

        // Options
        this.healthCheckInterval = options.healthCheckInterval || 5000; // 5 seconds
        this.maxRetries = options.maxRetries || 3;

        // Start auto-check cycle
        setInterval(() => this.checkAllHealth(), this.healthCheckInterval);
    }

    register(serviceName, url, metadata = {}) {
        this.services.set(serviceName, {
            url,
            metadata: {
                version: metadata.version || "1.0.0",
                tags: metadata.tags || [],
                ...metadata
            },
            retries: 0,
            lastHealthCheck: Date.now(),
            healthy: true
        });

        this.emit("register", serviceName);
        return () => this.unregister(serviceName);
    }

    unregister(serviceName) {
        this.services.delete(serviceName);
        this.healthChecks.delete(serviceName);
        this.emit("unregister", serviceName);
    }

    getService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service || !service.healthy) {
            throw new Error(`❌ Service "${serviceName}" is not available`);
        }
        return service;
    }

    /**
     * Load balance across services with same name using round-robin
     */
    getServiceBalanced(serviceName) {
        const candidates = [...this.services.entries()]
            .filter(([name, svc]) => name === serviceName && svc.healthy);

        if (candidates.length === 0) {
            throw new Error(`❌ No healthy instances for service "${serviceName}"`);
        }

        const index = this.roundRobinIndex.get(serviceName) || 0;
        const nextIndex = (index + 1) % candidates.length;
        this.roundRobinIndex.set(serviceName, nextIndex);

        return candidates[index][1];
    }

    setHealthCheck(serviceName, fn) {
        this.healthChecks.set(serviceName, fn);
    }

    async checkHealth(serviceName) {
        const healthCheck = this.healthChecks.get(serviceName);
        const svc = this.services.get(serviceName);

        if (!svc) return false;

        if (!healthCheck) {
            return svc.healthy; // No checker means trust current state
        }

        try {
            await healthCheck(svc.url);
            svc.healthy = true;
            svc.retries = 0;
            svc.lastHealthCheck = Date.now();
            this.emit("healthy", serviceName);

            return true;
        } catch (err) {
            svc.retries++;

            if (svc.retries >= this.maxRetries) {
                svc.healthy = false;
                this.emit("unhealthy", serviceName, err);
            }

            return false;
        }
    }

    async checkAllHealth() {
        const result = {};
        for (const [serviceName] of this.services) {
            result[serviceName] = await this.checkHealth(serviceName);
        }
        return result;
    }

    listServices(filter = {}) {
        const items = Array.from(this.services.entries()).map(([name, svc]) => ({
            name,
            url: svc.url,
            metadata: svc.metadata,
            healthy: svc.healthy,
            lastHealthCheck: svc.lastHealthCheck,
        }));

        // Optional filtering by tag, version, metadata, etc.
        if (filter.tag) {
            return items.filter(svc =>
                svc.metadata.tags?.includes(filter.tag)
            );
        }

        if (filter.version) {
            return items.filter(svc => svc.metadata.version === filter.version);
        }

        return items;
    }
}

module.exports = ServiceRegistry;
