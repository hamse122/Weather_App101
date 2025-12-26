// Advanced Migration Tool v2
const crypto = require("crypto");

class MigrationTool {
    constructor(databaseManager, options = {}) {
        this.databaseManager = databaseManager;
        this.migrations = [];
        this.tableName = options.tableName || "_migrations";
        this.lockTable = options.lockTable || "_migration_lock";
    }

    register(migration) {
        if (
            !migration ||
            typeof migration.up !== "function" ||
            typeof migration.down !== "function" ||
            !migration.id
        ) {
            throw new Error("Migration must have id, up, and down functions");
        }

        const checksum = crypto
            .createHash("sha256")
            .update(migration.up.toString() + migration.down.toString())
            .digest("hex");

        this.migrations.push({ ...migration, checksum });
        this.migrations.sort((a, b) => a.id.localeCompare(b.id));
        return this;
    }

    async ensureTables(connection) {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id VARCHAR(255) PRIMARY KEY,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMP NOT NULL
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ${this.lockTable} (
                locked BOOLEAN PRIMARY KEY DEFAULT TRUE
            )
        `);
    }

    async acquireLock(connection) {
        const res = await connection.query(
            `INSERT INTO ${this.lockTable} (locked)
             VALUES (TRUE)
             ON CONFLICT DO NOTHING`
        );

        if (res.rowCount === 0) {
            throw new Error("Another migration process is running");
        }
    }

    async releaseLock(connection) {
        await connection.query(`DELETE FROM ${this.lockTable}`);
    }

    async appliedMigrations(connection) {
        const result = await connection.query(
            `SELECT id, checksum FROM ${this.tableName} ORDER BY id ASC`
        );
        return result.rows;
    }

    async migrate(config = {}) {
        return this.databaseManager.query(async connection => {
            await connection.query("BEGIN");

            try {
                await this.ensureTables(connection);
                await this.acquireLock(connection);

                const applied = await this.appliedMigrations(connection);
                const appliedMap = new Map(
                    applied.map(m => [m.id, m.checksum])
                );

                const pending = this.migrations.filter(m => {
                    if (!appliedMap.has(m.id)) return true;
                    if (appliedMap.get(m.id) !== m.checksum) {
                        throw new Error(
                            `Migration checksum mismatch: ${m.id}`
                        );
                    }
                    return false;
                });

                for (const migration of pending) {
                    await migration.up(connection);
                    await connection.query(
                        `INSERT INTO ${this.tableName}
                         (id, checksum, applied_at)
                         VALUES ($1, $2, NOW())`,
                        [migration.id, migration.checksum]
                    );
                }

                await this.releaseLock(connection);
                await connection.query("COMMIT");

                return { applied: pending.map(m => m.id) };
            } catch (err) {
                await connection.query("ROLLBACK");
                throw err;
            }
        }, config);
    }

    async rollback(steps = 1, config = {}) {
        return this.databaseManager.query(async connection => {
            await connection.query("BEGIN");

            try {
                await this.ensureTables(connection);
                await this.acquireLock(connection);

                const applied = await this.appliedMigrations(connection);
                const toRollback = applied.slice(-steps).reverse();

                for (const { id } of toRollback) {
                    const migration = this.migrations.find(m => m.id === id);
                    if (!migration) continue;

                    await migration.down(connection);
                    await connection.query(
                        `DELETE FROM ${this.tableName} WHERE id = $1`,
                        [id]
                    );
                }

                await this.releaseLock(connection);
                await connection.query("COMMIT");

                return { rolledBack: toRollback.map(m => m.id) };
            } catch (err) {
                await connection.query("ROLLBACK");
                throw err;
            }
        }, config);
    }
}

module.exports = MigrationTool;
