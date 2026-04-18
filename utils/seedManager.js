const crypto = require('crypto');

class SeedManager {
    constructor(databaseManager, options = {}) {
        if (!databaseManager) {
            throw new Error('DatabaseManager instance is required');
        }

        this.databaseManager = databaseManager;
        this.seeds = new Map();

        this.tableName = options.tableName || '_seeds';
        this.lockTable = options.lockTable || '_seed_lock';

        this.logger = options.logger || console;
        this.retryAttempts = options.retryAttempts || 1;
    }

    register(seed) {
        if (!seed || typeof seed.run !== 'function' || !seed.id) {
            throw new Error('Seed must have "id" and "run(connection)"');
        }

        if (this.seeds.has(seed.id)) {
            throw new Error(`Seed "${seed.id}" already registered`);
        }

        this.seeds.set(seed.id, seed);
        return this;
    }

    getSortedSeeds() {
        return Array.from(this.seeds.values()).sort((a, b) =>
            a.id.localeCompare(b.id)
        );
    }

    async ensureTables(config = {}) {
        await this.databaseManager.query(async (conn) => {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS ${this.tableName} (
                    id VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS ${this.lockTable} (
                    id INT PRIMARY KEY,
                    locked BOOLEAN DEFAULT FALSE
                )
            `);

            await conn.query(`
                INSERT INTO ${this.lockTable} (id, locked)
                VALUES (1, FALSE)
                ON CONFLICT (id) DO NOTHING
            `);
        }, config);
    }

    async acquireLock(conn) {
        const res = await conn.query(`
            UPDATE ${this.lockTable}
            SET locked = TRUE
            WHERE id = 1 AND locked = FALSE
            RETURNING *
        `);

        if (res.rowCount === 0) {
            throw new Error('Another seed process is running');
        }
    }

    async releaseLock(conn) {
        await conn.query(`
            UPDATE ${this.lockTable}
            SET locked = FALSE
            WHERE id = 1
        `);
    }

    async appliedSeeds(config = {}) {
        await this.ensureTables(config);

        return this.databaseManager.query(async (conn) => {
            const res = await conn.query(
                `SELECT id FROM ${this.tableName}`
            );
            return res.rows.map(r => r.id);
        }, config);
    }

    async run(options = {}) {
        const {
            config = {},
            force = false,
            only = null,
            dryRun = false
        } = options;

        await this.ensureTables(config);

        const applied = await this.appliedSeeds(config);
        let seeds = this.getSortedSeeds();

        if (only && Array.isArray(only)) {
            seeds = seeds.filter(s => only.includes(s.id));
        }

        const pending = force
            ? seeds
            : seeds.filter(s => !applied.includes(s.id));

        const results = [];

        await this.databaseManager.query(async (conn) => {
            await this.acquireLock(conn);

            try {
                for (const seed of pending) {
                    const start = Date.now();

                    this.logger.info?.(`🌱 Running: ${seed.id}`);

                    if (dryRun) {
                        results.push({ id: seed.id, status: 'dry-run' });
                        continue;
                    }

                    let success = false;
                    let attempt = 0;

                    while (!success && attempt < this.retryAttempts) {
                        attempt++;

                        try {
                            await conn.query('BEGIN');

                            await seed.run(conn);

                            if (!force) {
                                await conn.query(
                                    `INSERT INTO ${this.tableName} (id)
                                     VALUES ($1)
                                     ON CONFLICT DO NOTHING`,
                                    [seed.id]
                                );
                            }

                            await conn.query('COMMIT');

                            success = true;

                            const duration = Date.now() - start;

                            results.push({
                                id: seed.id,
                                status: 'success',
                                duration
                            });

                            this.logger.info?.(
                                `✅ Done: ${seed.id} (${duration}ms)`
                            );

                        } catch (err) {
                            await conn.query('ROLLBACK');

                            this.logger.error?.(
                                `❌ Failed (${attempt}): ${seed.id}`,
                                err
                            );

                            if (attempt >= this.retryAttempts) {
                                throw err;
                            }
                        }
                    }
                }

            } finally {
                await this.releaseLock(conn);
            }
        }, config);

        return {
            total: results.length,
            results
        };
    }

    async reset({ config = {}, dropTable = false } = {}) {
        await this.databaseManager.query(async (conn) => {
            if (dropTable) {
                await conn.query(`DROP TABLE IF EXISTS ${this.tableName}`);
            } else {
                await this.ensureTables(config);
                await conn.query(`TRUNCATE TABLE ${this.tableName}`);
            }
        }, config);

        this.logger.warn?.('⚠️ Seeds reset');
    }

    async status(config = {}) {
        const applied = await this.appliedSeeds(config);
        const all = this.getSortedSeeds().map(s => s.id);

        return {
            total: all.length,
            applied,
            pending: all.filter(id => !applied.includes(id))
        };
    }
}

module.exports = SeedManager;
