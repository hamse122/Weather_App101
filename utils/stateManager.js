// Advanced Redux-like State Manager
class StateManager {
    constructor(reducer, options = {}) {
        this.reducer = reducer;
        this.state = options.initialState || {};
        this.initialState = structuredClone(this.state);

        this.subscribers = new Set();
        this.middlewares = [];
        this.persistKey = options.persistKey;

        this.history = [];
        this.future = [];
        this.maxHistory = options.maxHistory || 50;

        this.devMode = options.devMode ?? true;
        this.enableLogging = options.logging ?? false;

        this._rehydrate();
    }

    /* ---------------------------------- */
    /* State Access */
    /* ---------------------------------- */
    getState() {
        const snapshot = structuredClone(this.state);
        return this.devMode ? deepFreeze(snapshot) : snapshot;
    }

    /* ---------------------------------- */
    /* Dispatch */
    /* ---------------------------------- */
    dispatch(action) {
        if (!action || typeof action.type !== "string") {
            throw new Error("Invalid action. Must have a type.");
        }

        const prevState = this.state;

        const chain = this._composeMiddleware();
        const nextState = chain(action);

        if (Object.is(prevState, nextState)) return action;

        this._commit(prevState, action, nextState);
        return action;
    }

    /* ---------------------------------- */
    /* Middleware */
    /* ---------------------------------- */
    use(middleware) {
        this.middlewares.push(middleware);
    }

    _composeMiddleware() {
        let dispatch = (action) => this.reducer(this.state, action);

        [...this.middlewares].reverse().forEach(mw => {
            dispatch = mw(this)(dispatch);
        });

        return dispatch;
    }

    /* ---------------------------------- */
    /* Commit */
    /* ---------------------------------- */
    _commit(prevState, action, nextState) {
        this.state = nextState;
        this.future = [];

        this.history.push(prevState);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this._persist();

        if (this.enableLogging) {
            console.group(action.type);
            console.log("Action:", action);
            console.log("Prev:", prevState);
            console.log("Next:", nextState);
            console.groupEnd();
        }

        this.subscribers.forEach(fn => {
            try {
                fn(this.state, action);
            } catch (err) {
                console.error("Subscriber error:", err);
            }
        });
    }

    /* ---------------------------------- */
    /* Undo / Redo */
    /* ---------------------------------- */
    undo() {
        if (!this.history.length) return false;
        this.future.push(this.state);
        this.state = this.history.pop();
        return true;
    }

    redo() {
        if (!this.future.length) return false;
        this.history.push(this.state);
        this.state = this.future.pop();
        return true;
    }

    /* ---------------------------------- */
    /* Batch */
    /* ---------------------------------- */
    batch(actions = []) {
        actions.forEach(action => this.dispatch(action));
    }

    /* ---------------------------------- */
    /* Subscription */
    /* ---------------------------------- */
    subscribe(listener) {
        this.subscribers.add(listener);
        return () => this.subscribers.delete(listener);
    }

    /* ---------------------------------- */
    /* Persistence */
    /* ---------------------------------- */
    _persist() {
        if (!this.persistKey || typeof localStorage === "undefined") return;
        localStorage.setItem(this.persistKey, JSON.stringify(this.state));
    }

    _rehydrate() {
        if (!this.persistKey || typeof localStorage === "undefined") return;
        try {
            const saved = localStorage.getItem(this.persistKey);
            if (saved) this.state = JSON.parse(saved);
        } catch {}
    }

    /* ---------------------------------- */
    /* Utilities */
    /* ---------------------------------- */
    reset() {
        this.state = structuredClone(this.initialState);
        this.history = [];
        this.future = [];
    }

    replaceReducer(newReducer) {
        this.reducer = newReducer;
    }
}

/* ---------------------------------- */
/* Middleware Example */
const loggerMiddleware = store => next => action => {
    console.log("Dispatching:", action.type);
    return next(action);
};

/* ---------------------------------- */
/* Reducer Factory */
function createReducer(initialState, handlers) {
    return (state = initialState, action) =>
        handlers[action.type]
            ? handlers[action.type](state, action)
            : state;
}

/* ---------------------------------- */
/* Deep Freeze */
function deepFreeze(obj) {
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            typeof obj[prop] === "object" &&
            obj[prop] !== null &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return Object.freeze(obj);
}

module.exports = { StateManager, createReducer, loggerMiddleware };
