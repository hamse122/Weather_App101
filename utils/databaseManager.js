/**
 * DatabaseManager
 * - Driver-based connection abstraction
 * - Connection pooling
 * - Safe query builder with bindings
 */
class DatabaseManager {
    constructor(options = {}) {
        this.drivers = new Map();
        this.pools = new Map();
        this.defaultDriver = options.defaultDriver ?? null;

        this.poolConfig = {
            max: options.poolMax ?? 10,
            idleTimeout: options.idleTimeout ?? 30_000,
            acquireTimeout: options.acquireTimeout ?? 10_000
        };
    }

    /* ---------------------------------- */
    /* Driver Management                  */
    /* ---------------------------------- */

    registerDriver(name, driver) {
        if (!driver || typeof driver.createConnection !== 'function') {
            throw new Error('Driver must implement createConnection(config)');
        }
        this.drivers.set(name, driver);
        if (!this.defaultDriver) this.defaultDriver = name;
        return this;
    }

    
    /* ---------------------------------- */
    /* Pool Handling                      */
    /* ---------------------------------- */

    async connect(config = {}) {
        const driverName = config.driver ?? this.defaultDriver;
        if (!driverName) throw new Error('No database driver registered');

        const driver = this.drivers.get(driverName);
        if (!driver) throw new Error(`Driver "${driverName}" not registered`);

        const key = this.getPoolKey(driverName, config);

        if (!this.pools.has(key)) {
            this.pools.set(key, this.createPool(driver, config));
        }

        return this.pools.get(key).acquire();
    }

    getPoolKey(driver, config) {
        const { host = 'localhost', port = '', database = '', user = '' } = config;
        return `${driver}:${host}:${port}:${database}:${user}`;
    }

