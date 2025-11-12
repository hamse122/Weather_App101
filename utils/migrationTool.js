// Migration tool for managing database schema changes
class MigrationTool {
    constructor(databaseManager, options = {}) {
        this.databaseManager = databaseManager;
        this.migrations = [];
        this.tableName = options.tableName || '_migrations';
    }

    register(migration) {
        if (!migration || typeof migration.up !== 'function' || typeof migration.down !== 'function' || !migration.id) {
            throw new Error('Migration must have id, up, and down functions');
        }
        this.migrations.push(migration);
        this.migrations.sort((a, b) => a.id.localeCompare(b.id));
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

    async appliedMigrations(config = {}) {
        await this.ensureTable(config);
        return this.databaseManager.query(async connection => {
            const result = await connection.query(`SELECT id FROM ${this.tableName} ORDER BY id ASC`);
            return result.rows.map(row => row.id);
        }, config);
    }

    async migrate(config = {}) {
        const applied = await this.appliedMigrations(config);
        const pending = this.migrations.filter(migration => !applied.includes(migration.id));

        for (const migration of pending) {
            await this.databaseManager.query(async connection => {
                await migration.up(connection);
                await connection.query(
                    `INSERT INTO ${this.tableName} (id, applied_at) VALUES ($1, NOW())`,
                    [migration.id]
                );
            }, config);
        }

        return { applied: pending.map(m => m.id) };
    }

    async rollback(steps = 1, config = {}) {
        const applied = await this.appliedMigrations(config);
        const toRollback = applied.slice(-steps).reverse();

        for (const id of toRollback) {
            const migration = this.migrations.find(m => m.id === id);
            if (!migration) {
                continue;
            }
            await this.databaseManager.query(async connection => {
                await migration.down(connection);
                await connection.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
            }, config);
        }

        return { rolledBack: toRollback };
    }
}

module.exports = MigrationTool;

