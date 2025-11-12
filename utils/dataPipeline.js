// Data processing pipeline
class DataPipeline {
    constructor() {
        this.stages = [];
        this.context = new Map();
    }

    stage(name, processor) {
        this.stages.push({ name, processor });
        return this;
    }

    async process(input) {
        let data = input;
        const results = [];

        for (const stage of this.stages) {
            const startTime = Date.now();
            try {
                data = await stage.processor(data, this.context);
                results.push({
                    stage: stage.name,
                    data,
                    duration: Date.now() - startTime,
                    success: true
                });
            } catch (error) {
                results.push({
                    stage: stage.name,
                    error: error.message,
                    success: false
                });
                throw error;
            }
        }

        return {
            finalResult: data,
            stageResults: results
        };
    }

    use(middleware) {
        this.stages.push({
            name: 'middleware',
            processor: middleware
        });
        return this;
    }

    setContext(key, value) {
        this.context.set(key, value);
        return this;
    }

    getContext(key) {
        return this.context.get(key);
    }

    clear() {
        this.stages = [];
        this.context.clear();
        return this;
    }

    getStageNames() {
        return this.stages.map(stage => stage.name);
    }
}

const builtInProcessors = {
    filter: predicate => data => data.filter(predicate),
    map: mapper => data => data.map(mapper),
    reduce: (reducer, initial) => data => data.reduce(reducer, initial),
    batch: size => data => {
        const batches = [];
        for (let i = 0; i < data.length; i += size) {
            batches.push(data.slice(i, i + size));
        }
        return batches;
    }
};

module.exports = { DataPipeline, builtInProcessors };

