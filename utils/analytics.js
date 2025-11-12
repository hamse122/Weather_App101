// Analytics and event tracking system
class Analytics {
    constructor(options = {}) {
        this.endpoint = options.endpoint || '/analytics';
        this.queue = [];
        this.maxQueueSize = options.maxQueueSize || 100;
        this.flushInterval = options.flushInterval || 30000;
        this.isFlushing = false;
        this.fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch : null);

        if (!this.fetchImpl) {
            throw new Error('Analytics requires a fetch implementation');
        }

        if (this.flushInterval > 0) {
            setInterval(() => this.flush(), this.flushInterval).unref?.();
        }
    }

    track(event, properties = {}) {
        const eventData = {
            event,
            properties,
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            url: typeof window !== 'undefined' ? window.location.href : 'server',
            sessionId: this.getSessionId()
        };

        this.queue.push(eventData);

        if (this.queue.length >= this.maxQueueSize) {
            this.flush();
        }

        return eventData;
    }

    pageView(page, properties = {}) {
        return this.track('page_view', { page, ...properties });
    }

    identify(userId, traits = {}) {
        return this.track('identify', { userId, traits });
    }

    async flush() {
        if (this.isFlushing || this.queue.length === 0) {
            return;
        }

        this.isFlushing = true;
        const eventsToSend = [...this.queue];
        this.queue = [];

        try {
            await this.sendEvents(eventsToSend);
        } catch (error) {
            console.error('Failed to send events:', error);
            this.queue = [...eventsToSend, ...this.queue];
        } finally {
            this.isFlushing = false;
        }
    }

    async sendEvents(events) {
        const response = await this.fetchImpl(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ events })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    getSessionId() {
        if (typeof sessionStorage === 'undefined') {
            return this.generateId();
        }

        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
            sessionId = this.generateId();
            sessionStorage.setItem('analytics_session_id', sessionId);
        }
        return sessionId;
    }

    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    getQueueSize() {
        return this.queue.length;
    }

    clearQueue() {
        this.queue = [];
    }
}

module.exports = Analytics;

