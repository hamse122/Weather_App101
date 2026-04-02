const EventEmitter = require("events");

class BaseModel {
    constructor(attrs = {}, options = {}) {
        this.$exists = !!options.exists;
        this.$orm = options.orm;
        this.$model = options.model;

        Object.assign(this, attrs);
    }

    toJSON() {
        const hidden = this.$model.hidden || [];
        return Object.fromEntries(
            Object.entries(this).filter(([k]) => !k.startsWith("$") && !hidden.includes(k))
        );
    }

    async save(config = {}) {
        return this.$exists ? this._update(config) : this._create(config);
    }

    async _create(config) {
        const created = await this.$model.create(this.toJSON(), config);
        Object.assign(this, created);
        this.$exists = true;
        return this;
    }

    async _update(config) {
        const updated = await this.$model.update(
            this[this.$model.primaryKey],
            this.toJSON(), 
            config
        );
        Object.assign(this, updated);
        return this;
    }

    async destroy(config = {}) {
        return this.$model.destroy(this[this.$model.primaryKey], config);
    }

    async forceDelete(config = {}) {
        return this.$model.forceDelete(this[this.$model.primaryKey], config);
    }

    async restore(config = {}) {
        return this.$model.restore(this[this.$model.primaryKey], config);
    }

    async reload(config = {}) {
        const fresh = await this.$model.findById(
            this[this.$model.primaryKey],
            config
        );
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
            tablePrefix: "",
            timestampFields: true,
            paranoid: true,
            globalScopes: {},
            ...options,
        };

