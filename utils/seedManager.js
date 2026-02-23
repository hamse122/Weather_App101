class SeedManager {
    constructor(databaseManager, options = {}) {
        if (!databaseManager) {
            throw new Error('DatabaseManager instance is required');
        }

        this.databaseManager = databaseManager;
        this.seeds = new Map();
        this.tableName = options.tableName || '_seeds';
        this.logger = options.logger || console;
    }

    register(seed) {
        if (!seed || typeof seed.run !== 'function' || !seed.id) {
            throw new Error('Seed must have "id" and "run(connection)" function');
        }

        if (this.seeds.has(seed.id)) {
            throw new Error(`Seed with id "${seed.id}" already registered`);
        }

        this.seeds.set(seed.id, seed);
        return this;
    }

    getSortedSeeds() {
        return Array.from(this.seeds.values()).sort((a, b) =>
            a.id.localeCompare(b.id)
        );
    }

    async ensureTable(config = {}) {
        await this.databaseManager.query(async connection => {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS ${this.tableName} (
                    id VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            `);
        }, config);
    }

    async appliedSeeds(config = {}) {
        await this.ensureTable(config);

        return this.databaseManager.query(async connection => {
            const result = await connection.query(
                `SELECT id FROM ${this.tableName} ORDER BY id ASC`
            );
            return result.rows.map(row => row.id);
        }, config);
    }

    async run(options = {}) {
        const {
            config = {},
            force = false,
            only = null // array of seed IDs to run
        } = options;

        await this.ensureTable(config);

        const applied = await this.appliedSeeds(config);
        let seeds = this.getSortedSeeds();

        if (only && Array.isArray(only)) {
            seeds = seeds.filter(seed => only.includes(seed.id));
        }

        const pending = force
            ? seeds
            : seeds.filter(seed => !applied.includes(seed.id));

        const results = [];

        for (const seed of pending) {
            this.logger.info?.(`🌱 Running seed: ${seed.id}`);

            await this.databaseManager.query(async connection => {
                try {
                    await connection.query('BEGIN');

                    await seed.run(connection);

                    if (!force) {
                        await connection.query(
                            `INSERT INTO ${this.tableName} (id) VALUES ($1)
                             ON CONFLICT (id) DO NOTHING`,
                            [seed.id]
                        );
                    }

                    await connection.query('COMMIT');
                    results.push({ id: seed.id, status: 'success' });
                } catch (error) {
                    await connection.query('ROLLBACK');
                    this.logger.error?.(`❌ Seed failed: ${seed.id}`, error);
                    throw error;
                }
            }, config);
        }

        return {
            total: results.length,
            applied: results.map(r => r.id)
        };
    }

    async reset(options = {}) {
        const { config = {}, dropTable = false } = options;

        await this.databaseManager.query(async connection => {
            if (dropTable) {
                await connection.query(`DROP TABLE IF EXISTS ${this.tableName}`);
            } else {
                await this.ensureTable(config);
                await connection.query(`TRUNCATE TABLE ${this.tableName}`);
            }
        }, config);

        this.logger.warn?.('⚠️ Seed history reset');
    }

    async status(config = {}) {
        const applied = await this.appliedSeeds(config);
        const all = this.getSortedSeeds().map(seed => seed.id);

        return {
            total: all.length,
            applied,
            pending: all.filter(id => !applied.includes(id))
        };
    }
}

module.exports = SeedManager;
