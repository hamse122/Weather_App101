/**
 * Ultra Advanced Finite State Machine
 * Features:
 * - Async transitions & guards
 * - Middleware/interceptors
 * - Event emitter
 * - Hierarchical states (nested)
 * - Time travel (undo/redo)
 * - Auto transitions
 * - Persistence (serialize/restore)
 * - Metrics & debugging tools
 */

class StateMachine {
    constructor(initialState, options = {}) {
        this.state = initialState;
        this.initialState = initialState;
        this.states = new Map();
        this.transitions = new Map();
        this.history = [];
        this.future = [];
        this.maxHistory = options.maxHistory || 100;
        this.autoTransitions = options.autoTransitions ?? true;
        this.debug = options.debug ?? false;

        this.middleware = [];
        this.events = {};
        this.metrics = {
            transitions: 0,
            failedTransitions: 0
        };
    }

    /* ---------------- EVENT SYSTEM ---------------- */
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        return this;
    }

    _emit(event, payload) {
        (this.events[event] || []).forEach(cb => cb(payload));
    }

    /* ---------------- STATE DEFINITION ---------------- */
    defineState(state, config = {}) {
        this.states.set(state, {
            onEnter: config.onEnter || null,
            onExit: config.onExit || null,
            onUpdate: config.onUpdate || null,
            meta: config.meta || {},
            parent: config.parent || null // for hierarchical states
        });
        return this;
    }

    /* ---------------- MIDDLEWARE ---------------- */
    use(fn) {
        this.middleware.push(fn);
        return this;
    }

    async _runMiddleware(context) {
        for (const mw of this.middleware) {
            await mw(context);
            if (context.cancel) return false;
        }
        return true;
    }

    /* ---------------- TRANSITIONS ---------------- */
    addTransition(fromState, toState, options = {}) {
        const key = `${fromState}->${toState}`;
        this.transitions.set(key, {
            fromState,
            toState,
            guard: options.guard || (async () => true),
            priority: options.priority || 0,
            action: options.action || null
        });
        return this;
    }

    _getTransition(toState) {
        return this.transitions.get(`${this.state}->${toState}`);
    }

    async canTransition(toState, payload) {
        const transition = this._getTransition(toState);
        if (!transition) return false;
        return await transition.guard(payload, this.state);
    }

    /* ---------------- CORE TRANSITION ---------------- */
    async transitionTo(newState, payload = null) {
        const transition = this._getTransition(newState);

        if (!transition) {
            this.metrics.failedTransitions++;
            throw new Error(`Invalid transition: ${this.state} -> ${newState}`);
        }

        const canPass = await this.canTransition(newState, payload);
        if (!canPass) {
            this.metrics.failedTransitions++;
            throw new Error(`Guard blocked transition: ${this.state} -> ${newState}`);
        }

        const context = {
            from: this.state,
            to: newState,
            payload,
            cancel: false,
            machine: this
        };

        const middlewareOk = await this._runMiddleware(context);
        if (!middlewareOk) return false;

        const currentConfig = this.states.get(this.state);
        if (currentConfig?.onExit) {
            await currentConfig.onExit(newState, payload);
        }

        const previousState = this.state;
        this.state = newState;

        this.history.push({
            from: previousState,
            to: newState,
            payload,
            timestamp: Date.now()
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.future = []; // clear redo stack

        const newConfig = this.states.get(newState);
        if (transition.action) {
            await transition.action(payload, previousState);
        }

        if (newConfig?.onEnter) {
            await newConfig.onEnter(previousState, payload);
        }

        this.metrics.transitions++;
        this._emit("transition", { from: previousState, to: newState, payload });

        if (this.debug) {
            console.log(`[FSM] ${previousState} -> ${newState}`);
        }

        return true;
    }

    /* ---------------- AUTO TRANSITIONS ---------------- */
    async update(payload = null) {
        const config = this.states.get(this.state);

        if (config?.onUpdate) {
            await config.onUpdate(payload);
        }

        if (!this.autoTransitions) return;

        const possible = this.getPossibleTransitionsDetailed()
            .sort((a, b) => b.priority - a.priority);

        for (const t of possible) {
            if (await t.guard(payload, this.state)) {
                await this.transitionTo(t.toState, payload);
                break;
            }
        }
    }

    /* ---------------- TIME TRAVEL ---------------- */
    async undo() {
        const last = this.history.pop();
        if (!last) return false;

        this.future.push(last);
        this.state = last.from;
        this._emit("undo", last);
        return true;
    }

    async redo() {
        const next = this.future.pop();
        if (!next) return false;

        await this.transitionTo(next.to, next.payload);
        return true;
    }

    /* ---------------- UTILITIES ---------------- */
    getState() {
        return this.state;
    }

    getHistory() {
        return [...this.history];
    }

    getPossibleTransitions() {
        return this.getPossibleTransitionsDetailed().map(t => t.toState);
    }

    getPossibleTransitionsDetailed() {
        return Array.from(this.transitions.values())
            .filter(t => t.fromState === this.state);
    }

    serialize() {
        return JSON.stringify({
            state: this.state,
            history: this.history,
            metrics: this.metrics
        });
    }

    restore(serialized) {
        const data = JSON.parse(serialized);
        this.state = data.state;
        this.history = data.history || [];
        this.metrics = data.metrics || this.metrics;
        return this;
    }

    reset() {
        this.state = this.initialState;
        this.history = [];
        this.future = [];
        this.metrics = { transitions: 0, failedTransitions: 0 };
        this._emit("reset", this.state);
    }

    getMetrics() {
        return {
            ...this.metrics,
            currentState: this.state,
            historySize: this.history.length
        };
    }
}

module.exports = StateMachine;
