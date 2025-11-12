// Publish-Subscribe system
class PubSub {
    constructor() {
        this.channels = new Map();
        this.history = new Map();
        this.maxHistory = 100;
    }

    subscribe(channel, callback) {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel).add(callback);

        return () => this.unsubscribe(channel, callback);
    }

    unsubscribe(channel, callback) {
        const channelCallbacks = this.channels.get(channel);
        if (channelCallbacks) {
            channelCallbacks.delete(callback);
            if (channelCallbacks.size === 0) {
                this.channels.delete(channel);
            }
        }
    }

    publish(channel, data) {
        if (!this.history.has(channel)) {
            this.history.set(channel, []);
        }
        const channelHistory = this.history.get(channel);
        channelHistory.push({
            data,
            timestamp: Date.now()
        });

        if (channelHistory.length > this.maxHistory) {
            channelHistory.shift();
        }

        const callbacks = this.channels.get(channel);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data, channel);
                } catch (error) {
                    console.error('PubSub callback error:', error);
                }
            });
        }

        return callbacks ? callbacks.size : 0;
    }

    getHistory(channel, limit = 10) {
        const history = this.history.get(channel) || [];
        return history.slice(-limit);
    }

    getSubscriberCount(channel = null) {
        if (channel) {
            return this.channels.get(channel)?.size || 0;
        }
        return Array.from(this.channels.values()).reduce((sum, callbacks) => sum + callbacks.size, 0);
    }
}

module.exports = PubSub;

