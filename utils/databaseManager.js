// Database connection management, connection pooling, and query building utilities
class DatabaseManager {
    constructor(options = {}) {
        this.drivers = new Map();
        this.pools = new Map();
        this.defaultDriver = options.defaultDriver || null;
        this.poolConfig = {
            max: options.poolMax || 10,
            idleTimeout: options.idleTimeout || 30000,
            acquireTimeout: options.acquireTimeout || 10000
        };
    }

    registerDriver(name, driver) {
        if (!driver || typeof driver.createConnection !== 'function') {
            throw new Error('Driver must implement createConnection(config)');
        }
        this.drivers.set(name, driver);
        if (!this.defaultDriver) {
            this.defaultDriver = name;
        }
        return this;
    }

    async connect(config = {}) {
        const driverName = config.driver || this.defaultDriver;
        if (!driverName) {
            throw new Error('No database driver registered');
        }

        if (!this.drivers.has(driverName)) {
            throw new Error(`Driver ${driverName} not registered`);
        }

        const poolKey = this.getPoolKey(driverName, config);
        if (!this.pools.has(poolKey)) {
            this.pools.set(poolKey, this.createPool(driverName, config));
        }
        const pool = this.pools.get(poolKey);
        return pool.acquire();
    }

    getPoolKey(driverName, config) {
        const { host, port, database, user } = config;
        return `${driverName}:${host || 'localhost'}:${port || ''}:${database || ''}:${user || ''}`;
    }

    createPool(driverName, config) {
        const driver = this.drivers.get(driverName);
        const connections = [];
        const pending = [];

        const acquire = () => new Promise((resolve, reject) => {
            const available = connections.find(conn => !conn.busy);
            if (available) {
                available.busy = true;
                resolve(available.instance);
                return;
            }

            if (connections.length < this.poolConfig.max) {
                this.createConnection(driver, config)
                    .then(instance => {
                        connections.push({ instance, busy: true, lastUsed: Date.now() });
                        resolve(instance);
                    })
                    .catch(reject);
                return;
            }

            const timeoutId = setTimeout(() => {
                const index = pending.indexOf(promiseEntry);
                if (index > -1) {
                    pending.splice(index, 1);
                }
                reject(new Error('Timed out acquiring database connection'));
            }, this.poolConfig.acquireTimeout);

            const release = instance => {
                clearTimeout(timeoutId);
                resolve(instance);
            };

            const promiseEntry = { resolve: release, reject };
            pending.push(promiseEntry);
        });

        const release = instance => {
            const connection = connections.find(conn => conn.instance === instance);
            if (connection) {
                connection.busy = false;
                connection.lastUsed = Date.now();
            }

            const queued = pending.shift();
            if (queued) {
                connection.busy = true;
                queued.resolve(instance);
            }
        };

        const destroy = async instance => {
            if (instance && typeof instance.close === 'function') {
                await instance.close();
            } else if (instance && typeof instance.end === 'function') {
                await instance.end();
            }
        };

        const cleanupIdleConnections = () => {
            const now = Date.now();
            connections.forEach(async (conn, index) => {
                if (!conn.busy && now - conn.lastUsed > this.poolConfig.idleTimeout) {
                    connections.splice(index, 1);
                    await destroy(conn.instance);
                }
            });
        };

        const createConnection = () => this.createConnection(driver, config)
            .then(instance => {
                connections.push({ instance, busy: false, lastUsed: Date.now() });
                return instance;
            });

        setInterval(cleanupIdleConnections, this.poolConfig.idleTimeout).unref?.();

        return { acquire, release, destroy, createConnection, connections };
    }

    async createConnection(driver, config) {
        const instance = await driver.createConnection(config);
        if (!instance) {
            throw new Error('Driver failed to create connection');
        }
        return instance;
    }

    async query(callback, config = {}) {
        const connection = await this.connect(config);
        const poolKey = this.getPoolKey(config.driver || this.defaultDriver, config);
        const pool = this.pools.get(poolKey);
        try {
            return await callback(connection, this.createQueryBuilder());
        } finally {
            pool.release(connection);
        }
    }

    createQueryBuilder() {
        const clauses = [];
        return {
            select(fields = '*') {
                clauses.push(`SELECT ${Array.isArray(fields) ? fields.join(', ') : fields}`);
                return this;
            },
            from(table) {
                clauses.push(`FROM ${table}`);
                return this;
            },
            where(condition) {
                clauses.push(`WHERE ${condition}`);
                return this;
            },
            groupBy(fields) {
                clauses.push(`GROUP BY ${Array.isArray(fields) ? fields.join(', ') : fields}`);
                return this;
            },
            orderBy(field, direction = 'ASC') {
                clauses.push(`ORDER BY ${field} ${direction.toUpperCase()}`);
                return this;
            },
            limit(count) {
                clauses.push(`LIMIT ${count}`);
                return this;
            },
            offset(count) {
                clauses.push(`OFFSET ${count}`);
                return this;
            },
            build() {
                return clauses.join(' ');
            }
        };
    }

    async close(driverName = null) {
        const entries = driverName
            ? Array.from(this.pools.entries()).filter(([key]) => key.startsWith(`${driverName}:`))
            : Array.from(this.pools.entries());

        for (const [key, pool] of entries) {
            const { connections, destroy } = pool;
            for (const conn of connections) {
                await destroy(conn.instance);
            }
            this.pools.delete(key);
        }
    }
}

module.exports = DatabaseManager;

