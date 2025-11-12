// Finite State Machine
class StateMachine {
    constructor(initialState) {
        this.state = initialState;
        this.states = new Map();
        this.transitions = new Map();
        this.history = [];
        this.maxHistory = 50;
    }

    defineState(state, config = {}) {
        this.states.set(state, {
            onEnter: config.onEnter,
            onExit: config.onExit,
            onUpdate: config.onUpdate
        });
        return this;
    }

    addTransition(fromState, toState, condition = () => true) {
        const key = `${fromState}-${toState}`;
        this.transitions.set(key, { fromState, toState, condition });
        return this;
    }

    canTransition(toState) {
        const key = `${this.state}-${toState}`;
        const transition = this.transitions.get(key);
        return Boolean(transition && transition.condition());
    }

    transitionTo(newState) {
        if (!this.canTransition(newState)) {
            throw new Error(`Cannot transition from ${this.state} to ${newState}`);
        }

        const currentStateConfig = this.states.get(this.state);
        if (currentStateConfig && typeof currentStateConfig.onExit === 'function') {
            currentStateConfig.onExit(newState);
        }

        this.history.push({
            from: this.state,
            to: newState,
            timestamp: Date.now()
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        const previousState = this.state;
        this.state = newState;

        const newStateConfig = this.states.get(newState);
        if (newStateConfig && typeof newStateConfig.onEnter === 'function') {
            newStateConfig.onEnter(previousState);
        }

        return this;
    }

    update() {
        const stateConfig = this.states.get(this.state);
        if (stateConfig && typeof stateConfig.onUpdate === 'function') {
            stateConfig.onUpdate();
        }
    }

    getHistory() {
        return [...this.history];
    }

    getPossibleTransitions() {
        return Array.from(this.transitions.values())
            .filter(transition => transition.fromState === this.state)
            .map(transition => transition.toState);
    }
}

module.exports = StateMachine;

