const EventEmitter = require("events");

class BaseModel {
    constructor(attrs = {}, options = {}) {
        this.$exists = Boolean(options.exists);
        this.$orm = options.orm;
        this.$model = options.model;

        Object.assign(this, attrs);
    }

    toJSON() {
        const hidden = this.$model?.hidden ?? [];

        return Object.fromEntries(
            Object.entries(this).filter(
                ([key]) => !key.startsWith("$") && !hidden.includes(key)
            )
        );
    }

    async save(config = {}) {
        return this.$exists
            ? this._update(config)
            : this._create(config);
    }

    async _create(config = {}) {
        const created = await this.$model.create(this.toJSON(), config);

        if (created) {
            Object.assign(this, created);
            this.$exists = true;
        }

        return this;
    }

    async _update(config = {}) {
        const primaryKey = this.$model.primaryKey;
        const id = this[primaryKey];

        if (id == null) {
            throw new Error(`Cannot update ${this.$model.modelName}: missing ${primaryKey}`);
        }

        const updated = await this.$model.update(id, this.toJSON(), config);

        if (updated) {
            Object.assign(this, updated);
        }

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
        const id = this[this.$model.primaryKey];

        if (id == null) {
            throw new Error(`Cannot reload ${this.$model.modelName}: missing primary key`);
        }

        const fresh = await this.$model.findById(id, config);

        if (!fresh) {
            this.$exists = false;
            return null;
        }

        Object.assign(this, fresh);
        this.$exists = true;

        return this;
    }
}

class ORM extends EventEmitter {
    constructor(databaseManager, options = {}) {
        super();

        if (!databaseManager) {
            throw new TypeError("A database manager is required.");
        }

        this.db = databaseManager;
        this.models = new Map();
        this.migrations = [];

        this.options = {
            tablePrefix: "",
            timestampFields: true,
            paranoid: true,
            globalScopes: {},
            ...options
        };

        this.applyGlobalScopes = this.applyGlobalScopes.bind(this);
    }

    async transaction(fn) {
        if (typeof this.db.transaction !== "function") {
            throw new Error("Database manager does not support transactions.");
        }

        return this.db.transaction(fn);
    }

    defineModel(name, schema = {}) {
        if (!name || typeof name !== "string") {
            throw new TypeError("Model name must be a non-empty string.");
        }

        const orm = this;

        const tableName =
            this.options.tablePrefix +
            (schema.tableName || `${name.toLowerCase()}s`);

        class Model extends BaseModel {}

        Object.assign(Model, {
            modelName: name,
            tableName,
            schema: schema.fields || {},
            relationships: schema.relationships || {},
            primaryKey: schema.primaryKey || "id",
            hidden: schema.hidden || [],
            fillable: schema.fillable ?? null,
            softDelete: schema.softDelete ?? this.options.paranoid,
            hooks: schema.hooks || {},
            orm
        });

        this._attachModelMethods(Model);
        this.models.set(name, Model);

        return Model;
    }

    _attachModelMethods(Model) {
        const orm = this;

        const wrap = (row, exists = true) =>
            row
                ? new Model(row, {
                      orm,
                      model: Model,
                      exists
                  })
                : null;

        const addHook = async (hook, payload, config = {}) => {
            const handler = Model.hooks?.[hook];

            if (typeof handler === "function") {
                await handler(payload, {
                    model: Model,
                    orm,
                    ...config
                });
            }
        };

        Model.query = () =>
            orm.db.createQueryBuilder().table(Model.tableName);

        Model.create = async (attrs = {}, config = {}) => {
            const data = orm._prepareAttributes(Model, attrs, true);

            await addHook("beforeCreate", data, config);

            const fields = Object.keys(data);

            if (!fields.length) {
                throw new Error(`No attributes supplied for ${Model.modelName}`);
            }

            const values = Object.values(data);

            const placeholders = fields
                .map((_, i) => `$${i + 1}`)
                .join(", ");

            const sql = `
                INSERT INTO ${Model.tableName}
                (${fields.join(", ")})
                VALUES (${placeholders})
                RETURNING *
            `;

            return orm.db.query(async conn => {
                const res = await conn.query(sql, values);
                const instance = wrap(res.rows[0]);

                await addHook("afterCreate", instance, config);

                orm.emit("created", {
                    model: Model.modelName,
                    instance
                });

                return instance;
            }, config);
        };

        Model.findById = async (id, config = {}) => {
            const qb = Model.query()
                .where({ [Model.primaryKey]: id })
                .limit(1);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async conn => {
                const result = await conn.query(sql, qb.getParams());
                return wrap(result.rows[0]);
            }, config);
        };

