const EventEmitter = require("events");
const { randomUUID } = require("crypto");

class QueueSystem extends EventEmitter {
    constructor({
        concurrency = 1,
        maxRetries = 3,
        retryDelay = 500,
        timeout = 0,
        agingInterval = 5000,
        retryJitter = true
    } = {}) {
        super();

        this.queues = {
            high: [],
            normal: [],
            low: []
        };

        this.deadLetterQueue = [];

        this.concurrency = concurrency;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.retryJitter = retryJitter;
        this.timeout = timeout;

        this.activeCount = 0;
        this.paused = false;
        this.stopped = false;

        this.metrics = {
            completed: 0,
            failed: 0,
            retries: 0,
            cancelled: 0
        };

        this._agingTimer = this._startAging(agingInterval);
    }

    /* ================================================= */

    enqueue(task, priority = "normal", options = {}) {
        if (this.stopped) throw new Error("Queue is stopped");

        if (!this.queues[priority]) {
            priority = "normal";
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
            delay: options.delay || 0
        };

        if (item.signal?.aborted) {
            item.cancelled = true;
        }

        item.signal?.addEventListener(
            "abort",
            () => this.cancel(id),
            { once: true }
        );

        this.queues[priority].push(item);

        this.emit("enqueue", item);

        this._process();

        return id;
    }

    cancel(id) {
        for (const queue of Object.values(this.queues)) {
            const item = queue.find(i => i.id === id);

            if (item) {
                item.cancelled = true;
                this.metrics.cancelled++;
                this.emit("cancel", item);
                return true;
            }
        }

        return false;
    }

    pause() {
        this.paused = true;
        this.emit("pause");
    }

    resume() {
        this.paused = false;
        this.emit("resume");
        this._process();
    }

    stop() {
        this.stopped = true;
        this.emit("stop");
    }

    destroy() {
        this.stop();

        if (this._agingTimer) {
            clearInterval(this._agingTimer);
        }

        this.removeAllListeners();
    }

    getQueueLength(priority = null) {
        if (priority) {
            return this.queues[priority]?.length || 0;
        }

        return Object.values(this.queues)
            .reduce((n, q) => n + q.length, 0);
    }

    getStats() {
        return {
            queued: this.getQueueLength(),
            running: this.activeCount,
            ...this.metrics,
            deadLetters: this.deadLetterQueue.length
        };
    }

    /* ================================================= */

    async _process() {
        if (this.paused || this.stopped) return;

        while (
            this.activeCount < this.concurrency &&
            this._hasItems()
        ) {
            const item = this._dequeue();

            if (!item) break;

            this.activeCount++;

            this._runItem(item)
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

    async _runItem(item) {
        if (item.cancelled) return;

        if (item.delay > 0) {
            await this._delay(item.delay);
        }

        try {
            this.emit("start", item);

            const execution = Promise.resolve(item.task.process());

            if (this.timeout > 0) {
                await Promise.race([
                    execution,
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Timeout")),
                            this.timeout
                        )
                    )
                ]);
            } else {
                await execution;
            }

            this.metrics.completed++;
            this.emit("success", item);

        } catch (err) {

            if (
                item.retries < this.maxRetries &&
                !item.cancelled
            ) {

                item.retries++;
                this.metrics.retries++;

                this.emit("retry", item, item.retries);

                let delay =
                    this.retryDelay * (2 ** (item.retries - 1));

                if (this.retryJitter) {
                    delay += Math.random() * 250;
                }

                await this._delay(delay);

                this.queues[item.priority].push(item);

            } else {

                this.metrics.failed++;

                this.deadLetterQueue.push(item);

                this.emit("failure", item, err);
            }
        }
    }

    _dequeue() {
        for (const level of ["high", "normal", "low"]) {
            if (this.queues[level].length) {
                return this.queues[level].shift();
            }
        }
        return null;
    }

    _hasItems() {
        return Object.values(this.queues)
            .some(q => q.length);
    }

    _startAging(interval) {
        if (!interval) return null;

        return setInterval(() => {

            const now = Date.now();

            if (this.queues.low.length) {

                const item = this.queues.low[0];

                if (now - item.enqueuedAt >= interval) {

                    this.queues.low.shift();

                    item.priority = "normal";

                    this.queues.normal.push(item);

                    this.emit("promote", item);
                }
            }

            if (this.queues.normal.length) {

                const item = this.queues.normal[0];

                if (now - item.enqueuedAt >= interval * 2) {

                    this.queues.normal.shift();

                    item.priority = "high";

                    this.queues.high.push(item);

                    this.emit("promote", item);
                }
            }

        }, interval);
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = QueueSystem;
