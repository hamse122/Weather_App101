// Upgraded Event Sourcing Implementation

class EventStore {
    constructor({
        snapshotInterval = 50,
        clock = () => new Date()
    } = {}) {
        this.streams = new Map();           
        this.projections = new Map();        
        this.snapshots = new Map();          
        this.subscribers = new Set();        
        this.globalVersion = 0;
        this.snapshotInterval = snapshotInterval;
        this.clock = clock;

        this.processedEventIds = new Set();   // idempotency
    }

/* ---------------- EVENTS (v2) ---------------- */

async appendEvent(
    aggregateId,
    type,
    data,
    {
        expectedVersion = null,
        eventId = crypto.randomUUID(),
        metadata = {}
    } = {}
) {
    if (!aggregateId || typeof aggregateId !== "string") {
        throw new TypeError("Valid aggregateId is required");
    }

    if (!type || typeof type !== "string") {
        throw new TypeError("Event type must be a non-empty string");
    }

    if (!eventId || typeof eventId !== "string") {
        throw new TypeError("Valid eventId is required");
    }

    if (this.processedEventIds.has(eventId)) {
        return null;
    }

    if (
        expectedVersion !== null &&
        (!Number.isInteger(expectedVersion) || expectedVersion < 0)
    ) {
        throw new TypeError("expectedVersion must be a non-negative integer");
    }

    const stream = this._getStream(aggregateId);
    const currentVersion = stream.length;

    // Optimistic concurrency control
    if (
        expectedVersion !== null &&
        expectedVersion !== currentVersion
    ) {
        throw new Error(
            `Concurrency error: expected v${expectedVersion}, got v${currentVersion}`
        );
    }

    const clone = value => {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    };

    const event = Object.freeze({
        id: eventId,
        globalPosition: this.globalVersion + 1,
        aggregateId,
        type,
        data: clone(data),
        metadata: Object.freeze(clone(metadata)),
        version: currentVersion + 1,
        timestamp: this.clock()
    });

    // Persist event before updating derived state
    stream.push(event);
    this.globalVersion++;
    this.processedEventIds.add(eventId);

    try {
        await this._updateProjections(event);
        await this._notifySubscribers(event);

        // Automatic snapshot generation
        if (
            this.snapshotInterval > 0 &&
            event.version % this.snapshotInterval === 0
        ) {
            const state = await this.rebuildAggregate(
                aggregateId,
                metadata.reducer
            );

            this.saveSnapshot(
                aggregateId,
                event.version,
                state,
                { globalPosition: event.globalPosition }
            );
        }
    } catch (error) {
        // Event remains committed; projections can be rebuilt later
        error.eventId = eventId;
        error.aggregateId = aggregateId;
        throw error;
    }

    return event;
}

async getEvents(aggregateId, fromVersion = 1, options = {}) {
    if (!Number.isInteger(fromVersion) || fromVersion < 1) {
        throw new TypeError("fromVersion must be a positive integer");
    }

    const {
        toVersion = Infinity,
        limit = Infinity,
        types = null
    } = options;

    const stream = this._getStream(aggregateId);

    return stream
        .filter(event =>
            event.version >= fromVersion &&
            event.version <= toVersion &&
            (!types || types.includes(event.type))
        )
        .slice(0, limit);
}

getAggregateVersion(aggregateId) {
    return this._getStream(aggregateId).length;
}
/* ---------------- SNAPSHOTS (v2) ---------------- */

saveSnapshot(aggregateId, version, state, metadata = {}) {
    if (!aggregateId) {
        throw new Error("aggregateId is required");
    }

    if (!Number.isInteger(version) || version < 0) {
        throw new Error("Snapshot version must be a non-negative integer");
    }

    const clone =
        typeof structuredClone === "function"
            ? structuredClone(state)
            : JSON.parse(JSON.stringify(state));

    const snapshot = Object.freeze({
        aggregateId,
        version,
        state: clone,
        timestamp: this.clock(),
        metadata: { ...metadata }
    });

    this.snapshots.set(aggregateId, snapshot);

    return snapshot;
}

getSnapshot(aggregateId, { clone = true } = {}) {
    const snapshot = this.snapshots.get(aggregateId);
    if (!snapshot) return null;

    if (!clone) {
        return snapshot;
    }

    return {
        ...snapshot,
        state:
            typeof structuredClone === "function"
                ? structuredClone(snapshot.state)
                : JSON.parse(JSON.stringify(snapshot.state)),
        metadata: { ...snapshot.metadata }
    };
}
    /* ---------------- PROJECTIONS ---------------- */

    registerProjection(name, projection) {
        this.projections.set(name, projection);
        this.replayProjection(name);
    }

    replayProjection(name) {
        const projection = this.projections.get(name);
        if (!projection) return;

        if (projection.reset) projection.reset();

        for (const stream of this.streams.values()) {
            for (const event of stream) {
                projection[event.type]?.(event);
            }
        }
    }

    async _updateProjections(event) {
        for (const [name, projection] of this.projections) {
            const handler = projection[event.type];
            if (!handler) continue;

            try {
                await handler(event);
            } catch (err) {
                console.error(`Projection "${name}" failed`, err);
            }
        }
    }

    getProjection(name) {
        return this.projections.get(name);
    }

    /* ---------------- SUBSCRIPTIONS ---------------- */

    subscribe(handler) {
        this.subscribers.add(handler);
        return () => this.subscribers.delete(handler);
    }

    async _notifySubscribers(event) {
        for (const handler of this.subscribers) {
            Promise.resolve()
                .then(() => handler(event))
                .catch(err => {
                    console.error("Subscriber error:", err);
                });
        }
    }

    /* ---------------- REBUILD ---------------- */

    async rebuildAggregate(aggregateId, reducer, initialState = {}) {
        const snapshot = this.getSnapshot(aggregateId);

        let state = snapshot
            ? structuredClone(snapshot.state)
            : structuredClone(initialState);

        let fromVersion = snapshot ? snapshot.version + 1 : 1;

        const events = await this.getEvents(aggregateId, fromVersion);
        for (const event of events) {
            state = reducer(state, event);
        }

        return state;
    }

    /* ---------------- INTERNAL ---------------- */

    _getStream(aggregateId) {
        if (!this.streams.has(aggregateId)) {
            this.streams.set(aggregateId, []);
        }
        return this.streams.get(aggregateId);
    }
}

module.exports = EventStore;
