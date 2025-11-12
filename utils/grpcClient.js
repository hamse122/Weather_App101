// gRPC client implementation supporting service discovery, load balancing, and connection pooling
class GrpcClient {
    constructor(options = {}) {
        this.grpc = options.grpc;
        if (!this.grpc) {
            throw new Error('gRPC implementation must be provided (e.g. require("@grpc/grpc-js"))');
        }

        this.credentials = options.credentials || this.grpc.credentials.createInsecure();
        this.services = new Map();
        this.discovery = options.discovery || null;
        this.loadBalancers = new Map();
        this.pools = new Map();
        this.poolSize = options.poolSize || 5;
    }

    registerService(name, definition, endpoints = []) {
        this.services.set(name, { definition, endpoints: new Set(endpoints) });
        if (!this.loadBalancers.has(name)) {
            this.loadBalancers.set(name, this.createRoundRobin());
        }
        return this;
    }

    async discoverServices() {
        if (!this.discovery || typeof this.discovery.list !== 'function') {
            return;
        }

        const discovered = await this.discovery.list();
        discovered.forEach(service => {
            if (this.services.has(service.name)) {
                this.services.get(service.name).endpoints = new Set(service.endpoints);
            } else {
                this.registerService(service.name, service.definition, service.endpoints);
            }
        });
    }

    async getClient(serviceName) {
        if (!this.services.has(serviceName)) {
            if (this.discovery) {
                await this.discoverServices();
            }
            if (!this.services.has(serviceName)) {
                throw new Error(`Service ${serviceName} not registered`);
            }
        }

        const service = this.services.get(serviceName);
        const endpoints = Array.from(service.endpoints);
        if (endpoints.length === 0) {
            throw new Error(`No endpoints available for ${serviceName}`);
        }

        const endpoint = this.selectEndpoint(serviceName, endpoints);
        return this.getPooledClient(serviceName, endpoint, service.definition);
    }

    selectEndpoint(serviceName, endpoints) {
        const balancer = this.loadBalancers.get(serviceName);
        if (!balancer) {
            return endpoints[0];
        }
        return balancer.next(endpoints);
    }

    getPooledClient(serviceName, endpoint, definition) {
        const poolKey = `${serviceName}:${endpoint}`;
        if (!this.pools.has(poolKey)) {
            this.pools.set(poolKey, []);
        }

        const pool = this.pools.get(poolKey);
        const available = pool.find(client => !client.busy);
        if (available) {
            available.busy = true;
            return available.instance;
        }

        if (pool.length < this.poolSize) {
            const ClientConstructor = this.grpc.makeGenericClientConstructor(definition, serviceName);
            const instance = new ClientConstructor(endpoint, this.credentials, {});
            pool.push({ instance, busy: true });
            return instance;
        }

        return new Promise(resolve => {
            const checkAvailability = () => {
                const available = this.pools.get(poolKey).find(client => !client.busy);
                if (available) {
                    available.busy = true;
                    resolve(available.instance);
                } else {
                    setTimeout(checkAvailability, 50);
                }
            };
            checkAvailability();
        });
    }

    releaseClient(serviceName, endpoint, clientInstance) {
        const poolKey = `${serviceName}:${endpoint}`;
        const pool = this.pools.get(poolKey);
        if (!pool) {
            return;
        }
        const client = pool.find(item => item.instance === clientInstance);
        if (client) {
            client.busy = false;
        }
    }

    close(serviceName = null) {
        const entries = serviceName
            ? Array.from(this.pools.entries()).filter(([key]) => key.startsWith(`${serviceName}:`))
            : Array.from(this.pools.entries());

        entries.forEach(([, pool]) => {
            pool.forEach(client => {
                if (client.instance && typeof client.instance.close === 'function') {
                    client.instance.close();
                }
            });
        });

        if (serviceName) {
            Array.from(this.pools.keys()).forEach(key => {
                if (key.startsWith(`${serviceName}:`)) {
                    this.pools.delete(key);
                }
            });
        } else {
            this.pools.clear();
        }
    }

    createRoundRobin() {
        let index = 0;
        return {
            next(endpoints) {
                if (endpoints.length === 0) {
                    return null;
                }
                const endpoint = endpoints[index % endpoints.length];
                index = (index + 1) % endpoints.length;
                return endpoint;
            }
        };
    }
}

module.exports = GrpcClient;

