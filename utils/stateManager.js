// State management system (Redux-like)
class StateManager {
    constructor(initialState = {}, reducer) {
        this.state = initialState;
        this.reducer = reducer;
        this.subscribers = [];
        this.history = [];
        this.maxHistory = 50;
    }
    
    getState() {
        return { ...this.state };
    }
    
    dispatch(action) {
        const prevState = this.state;
        this.state = this.reducer(this.state, action);
        
        // Add to history
        this.history.push({
            action,
            prevState,
            nextState: this.state,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        // Notify subscribers
        this.subscribers.forEach(subscriber => subscriber(this.state, action));
        
        return action;
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
        
        // Truncate history
        this.history = this.history.slice(0, targetIndex);
        
        return true;
    }
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

