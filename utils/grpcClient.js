// Advanced gRPC Client with Discovery, Load Balancing, Pooling,
// Circuit Breaker, Retries, Timeouts, Queueing & Metrics

class GrpcClient {
    constructor(options = {}) {
        this.grpc = options.grpc;

        if (!this.grpc) {
            throw new Error(
                'gRPC implementation required (e.g. @grpc/grpc-js)'
            );
        }

        this.credentials =
            options.credentials ||
            this.grpc.credentials.createInsecure();

        this.discovery = options.discovery || null;

        this.services = new Map();
        this.pools = new Map();
        this.loadBalancers = new Map();
        this.waitQueues = new Map();
        this.circuitBreakers = new Map();
        this.metrics = new Map();

        this.poolSize = options.poolSize || 10;
        this.preWarm = options.preWarm || false;

        this.retry = {
            max: options.retry?.max || 3,
            delay: options.retry?.delay || 100,
            factor: options.retry?.factor || 2
        };

        this.timeout = options.timeout || 5000;

        this.healthCheck = options.healthCheck || null;

        this.logger = options.logger || console;

        this.keepAliveOptions = {
            'grpc.keepalive_time_ms': 60000,
            'grpc.keepalive_timeout_ms': 10000,
            'grpc.keepalive_permit_without_calls': 1,
            ...(options.keepAliveOptions || {})
        };
    }

    // =====================================================
    // SERVICE REGISTRATION
    // =====================================================

    registerService(name, definition, endpoints = []) {
        if (!definition) {
            throw new Error(
                `Service '${name}' requires a valid definition`
            );
        }

        this.services.set(name, {
            definition,
            endpoints: new Set(endpoints)
        });

        if (!this.loadBalancers.has(name)) {
            this.loadBalancers.set(name, this.createRoundRobin());
        }

        if (this.preWarm) {
            endpoints.forEach(endpoint => {
                this.preWarmPool(name, endpoint, definition);
            });
        }

        return this;
    }

    async preWarmPool(serviceName, endpoint, definition) {
        const poolKey = this.getPoolKey(serviceName, endpoint);

        if (!this.pools.has(poolKey)) {
            this.pools.set(poolKey, []);
        }

        const pool = this.pools.get(poolKey);

        while (pool.length < this.poolSize) {
            pool.push({
                instance: this.createClient(definition, endpoint),
                busy: false,
                createdAt: Date.now(),
                lastUsed: Date.now()
            });
        }
    }

    // =====================================================
    // DISCOVERY
    // =====================================================

    async discoverServices() {
        if (!this.discovery?.list) return;

        const discovered = await this.discovery.list();

        for (const service of discovered) {
            if (this.services.has(service.name)) {
                this.services.get(service.name).endpoints =
                    new Set(service.endpoints);
            } else {
                this.registerService(
                    service.name,
                    service.definition,
                    service.endpoints
                );
            }
        }
    }

    // =====================================================
    // CLIENT CREATION
    // =====================================================

    createClient(definition, endpoint) {
        const ClientConstructor =
            this.grpc.makeGenericClientConstructor(
                definition,
                'DynamicClient'
            );

        return new ClientConstructor(
            endpoint,
            this.credentials,
            this.keepAliveOptions
        );
    }

    // =====================================================
    // GET CLIENT
    // =====================================================

    async getClient(serviceName) {
        if (!this.services.has(serviceName)) {
            await this.discoverServices();

            if (!this.services.has(serviceName)) {
                throw new Error(
                    `Service '${serviceName}' not found`
                );
            }
        }

        const service = this.services.get(serviceName);

        const endpoints = [...service.endpoints];

        if (!endpoints.length) {
            throw new Error(
                `No endpoints available for '${serviceName}'`
            );
        }

        let attempts = 0;

        while (attempts < endpoints.length) {
            const endpoint =
                this.selectEndpoint(serviceName, endpoints);

            attempts++;

            if (!endpoint) continue;

            const breakerKey =
                this.getPoolKey(serviceName, endpoint);

            if (this.isCircuitOpen(breakerKey)) {
                continue;
            }

            try {
                if (
                    this.healthCheck &&
                    !(await this.healthCheck(endpoint))
                ) {
                    this.recordFailure(breakerKey);
                    continue;
                }

                const client =
                    await this.getPooledClient(
                        serviceName,
                        endpoint,
                        service.definition
                    );

                return {
                    client,
                    endpoint
                };
            } catch (err) {
                this.recordFailure(breakerKey);
                this.logger.error(err);
            }
        }

        throw new Error(
            `Unable to acquire healthy client for '${serviceName}'`
        );
    }

    // =====================================================
    // LOAD BALANCER
    // =====================================================

    selectEndpoint(serviceName, endpoints) {
        const lb = this.loadBalancers.get(serviceName);

        return lb ? lb.next(endpoints) : endpoints[0];
    }

    createRoundRobin() {
        let index = 0;

        return {
            next(list) {
                if (!list.length) return null;

                const item = list[index % list.length];

                index++;

                return item;
            }
        };
    }

    // =====================================================
    // POOLING
    // =====================================================

    getPoolKey(serviceName, endpoint) {
        return `${serviceName}:${endpoint}`;
    }

