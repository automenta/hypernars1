import { extractTerms } from '../../support/termExtraction.js';

export class ForgettingManager {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.nar = memoryManager.nar;
        this.config = memoryManager.config;
    }

    selectivelyForget() {
        const totalConcepts = this.nar.state.hypergraph.size;
        if (totalConcepts < this.config.minConceptsForForgetting) return;

        let prunedCount = 0;
        const conceptsToCheck = new Set();
        const sampleSize = Math.min(totalConcepts, this.config.forgettingCheckSampleSize);
        const hypergraphKeys = Array.from(this.nar.state.hypergraph.keys());

        for (let i = 0; i < sampleSize; i++) {
            conceptsToCheck.add(hypergraphKeys[Math.floor(Math.random() * totalConcepts)]);
        }

        for (const id of conceptsToCheck) {
            const hyperedge = this.nar.state.hypergraph.get(id);
            if (!hyperedge || this._isImportantConcept(id)) {
                continue;
            }

            const importance = this.memoryManager.importanceScores.get(id) || 0;
            const activation = this.nar.state.activations.get(id) || 0;
            const popularity = this.memoryManager.index.conceptPopularity.get(id) || 0;

            const normalizedPopularity = Math.min(1, popularity / this.config.popularityNormalizationFactor);

            const retentionScore =
                importance * this.config.retentionScoreImportanceWeight +
                activation * this.config.retentionScoreActivationWeight +
                normalizedPopularity * this.config.retentionScorePopularityWeight;

            const forgettingProbability = Math.pow(1 - retentionScore, 2);

            if (Math.random() < forgettingProbability) {
                if (hyperedge.beliefs.length > 1) {
                    hyperedge.beliefs.sort((a, b) => a.budget.total() - b.budget.total());
                    const weakestBelief = hyperedge.beliefs.shift();
                    this.nar.emit('belief-pruned', {hyperedgeId: id, belief: weakestBelief});
                } else {
                    if (retentionScore < this.memoryManager.forgettingThreshold) {
                        this._removeHyperedge(id);
                        prunedCount++;
                    }
                }
            }
        }

        if (prunedCount > 0) {
            this.nar.emit('maintenance-info', {message: `Pruned ${prunedCount} concepts.`});
        }
    }

    _removeHyperedge(id) {
        const hyperedge = this.nar.state.hypergraph.get(id);
        if (!hyperedge) return;

        this.nar.state.hypergraph.delete(id);
        this.nar.state.activations.delete(id);
        this.memoryManager.importanceScores.delete(id);

        this.memoryManager.index.removeFromIndex(hyperedge);

        this.nar.emit('knowledge-pruned', {id, type: hyperedge.type});
    }

    _isImportantConcept(hyperedgeId) {
        const importantTermsInQuestions = new Set();

        this.nar.state.questionPromises.forEach((promise, questionId) => {
            try {
                const match = questionId.match(/^Question\((.*)\)$/);
                if (match) {
                    const questionContent = match[1];
                    const parsedQuestion = this.nar.expressionEvaluator.parse(questionContent);
                    extractTerms(parsedQuestion, importantTermsInQuestions);
                }
            } catch (e) {
            }
        });

        if (importantTermsInQuestions.has(hyperedgeId)) {
            return true;
        }

        if (this.memoryManager.index.activeConcepts.has(hyperedgeId)) {
            return true;
        }

        const importance = this.memoryManager.importanceScores.get(hyperedgeId) || 0;
        if (importance > 0.8) {
            return true;
        }

        return false;
    }
}