    createPool(driver, config) {
        const connections = [];
        const queue = [];
        let closed = false;

        const createConnection = async () => {
            const instance = await driver.createConnection(config);
            if (!instance) throw new Error('Failed to create DB connection');

            connections.push({
                instance,
                busy: false,
                lastUsed: Date.now()
            });

            return instance;
        };

        const acquire = () =>
            new Promise(async (resolve, reject) => {
                if (closed) return reject(new Error('Pool is closed'));

                const free = connections.find(c => !c.busy);
                if (free) {
                    free.busy = true;
                    return resolve(free.instance);
                }

                if (connections.length < this.poolConfig.max) {
                    try {
                        const instance = await createConnection();
                        const conn = connections.find(c => c.instance === instance);
                        conn.busy = true;
                        return resolve(instance);
                    } catch (err) {
                        return reject(err);
                    }
                }

                const timer = setTimeout(() => {
                    queue.splice(queue.indexOf(entry), 1);
                    reject(new Error('Acquire timeout'));
                }, this.poolConfig.acquireTimeout);

                const entry = {
                    resolve: instance => {
                        clearTimeout(timer);
                        resolve(instance);
                    }
                };

                queue.push(entry);
            });

        const release = instance => {
            const conn = connections.find(c => c.instance === instance);
            if (!conn) return;

            conn.busy = false;
            conn.lastUsed = Date.now();

            const next = queue.shift();
            if (next) {
                conn.busy = true;
                next.resolve(instance);
            }
        };

        const destroy = async instance => {
            if (!instance) return;
            if (typeof instance.close === 'function') await instance.close();
            else if (typeof instance.end === 'function') await instance.end();
        };

        const cleanup = async () => {
            const now = Date.now();
            for (let i = connections.length - 1; i >= 0; i--) {
                const c = connections[i];
                if (!c.busy && now - c.lastUsed > this.poolConfig.idleTimeout) {
                    connections.splice(i, 1);
                    await destroy(c.instance);
                }
            }
        };

        const interval = setInterval(cleanup, this.poolConfig.idleTimeout);
        interval.unref?.();

        return {
            acquire,
            release,
            close: async () => {
                closed = true;
                clearInterval(interval);
                for (const c of connections) await destroy(c.instance);
                connections.length = 0;
            }
        };
    }

/* ---------------------------------- */
/* Query Execution (v2)               */
/* ---------------------------------- */

async query(fn, config = {}) {
    if (typeof fn !== "function") {
        throw new TypeError("Query callback must be a function");
    }

    const {
        driver = this.defaultDriver,
        timeout = 30000,
        retries = 0,
        retryDelay = 500,
        signal,
        ...connectionConfig
    } = config;

    const key = this.getPoolKey(driver, connectionConfig);
    const pool = this.pools.get(key);

    if (!pool) {
        throw new Error(`Connection pool '${key}' not found`);
    }

    if (signal?.aborted) {
        throw signal.reason ?? new Error("Query aborted");
    }

    let conn;
    let released = false;

    const release = async () => {
        if (released || !conn) return;

        released = true;
        await pool.release(conn);
    };

    try {
        conn = await this.connect({
            ...connectionConfig,
            driver
        });

        if (!conn) {
            throw new Error("Failed to acquire database connection");
        }

        if (signal?.aborted) {
            throw signal.reason ?? new Error("Query aborted");
        }

        const builder = this.createQueryBuilder({
            ...connectionConfig,
            driver
        });

        let attempt = 0;

        while (true) {
            try {
                const execution = Promise.resolve(
                    fn(conn, builder)
                );

                if (!timeout && !signal) {
                    return await execution;
                }

                const controls = [];

                if (timeout > 0) {
                    controls.push(
                        new Promise((_, reject) => {
                            const timer = setTimeout(
                                () => reject(
                                    new Error(`Query timed out after ${timeout}ms`)
                                ),
                                timeout
                            );

                            execution.finally(() => clearTimeout(timer)).catch(() => {});
                        })
                    );
                }

                if (signal) {
                    controls.push(
                        new Promise((_, reject) => {
                            const abort = () => reject(
                                signal.reason ?? new Error("Query aborted")
                            );

                            signal.addEventListener("abort", abort, {
                                once: true
                            });

                            execution.finally(() =>
                                signal.removeEventListener("abort", abort)
                            ).catch(() => {});
                        })
                    );
                }

                return await Promise.race([
                    execution,
                    ...controls
                ]);

            } catch (error) {
                if (
                    signal?.aborted ||
                    attempt >= retries ||
                    error.retryable === false
                ) {
                    throw error;
                }

                attempt++;

                await new Promise(resolve =>
                    setTimeout(resolve, retryDelay * attempt)
                );
            }
        }

    } catch (error) {
        error.queryPool = key;
        error.queryDriver = driver;
        error.queryAttempts = retries + 1;

        throw error;

    } finally {
        await release();
    }
}
    /* ---------------------------------- */
    /* Query Builder (Safe)               */
    /* ---------------------------------- */

    createQueryBuilder() {
        const clauses = [];
        const bindings = [];

        return {
            select(fields = '*') {
                clauses.push(`SELECT ${Array.isArray(fields) ? fields.join(', ') : fields}`);
                return this;
            },
            from(table) {
                clauses.push(`FROM ${table}`);
                return this;
            },
            where(condition, params = []) {
                clauses.push(`WHERE ${condition}`);
                bindings.push(...params);
                return this;
            },
            orderBy(field, dir = 'ASC') {
                clauses.push(`ORDER BY ${field} ${dir.toUpperCase()}`);
                return this;
            },
            limit(n) {
                clauses.push(`LIMIT ?`);
                bindings.push(n);
                return this;
            },
            offset(n) {
                clauses.push(`OFFSET ?`);
                bindings.push(n);
                return this;
            },
            build() {
                return {
                    sql: clauses.join(' '),
                    params: bindings
                };
            }
        };
    }
    

    /* ---------------------------------- */
    /* Shutdown                           */
    /* ---------------------------------- */

    async close(driverName = null) {
        for (const [key, pool] of this.pools) {
            if (!driverName || key.startsWith(`${driverName}:`)) {
                await pool.close();
                this.pools.delete(key);
            }
        }
    }
}

module.exports = DatabaseManager;
