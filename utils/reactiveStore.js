/**
 * Advanced Reactive Store
 * Lightweight reactive engine with computed & batching
 */

class ReactiveStore {
  constructor(initialState = {}) {
    this._subscribers = new Map();
    this._computed = new Map();
    this._dependencies = new Map();
    this._pending = new Set();
    this._isBatching = false;

    this.state = this._createReactive({ ...initialState });
  }

  /* ---------------------------------- */
  /* Deep Reactive Proxy */
  /* ---------------------------------- */
  _createReactive(obj, path = '') {
    return new Proxy(obj, {
      get: (target, prop) => {
        const value = target[prop];
        if (typeof value === 'object' && value !== null) {
          return this._createReactive(value, `${path}${prop}.`);
        }
        return value;
      },

      set: (target, prop, value) => {
        const oldValue = target[prop];
        if (oldValue === value) return true;

        target[prop] = value;
        this._queueUpdate(prop);
        return true;
      }
    });
  }

  /* ---------------------------------- */
  /* Core API */
  /* ---------------------------------- */
  set(key, value) {
    this.state[key] = value;
  }

  get(key) {
    return this.state[key];
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /* ---------------------------------- */
  /* Subscriptions */
  /* ---------------------------------- */
  subscribe(key, callback) {
    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, new Set());
    }

    this._subscribers.get(key).add(callback);

    return () => this.unsubscribe(key, callback);
  }

  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  unsubscribe(key, callback) {
    const set = this._subscribers.get(key);
    if (!set) return;

    set.delete(callback);
    if (set.size === 0) {
      this._subscribers.delete(key);
    }
  }

  /* ---------------------------------- */
  /* Computed Properties */
  /* ---------------------------------- */
  defineComputed(key, dependencies, computeFn) {
    if (!Array.isArray(dependencies)) {
      throw new Error('Dependencies must be an array');
    }

    this._computed.set(key, {
      dependencies,
      computeFn,
      cachedValue: undefined
    });

    dependencies.forEach(dep => {
      if (!this._dependencies.has(dep)) {
        this._dependencies.set(dep, new Set());
      }
      this._dependencies.get(dep).add(key);
    });

    // Initial compute
    this._recompute(key);
  }

  _recompute(key) {
    const entry = this._computed.get(key);
    if (!entry) return;

    const newValue = entry.computeFn(this.state);

    if (entry.cachedValue !== newValue) {
      entry.cachedValue = newValue;
      this.state[key] = newValue;
    }
  }

  /* ---------------------------------- */
  /* Batched Updates */
  /* ---------------------------------- */
  _queueUpdate(key) {
    this._pending.add(key);

    if (!this._isBatching) {
      this._isBatching = true;
      Promise.resolve().then(() => this._flush());
    }
  }

  _flush() {
    const changedKeys = [...this._pending];
    this._pending.clear();
    this._isBatching = false;

    changedKeys.forEach(key => {
      this._notify(key);
      this._updateComputed(key);
    });
  }

  /* ---------------------------------- */
  /* Notify Subscribers */
  /* ---------------------------------- */
  _notify(key) {
    const run = (k) => {
      const subs = this._subscribers.get(k);
      if (!subs) return;

      subs.forEach(cb => {
        try {
          cb(this.state[k], key);
        } catch (err) {
          console.error('ReactiveStore subscriber error:', err);
        }
      });
    };

    run(key);
    run('*');
  }

  /* ---------------------------------- */
  /* Computed Dependency Updates */
  /* ---------------------------------- */
  _updateComputed(changedKey) {
    const dependents = this._dependencies.get(changedKey);
    if (!dependents) return;

    dependents.forEach(key => {
      this._recompute(key);
    });
  }
}

module.exports = ReactiveStore;
