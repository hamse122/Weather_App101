// worker-pool.js
const { Worker } = require('worker_threads');
const path = require('path');
const { cpus } = require('os');
const { randomUUID } = require('crypto');

class WorkerPool {
    constructor(workerPath, options = {}) {
        this.workerPath = path.resolve(workerPath);
        this.size = options.size || cpus().length;
        this.taskTimeout = options.taskTimeout || 0; // 0 = no timeout

        this.workers = new Set();
        this.idleWorkers = [];
        this.queue = [];
        this.activeTasks = new Map();

        this._init();
    }

    _init() {
        for (let i = 0; i < this.size; i++) {
            this._spawnWorker();
        }
    }

    _spawnWorker() {
        const worker = new Worker(this.workerPath);

        worker.on('message', msg => this._handleMessage(worker, msg));
        worker.on('error', err => this._handleFailure(worker, err));
        worker.on('exit', code => {
            this.workers.delete(worker);
            this._removeIdle(worker);
            if (code !== 0) this._spawnWorker(); // auto-respawn
        });

        this.workers.add(worker);
        this.idleWorkers.push(worker);
    }

    _handleMessage(worker, { id, result, error }) {
        const task = this.activeTasks.get(id);
        if (!task) return;

        clearTimeout(task.timeout);
        this.activeTasks.delete(id);

        error ? task.reject(error) : task.resolve(result);
        this._release(worker);
    }

    _handleFailure(worker, err) {
        for (const [id, task] of this.activeTasks) {
            if (task.worker === worker) {
                task.reject(err);
                clearTimeout(task.timeout);
                this.activeTasks.delete(id);
            }
        }
        this._removeIdle(worker);
    }

    _removeIdle(worker) {
        this.idleWorkers = this.idleWorkers.filter(w => w !== worker);
    }

    _release(worker) {
        this.idleWorkers.push(worker);
        this._process();
    }

    execute(data, options = {}) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                id: randomUUID(),
                data,
                resolve,
                reject,
                timeoutMs: options.timeout ?? this.taskTimeout
            });
            this._process();
        });
    }

    _process() {
        while (this.queue.length && this.idleWorkers.length) {
            const task = this.queue.shift();
            const worker = this.idleWorkers.shift();

            const payload = { id: task.id, data: task.data };

            let timeout;
            if (task.timeoutMs > 0) {
                timeout = setTimeout(() => {
                    this.activeTasks.delete(task.id);
                    task.reject(new Error('Task timeout'));
                    this._release(worker);
                }, task.timeoutMs);
            }

            this.activeTasks.set(task.id, { ...task, worker, timeout });
            worker.postMessage(payload);
        }
    }

    async drain() {
        while (this.queue.length || this.activeTasks.size) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    async terminate() {
        await this.drain();
        await Promise.all([...this.workers].map(w => w.terminate()));
        this.workers.clear();
        this.idleWorkers.length = 0;
        this.queue.length = 0;
        this.activeTasks.clear();
    }
}

module.exports = WorkerPool;
