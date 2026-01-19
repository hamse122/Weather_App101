// Advanced Priority Queue System

const EventEmitter = require('events');

class QueueSystem extends EventEmitter {
    constructor({
        concurrency = 1,
        maxRetries = 3,
        retryDelay = 500,
        timeout = 0, // 0 = no timeout
        agingInterval = 5000
    } = {}) {
        super();

        this.queues = {
            high: [],
            normal: [],
            low: []
        };

        this.concurrency = concurrency;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.timeout = timeout;

        this.activeCount = 0;
        this.paused = false;
        this.stopped = false;

        this._startAging(agingInterval);
    }

    enqueue(task, priority = 'normal') {
        if (this.stopped) throw new Error('Queue is stopped');
        if (!this.queues[priority]) priority = 'normal';

        this.queues[priority].push({
            task,
            priority,
            retries: 0,
            enqueuedAt: Date.now(),
            cancelled: false
        });

        this.emit('enqueue', task, priority);
        this._process();
    }

    cancel(task) {
        for (const queue of Object.values(this.queues)) {
            const item = queue.find(i => i.task === task);
            if (item) item.cancelled = true;
        }
    }

    pause() {
        this.paused = true;
        this.emit('pause');
    }

    resume() {
        this.paused = false;
        this.emit('resume');
        this._process();
    }

    stop() {
        this.stopped = true;
        this.emit('stop');
    }

    getQueueLength(priority = null) {
        if (priority) return this.queues[priority]?.length || 0;
        return Object.values(this.queues).reduce((s, q) => s + q.length, 0);
    }

    async _process() {
        if (this.paused || this.stopped) return;

        while (this.activeCount < this.concurrency && this._hasItems()) {
            const item = this._dequeue();
            if (!item) return;

            this.activeCount++;
            this._runItem(item).finally(() => {
                this.activeCount--;
                this._process();
            });
        }
    }

    async _runItem(item) {
        if (item.cancelled) return;

        try {
            this.emit('start', item.task);

            const execution = item.task.process();

            if (this.timeout > 0) {
                await Promise.race([
                    execution,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), this.timeout)
                    )
                ]);
            } else {
                await execution;
            }

            this.emit('success', item.task);
        } catch (err) {
            if (item.retries < this.maxRetries && !item.cancelled) {
                item.retries++;
                this.emit('retry', item.task, item.retries);

                await this._delay(this.retryDelay * item.retries);
                this.queues[item.priority].push(item);
            } else {
                this.emit('failure', item.task, err);
            }
        }
    }

    _dequeue() {
        for (const p of ['high', 'normal', 'low']) {
            if (this.queues[p].length > 0) {
                return this.queues[p].shift();
            }
        }
        return null;
    }

    _hasItems() {
        return Object.values(this.queues).some(q => q.length > 0);
    }

    _startAging(interval) {
        if (!interval) return;

        setInterval(() => {
            const now = Date.now();

            // Promote long-waiting tasks
            if (this.queues.low.length > 0) {
                const item = this.queues.low[0];
                if (now - item.enqueuedAt > interval) {
                    this.queues.low.shift();
                    item.priority = 'normal';
                    this.queues.normal.push(item);
                }
            }

            if (this.queues.normal.length > 0) {
                const item = this.queues.normal[0];
                if (now - item.enqueuedAt > interval * 2) {
                    this.queues.normal.shift();
                    item.priority = 'high';
                    this.queues.high.push(item);
                }
            }
        }, interval);
    }

    _delay(ms) {
        return new Promise(res => setTimeout(res, ms));
    }
}

module.exports = QueueSystem;
