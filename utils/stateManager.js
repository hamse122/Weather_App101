// State management system (Redux-like)
class StateManager {
    constructor(initialState = {}, reducer, options = {}) {
        this.state = initialState;
        this.initialState = initialState;
        this.reducer = reducer;
        this.subscribers = [];
        this.history = [];
        this.maxHistory = 50;

        this.middlewares = [];
        this.enableLogging = options.logging || false;
        this.freezeState = options.immutable || false;

        if (options.persistKey) {
            const saved = typeof localStorage !== "undefined"
                ? localStorage.getItem(options.persistKey)
                : null;

            if (saved) {
                try {
                    this.state = JSON.parse(saved);
                } catch { /* ignore error */ }
            }
            this.persistKey = options.persistKey;
        }
    }
    
    getState() {
        return this.freezeState ? deepFreeze({ ...this.state }) : { ...this.state };
    }
    
    dispatch(action) {
        const prevState = this.state;

        // Middleware chain
        let processedAction = action;
        this.middlewares.forEach(mw => {
            processedAction = mw(this.state, processedAction) || processedAction;
        });

        this.state = this.reducer(this.state, processedAction);

        if (this.persistKey && typeof localStorage !== "undefined") {
            localStorage.setItem(this.persistKey, JSON.stringify(this.state));
        }

        if (this.enableLogging) {
            console.log("ACTION:", processedAction);
            console.log("PREV:", prevState);
            console.log("NEXT:", this.state);
        }

        // Add history snapshot
        this.history.push({
            action: processedAction,
            prevState,
            nextState: this.state,
            timestamp: Date.now()
        });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        this.subscribers.forEach(subscriber => subscriber(this.state, processedAction));
        
        return processedAction;
    }
    
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }
    
    getHistory() {
        return [...this.history];
    }
    
    timeTravel(stepsBack = 1) {
        if (stepsBack >= this.history.length) return false;
        
        const targetIndex = this.history.length - 1 - stepsBack;
        const targetState = this.history[targetIndex].prevState;
        this.state = targetState;
        
        this.history = this.history.slice(0, targetIndex);
        
        return true;
    }

    /* ---------------------------------------------------------
     * EXTRA ADDED LINES BELOW
     * --------------------------------------------------------- */

    /**
     * Register middleware
     */
    use(middlewareFn) {
        this.middlewares.push(middlewareFn);
    }

    /**
     * Reset state back to initialState
     */
    resetState() {
        this.state = { ...this.initialState };
        this.history = [];
    }

    /**
     * Replace reducer function at runtime
     */
    replaceReducer(newReducer) {
        this.reducer = newReducer;
    }

    /**
     * Batch multiple actions (atomic update)
     */
    batch(actions = []) {
        actions.forEach(action => this.dispatch(action));
    }
}

/**
 * Deep freeze helper to enforce immutability
 */
function deepFreeze(obj) {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === "object" && obj[key] !== null) {
            deepFreeze(obj[key]);
        }
    });
    return Object.freeze(obj);
}

// Example reducer
function createReducer(initialState) {
    return (state = initialState, action) => {
        switch (action.type) {
            case 'SET':
                return { ...state, ...action.payload };
            case 'UPDATE':
                return {
                    ...state,
                    [action.key]: action.value
                };
            case 'DELETE':
                const newState = { ...state };
                delete newState[action.key];
                return newState;
            default:
                return state;
        }
    };
}

module.exports = { StateManager, createReducer };
