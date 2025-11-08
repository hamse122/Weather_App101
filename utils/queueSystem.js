// Advanced Queue System with priorities
class QueueSystem {
    constructor() {
        this.queues = {
            high: [],
            normal: [],
            low: []
        };
        this.isProcessing = false;
    }
    
    enqueue(item, priority = 'normal') {
        if (!this.queues[priority]) priority = 'normal';
        this.queues[priority].push(item);
        this.process();
    }
    
    async process() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        while (this.hasItems()) {
            const item = this.dequeue();
            if (item && item.process) {
                await item.process();
            }
        }
        
        this.isProcessing = false;
    }
    
    dequeue() {
        for (const priority of ['high', 'normal', 'low']) {
            if (this.queues[priority].length > 0) {
                return this.queues[priority].shift();
            }
        }
        return null;
    }
    
    hasItems() {
        return Object.values(this.queues).some(queue => queue.length > 0);
    }
    
    getQueueLength(priority = null) {
        if (priority) return this.queues[priority]?.length || 0;
        return Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0);
    }
}

module.exports = QueueSystem;

