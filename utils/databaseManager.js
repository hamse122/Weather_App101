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
    /* Query Execution                    */
    /* ---------------------------------- */

    async query(fn, config = {}) {
        const conn = await this.connect(config);
        const key = this.getPoolKey(config.driver ?? this.defaultDriver, config);
        const pool = this.pools.get(key);

        try {
            return await fn(conn, this.createQueryBuilder());
        } finally {
            pool.release(conn);
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
