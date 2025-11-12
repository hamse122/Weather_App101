// Event sourcing implementation
class EventStore {
    constructor() {
        this.events = [];
        this.projections = new Map();
    }

    appendEvent(aggregateId, eventType, eventData) {
        const event = {
            id: this.events.length + 1,
            aggregateId,
            type: eventType,
            data: eventData,
            timestamp: new Date(),
            version: this.getNextVersion(aggregateId)
        };

        this.events.push(event);
        this.updateProjections(event);

        return event;
    }

    getEvents(aggregateId) {
        return this.events.filter(event => event.aggregateId === aggregateId);
    }

    getNextVersion(aggregateId) {
        const aggregateEvents = this.getEvents(aggregateId);
        return aggregateEvents.length + 1;
    }

    registerProjection(name, projection) {
        this.projections.set(name, projection);
        this.events.forEach(event => {
            if (projection[event.type]) {
                projection[event.type](event);
            }
        });
    }

    updateProjections(event) {
        this.projections.forEach((projection, name) => {
            if (projection[event.type]) {
                try {
                    projection[event.type](event);
                } catch (error) {
                    console.error(`Projection ${name} error:`, error);
                }
            }
        });
    }

    getProjection(name) {
        return this.projections.get(name);
    }
}

module.exports = EventStore;

