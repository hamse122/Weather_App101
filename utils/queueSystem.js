const EventEmitter = require("events");
const { randomUUID } = require("crypto");

class QueueSystem extends EventEmitter {
    constructor({
        concurrency = 1,
        maxRetries = 3,
        retryDelay = 500,
        maxRetryDelay = 30000,
        timeout = 0,
        agingInterval = 5000,
        retryJitter = true,
        maxQueueSize = Infinity,
        maxDeadLetters = 1000
    } = {}) {
        super();

        if (!Number.isInteger(concurrency) || concurrency < 1) {
            throw new TypeError("Concurrency must be a positive integer");
        }

        if (!Number.isInteger(maxRetries) || maxRetries < 0) {
            throw new TypeError("maxRetries must be a non-negative integer");
        }

        this.queues = {
            high: [],
            normal: [],
            low: []
        };

        this.deadLetterQueue = [];

        this.concurrency = concurrency;
        this.maxRetries = maxRetries;
        this.retryDelay = Math.max(0, retryDelay);
        this.maxRetryDelay = Math.max(0, maxRetryDelay);
        this.retryJitter = retryJitter;
        this.timeout = Math.max(0, timeout);
        this.maxQueueSize = maxQueueSize;
        this.maxDeadLetters = maxDeadLetters;

        this.activeCount = 0;
        this.paused = false;
        this.stopped = false;
        this.closing = false;

        this.activeTasks = new Map();
        this.taskIndex = new Map();
        this.retryTimers = new Set();

        this.metrics = {
            enqueued: 0,
            completed: 0,
            failed: 0,
            retries: 0,
            cancelled: 0,
            timedOut: 0,
            promoted: 0
        };

        this._agingTimer = this._startAging(agingInterval);
    }

    /* =================================================
       ENQUEUE
    ================================================= */

    enqueue(task, priority = "normal", options = {}) {
        if (this.stopped || this.closing) {
            throw new Error("Queue is not accepting new tasks");
        }

        if (!task || typeof task.process !== "function") {
            throw new TypeError("Task must implement process()");
        }

        if (!this.queues[priority]) {
            throw new Error(`Invalid priority: ${priority}`);
        }

        if (this.getQueueLength() >= this.maxQueueSize) {
            throw new Error("Queue capacity exceeded");
        }

        const id = randomUUID();

        const item = {
            id,
            task,
            priority,
            retries: 0,
            enqueuedAt: Date.now(),
            cancelled: false,
            signal: options.signal || null,
            delay: Math.max(0, options.delay || 0),
            timeout: options.timeout ?? this.timeout,
            metadata: options.metadata ?? null,
            lastError: null
        };

        if (item.signal?.aborted) {
            throw new Error("Task already aborted");
        }

        item.abortHandler = () => this.cancel(id);

        item.signal?.addEventListener(
            "abort",
            item.abortHandler,
            { once: true }
        );

        this.taskIndex.set(id, item);
        this.queues[priority].push(item);

        this.metrics.enqueued++;

        this.emit("enqueue", item);
        this._process();

        return id;
    }

    /* =================================================
       CANCELLATION
    ================================================= */

    cancel(id) {
        const item = this.taskIndex.get(id);

        if (!item || item.cancelled) return false;

        item.cancelled = true;

        this._removeFromQueues(item);

        const active = this.activeTasks.get(id);

        if (active) {
            active.controller.abort(
                new Error("Task cancelled")
            );
        }

        item.signal?.removeEventListener(
            "abort",
            item.abortHandler
        );

        this.taskIndex.delete(id);
        this.metrics.cancelled++;

        this.emit("cancel", item);

        return true;
    }

    _removeFromQueues(item) {
        for (const queue of Object.values(this.queues)) {
            const index = queue.indexOf(item);

            if (index !== -1) {
                queue.splice(index, 1);
            }
        }
    }

    /* =================================================
       QUEUE CONTROL
    ================================================= */

    pause() {
        if (this.paused) return this;

        this.paused = true;
        this.emit("pause");

        return this;
    }

    resume() {
        if (!this.paused) return this;

        this.paused = false;
        this.emit("resume");

        this._process();

        return this;
    }

    stop() {
        this.stopped = true;
        this.emit("stop");

        return this;
    }

    /* =================================================
       PROCESSING
    ================================================= */

    _process() {
        if (this.paused || this.stopped || this.closing) return;

        while (
            this.activeCount < this.concurrency &&
            this._hasItems()
        ) {
            const item = this._dequeue();

            if (!item) break;

            if (item.cancelled) continue;

            this.activeCount++;

            this._runItem(item)
                .catch(error => {
                    this.emit("error", error, item);
                })
                .finally(() => {
                    this.activeCount--;

                    if (
                        this.activeCount === 0 &&
                        !this._hasItems()
                    ) {
                        this.emit("idle");
                        this.emit("drain");
                    }

                    this._process();
                });
        }
    }

    /* =================================================
       TASK EXECUTION
    ================================================= */

