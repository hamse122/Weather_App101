// Upgraded Event Sourcing Implementation

class EventStore {
    constructor({
        snapshotInterval = 50,
        clock = () => new Date()
    } = {}) {
        this.streams = new Map();            // aggregateId -> events[]
        this.projections = new Map();        // name -> projection
        this.snapshots = new Map();           // aggregateId -> snapshot
        this.subscribers = new Set();         // async handlers
        this.globalVersion = 0;
        this.snapshotInterval = snapshotInterval;
        this.clock = clock;

        this.processedEventIds = new Set();   // idempotency
    }

    /* ---------------- EVENTS ---------------- */

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
        if (this.processedEventIds.has(eventId)) {
            return null; // idempotent replay protection
        }

        const stream = this._getStream(aggregateId);
        const currentVersion = stream.length;

        // Optimistic concurrency control
        if (expectedVersion !== null && expectedVersion !== currentVersion) {
            throw new Error(
                `Concurrency error: expected v${expectedVersion}, got v${currentVersion}`
            );
        }

        const event = Object.freeze({
            id: eventId,
            globalPosition: ++this.globalVersion,
            aggregateId,
            type,
            data: structuredClone(data),
            metadata: {
                ...metadata
            },
            version: currentVersion + 1,
            timestamp: this.clock()
        });

        stream.push(event);
        this.processedEventIds.add(eventId);

        await this._updateProjections(event);
        await this._notifySubscribers(event);

        if (event.version % this.snapshotInterval === 0) {
            this.saveSnapshot(
                aggregateId,
                event.version,
                await this.rebuildAggregate(aggregateId, metadata.reducer)
            );
        }

        return event;
    }

    async getEvents(aggregateId, fromVersion = 1) {
        const stream = this._getStream(aggregateId);
        return stream.slice(fromVersion - 1);
    }

    getAggregateVersion(aggregateId) {
        return this._getStream(aggregateId).length;
    }

    /* ---------------- SNAPSHOTS ---------------- */

    saveSnapshot(aggregateId, version, state) {
        this.snapshots.set(aggregateId, {
            aggregateId,
            version,
            state: structuredClone(state),
            timestamp: this.clock()
        });
    }

    getSnapshot(aggregateId) {
        return this.snapshots.get(aggregateId) ?? null;
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