    async getPooledClient(serviceName, endpoint, definition) {
        const poolKey =
            this.getPoolKey(serviceName, endpoint);

        if (!this.pools.has(poolKey)) {
            this.pools.set(poolKey, []);
        }

        if (!this.waitQueues.has(poolKey)) {
            this.waitQueues.set(poolKey, []);
        }

        const pool = this.pools.get(poolKey);

        // Find available client
        const available = pool.find(c => !c.busy);

        if (available) {
            available.busy = true;
            available.lastUsed = Date.now();

            return available.instance;
        }

        // Create new if below limit
        if (pool.length < this.poolSize) {
            const instance =
                this.createClient(definition, endpoint);

            pool.push({
                instance,
                busy: true,
                createdAt: Date.now(),
                lastUsed: Date.now()
            });

            return instance;
        }

        // Queue request
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        `Timed out waiting for pooled client`
                    )
                );
            }, this.timeout);

            this.waitQueues.get(poolKey).push({
                resolve,
                timeout
            });
        });
    }

    releaseClient(serviceName, endpoint, clientInstance) {
        const poolKey =
            this.getPoolKey(serviceName, endpoint);

        const pool = this.pools.get(poolKey);

        if (!pool) return;

        const item = pool.find(
            p => p.instance === clientInstance
        );

        if (!item) return;

        item.busy = false;
        item.lastUsed = Date.now();

        const queue = this.waitQueues.get(poolKey);

        if (queue?.length) {
            const waiter = queue.shift();

            clearTimeout(waiter.timeout);

            item.busy = true;

            waiter.resolve(item.instance);
        }
    }

    // =====================================================
    // CIRCUIT BREAKER
    // =====================================================

    recordFailure(key) {
        if (!this.circuitBreakers.has(key)) {
            this.circuitBreakers.set(key, {
                failures: 0,
                openedAt: null
            });
        }

        const breaker = this.circuitBreakers.get(key);

        breaker.failures++;

        if (breaker.failures >= 5) {
            breaker.openedAt = Date.now();

            this.logger.warn(
                `Circuit opened for ${key}`
            );
        }
    }

    resetCircuit(key) {
        this.circuitBreakers.set(key, {
            failures: 0,
            openedAt: null
        });
    }

    isCircuitOpen(key) {
        const breaker =
            this.circuitBreakers.get(key);

        if (!breaker) return false;

        if (!breaker.openedAt) return false;

        // Half-open after 30s
        if (Date.now() - breaker.openedAt > 30000) {
            breaker.failures = 0;
            breaker.openedAt = null;

            return false;
        }

        return true;
    }

    // =====================================================
    // REQUEST EXECUTION
    // =====================================================

    async call(
        serviceName,
        method,
        payload,
        metadata = {}
    ) {
        let attempt = 0;

        while (attempt < this.retry.max) {
            let endpoint = null;
            let client = null;

            try {
                const result =
                    await this.getClient(serviceName);

                client = result.client;
                endpoint = result.endpoint;

                const response =
                    await this.executeRequest(
                        client,
                        method,
                        payload,
                        metadata
                    );

                this.recordMetric(
                    serviceName,
                    true
                );

                this.releaseClient(
                    serviceName,
                    endpoint,
                    client
                );

                return response;
            } catch (err) {
                this.recordMetric(
                    serviceName,
                    false
                );

                attempt++;

                if (client && endpoint) {
                    this.releaseClient(
                        serviceName,
                        endpoint,
                        client
                    );
                }

                if (attempt >= this.retry.max) {
                    throw err;
                }

                const delay =
                    this.retry.delay *
                    Math.pow(
                        this.retry.factor,
                        attempt - 1
                    );

                await this.sleep(delay);
            }
        }
    }

    executeRequest(
        client,
        method,
        payload,
        metadata = {}
    ) {
        return new Promise((resolve, reject) => {
            const deadline =
                new Date(Date.now() + this.timeout);

            client[method](
                payload,
                metadata,
                { deadline },
                (err, response) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve(response);
                }
            );
        });
    }

    // =====================================================
    // METRICS
    // =====================================================

    recordMetric(serviceName, success) {
        if (!this.metrics.has(serviceName)) {
            this.metrics.set(serviceName, {
                requests: 0,
                failures: 0
            });
        }

        const metric =
            this.metrics.get(serviceName);

        metric.requests++;

        if (!success) {
            metric.failures++;
        }
    }

    getMetrics() {
        return Object.fromEntries(this.metrics);
    }

    // =====================================================
    // CLEANUP
    // =====================================================

    close(serviceName = null) {
        const entries = serviceName
            ? [...this.pools.entries()].filter(
                  ([key]) =>
                      key.startsWith(
                          `${serviceName}:`
                      )
              )
            : [...this.pools.entries()];

        for (const [, pool] of entries) {
            for (const client of pool) {
                try {
                    client.instance?.close?.();
                } catch (err) {
                    this.logger.error(err);
                }
            }
        }

        if (serviceName) {
            for (const key of this.pools.keys()) {
                if (
                    key.startsWith(
                        `${serviceName}:`
                    )
                ) {
                    this.pools.delete(key);
                }
            }
        } else {
            this.pools.clear();
            this.waitQueues.clear();
        }
    }

    // =====================================================
    // UTILITIES
    // =====================================================

    sleep(ms) {
        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );
    }
}

module.exports = GrpcClient;