    async _runItem(item) {
        if (item.cancelled) return;

        if (item.delay > 0) {
            await this._delay(item.delay);
        }

        if (item.cancelled) return;

        const controller = new AbortController();

        const active = {
            controller,
            startedAt: Date.now()
        };

        this.activeTasks.set(item.id, active);

        let timeoutId;

        try {
            this.emit("start", item);

            const execution = Promise.resolve().then(() =>
                item.task.process({
                    id: item.id,
                    signal: controller.signal,
                    attempt: item.retries + 1,
                    metadata: item.metadata
                })
            );

            let result;

            if (item.timeout > 0) {
                result = await Promise.race([
                    execution,
                    new Promise((_, reject) => {
                        timeoutId = setTimeout(() => {
                            controller.abort(
                                new Error("Task timeout")
                            );

                            reject(new Error("Task timeout"));
                        }, item.timeout);
                    })
                ]);
            } else {
                result = await execution;
            }

            if (item.cancelled) return;

            this.metrics.completed++;

            this.emit("success", item, result);

            return result;

        } catch (error) {
            item.lastError = error;

            if (error.message === "Task timeout") {
                this.metrics.timedOut++;
            }

            if (
                item.retries < this.maxRetries &&
                !item.cancelled &&
                !this.closing
            ) {
                await this._retry(item);
            } else if (!item.cancelled) {
                this._deadLetter(item, error);
            }

        } finally {
            clearTimeout(timeoutId);

            this.activeTasks.delete(item.id);
        }
    }

    /* =================================================
       RETRY MANAGEMENT
    ================================================= */

    async _retry(item) {
        item.retries++;

        this.metrics.retries++;

        const exponentialDelay = Math.min(
            this.retryDelay * (2 ** (item.retries - 1)),
            this.maxRetryDelay
        );

        const jitter = this.retryJitter
            ? Math.random() * Math.min(250, exponentialDelay * 0.2)
            : 0;

        this.emit("retry", item, item.retries);

        await this._delay(exponentialDelay + jitter);

        if (!item.cancelled && !this.closing) {
            this.queues[item.priority].push(item);
        }
    }

    _deadLetter(item, error) {
        this.metrics.failed++;

        const record = {
            id: item.id,
            task: item.task,
            priority: item.priority,
            retries: item.retries,
            error,
            failedAt: new Date().toISOString(),
            metadata: item.metadata
        };

        this.deadLetterQueue.push(record);

        if (this.deadLetterQueue.length > this.maxDeadLetters) {
            this.deadLetterQueue.shift();
        }

        item.signal?.removeEventListener(
            "abort",
            item.abortHandler
        );

        this.taskIndex.delete(item.id);

        this.emit("failure", record);
        this.emit("deadLetter", record);
    }

    /* =================================================
       PRIORITY & AGING
    ================================================= */

    _dequeue() {
        for (const level of ["high", "normal", "low"]) {
            const item = this.queues[level].shift();

            if (item) return item;
        }

        return null;
    }

    _hasItems() {
        return Object.values(this.queues).some(
            queue => queue.length > 0
        );
    }

    _startAging(interval) {
        if (!interval || interval <= 0) return null;

        const timer = setInterval(() => {
            const now = Date.now();

            for (const [from, to, threshold] of [
                ["low", "normal", interval],
                ["normal", "high", interval * 2]
            ]) {
                const queue = this.queues[from];

                for (let i = queue.length - 1; i >= 0; i--) {
                    const item = queue[i];

                    if (
                        !item.cancelled &&
                        now - item.enqueuedAt >= threshold
                    ) {
                        queue.splice(i, 1);

                        item.priority = to;

                        this.queues[to].push(item);

                        this.metrics.promoted++;

                        this.emit("promote", item, from, to);
                    }
                }
            }

            this._process();

        }, interval);

        timer.unref?.();

        return timer;
    }

    /* =================================================
       STATISTICS
    ================================================= */

    getQueueLength(priority = null) {
        if (priority) {
            return this.queues[priority]?.length ?? 0;
        }

        return Object.values(this.queues)
            .reduce((total, queue) => total + queue.length, 0);
    }

    getStats() {
        const queued = this.getQueueLength();

        return {
            ...this.metrics,
            queued,
            running: this.activeCount,
            deadLetters: this.deadLetterQueue.length,
            concurrency: this.concurrency,
            paused: this.paused,
            stopped: this.stopped,
            closing: this.closing
        };
    }

    /* =================================================
       SHUTDOWN
    ================================================= */

    async drain() {
        while (this.getQueueLength() || this.activeCount) {
            await this._delay(25);
        }
    }

    async shutdown({ graceful = true } = {}) {
        if (this.closing) return;

        this.closing = true;

        if (this._agingTimer) {
            clearInterval(this._agingTimer);
        }

        if (!graceful) {
            for (const item of this.taskIndex.values()) {
                this.cancel(item.id);
            }

            for (const active of this.activeTasks.values()) {
                active.controller.abort(
                    new Error("Queue shutdown")
                );
            }
        } else {
            this.stopped = true;
            await this.drain();
        }

        this.stopped = true;

        for (const item of this.taskIndex.values()) {
            item.signal?.removeEventListener(
                "abort",
                item.abortHandler
            );
        }

        this.taskIndex.clear();

        this.emit("shutdown");

        return this.getStats();
    }

    destroy() {
        if (this._agingTimer) {
            clearInterval(this._agingTimer);
        }

        this.stopped = true;
        this.closing = true;

        for (const active of this.activeTasks.values()) {
            active.controller.abort();
        }

        for (const item of this.taskIndex.values()) {
            item.signal?.removeEventListener(
                "abort",
                item.abortHandler
            );
        }

        this.queues.high.length = 0;
        this.queues.normal.length = 0;
        this.queues.low.length = 0;

        this.taskIndex.clear();
        this.removeAllListeners();
    }

    /* =================================================
       UTILITIES
    ================================================= */

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = QueueSystem;
