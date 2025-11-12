// Worker thread pool (Node.js)
const { Worker } = require('worker_threads');
const path = require('path');
const { cpus } = require('os');

class WorkerPool {
    constructor(workerPath, size = cpus().length) {
        this.workerPath = path.resolve(workerPath);
        this.size = size;
        this.workers = [];
        this.tasks = [];
        this.availableWorkers = [];

        this.initWorkers();
    }

    initWorkers() {
        for (let i = 0; i < this.size; i++) {
            const worker = new Worker(this.workerPath);
            worker.busy = false;
            worker.id = i;

            const markAvailable = () => {
                worker.busy = false;
                if (!this.availableWorkers.includes(worker)) {
                    this.availableWorkers.push(worker);
                }
                this.processNextTask();
            };

            worker.on('message', markAvailable);
            worker.on('error', error => {
                console.error(`Worker ${i} error:`, error);
                markAvailable();
            });

            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
    }

    async execute(taskData) {
        return new Promise((resolve, reject) => {
            this.tasks.push({ taskData, resolve, reject });
            this.processNextTask();
        });
    }

    processNextTask() {
        if (this.tasks.length === 0 || this.availableWorkers.length === 0) {
            return;
        }

        const task = this.tasks.shift();
        const worker = this.availableWorkers.shift();
        worker.busy = true;

        const cleanup = () => {
            worker.removeListener('message', onMessage);
            worker.removeListener('error', onError);
        };

        const onMessage = result => {
            cleanup();
            task.resolve(result);
            worker.emit('message', result);
        };

        const onError = error => {
            cleanup();
            task.reject(error);
            worker.emit('error', error);
        };

        worker.once('message', onMessage);
        worker.once('error', onError);
        worker.postMessage(task.taskData);
    }

    async drain() {
        while (this.tasks.length > 0 || this.workers.some(worker => worker.busy)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.availableWorkers = [];
        this.tasks = [];
    }
}

module.exports = WorkerPool;

