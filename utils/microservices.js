// advanced-service-registry.js
const EventEmitter = require("events");
const crypto = require("crypto");

class ServiceRegistry extends EventEmitter {
    constructor(options = {}) {
        super();

        this.services = new Map();
        this.healthChecks = new Map();
        this.roundRobinIndex = new Map();
        this.metrics = new Map();

        // Config
        this.healthCheckInterval = options.healthCheckInterval || 5000;
        this.maxRetries = options.maxRetries || 3;
        this.requestTimeout = options.requestTimeout || 3000;

        // Auto health checker
        this.healthInterval = setInterval(
            () => this.checkAllHealth(),
            this.healthCheckInterval
        );
    }

    /**
     * Generate unique instance ID
     */
    generateId() {
        return crypto.randomUUID();
    }

    /**
     * Register service instance
     */
    register(serviceName, url, metadata = {}) {
        const instanceId = metadata.instanceId || this.generateId();

        if (!this.services.has(serviceName)) {
            this.services.set(serviceName, []);
        }

        const service = {
            instanceId,
            url,
            metadata: {
                version: metadata.version || "1.0.0",
                tags: metadata.tags || [],
                weight: metadata.weight || 1,
                region: metadata.region || "global",
                createdAt: new Date(),
                ...metadata
            },
            retries: 0,
            healthy: true,
            lastHealthCheck: Date.now()
        };

        this.services.get(serviceName).push(service);

        this.metrics.set(instanceId, {
            requests: 0,
            failures: 0,
            avgResponseTime: 0
        });

        this.emit("register", {
            serviceName,
            instanceId,
            url
        });

        return () => this.unregister(serviceName, instanceId);
    }

    /**
     * Remove service instance
     */
    unregister(serviceName, instanceId) {
        if (!this.services.has(serviceName)) return;

        const updated = this.services
            .get(serviceName)
            .filter(svc => svc.instanceId !== instanceId);

        this.services.set(serviceName, updated);

        this.metrics.delete(instanceId);

        this.emit("unregister", {
            serviceName,
            instanceId
        });
    }

    /**
     * Get healthy services
     */
    getHealthyServices(serviceName) {
        const services = this.services.get(serviceName) || [];

        return services.filter(svc => svc.healthy);
    }

    /**
     * Round Robin Load Balancer
     */
    getServiceBalanced(serviceName) {
        const healthy = this.getHealthyServices(serviceName);

        if (!healthy.length) {
            throw new Error(
                `❌ No healthy instances available for "${serviceName}"`
            );
        }

        const currentIndex =
            this.roundRobinIndex.get(serviceName) || 0;

        const service = healthy[currentIndex];

        const nextIndex =
            (currentIndex + 1) % healthy.length;

        this.roundRobinIndex.set(serviceName, nextIndex);

        this.trackRequest(service.instanceId);

        return service;
    }

    /**
     * Weighted load balancing
     */
    getWeightedService(serviceName) {
        const healthy = this.getHealthyServices(serviceName);

        if (!healthy.length) {
            throw new Error(
                `❌ No healthy instances available`
            );
        }

        const weightedPool = [];

        for (const svc of healthy) {
            for (let i = 0; i < svc.metadata.weight; i++) {
                weightedPool.push(svc);
            }
        }

        const selected =
            weightedPool[
                Math.floor(Math.random() * weightedPool.length)
            ];

        this.trackRequest(selected.instanceId);

        return selected;
    }

    /**
     * Least connections strategy
     */
    getLeastUsedService(serviceName) {
        const healthy = this.getHealthyServices(serviceName);

        if (!healthy.length) {
            throw new Error(
                `❌ No healthy instances available`
            );
        }

        let best = healthy[0];

        for (const svc of healthy) {
            const currentMetric = this.metrics.get(svc.instanceId);
            const bestMetric = this.metrics.get(best.instanceId);

            if (currentMetric.requests < bestMetric.requests) {
                best = svc;
            }
        }

        this.trackRequest(best.instanceId);

        return best;
    }

    /**
     * Track metrics
     */
    trackRequest(instanceId, responseTime = 0, failed = false) {
        const metric = this.metrics.get(instanceId);

        if (!metric) return;

        metric.requests++;

        if (failed) {
            metric.failures++;
        }

        if (responseTime > 0) {
            metric.avgResponseTime =
                (metric.avgResponseTime + responseTime) / 2;
        }
    }

    /**
     * Attach health checker
     */
    setHealthCheck(serviceName, fn) {
        this.healthChecks.set(serviceName, fn);
    }

    /**
     * Check one service instance
     */
    async checkHealth(serviceName, service) {
        const healthCheck = this.healthChecks.get(serviceName);

        if (!healthCheck) {
            return service.healthy;
        }

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("Health check timeout")),
                    this.requestTimeout
                )
            );

            await Promise.race([
                healthCheck(service.url),
                timeoutPromise
            ]);

            service.healthy = true;
            service.retries = 0;
            service.lastHealthCheck = Date.now();

            this.emit("healthy", {
                serviceName,
                instanceId: service.instanceId
            });

            return true;
        } catch (err) {
            service.retries++;

            if (service.retries >= this.maxRetries) {
                service.healthy = false;

                this.emit("unhealthy", {
                    serviceName,
                    instanceId: service.instanceId,
                    error: err.message
                });
            }

            return false;
        }
    }

    /**
     * Check all services
     */
    async checkAllHealth() {
        const results = {};

        for (const [serviceName, services] of this.services) {
            results[serviceName] = [];

            for (const service of services) {
                const status = await this.checkHealth(
                    serviceName,
                    service
                );

                results[serviceName].push({
                    instanceId: service.instanceId,
                    healthy: status
                });
            }
        }

        return results;
    }

    /**
     * Get service metrics
     */
    getMetrics(serviceName = null) {
        const output = [];

        for (const [name, services] of this.services) {
            if (serviceName && name !== serviceName) continue;

            for (const svc of services) {
                output.push({
                    serviceName: name,
                    instanceId: svc.instanceId,
                    url: svc.url,
                    healthy: svc.healthy,
                    retries: svc.retries,
                    metrics: this.metrics.get(svc.instanceId),
                    metadata: svc.metadata
                });
            }
        }

        return output;
    }

    /**
     * List services with filters
     */
    listServices(filter = {}) {
        let result = [];

        for (const [serviceName, services] of this.services) {
            for (const svc of services) {
                result.push({
                    serviceName,
                    instanceId: svc.instanceId,
                    url: svc.url,
                    healthy: svc.healthy,
                    metadata: svc.metadata,
                    lastHealthCheck: svc.lastHealthCheck
                });
            }
        }

        if (filter.tag) {
            result = result.filter(svc =>
                svc.metadata.tags.includes(filter.tag)
            );
        }

        if (filter.version) {
            result = result.filter(
                svc => svc.metadata.version === filter.version
            );
        }

        if (filter.region) {
            result = result.filter(
                svc => svc.metadata.region === filter.region
            );
        }

        return result;
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        clearInterval(this.healthInterval);

        this.emit("shutdown");

        console.log("🛑 Service Registry shutdown complete");
    }
}

module.exports = ServiceRegistry;
