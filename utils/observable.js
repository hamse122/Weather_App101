// Observable pattern implementation
class Observable {
    constructor() {
        this.observers = new Set();
    }

    subscribe(observer) {
        this.observers.add(observer);
        return () => this.unsubscribe(observer);
    }

    unsubscribe(observer) {
        this.observers.delete(observer);
    }

    notify(data) {
        this.observers.forEach(observer => {
            if (typeof observer === 'function') {
                observer(data);
            } else if (observer && typeof observer.update === 'function') {
                observer.update(data);
            }
        });
    }

    clear() {
        this.observers.clear();
    }

    get observerCount() {
        return this.observers.size;
    }
}

module.exports = Observable;

