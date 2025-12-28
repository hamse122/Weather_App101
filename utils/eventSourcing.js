// Advanced Event Sourcing Implementation
class EventStore {
    constructor() {
        this.events = [];
        this.projections = new Map();
        this.snapshots = new Map();
        this.subscribers = new Set();
        this.globalVersion = 0;
    }

    /* ---------------- EVENTS ---------------- */

    async appendEvent(aggregateId, eventType, eventData, expectedVersion = null) {
        const currentVersion = this.getAggregateVersion(aggregateId);

        // Optimistic concurrency control
        if (expectedVersion !== null && expectedVersion !== currentVersion) {
            throw new Error(
                `Concurrency error: expected v${expectedVersion}, got v${currentVersion}`
            );
        }

        const event = Object.freeze({
            id: ++this.globalVersion,
            aggregateId,
            type: eventType,
            data: structuredClone(eventData),
            timestamp: new Date(),
            version: currentVersion + 1
        });

        this.events.push(event);

        this.updateProjections(event);
        this.notifySubscribers(event);

        return event;
    }

    async getEvents(aggregateId, fromVersion = 1) {
        return this.events.filter(
            e => e.aggregateId === aggregateId && e.version >= fromVersion
        );
    }

    getAggregateVersion(aggregateId) {
        const events = this.events.filter(e => e.aggregateId === aggregateId);
        return events.length ? events[events.length - 1].version : 0;
    }

    /* ---------------- SNAPSHOTS ---------------- */

    saveSnapshot(aggregateId, version, state) {
        this.snapshots.set(aggregateId, {
            aggregateId,
            version,
            state: structuredClone(state),
            timestamp: new Date()
        });
    }

    getSnapshot(aggregateId) {
        return this.snapshots.get(aggregateId) || null;
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

        for (const event of this.events) {
            if (projection[event.type]) {
                projection[event.type](event);
            }
        }
    }

    updateProjections(event) {
        for (const [name, projection] of this.projections) {
            if (projection[event.type]) {
                try {
                    projection[event.type](event);
                } catch (err) {
                    console.error(`Projection "${name}" failed:`, err);
                }
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

    notifySubscribers(event) {
        for (const handler of this.subscribers) {
            try {
                handler(event);
            } catch (err) {
                console.error("Subscriber error:", err);
            }
        }
    }

    /* ---------------- REBUILD ---------------- */

    async rebuildAggregate(aggregateId, reducer, initialState = {}) {
        const snapshot = this.getSnapshot(aggregateId);
        let state = snapshot ? structuredClone(snapshot.state) : initialState;
        let fromVersion = snapshot ? snapshot.version + 1 : 1;

        const events = await this.getEvents(aggregateId, fromVersion);
        for (const event of events) {
            state = reducer(state, event);
        }

        return state;
    }
}

module.exports = EventStore;
