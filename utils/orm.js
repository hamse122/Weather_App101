const EventEmitter = require('events');

class BaseModel {
    constructor(attributes = {}, options = {}) {
        this.$exists = !!options.exists;
        this.$orm = options.orm;
        this.$model = options.model;
        Object.assign(this, attributes);
    }

    toJSON() {
        const hidden = this.$model?.hidden || [];
        return Object.fromEntries(
            Object.entries(this).filter(([k]) => !hidden.includes(k) && !k.startsWith('$'))
        );
    }

    async save(config = {}) {
        if (!this.$exists) {
            const created = await this.$model.create(this.toJSON(), config);
            Object.assign(this, created);
            this.$exists = true;
            return this;
        }
        const updated = await this.$model.update(this[this.$model.primaryKey], this.toJSON(), config);
        Object.assign(this, updated);
        return this;
    }

    async destroy(config = {}) {
        return this.$model.destroy(this[this.$model.primaryKey], config);
    }

    async reload(config = {}) {
        const fresh = await this.$model.findById(this[this.$model.primaryKey], config);
        Object.assign(this, fresh);
        return this;
    }
}

class ORM extends EventEmitter {
    constructor(databaseManager, options = {}) {
        super();
        this.db = databaseManager;
        this.models = new Map();
        this.migrations = [];

        this.options = {
            tablePrefix: '',
            timestampFields: true,
            paranoid: true,
            ...options
        };
    }

    // =====================
    // TRANSACTIONS
    // =====================
    async transaction(callback) {
        return this.db.transaction(callback);
    }

    // =====================
    // MODEL DEFINITION
    // =====================
    defineModel(name, schema) {
        const orm = this;
        const tableName = this.options.tablePrefix + (schema.tableName || `${name.toLowerCase()}s`);

        class Model extends BaseModel {}

        Object.assign(Model, {
            modelName: name,
            tableName,
            schema: schema.fields || {},
            relationships: schema.relationships || {},
            primaryKey: schema.primaryKey || 'id',
            softDelete: schema.softDelete ?? this.options.paranoid,
            hidden: schema.hidden || [],
            fillable: schema.fillable || null,
            hooks: schema.hooks || {},
            orm
        });

        this._attachModelMethods(Model);
        this.models.set(name, Model);
        return Model;
    }

    // =====================
    // MODEL METHODS
    // =====================
    _attachModelMethods(Model) {
        const orm = this;

        const wrap = (row, exists = true) =>
            row ? new Model(row, { exists, orm, model: Model }) : null;

        // CREATE
        Model.create = async (attrs = {}, config = {}) => {
            const data = this._prepareAttributes(Model, attrs, true);
            const fields = Object.keys(data);
            const values = Object.values(data);

            const sql = `
                INSERT INTO ${Model.tableName}
                (${fields.join(', ')})
                VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')})
                RETURNING *
            `;

            return orm.db.query(async conn => {
                await Model.hooks?.beforeCreate?.(data);
                const res = await conn.query(sql, values);
                const instance = wrap(res.rows[0]);
                orm.emit('created', { model: Model.modelName, instance });
                await Model.hooks?.afterCreate?.(instance);
                return instance;
            }, config);
        };

        // FIND
        Model.findById = async (id, config = {}) => {
            const where = [`${Model.primaryKey} = $1`];
            if (Model.softDelete) where.push(`deletedAt IS NULL`);

            const sql = `
                SELECT * FROM ${Model.tableName}
                WHERE ${where.join(' AND ')}
                LIMIT 1
            `;

            return orm.db.query(async c => {
                const r = await c.query(sql, [id]);
                return wrap(r.rows[0]);
            }, config);
        };

        // FIND ALL
        Model.findAll = async (opts = {}, config = {}) => {
            const qb = orm.db.createQueryBuilder()
                .select(opts.fields || '*')
                .from(Model.tableName);

            if (Model.softDelete) qb.where({ deletedAt: null });
            if (opts.where) qb.where(opts.where);
            if (opts.whereIn) qb.whereIn(opts.whereIn);
            if (opts.orderBy) qb.orderBy(...opts.orderBy.split(' '));
            if (opts.limit) qb.limit(opts.limit);
            if (opts.offset) qb.offset(opts.offset);

            const sql = qb.build();
            return orm.db.query(async c => {
                const r = await c.query(sql);
                return r.rows.map(row => wrap(row));
            }, config);
        };

        // UPDATE
        Model.update = async (id, attrs = {}, config = {}) => {
            const data = this._prepareAttributes(Model, attrs);
            if (!Object.keys(data).length) return null;

            const fields = Object.keys(data);
            const sql = `
                UPDATE ${Model.tableName}
                SET ${fields.map((f, i) => `${f}=$${i + 1}`).join(', ')}
                WHERE ${Model.primaryKey}=$${fields.length + 1}
                RETURNING *
            `;

            return orm.db.query(async c => {
                const r = await c.query(sql, [...Object.values(data), id]);
                const instance = wrap(r.rows[0]);
                orm.emit('updated', { model: Model.modelName, instance });
                return instance;
            }, config);
        };

        // BULK CREATE
        Model.bulkCreate = async (rows = [], config = {}) => {
            return Promise.all(rows.map(r => Model.create(r, config)));
        };

        // DESTROY
        Model.destroy = async (id, config = {}) => {
            const sql = Model.softDelete
                ? `UPDATE ${Model.tableName} SET deletedAt=NOW() WHERE ${Model.primaryKey}=$1`
                : `DELETE FROM ${Model.tableName} WHERE ${Model.primaryKey}=$1`;

            return orm.db.query(async c => {
                await c.query(sql, [id]);
                orm.emit('destroyed', { model: Model.modelName, id });
                return true;
            }, config);
        };

        // RELATIONS
        Model.with = (...relations) => ({
            async load(instance) {
                for (const name of relations) {
                    const rel = Model.relationships[name];
                    const Related = orm.models.get(rel.model);
                    if (!Related) continue;

                    if (rel.type === 'hasMany') {
                        instance[name] = await Related.findAll({
                            where: { [rel.foreignKey]: instance[rel.localKey || 'id'] }
                        });
                    }

                    if (rel.type === 'belongsTo') {
                        instance[name] = await Related.findById(instance[rel.foreignKey]);
                    }
                }
                return instance;
            }
        });
    }

    // =====================
    // HELPERS
    // =====================
    _prepareAttributes(Model, attrs, isCreate = false) {
        const now = new Date();
        let data = { ...attrs };

        if (Model.fillable) {
            data = Object.fromEntries(
                Object.entries(data).filter(([k]) => Model.fillable.includes(k))
            );
        }

        if (this.options.timestampFields) {
            if (isCreate) data.createdAt = now;
            data.updatedAt = now;
        }

        return data;
    }

    // =====================
    // MIGRATIONS
    // =====================
    addMigration(m) {
        this.migrations.push(m);
        return this;
    }

    async migrate(config = {}) {
        for (const m of this.migrations) {
            await this.db.query(c => m.up(c), config);
        }
    }

    async rollback(config = {}) {
        for (const m of [...this.migrations].reverse()) {
            await this.db.query(c => m.down(c), config);
        }
    }
}

module.exports = { ORM, BaseModel };