        this.applyGlobalScopes = this.applyGlobalScopes.bind(this);
    }

    // =====================================================================
    // TRANSACTIONS
    // =====================================================================
    async transaction(fn) {
        return this.db.transaction(fn);
    }

    // =====================================================================
    // MODEL DEFINITION
    // =====================================================================
    defineModel(name, schema) {
        const orm = this;
        const tableName = this.options.tablePrefix + (schema.tableName || `${name.toLowerCase()}s`);

        class Model extends BaseModel {}

        Object.assign(Model, {
            modelName: name,
            tableName,
            schema: schema.fields || {},
            relationships: schema.relationships || {},
            primaryKey: schema.primaryKey || "id",
            hidden: schema.hidden || [],
            fillable: schema.fillable || null,
            softDelete: schema.softDelete ?? this.options.paranoid,
            hooks: schema.hooks || {},
            orm
        });

        this._attachModelMethods(Model);
        this.models.set(name, Model);
        return Model;
    }

    // =====================================================================
    // MODEL STATIC METHODS
    // =====================================================================
    _attachModelMethods(Model) {
        const orm = this;

        const wrap = (row, exists = true) =>
            row ? new Model(row, { orm, model: Model, exists }) : null;

        const addHook = async (hook, payload) => {
            if (Model.hooks?.[hook]) await Model.hooks[hook](payload);
        };

        // ------------------------------
        // QUERY BUILDER STARTER
        // ------------------------------
        Model.query = () => orm.db.createQueryBuilder().table(Model.tableName);

        // ------------------------------
        // CREATE
        // ------------------------------
        Model.create = async (attrs = {}, config = {}) => {
            const data = orm._prepareAttributes(Model, attrs, true);

            await addHook("beforeCreate", data);

            let fields = Object.keys(data);
            let values = Object.values(data);

            const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

            const sql = `
                INSERT INTO ${Model.tableName} (${fields.join(", ")})
                VALUES (${placeholders})
                RETURNING *
            `;

            return orm.db.query(async conn => {
                const res = await conn.query(sql, values);
                const instance = wrap(res.rows[0]);
                orm.emit("created", { model: Model.modelName, instance });
                await addHook("afterCreate", instance);
                return instance;
            }, config);
        };

        // ------------------------------
        // FIND BY ID
        // ------------------------------
        Model.findById = async (id, config = {}) => {
            const qb = Model.query().where({ [Model.primaryKey]: id }).limit(1);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async c => {
                const r = await c.query(sql, qb.getParams());
                return wrap(r.rows[0]);
            }, config);
        };

        // ------------------------------
        // FIND ONE
        // ------------------------------
        Model.findOne = async (where = {}, config = {}) => {
            const qb = Model.query().where(where).limit(1);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async c => {
                const r = await c.query(sql, qb.getParams());
                return wrap(r.rows[0]);
            }, config);
        };

        // ------------------------------
        // FIND ALL
        // ------------------------------
        Model.findAll = async (opts = {}, config = {}) => {
            const qb = Model.query();

            if (opts.fields) qb.select(opts.fields);
            if (opts.where) qb.where(opts.where);
            if (opts.whereIn) qb.whereIn(opts.whereIn);
            if (opts.orderBy) qb.orderBy(...opts.orderBy.split(" "));
            if (opts.limit) qb.limit(opts.limit);
            if (opts.offset) qb.offset(opts.offset);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async c => {
                const r = await c.query(sql, qb.getParams());
                return r.rows.map(row => wrap(row));
            }, config);
        };

        // ------------------------------
        // COUNT
        // ------------------------------
        Model.count = async (where = {}, config = {}) => {
            const qb = Model.query().count("*").where(where);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();
            return orm.db.query(async c => {
                const r = await c.query(sql, qb.getParams());
                return parseInt(r.rows[0].count, 10);
            }, config);
        };

        // ------------------------------
        // PAGINATE
        // ------------------------------
        Model.paginate = async ({ page = 1, limit = 10, where = {} } = {}, config = {}) => {
            const offset = (page - 1) * limit;

            const [rows, total] = await Promise.all([
                Model.findAll({ where, limit, offset }, config),
                Model.count(where, config)
            ]);

            return {
                rows,
                total,
                page,
                pages: Math.ceil(total / limit)
            };
        };

        // ------------------------------
        // UPDATE
        // ------------------------------
        Model.update = async (id, attrs = {}, config = {}) => {
            const data = orm._prepareAttributes(Model, attrs);

            if (!Object.keys(data).length) return null;

            const fields = Object.keys(data);
            const values = Object.values(data);

            const sql = `
                UPDATE ${Model.tableName}
                SET ${fields.map((f, i) => `${f}=$${i + 1}`).join(", ")}
                WHERE ${Model.primaryKey}=$${fields.length + 1}
                RETURNING *
            `;

            return orm.db.query(async c => {
                const r = await c.query(sql, [...values, id]);
                const instance = wrap(r.rows[0]);
                orm.emit("updated", { model: Model.modelName, instance });
                return instance;
            }, config);
        };

        // ------------------------------
        // SOFT DELETE / HARD DELETE
        // ------------------------------
        Model.destroy = async (id, config = {}) => {
            if (Model.softDelete) {
                const sql = `
                    UPDATE ${Model.tableName}
                    SET deletedAt = NOW()
                    WHERE ${Model.primaryKey} = $1
                `;
                return orm.db.query(async c => {
                    await c.query(sql, [id]);
                    orm.emit("destroyed", { model: Model.modelName, id, soft: true });
                    return true;
                }, config);
            }

            return Model.forceDelete(id, config);
        };

        Model.forceDelete = async (id, config = {}) => {
            const sql = `
                DELETE FROM ${Model.tableName}
                WHERE ${Model.primaryKey} = $1
            `;
            return orm.db.query(async c => {
                await c.query(sql, [id]);
                orm.emit("destroyed", { model: Model.modelName, id, soft: false });
                return true;
            }, config);
        };

        Model.restore = async (id, config = {}) => {
            const sql = `
                UPDATE ${Model.tableName}
                SET deletedAt = NULL
                WHERE ${Model.primaryKey} = $1
            `;
            return orm.db.query(async c => {
                await c.query(sql, [id]);
                orm.emit("restored", { model: Model.modelName, id });
                return true;
            }, config);
        };

        // ------------------------------
        // RELATION LOADING
        // ------------------------------
        Model.with = (...relations) => ({
            async load(instance) {
                for (const relName of relations) {
                    const rel = Model.relationships[relName];
                    if (!rel) continue;

                    const Related = orm.models.get(rel.model);
                    if (!Related) continue;

                    if (rel.type === "hasMany") {
                        instance[relName] = await Related.findAll({
                            where: { [rel.foreignKey]: instance[rel.localKey || "id"] }
                        });
                    }

                    if (rel.type === "belongsTo") {
                        instance[relName] = await Related.findById(instance[rel.foreignKey]);
                    }
                }
                return instance;
            }
        });
    }

    // =====================================================================
    // HELPERS
    // =====================================================================
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

    // =====================================================================
    // GLOBAL SCOPES (Soft delete, custom scopes, etc.)
    // =====================================================================
    applyGlobalScopes(Model, qb) {
        if (Model.softDelete) qb.where({ deletedAt: null });

        for (const scopeName in this.options.globalScopes) {
            this.options.globalScopes[scopeName](qb);
        }
    }

    // =====================================================================
    // MIGRATIONS
    // =====================================================================
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
