// Simple ORM supporting models, relationships, queries, and migrations
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

    defineModel(name, schema) {
        const tableName = this.options.tablePrefix + (schema.tableName || `${name.toLowerCase()}s`);
        const ModelClass = class extends BaseModel {};
        ModelClass.modelName = name;
        ModelClass.tableName = tableName;
        ModelClass.schema = schema.fields || {};
        ModelClass.relationships = schema.relationships || {};

        this.attachModelMethods(ModelClass, schema);
        this.models.set(name, ModelClass);
        return ModelClass;
    }

    attachModelMethods(ModelClass, schema) {
        ModelClass.create = async (attributes, config = {}) => {
            const now = new Date();
            const data = this.options.timestampFields
                ? { createdAt: now, updatedAt: now, ...attributes }
                : attributes;

            const fields = Object.keys(data);
            const values = Object.values(data);
            const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

            const sql = `INSERT INTO ${ModelClass.tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;

            return this.databaseManager.query(async (connection) => {
                const result = await connection.query(sql, values);
                this.emit('created', { model: ModelClass.modelName, instance: result.rows[0] });
                return new ModelClass(result.rows[0]);
            }, config);
        };

        ModelClass.findById = async (id, config = {}) => {
            const sql = `SELECT * FROM ${ModelClass.tableName} WHERE id = $1 LIMIT 1`;
            return this.databaseManager.query(async (connection) => {
                const result = await connection.query(sql, [id]);
                return result.rows[0] ? new ModelClass(result.rows[0]) : null;
            }, config);
        };

        ModelClass.findAll = async (options = {}, config = {}) => {
            const builder = this.databaseManager.createQueryBuilder()
                .select(options.fields || '*')
                .from(ModelClass.tableName);

            if (options.where) {
                builder.where(options.where);
            }
            if (options.orderBy) {
                const [field, direction] = options.orderBy.split(' ');
                builder.orderBy(field, direction);
            }
            if (options.limit) {
                builder.limit(options.limit);
            }
            if (options.offset) {
                builder.offset(options.offset);
            }

            const sql = builder.build();
            return this.databaseManager.query(async (connection) => {
                const result = await connection.query(sql);
                return result.rows.map(row => new ModelClass(row));
            }, config);
        };

        ModelClass.update = async (id, attributes, config = {}) => {
            const now = new Date();
            const data = this.options.timestampFields
                ? { ...attributes, updatedAt: now }
                : attributes;

            const fields = Object.keys(data);
            const values = Object.values(data);
            const assignments = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

            const sql = `UPDATE ${ModelClass.tableName} SET ${assignments} WHERE id = $${fields.length + 1} RETURNING *`;

            return this.databaseManager.query(async (connection) => {
                const result = await connection.query(sql, [...values, id]);
                this.emit('updated', { model: ModelClass.modelName, instance: result.rows[0] });
                return result.rows[0] ? new ModelClass(result.rows[0]) : null;
            }, config);
        };

        ModelClass.destroy = async (id, config = {}) => {
            const sql = `DELETE FROM ${ModelClass.tableName} WHERE id = $1`;
            return this.databaseManager.query(async (connection) => {
                await connection.query(sql, [id]);
                this.emit('destroyed', { model: ModelClass.modelName, id });
                return true;
            }, config);
        };

        ModelClass.with = (relationName) => {
            const relation = ModelClass.relationships[relationName];
            if (!relation) {
                throw new Error(`Relation ${relationName} not defined on ${ModelClass.modelName}`);
            }
            return {
                async load(instance, config = {}) {
                    const RelatedModel = this.models.get(relation.model);
                    if (!RelatedModel) {
                        throw new Error(`Related model ${relation.model} not registered`);
                    }
                    switch (relation.type) {
                        case 'hasMany': {
                            const sql = `SELECT * FROM ${RelatedModel.tableName} WHERE ${relation.foreignKey} = $1`;
                            return this.databaseManager.query(async (connection) => {
                                const result = await connection.query(sql, [instance[relation.localKey || 'id']]);
                                instance[relationName] = result.rows.map(row => new RelatedModel(row));
                                return instance;
                            }, config);
                        }
                        case 'belongsTo': {
                            const sql = `SELECT * FROM ${RelatedModel.tableName} WHERE ${relation.localKey || 'id'} = $1 LIMIT 1`;
                            return this.databaseManager.query(async (connection) => {
                                const result = await connection.query(sql, [instance[relation.foreignKey]]);
                                instance[relationName] = result.rows[0] ? new RelatedModel(result.rows[0]) : null;
                                return instance;
                            }, config);
                        }
                        default:
                            throw new Error(`Unsupported relation type: ${relation.type}`);
                    }
                }
            };
        };
    }

    addMigration(migration) {
        if (!migration || typeof migration.up !== 'function' || typeof migration.down !== 'function') {
            throw new Error('Migration must implement up and down functions');
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

