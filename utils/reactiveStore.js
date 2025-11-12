// Reactive store with computed properties
class ReactiveStore {
    constructor(initialState = {}) {
        this.subscribers = new Map();
        this.computed = new Map();
        this.state = new Proxy({ ...initialState }, {
            set: (target, property, value) => {
                target[property] = value;
                this.notify(property, value);
                return true;
            }
        });
    }

    set(key, value) {
        this.state[key] = value;
    }

    get(key) {
        return this.state[key];
    }

    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        return () => this.unsubscribe(key, callback);
    }

    unsubscribe(key, callback) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.subscribers.delete(key);
            }
        }
    }

    notify(key, value) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(value, key);
                } catch (error) {
                    console.error('ReactiveStore subscriber error:', error);
                }
            });
        }
        this.updateComputed(key);
    }

    computed(key, dependencies, computeFn) {
        if (!Array.isArray(dependencies)) {
            throw new Error('Dependencies must be an array');
        }

        this.computed.set(key, { dependencies, computeFn });

        dependencies.forEach(dep => {
            this.subscribe(dep, () => {
                const newValue = computeFn(this.state);
                if (this.state[key] !== newValue) {
                    this.state[key] = newValue;
                }
            });
        });

        this.state[key] = computeFn(this.state);
        return this.state[key];
    }

    updateComputed(changedKey) {
        this.computed.forEach(({ dependencies, computeFn }, key) => {
            if (dependencies.includes(changedKey)) {
                const newValue = computeFn(this.state);
                if (this.state[key] !== newValue) {
                    this.state[key] = newValue;
                }
            }
        });
    }

    getState() {
        return { ...this.state };
    }
}

module.exports = ReactiveStore;