        Model.findOne = async (where = {}, config = {}) => {
            const qb = Model.query().where(where).limit(1);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async conn => {
                const result = await conn.query(sql, qb.getParams());
                return wrap(result.rows[0]);
            }, config);
        };

        Model.findAll = async (opts = {}, config = {}) => {
            const qb = Model.query();

            if (opts.fields) qb.select(opts.fields);
            if (opts.where) qb.where(opts.where);
            if (opts.whereIn) qb.whereIn(opts.whereIn);

            if (opts.orderBy) {
                const order = String(opts.orderBy).trim().split(/\s+/);

                const column = order[0];
                const direction =
                    order[1]?.toUpperCase() === "DESC"
                        ? "DESC"
                        : "ASC";

                qb.orderBy(column, direction);
            }

            if (opts.limit != null) qb.limit(Number(opts.limit));
            if (opts.offset != null) qb.offset(Number(opts.offset));

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async conn => {
                const result = await conn.query(sql, qb.getParams());
                return result.rows.map(row => wrap(row));
            }, config);
        };

        Model.count = async (where = {}, config = {}) => {
            const qb = Model.query().count("*").where(where);

            orm.applyGlobalScopes(Model, qb);

            const sql = qb.build();

            return orm.db.query(async conn => {
                const result = await conn.query(sql, qb.getParams());
                return Number(result.rows[0]?.count ?? 0);
            }, config);
        };

        Model.paginate = async (
            { page = 1, limit = 10, where = {}, ...options } = {},
            config = {}
        ) => {
            page = Math.max(1, Number(page));
            limit = Math.max(1, Number(limit));

            const offset = (page - 1) * limit;

            const [rows, total] = await Promise.all([
                Model.findAll(
                    {
                        ...options,
                        where,
                        limit,
                        offset
                    },
                    config
                ),
                Model.count(where, config)
            ]);

            return {
                rows,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            };
        };

        Model.update = async (id, attrs = {}, config = {}) => {
            const data = orm._prepareAttributes(Model, attrs, false);
            const fields = Object.keys(data);

            if (!fields.length) {
                return Model.findById(id, config);
            }

            await addHook("beforeUpdate", {
                id,
                data
            }, config);

            const values = Object.values(data);

            const assignments = fields
                .map((field, i) => `${field}=$${i + 1}`)
                .join(", ");

            const sql = `
                UPDATE ${Model.tableName}
                SET ${assignments}
                WHERE ${Model.primaryKey}=$${fields.length + 1}
                RETURNING *
            `;

            return orm.db.query(async conn => {
                const result = await conn.query(sql, [...values, id]);
                const instance = wrap(result.rows[0]);

                if (instance) {
                    await addHook("afterUpdate", instance, config);

                    orm.emit("updated", {
                        model: Model.modelName,
                        instance
                    });
                }

                return instance;
            }, config);
        };

        Model.destroy = async (id, config = {}) => {
            if (Model.softDelete) {
                await addHook("beforeDestroy", { id }, config);

                const sql = `
                    UPDATE ${Model.tableName}
                    SET deletedAt = NOW()
                    WHERE ${Model.primaryKey} = $1
                    RETURNING *
                `;

                return orm.db.query(async conn => {
                    const result = await conn.query(sql, [id]);

                    if (!result.rowCount) return false;

                    await addHook(
                        "afterDestroy",
                        { id, soft: true },
                        config
                    );

                    orm.emit("destroyed", {
                        model: Model.modelName,
                        id,
                        soft: true
                    });

                    return true;
                }, config);
            }

            return Model.forceDelete(id, config);
        };

        Model.forceDelete = async (id, config = {}) => {
            await addHook("beforeForceDelete", { id }, config);

            const sql = `
                DELETE FROM ${Model.tableName}
                WHERE ${Model.primaryKey} = $1
            `;

            return orm.db.query(async conn => {
                const result = await conn.query(sql, [id]);

                if (!result.rowCount) return false;

                await addHook(
                    "afterForceDelete",
                    { id },
                    config
                );

                orm.emit("destroyed", {
                    model: Model.modelName,
                    id,
                    soft: false
                });

                return true;
            }, config);
        };

        Model.restore = async (id, config = {}) => {
            if (!Model.softDelete) {
                return false;
            }

            await addHook("beforeRestore", { id }, config);

            const sql = `
                UPDATE ${Model.tableName}
                SET deletedAt = NULL
                WHERE ${Model.primaryKey} = $1
            `;

            return orm.db.query(async conn => {
                const result = await conn.query(sql, [id]);

                if (!result.rowCount) return false;

                await addHook("afterRestore", { id }, config);

                orm.emit("restored", {
                    model: Model.modelName,
                    id
                });

                return true;
            }, config);
        };

        Model.with = (...relations) => ({
            async load(instance) {
                if (!instance) return instance;

                for (const relationName of relations) {
                    const relation =
                        Model.relationships?.[relationName];

                    if (!relation) continue;

                    const Related = orm.models.get(relation.model);

                    if (!Related) {
                        throw new Error(
                            `Related model '${relation.model}' not found.`
                        );
                    }

                    if (relation.type === "hasMany") {
                        const localKey =
                            relation.localKey || Model.primaryKey;

                        instance[relationName] =
                            await Related.findAll({
                                where: {
                                    [relation.foreignKey]:
                                        instance[localKey]
                                }
                            });
                    }

                    if (relation.type === "belongsTo") {
                        instance[relationName] =
                            await Related.findById(
                                instance[relation.foreignKey]
                            );
                    }
                }

                return instance;
            }
        });
    }

    _prepareAttributes(Model, attrs = {}, isCreate = false) {
        let data = { ...attrs };

        if (Model.fillable) {
            const allowed = new Set(Model.fillable);

            data = Object.fromEntries(
                Object.entries(data).filter(([key]) =>
                    allowed.has(key)
                )
            );
        }

        if (this.options.timestampFields) {
            const now = new Date();

            if (isCreate && data.createdAt == null) {
                data.createdAt = now;
            }

            data.updatedAt = now;
        }

        return data;
    }

    applyGlobalScopes(Model, qb) {
        if (Model.softDelete) {
            qb.where({ deletedAt: null });
        }

        for (const scope of Object.values(
            this.options.globalScopes || {}
        )) {
            if (typeof scope === "function") {
                scope(qb, Model);
            }
        }
    }

    addMigration(migration) {
        if (
            !migration ||
            typeof migration.up !== "function" ||
            typeof migration.down !== "function"
        ) {
            throw new TypeError(
                "Migration must provide up() and down() functions."
            );
        }

        this.migrations.push(migration);
        return this;
    }

    async migrate(config = {}) {
        for (const migration of this.migrations) {
            await this.db.query(
                connection => migration.up(connection),
                config
            );
        }

        return this;
    }

    async rollback(config = {}) {
        for (const migration of [...this.migrations].reverse()) {
            await this.db.query(
                connection => migration.down(connection),
                config
            );
        }

        return this;
    }
}

module.exports = {
    ORM,
    BaseModel
};
