// worker-pool.js
const { Worker } = require('worker_threads');
const path = require('path');
const { cpus } = require('os');
const { randomUUID } = require('crypto');

class WorkerPool {
    constructor(workerPath, options = {}) {
        this.workerPath = path.resolve(workerPath);

        this.size = options.size ?? cpus().length;
        this.taskTimeout = options.taskTimeout ?? 0;
        this.maxQueue = options.maxQueue ?? Infinity;
        this.killOnTimeout = options.killOnTimeout ?? true;

        this.workers = new Set();
        this.idleWorkers = [];
        this.queue = [];
        this.activeTasks = new Map();
        this.closing = false;

        this._init();
    }

    /* ==============================
       Worker lifecycle
    ============================== */

    _init() {
        for (let i = 0; i < this.size; i++) {
            this._spawnWorker();
        }
    }

    _spawnWorker() {
        const worker = new Worker(this.workerPath);

        worker.on('message', msg => this._handleMessage(worker, msg));
        worker.on('error', err => this._handleWorkerError(worker, err));
        worker.on('exit', code => this._handleWorkerExit(worker, code));

        this.workers.add(worker);
        this.idleWorkers.push(worker);
    }

    _handleWorkerExit(worker, code) {
        this.workers.delete(worker);
        this._removeIdle(worker);

        // Fail active task if worker died
        for (const [id, task] of this.activeTasks) {
            if (task.worker === worker) {
                task.reject(new Error('Worker exited unexpectedly'));
                clearTimeout(task.timeout);
                this.activeTasks.delete(id);
            }
        }

        if (!this.closing && code !== 0) {
            this._spawnWorker();
        }
    }

    _handleWorkerError(worker, err) {
        this._handleWorkerExit(worker, 1);
    }

    /* ==============================
       Task handling
    ============================== */

    execute(data, options = {}) {
        if (this.closing) {
            return Promise.reject(new Error('WorkerPool is shutting down'));
        }

        if (this.queue.length >= this.maxQueue) {
            return Promise.reject(new Error('WorkerPool queue limit reached'));
        }

        return new Promise((resolve, reject) => {
            const id = randomUUID();

            const task = {
                id,
                data,
                resolve,
                reject,
                timeoutMs: options.timeout ?? this.taskTimeout,
                signal: options.signal
            };

            if (task.signal?.aborted) {
                return reject(new Error('Task aborted'));
            }

            task.abortHandler = () => {
                this._cancelTask(id, new Error('Task aborted'));
            };

            task.signal?.addEventListener('abort', task.abortHandler, { once: true });

            this.queue.push(task);
            this._process();
        });
    }

    _process() {
        while (this.queue.length && this.idleWorkers.length) {
            const task = this.queue.shift();
            const worker = this.idleWorkers.shift();

            let timeout;
            if (task.timeoutMs > 0) {
                timeout = setTimeout(() => {
                    this._handleTimeout(task, worker);
                }, task.timeoutMs);
            }

            this.activeTasks.set(task.id, {
                ...task,
                worker,
                timeout
            });

            worker.postMessage({ id: task.id, data: task.data });
        }
    }

    _handleMessage(worker, { id, result, error }) {
        const task = this.activeTasks.get(id);
        if (!task) return;

        clearTimeout(task.timeout);
        task.signal?.removeEventListener('abort', task.abortHandler);

        this.activeTasks.delete(id);
        error ? task.reject(error) : task.resolve(result);

        this._release(worker);
    }

    _handleTimeout(task, worker) {
        this.activeTasks.delete(task.id);
        task.reject(new Error('Task timeout'));

        if (this.killOnTimeout) {
            worker.terminate();
        } else {
            this._release(worker);
        }
    }

    _cancelTask(id, error) {
        const task = this.activeTasks.get(id);
        if (!task) return;

        clearTimeout(task.timeout);
        this.activeTasks.delete(id);
        task.reject(error);
        this._release(task.worker);
    }

    _release(worker) {
        if (!this.closing && this.workers.has(worker)) {
            this.idleWorkers.push(worker);
            this._process();
        }
    }

    _removeIdle(worker) {
        this.idleWorkers = this.idleWorkers.filter(w => w !== worker);
    }

    /* ==============================
       Shutdown
    ============================== */

    async drain() {
        while (this.queue.length || this.activeTasks.size) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    async terminate() {
        this.closing = true;
        await this.drain();

        await Promise.all([...this.workers].map(w => w.terminate()));

        this.workers.clear();
        this.idleWorkers.length = 0;
        this.queue.length = 0;
        this.activeTasks.clear();
    }
}

module.exports = WorkerPool;
