// Seed manager for populating databases with initial or test data
class SeedManager {
    constructor(databaseManager, options = {}) {
        this.databaseManager = databaseManager;
        this.seeds = [];
        this.tableName = options.tableName || '_seeds';
    }

    register(seed) {
        if (!seed || typeof seed.run !== 'function' || !seed.id) {
            throw new Error('Seed must have id and run function');
        }
        this.seeds.push(seed);
        this.seeds.sort((a, b) => a.id.localeCompare(b.id));
        return this;
    }

    async ensureTable(config = {}) {
        await this.databaseManager.query(async connection => {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS ${this.tableName} (
                    id VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP NOT NULL
                )
            `);
        }, config);
    }

    async appliedSeeds(config = {}) {
        await this.ensureTable(config);
        return this.databaseManager.query(async connection => {
            const result = await connection.query(`SELECT id FROM ${this.tableName} ORDER BY id ASC`);
            return result.rows.map(row => row.id);
        }, config);
    }

    async run(config = {}) {
        const applied = await this.appliedSeeds(config);
        const pending = this.seeds.filter(seed => !applied.includes(seed.id));

        for (const seed of pending) {
            await this.databaseManager.query(async connection => {
                await seed.run(connection);
                await connection.query(
                    `INSERT INTO ${this.tableName} (id, applied_at) VALUES ($1, NOW())`,
                    [seed.id]
                );
            }, config);
        }

        return { applied: pending.map(seed => seed.id) };
    }

    async reset(config = {}) {
        await this.databaseManager.query(async connection => {
            await connection.query(`TRUNCATE TABLE ${this.tableName}`);
        }, config);
    }
}

module.exports = SeedManager;

