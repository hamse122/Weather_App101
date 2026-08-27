/**
 * Advanced TaskRunner
 * - Parallel + sequential
 * - Dependency-aware scheduling
 * - Fail-fast safe
 * - Observable lifecycle
 */

class TaskRunner {
    constructor(options = {}) {
        this.tasks = new Map();
        this.results = new Map();
        this.errors = new Map();
        this.executionOrder = [];

        this.options = {
            parallel: true,
            concurrency: Infinity,
            failFast: true,
            ...options
        };

        this.running = new Set();
        this.cancelled = false;
        this.events = {};
    }

    // =====================
    // TASK REGISTRATION
    // =====================
    task(
        name,
        dependencies = [],
        fn,
        {
            retries = 0,
            timeout = null,
            before = null,
            after = null,
            skip = null
        } = {}
    ) {
        if (typeof fn !== 'function') {
            throw new Error(`Task "${name}" must have a function`);
        }

        this.tasks.set(name, {
            name,
            dependencies,
            fn,
            retries,
            timeout,
            before,
            after,
            skip,
            status: 'pending'
        });

        return this;
    }

// =====================
// EVENTS
// =====================

on(event, handler, { once = false, priority = 0, signal } = {}) {
    if (typeof event !== "string" && typeof event !== "symbol") {
        throw new TypeError("Event name must be a string or symbol");
    }

    if (typeof handler !== "function") {
        throw new TypeError("Event handler must be a function");
    }

    if (signal?.aborted) {
        return () => {};
    }

    const listener = {
        handler,
        once: !!once,
        priority: Number.isFinite(priority) ? priority : 0,
        signal,
        abortHandler: null
    };

    (this.events[event] ??= []).push(listener);

    this.events[event].sort((a, b) => b.priority - a.priority);

    if (signal) {
        listener.abortHandler = () => this.off(event, handler);
        signal.addEventListener("abort", listener.abortHandler, { once: true });
    }

    return () => this.off(event, handler);
}

off(event, handler) {
    const listeners = this.events[event];
    if (!listeners?.length) return this;

    const removed = listeners.filter(
        listener => listener.handler === handler
    );

    for (const listener of removed) {
        listener.signal?.removeEventListener(
            "abort",
            listener.abortHandler
        );
    }

    this.events[event] = listeners.filter(
        listener => listener.handler !== handler
    );

    if (this.events[event].length === 0) {
        delete this.events[event];
    }

    return this;
}

once(event, handler, options = {}) {
    return this.on(event, handler, {
        ...options,
        once: true
    });
}

async emit(event, payload, options = {}) {
    const {
        parallel = false,
        throwOnError = false,
        signal
    } = options;

    if (signal?.aborted) {
        throw new Error("Event emission aborted");
    }

    const directListeners = [...(this.events[event] ?? [])];
    const wildcardListeners =
        event === "*" ? [] : [...(this.events["*"] ?? [])];

    const listeners = [
        ...directListeners.map(listener => ({
            ...listener,
            wildcard: false
        })),
        ...wildcardListeners.map(listener => ({
            ...listener,
            wildcard: true
        }))
    ];

    const errors = [];

    const execute = async listener => {
        if (signal?.aborted) {
            throw new Error("Event emission aborted");
        }

        try {
            const result = listener.wildcard
                ? await listener.handler(event, payload)
                : await listener.handler(payload);

            if (listener.once) {
                this.off(
                    listener.wildcard ? "*" : event,
                    listener.handler
                );
            }

            return result;
        } catch (err) {
            errors.push(err);

            if (throwOnError) {
                throw err;
            }

            console.error(`[Event:${String(event)}]`, err);
            return undefined;
        }
    };

    let results;

    if (parallel) {
        results = await Promise.all(
            listeners.map(listener => execute(listener))
        );
    } else {
        results = [];

        for (const listener of listeners) {
            results.push(await execute(listener));
        }
    }

    return {
        count: listeners.length,
        results,
        errors
    };
}

    // =====================
    // RUNNER
    // =====================
    async run(target = null) {
        this.#validateGraph();

        const order = this.#topologicalSort(target);
        const pending = new Set(order.map(t => t.name));

        while (pending.size && !this.cancelled) {
            const ready = [...pending]
                .map(n => this.tasks.get(n))
                .filter(t =>
                    t.dependencies.every(d => this.results.has(d)) &&
                    this.running.size < this.options.concurrency
                );

            if (!ready.length) break;

            await Promise.all(
                ready.map(task => this.#execute(task, pending))
            );
        }

        return this.summary();
    }

    async #execute(task, pending) {
        if (this.cancelled) return;

        this.running.add(task.name);
        task.status = 'running';
        this.emit('start', task.name);

        let attempt = 0;

        while (attempt <= task.retries) {
            try {
                if (task.skip?.(this.results)) {
                    task.status = 'skipped';
                    this.emit('skip', task.name);
                    break;
                }

                if (task.before) await task.before(this.results);

                const start = Date.now();
                const result = await this.#withTimeout(
                    task.fn(this.results),
                    task.timeout
                );

                if (task.after) await task.after(result, this.results);

                this.results.set(task.name, result);
                task.status = 'success';
                this.executionOrder.push(task.name);

                this.emit('success', {
                    name: task.name,
                    duration: Date.now() - start
                });

                break;
            } catch (err) {
                attempt++;
                if (attempt > task.retries) {
                    task.status = 'failed';
                    this.errors.set(task.name, err);
                    this.emit('fail', { name: task.name, error: err });

                    if (this.options.failFast) {
                        this.cancelled = true;
                        throw err;
                    }
                }
            }
        }

        pending.delete(task.name);
        this.running.delete(task.name);
    }

    // =====================
    // HELPERS
    // =====================
    #withTimeout(promise, ms) {
        if (!ms) return promise;
        return Promise.race([
            promise,
            new Promise((_, r) =>
                setTimeout(() => r(new Error('Task timeout')), ms)
            )
        ]);
    }

    #validateGraph() {
        this.#topologicalSort(); // throws if invalid
    }

    #topologicalSort(target = null) {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (name) => {
            if (visiting.has(name)) {
                throw new Error(`Circular dependency at "${name}"`);
            }
            if (visited.has(name)) return;

            const task = this.tasks.get(name);
            if (!task) throw new Error(`Unknown task "${name}"`);

            visiting.add(name);
            task.dependencies.forEach(visit);
            visiting.delete(name);

            visited.add(name);
            order.push(task);
        };

        target
            ? visit(target)
            : [...this.tasks.keys()].forEach(visit);

        return order;
    }

    // =====================
    // UTIL
    // =====================
    cancel() {
        this.cancelled = true;
    }

    visualize() {
        return Object.fromEntries(
            [...this.tasks.entries()].map(([k, v]) => [
                k,
                [...v.dependencies]
            ])
        );
    }

    summary() {
        return {
            results: new Map(this.results),
            errors: new Map(this.errors),
            executionOrder: [...this.executionOrder],
            cancelled: this.cancelled
        };
    }

    clear() {
        this.tasks.clear();
        this.results.clear();
        this.errors.clear();
        this.executionOrder = [];
        this.running.clear();
        this.cancelled = false;
    }
}

module.exports = TaskRunner;
