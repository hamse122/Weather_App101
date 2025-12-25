class TaskRunner {
    constructor(options = {}) {
        this.tasks = new Map();
        this.results = new Map();
        this.executionOrder = [];

        this.options = {
            parallel: true,
            failFast: true,
            ...options
        };
    }

    task(
        name,
        dependencies = [],
        taskFn,
        {
            retries = 0,
            timeout = null,
            before = null,
            after = null
        } = {}
    ) {
        if (typeof taskFn !== 'function') {
            throw new Error('Task function must be provided');
        }

        this.tasks.set(name, {
            name,
            dependencies,
            taskFn,
            retries,
            timeout,
            before,
            after,
            executed: false
        });

        return this;
    }

    async run(target = null) {
        this.results.clear();
        this.executionOrder = [];

        const order = this.topologicalSort(target);

        for (const task of order) {
            task.executed = false;
        }

        if (this.options.parallel) {
            await this.runParallel(order);
        } else {
            for (const task of order) {
                await this.executeTask(task);
            }
        }

        return {
            results: new Map(this.results),
            executionOrder: [...this.executionOrder]
        };
    }

    async runParallel(tasks) {
        const pending = new Map(tasks.map(t => [t.name, t]));

        while (pending.size) {
            const ready = [...pending.values()].filter(t =>
                t.dependencies.every(d => this.results.has(d))
            );

            if (!ready.length) {
                throw new Error('Deadlock detected (cyclic dependency)');
            }

            await Promise.all(
                ready.map(async task => {
                    await this.executeTask(task);
                    pending.delete(task.name);
                })
            );
        }
    }

    async executeTask(task) {
        if (task.executed) return;

        let attempts = 0;

        while (true) {
            try {
                if (task.before) await task.before(this.results);

                const result = await this.withTimeout(
                    task.taskFn(this.results),
                    task.timeout
                );

                if (task.after) await task.after(result, this.results);

                this.results.set(task.name, result);
                task.executed = true;
                this.executionOrder.push(task.name);
                return;
            } catch (err) {
                attempts++;
                if (attempts > task.retries) {
                    if (this.options.failFast) throw err;
                    this.results.set(task.name, err);
                    return;
                }
            }
        }
    }

    withTimeout(promise, ms) {
        if (!ms) return promise;

        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Task timeout')), ms)
            )
        ]);
    }

    topologicalSort(target = null) {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (name) => {
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected at ${name}`);
            }
            if (visited.has(name)) return;

            const task = this.tasks.get(name);
            if (!task) throw new Error(`Task ${name} not found`);

            visiting.add(name);
            for (const dep of task.dependencies) {
                visit(dep);
            }
            visiting.delete(name);
            visited.add(name);
            order.push(task);
        };

        if (target) {
            visit(target);
        } else {
            this.tasks.forEach((_, name) => visit(name));
        }

        return order;
    }

    visualize() {
        return Object.fromEntries(
            [...this.tasks.entries()].map(([name, task]) => [
                name,
                [...task.dependencies]
            ])
        );
    }

    clear() {
        this.tasks.clear();
        this.results.clear();
        this.executionOrder = [];
    }
}

module.exports = TaskRunner;
