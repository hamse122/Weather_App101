// Upgraded gRPC Client with Discovery, Load Balancing & Pooling
class GrpcClient {
    constructor(options = {}) {
        this.grpc = options.grpc;
        if (!this.grpc) {
            throw new Error('gRPC implementation must be provided (e.g., require("@grpc/grpc-js"))');
        }

        this.credentials = options.credentials || this.grpc.credentials.createInsecure();
        this.discovery = options.discovery || null;

        this.services = new Map();
        this.pools = new Map();
        this.loadBalancers = new Map();

        this.poolSize = options.poolSize || 5;
        this.preWarm = options.preWarm || false;

        this.retry = options.retry || { max: 3, delay: 100 }; // Retry logic
        this.timeout = options.timeout || 5000; // Request timeout in ms

        this.healthCheck = options.healthCheck || null;
    }

    // ---------------------------------------------
    // SERVICE REGISTRATION
    // ---------------------------------------------

    registerService(name, definition, endpoints = []) {
        if (!definition) {
            throw new Error(`Service '${name}' must include a valid gRPC definition.`);
        }

        this.services.set(name, {
            definition,
            endpoints: new Set(endpoints)
        });

        if (!this.loadBalancers.has(name)) {
            this.loadBalancers.set(name, this.createRoundRobin());
        }

        // Pre-warm pool
        if (this.preWarm && endpoints.length > 0) {
            endpoints.forEach(ep => this.preWarmPool(name, ep, definition));
        }

        return this;
    }

    async preWarmPool(name, endpoint, definition) {
        const poolKey = `${name}:${endpoint}`;
        if (!this.pools.has(poolKey)) this.pools.set(poolKey, []);

        const pool = this.pools.get(poolKey);

        while (pool.length < this.poolSize) {
            pool.push({
                instance: this.createClient(definition, endpoint),
                busy: false
            });
        }
    }

    // ---------------------------------------------
    // SERVICE DISCOVERY
    // ---------------------------------------------

    async discoverServices() {
        if (!this.discovery?.list) return;

        const discovered = await this.discovery.list();

        for (const service of discovered) {
            if (this.services.has(service.name)) {
                this.services.get(service.name).endpoints = new Set(service.endpoints);
            } else {
                this.registerService(service.name, service.definition, service.endpoints);
            }
        }
    }

    // ---------------------------------------------
    // CLIENT CREATION
    // ---------------------------------------------

    createClient(definition, endpoint) {
        const ClientConstructor = this.grpc.makeGenericClientConstructor(
            definition,
            'DynamicClient'
        );

        const instance = new ClientConstructor(
            endpoint,
            this.credentials,
            { 'grpc.keepalive_time_ms': 60000 }
        );

        return instance;
    }

    async getClient(serviceName) {
        if (!this.services.has(serviceName)) {
            await this.discoverServices();
            if (!this.services.has(serviceName)) {
                throw new Error(`Service '${serviceName}' is not registered or discoverable.`);
            }
        }

        const service = this.services.get(serviceName);
        const endpoints = Array.from(service.endpoints);

        if (endpoints.length === 0) {
            throw new Error(`No endpoints available for '${serviceName}'.`);
        }

        const endpoint = this.selectEndpoint(serviceName, endpoints);

        if (this.healthCheck && !(await this.healthCheck(endpoint))) {
            console.warn(`Health check failed for ${endpoint}`);
            return this.getClient(serviceName); // retry using different endpoint
        }

        return this.getPooledClient(serviceName, endpoint, service.definition);
    }

    // ---------------------------------------------
    // LOAD BALANCING
    // ---------------------------------------------

    selectEndpoint(serviceName, endpoints) {
        const balancer = this.loadBalancers.get(serviceName);
        return balancer ? balancer.next(endpoints) : endpoints[0];
    }

    createRoundRobin() {
        let index = 0;
        return {
            next(list) {
                if (!list.length) return null;
                const endpoint = list[index % list.length];
                index++;
                return endpoint;
            }
        };
    }

    // ---------------------------------------------
    // CONNECTION POOLING
    // ---------------------------------------------

    getPooledClient(serviceName, endpoint, definition) {
        const poolKey = `${serviceName}:${endpoint}`;

        if (!this.pools.has(poolKey)) {
            this.pools.set(poolKey, []);
        }

        const pool = this.pools.get(poolKey);

        const available = pool.find(c => !c.busy);
        if (available) {
            available.busy = true;
            return available.instance;
        }

        if (pool.length < this.poolSize) {
            const instance = this.createClient(definition, endpoint);
            pool.push({ instance, busy: true });
            return instance;
        }

        return new Promise(resolve => {
            const check = () => {
                const available = this.pools.get(poolKey).find(c => !c.busy);
                if (available) {
                    available.busy = true;
                    return resolve(available.instance);
                }
                setTimeout(check, 50);
            };
            check();
        });
    }

    releaseClient(serviceName, endpoint, clientInstance) {
        const poolKey = `${serviceName}:${endpoint}`;
        const pool = this.pools.get(poolKey);
        if (!pool) return;

        const client = pool.find(p => p.instance === clientInstance);
        if (client) client.busy = false;
    }

    // ---------------------------------------------
    // CLOSE CLIENTS
    // ---------------------------------------------

    close(serviceName = null) {
        const entries = serviceName
            ? [...this.pools.entries()].filter(([key]) => key.startsWith(`${serviceName}:`))
            : [...this.pools.entries()];

        entries.forEach(([, pool]) => {
            pool.forEach(client => {
                if (client.instance?.close) {
                    client.instance.close();
                }
            });
        });

        if (serviceName) {
            for (const key of [...this.pools.keys()]) {
                if (key.startsWith(`${serviceName}:`)) {
                    this.pools.delete(key);
                }
            }
        } else {
            this.pools.clear();
        }
    }
}

module.exports = GrpcClient;
