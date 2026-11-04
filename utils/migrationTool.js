const crypto = require("node:crypto");

class MigrationTool {
    constructor(databaseManager, options = {}) {
        if (!databaseManager?.query) {
            throw new TypeError("A valid database manager is required");
        }

        this.databaseManager = databaseManager;

        this.migrations = new Map();

        this.tableName = options.tableName || "_migrations";
        this.lockTable = options.lockTable || "_migration_lock";

        this.lockId = options.lockId ?? 987654321;
        this.logger = options.logger || console;

        this.validateChecksums = options.validateChecksums !== false;
        this.transactional = options.transactional !== false;
    }

    /* =========================================
       VALIDATION
    ========================================= */

    validateIdentifier(identifier) {
        if (
            typeof identifier !== "string" ||
            !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)
        ) {
            throw new Error(`Invalid SQL identifier: ${identifier}`);
        }

        return `"${identifier}"`;
    }

    validateMigration(migration) {
        if (
            !migration ||
            typeof migration.id !== "string" ||
            !migration.id.trim() ||
            typeof migration.up !== "function" ||
            typeof migration.down !== "function"
        ) {
            throw new TypeError(
                "Migration must have a valid id, up, and down functions"
            );
        }

        if (migration.id.length > 255) {
            throw new Error("Migration ID exceeds 255 characters");
        }
    }

    generateChecksum(migration) {
        return crypto
            .createHash("sha256")
            .update(
                migration.up.toString() +
                "\n" +
                migration.down.toString()
            )
            .digest("hex");
    }

    /* =========================================
       REGISTRATION
    ========================================= */

    register(migration) {
        this.validateMigration(migration);

        if (this.migrations.has(migration.id)) {
            throw new Error(
                `Migration already registered: ${migration.id}`
            );
        }

        const registered = Object.freeze({
            ...migration,
            checksum: this.generateChecksum(migration),
            registeredAt: new Date()
        });

        this.migrations.set(migration.id, registered);

        return this;
    }

    registerMany(migrations = []) {
        if (!Array.isArray(migrations)) {
            throw new TypeError("Migrations must be an array");
        }

        for (const migration of migrations) {
            this.register(migration);
        }

        return this;
    }

    getMigrations() {
        return [...this.migrations.values()].sort(
            (a, b) => a.id.localeCompare(b.id)
        );
    }

    /* =========================================
       DATABASE TABLES
    ========================================= */

    async ensureTables(connection) {
        const migrationsTable =
            this.validateIdentifier(this.tableName);

        const lockTable =
            this.validateIdentifier(this.lockTable);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ${migrationsTable} (
                id VARCHAR(255) PRIMARY KEY,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                execution_ms BIGINT DEFAULT 0
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ${lockTable} (
                id BIGINT PRIMARY KEY,
                locked BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    }

    /* =========================================
       MIGRATION LOCK
    ========================================= */

    async acquireLock(connection) {
        const result = await connection.query(
            "SELECT pg_try_advisory_xact_lock($1) AS locked",
            [this.lockId]
        );

        if (!result.rows?.[0]?.locked) {
            throw new Error(
                "Another migration process is running"
            );
        }

        return true;
    }

    /* =========================================
       APPLIED MIGRATIONS
    ========================================= */

    async appliedMigrations(connection) {
        const table = this.validateIdentifier(this.tableName);

        const result = await connection.query(`
            SELECT id, checksum, applied_at, execution_ms
            FROM ${table}
            ORDER BY id ASC
        `);

        return result.rows || [];
    }

    async validateAppliedChecksums(applied) {
        if (!this.validateChecksums) return;

        for (const record of applied) {
            const migration = this.migrations.get(record.id);

            if (!migration) continue;

            if (migration.checksum !== record.checksum) {
                throw new Error(
                    `Checksum mismatch detected for migration: ${record.id}`
                );
            }
        }
    }

    /* =========================================
       MIGRATION EXECUTION
    ========================================= */

    async migrate(config = {}) {
        return this.databaseManager.query(
            async connection => {
                await connection.query("BEGIN");

                try {
                    await this.ensureTables(connection);
                    await this.acquireLock(connection);

                    const applied =
                        await this.appliedMigrations(connection);

                    const appliedMap = new Map(
                        applied.map(m => [m.id, m])
                    );

                    await this.validateAppliedChecksums(applied);

                    const pending = this.getMigrations().filter(
                        migration => !appliedMap.has(migration.id)
                    );

                    const completed = [];

                    for (const migration of pending) {
                        const startedAt = Date.now();

                        this.logger.info?.(
                            `Running migration: ${migration.id}`
                        );

                        await migration.up(connection);

                        const executionMs =
                            Date.now() - startedAt;

                        await connection.query(
                            `INSERT INTO ${this.validateIdentifier(this.tableName)}
                             (id, checksum, execution_ms)
                             VALUES ($1, $2, $3)`,
                            [
                                migration.id,
                                migration.checksum,
                                executionMs
                            ]
                        );

                        completed.push({
                            id: migration.id,
                            executionMs
                        });
                    }

                    await connection.query("COMMIT");

                    this.logger.info?.(
                        `Migrations completed: ${completed.length}`
                    );

                    return {
                        success: true,
                        applied: completed,
                        count: completed.length
                    };

                } catch (error) {
                    try {
                        await connection.query("ROLLBACK");
                    } catch (rollbackError) {
                        error.rollbackError = rollbackError;
                    }

                    this.logger.error?.(
                        "Migration failed:",
                        error
                    );

                    throw error;
                }
            },
            config
        );
    }

    /* =========================================
       ROLLBACK
    ========================================= */

    async rollback(steps = 1, config = {}) {
        if (!Number.isInteger(steps) || steps < 1) {
            throw new RangeError(
                "Rollback steps must be a positive integer"
            );
        }

        return this.databaseManager.query(
            async connection => {
                await connection.query("BEGIN");

                try {
                    await this.ensureTables(connection);
                    await this.acquireLock(connection);

                    const applied =
                        await this.appliedMigrations(connection);

                    const ordered = this.getMigrations();

                    const migrationMap = new Map(
                        ordered.map(m => [m.id, m])
                    );

                    const appliedIds = new Set(
                        applied.map(m => m.id)
                    );

                    const appliedOrdered = ordered.filter(
                        m => appliedIds.has(m.id)
                    );

                    const toRollback = appliedOrdered
                        .slice(-steps)
                        .reverse();

                    const rolledBack = [];

                    for (const migration of toRollback) {
                        this.logger.info?.(
                            `Rolling back: ${migration.id}`
                        );

                        await migration.down(connection);

                        await connection.query(
                            `DELETE FROM ${this.validateIdentifier(this.tableName)}
                             WHERE id = $1`,
                            [migration.id]
                        );

                        rolledBack.push(migration.id);
                    }

                    await connection.query("COMMIT");

                    return {
                        success: true,
                        rolledBack,
                        count: rolledBack.length
                    };

                } catch (error) {
                    try {
                        await connection.query("ROLLBACK");
                    } catch (rollbackError) {
                        error.rollbackError = rollbackError;
                    }

                    throw error;
                }
            },
            config
        );
    }

    /* =========================================
       STATUS
    ========================================= */

    async status(config = {}) {
        return this.databaseManager.query(
            async connection => {
                await this.ensureTables(connection);

                const applied =
                    await this.appliedMigrations(connection);

                const appliedMap = new Map(
                    applied.map(m => [m.id, m])
                );

                return this.getMigrations().map(migration => {
                    const record = appliedMap.get(migration.id);

                    return {
                        id: migration.id,
                        applied: !!record,
                        checksumValid: record
                            ? record.checksum === migration.checksum
                            : null,
                        appliedAt: record?.applied_at ?? null,
                        executionMs: record?.execution_ms ?? null
                    };
                });
            },
            config
        );
    }

    /* =========================================
       PENDING MIGRATIONS
    ========================================= */

    async pending(config = {}) {
        const statuses = await this.status(config);

        return statuses.filter(
            migration => !migration.applied
        );
    }

    /* =========================================
       RESET
    ========================================= */

    async reset(config = {}) {
        const applied = await this.status(config);

        const count = applied.filter(
            migration => migration.applied
        ).length;

        if (count === 0) {
            return {
                success: true,
                rolledBack: [],
                count: 0
            };
        }

        return this.rollback(count, config);
    }
}

module.exports = MigrationTool;
