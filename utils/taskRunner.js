// Advanced task runner with dependencies
class TaskRunner {
    constructor() {
        this.tasks = new Map();
        this.results = new Map();
        this.executionOrder = [];
    }

    task(name, dependencies = [], taskFn) {
        if (typeof taskFn !== 'function') {
            throw new Error('Task function must be provided');
        }
        this.tasks.set(name, { dependencies, taskFn, executed: false });
        return this;
    }

    async run(targetTask = null) {
        this.results.clear();
        this.executionOrder = [];

        const tasksToRun = targetTask
            ? this.getTaskDependencies(targetTask)
            : Array.from(this.tasks.keys());

        this.tasks.forEach(task => {
            task.executed = false;
        });

        for (const taskName of tasksToRun) {
            await this.executeTask(taskName);
        }

        return {
            results: new Map(this.results),
            executionOrder: [...this.executionOrder]
        };
    }

    async executeTask(taskName) {
        const task = this.tasks.get(taskName);
        if (!task) {
            throw new Error(`Task ${taskName} not found`);
        }
        if (task.executed) {
            return;
        }

        for (const dep of task.dependencies) {
            await this.executeTask(dep);
        }

        const result = await task.taskFn(this.results);
        this.results.set(taskName, result);
        task.executed = true;
        this.executionOrder.push(taskName);
    }

    getTaskDependencies(taskName, visited = new Set()) {
        if (visited.has(taskName)) {
            return [];
        }
        visited.add(taskName);

        const task = this.tasks.get(taskName);
        if (!task) {
            throw new Error(`Task ${taskName} not found`);
        }

        let dependencies = [taskName];
        for (const dep of task.dependencies) {
            dependencies = [...this.getTaskDependencies(dep, visited), ...dependencies];
        }

        return [...new Set(dependencies)];
    }

    visualize() {
        const graph = {};
        this.tasks.forEach((task, name) => {
            graph[name] = [...task.dependencies];
        });
        return graph;
    }

    clear() {
        this.tasks.clear();
        this.results.clear();
        this.executionOrder = [];
    }
}

module.exports = TaskRunner;

