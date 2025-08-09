export class StateSerializer {
    constructor(nar) {
        this.nar = nar;
    }

    saveState() {
        const hypergraphData = Array.from(this.nar.state.hypergraph.values()).map(h => h.toJSON());
        const stateData = {
            version: '1.0',
            timestamp: Date.now(),
            config: this.nar.config,
            currentStep: this.nar.state.currentStep,
            hypergraph: hypergraphData,
        };
        return JSON.stringify(stateData, null, 2);
    }

    loadState(jsonString) {
        const stateData = JSON.parse(jsonString);

        if (!stateData.version || !stateData.hypergraph) {
            throw new Error('Invalid or unsupported state file.');
        }

        this.nar.clearState();
        this.nar.config = Object.assign(this.nar.config, stateData.config);
        this.nar.state.currentStep = stateData.currentStep || 0;

        for (const edgeData of stateData.hypergraph) {
            if (!edgeData.beliefs || edgeData.beliefs.length === 0) continue;

            for (const beliefData of edgeData.beliefs) {
                const options = {
                    truth: new this.nar.api.TruthValue(beliefData.truth.frequency, beliefData.truth.confidence, beliefData.truth.priority),
                    budget: new this.nar.api.Budget(beliefData.budget.priority, beliefData.budget.durability, beliefData.budget.quality),
                    premises: beliefData.premises,
                    derivedBy: beliefData.derivedBy,
                    timestamp: beliefData.timestamp,
                };
                this.nar.api.addHyperedge(edgeData.type, edgeData.args, options);
            }
        }
    }
}
