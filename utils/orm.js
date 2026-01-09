const EventEmitter = require('events');

class BaseModel {
    constructor(attributes = {}) {
        Object.assign(this, attributes);
    }

    toJSON() {
        return { ...this };
    }
}

class ORM extends EventEmitter {
    constructor(databaseManager, options = {}) {
        super();
        this.databaseManager = databaseManager;
        this.models = new Map();
        this.migrations = [];
        this.options = {
            tablePrefix: options.tablePrefix || '',
            timestampFields: options.timestampFields !== false
        };
    }

    // =======================
    // MODEL DEFINITION
    // =======================
    defineModel(name, schema) {
        const tableName = this.options.tablePrefix + (schema.tableName || `${name.toLowerCase()}s`);
        const ModelClass = class extends BaseModel {};
        ModelClass.modelName = name;
        ModelClass.tableName = tableName;
        ModelClass.schema = schema.fields || {};
        ModelClass.relationships = schema.relationships || {};
        ModelClass.primaryKey = schema.primaryKey || 'id';
        ModelClass.softDelete = schema.softDelete || false;
        ModelClass.orm = this;

        this.attachModelMethods(ModelClass, schema);
        this.models.set(name, ModelClass);
        return ModelClass;
    }

    // =======================
    // MODEL METHODS
    // =======================
    attachModelMethods(ModelClass, schema) {
        const orm = this;

        // CREATE
        ModelClass.create = async (attributes = {}, config = {}) => {
            if (ModelClass.hooks?.beforeCreate) await ModelClass.hooks.beforeCreate(attributes);

            const now = new Date();
            const data = this.options.timestampFields
                ? { createdAt: now, updatedAt: now, ...attributes }
                : attributes;

            const fields = Object.keys(data);
            const values = Object.values(data);
            const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

            const sql = `INSERT INTO ${ModelClass.tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;

            return this.databaseManager.query(async connection => {
                const result = await connection.query(sql, values);
                const instance = new ModelClass(result.rows[0]);
                this.emit('created', { model: ModelClass.modelName, instance });
                if (ModelClass.hooks?.afterCreate) await ModelClass.hooks.afterCreate(instance);
                return instance;
            }, config);
        };

        // FIND BY ID
        ModelClass.findById = async (id, config = {}) => {
            const pk = ModelClass.primaryKey;
            const sql = `SELECT * FROM ${ModelClass.tableName} WHERE ${pk} = $1 LIMIT 1`;

            return this.databaseManager.query(async connection => {
                const result = await connection.query(sql, [id]);
                return result.rows[0] ? new ModelClass(result.rows[0]) : null;
            }, config);
        };

        // FIND ALL
        ModelClass.findAll = async (options = {}, config = {}) => {
            const builder = this.databaseManager.createQueryBuilder()
                .select(options.fields || '*')
                .from(ModelClass.tableName);

            if (options.where) builder.where(options.where);
            if (options.orderBy) {
                const [field, direction] = options.orderBy.split(' ');
                builder.orderBy(field, direction);
            }
            if (options.limit) builder.limit(options.limit);
            if (options.offset) builder.offset(options.offset);

            const sql = builder.build();
            return this.databaseManager.query(async connection => {
                const rows = await connection.query(sql);
                return rows.rows.map(r => new ModelClass(r));
            }, config);
        };

        // UPDATE
        ModelClass.update = async (id, attributes = {}, config = {}) => {
            const now = new Date();
            const data = this.options.timestampFields
                ? { ...attributes, updatedAt: now }
                : attributes;

            const fields = Object.keys(data);
            const values = Object.values(data);
            const assignments = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

            const pkIndex = fields.length + 1;
            const sql = `UPDATE ${ModelClass.tableName} SET ${assignments} WHERE ${ModelClass.primaryKey} = $${pkIndex} RETURNING *`;

            return this.databaseManager.query(async connection => {
                const result = await connection.query(sql, [...values, id]);
                if (!result.rows[0]) return null;

                const instance = new ModelClass(result.rows[0]);
                this.emit('updated', { model: ModelClass.modelName, instance });
                return instance;
            }, config);
        };

        // DESTROY
        ModelClass.destroy = async (id, config = {}) => {
            const pk = ModelClass.primaryKey;
            let sql;

            if (ModelClass.softDelete) {
                sql = `UPDATE ${ModelClass.tableName} SET deletedAt = NOW() WHERE ${pk} = $1`;
            } else {
                sql = `DELETE FROM ${ModelClass.tableName} WHERE ${pk} = $1`;
            }

            return this.databaseManager.query(async connection => {
                await connection.query(sql, [id]);
                this.emit('destroyed', { model: ModelClass.modelName, id });
                return true;
            }, config);
        };

        // RELATIONSHIP LOADER
        ModelClass.with = function (...relations) {
            return {
                async load(instance, config = {}) {
                    for (const relationName of relations) {
                        const relation = ModelClass.relationships[relationName];
                        if (!relation) throw new Error(`Relation ${relationName} not defined`);

                        const RelatedModel = orm.models.get(relation.model);
                        if (!RelatedModel) throw new Error(`Related model ${relation.model} not registered`);

                        switch (relation.type) {
                            case 'hasMany': {
                                const sql = `SELECT * FROM ${RelatedModel.tableName} WHERE ${relation.foreignKey} = $1`;
                                const result = await orm.databaseManager.query(async conn => conn.query(sql, [instance[relation.localKey || 'id']]), config);
                                instance[relationName] = result.rows.map(r => new RelatedModel(r));
                                break;
                            }
                            case 'belongsTo': {
                                const sql = `SELECT * FROM ${RelatedModel.tableName} WHERE ${relation.localKey || 'id'} = $1 LIMIT 1`;
                                const result = await orm.databaseManager.query(async conn => conn.query(sql, [instance[relation.foreignKey]]), config);
                                instance[relationName] = result.rows[0] ? new RelatedModel(result.rows[0]) : null;
                                break;
                            }
                            default:
                                throw new Error(`Unsupported relation type: ${relation.type}`);
                        }
                    }
                    return instance;
                }
            };
        };
    }

    // =======================
    // MIGRATIONS
    // =======================
    addMigration(migration) {
        if (!migration || typeof migration.up !== 'function' || typeof migration.down !== 'function') {
            throw new Error('Migration must implement up and down methods');
        }
        this.migrations.push(migration);
        return this;
    }

    async migrate(config = {}) {
        for (const migration of this.migrations) {
            await this.databaseManager.query(async connection => migration.up(connection), config);
        }
    }

    async rollback(config = {}) {
        for (const migration of [...this.migrations].reverse()) {
            await this.databaseManager.query(async connection => migration.down(connection), config);
        }
    }
}

module.exports = { ORM, BaseModel };
