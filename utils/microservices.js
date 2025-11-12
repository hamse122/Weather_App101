// Microservices communication utilities
class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.healthChecks = new Map();
    }

    register(serviceName, url, metadata = {}) {
        this.services.set(serviceName, {
            url,
            metadata,
            lastHealthCheck: Date.now(),
            healthy: true
        });

        return () => this.unregister(serviceName);
    }

    unregister(serviceName) {
        this.services.delete(serviceName);
        this.healthChecks.delete(serviceName);
    }

    getService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service || !service.healthy) {
            throw new Error(`Service ${serviceName} not available`);
        }
        return service;
    }

    setHealthCheck(serviceName, healthCheckFn) {
        this.healthChecks.set(serviceName, healthCheckFn);
    }

    async checkHealth(serviceName) {
        const healthCheck = this.healthChecks.get(serviceName);
        const service = this.services.get(serviceName);

        if (healthCheck && service) {
            try {
                await healthCheck(service.url);
                service.healthy = true;
                service.lastHealthCheck = Date.now();
                return true;
            } catch (error) {
                service.healthy = false;
                return false;
            }
        }

        return service ? service.healthy : false;
    }

    async checkAllHealth() {
        const results = {};

        for (const [serviceName] of this.services) {
            results[serviceName] = await this.checkHealth(serviceName);
        }

        return results;
    }

    listServices() {
        return Array.from(this.services.entries()).map(([name, service]) => ({
            name,
            ...service
        }));
    }
}

module.exports = ServiceRegistry;

