import {MemoryManagerBase} from './MemoryManagerBase.js';
import {OptimizedIndex} from './OptimizedIndex.js';
import {Budget} from '../support/Budget.js';
import {extractTerms} from '../support/termExtraction.js';

const defaultConfig = {
    forgettingThreshold: 0.1,
    forgettingCheckSampleSize: 200,
    minConceptsForForgetting: 1000,
    retentionScoreImportanceWeight: 0.6,
    retentionScoreActivationWeight: 0.3,
    retentionScorePopularityWeight: 0.1,
    popularityNormalizationFactor: 100,
    importanceDecayFactor: 0.995,
    importanceActivationWeight: 0.2,
    importanceQuestionWeight: 0.2,
    importanceSuccessWeight: 0.1,
    importanceContextWeight: 0.3,
    importanceGoalWeight: 0.4,
    beliefCapacityAdjustmentThresholdHigh: 10000,
    beliefCapacityAdjustmentThresholdLow: 5000,
    beliefCapacityAdjustmentFactor: 0.95,
    maxBeliefCapacity: 12,
    minBeliefCapacity: 4,
    basePriority: {
        question: 0.9,
        'critical-event': 0.95,
        derivation: 0.6,
        revision: 0.7,
        default: 0.5
    },
    urgencyPriorityFactor: 0.3,
    importancePriorityFactor: 0.2,
    resourceAvailabilityUsageFactor: 0.7,
    resourceAvailabilityMin: 0.1,
    durability: {
        high: 0.9,
        low: 0.6
    },
    qualityAvailabilityFactor: 0.8,
    eventQueueUsageNormalization: 1000,
    lowValuePathPruningThreshold: 0.2,
};

export class AdvancedMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.advancedMemoryManager};

        this.index = new OptimizedIndex(nar);
        nar.state.index = this.index;

        this.importanceScores = new Map();
        this.contextStack = [];
        this.forgettingThreshold = this.config.forgettingThreshold;
    }

    maintainMemory() {
        for (const hyperedge of this.nar.state.hypergraph.values()) {
            hyperedge.beliefs.forEach(belief => {
                belief.budget = belief.budget.scale(this.nar.config.budgetDecay);
            });
        }

        this._updateImportanceScores();
        this._adjustMemoryConfiguration();
        this._selectivelyForget();
        this.pruneLowValuePaths();
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        if (hyperedgeId) {
            this.index._updatePopularity(hyperedgeId, activityType);
        }
    }

    _selectivelyForget() {
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

            const importance = this.importanceScores.get(id) || 0;
            const activation = this.nar.state.activations.get(id) || 0;
            const popularity = this.index.conceptPopularity.get(id) || 0;

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
                    if (retentionScore < this.forgettingThreshold) {
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
        this.importanceScores.delete(id);

        this.index.removeFromIndex(hyperedge);

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

        if (this.index.activeConcepts.has(hyperedgeId)) {
            return true;
        }

        const importance = this.importanceScores.get(hyperedgeId) || 0;
        if (importance > 0.8) {
            return true;
        }

        return false;
    }

    _updateImportanceScores() {
        this.importanceScores.forEach((score, termId) => {
            this.importanceScores.set(termId, score * this.config.importanceDecayFactor);
        });

        this.nar.state.activations.forEach((activation, termId) => {
            const currentScore = this.importanceScores.get(termId) || 0;
            const newScore = (currentScore * (1 - this.config.importanceActivationWeight)) + (activation * this.config.importanceActivationWeight);
            this.importanceScores.set(termId, Math.min(1.0, newScore));
        });

        const importantTerms = new Set();
        this.nar.state.questionPromises.forEach((promise, questionId) => {
            try {
                const match = questionId.match(/^Question\((.*)\)$/);
                if (match) {
                    const questionContent = match[1];
                    const parsedQuestion = this.nar.expressionEvaluator.parse(questionContent);
                    extractTerms(parsedQuestion, importantTerms);
                }
            } catch (e) {
            }
        });

        importantTerms.forEach(termId => {
            const currentScore = this.importanceScores.get(termId) || 0;
            this.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceQuestionWeight));
        });

        this.nar.learningEngine.recentSuccesses?.forEach(termId => {
            const currentScore = this.importanceScores.get(termId) || 0;
            this.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceSuccessWeight));
        });

        if (this.contextStack.length > 0) {
            const currentContext = this.contextStack[this.contextStack.length - 1];
            currentContext.forEach(termId => {
                const currentScore = this.importanceScores.get(termId) || 0;
                this.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceContextWeight));
            });
        }

        if (this.nar.goalManager && this.nar.goalManager.getActiveGoals) {
            const activeGoals = this.nar.goalManager.getActiveGoals();
            activeGoals.forEach(goal => {
                const relatedTerms = this.nar.goalManager.getRelatedTerms(goal.id);
                relatedTerms.forEach(termId => {
                    const currentScore = this.importanceScores.get(termId) || 0;
                    this.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceGoalWeight * goal.priority));
                });
            });
        }
    }

    pushContext(context) {
        this.contextStack.push(context);
    }

    popContext() {
        if (this.contextStack.length > 0) {
            this.contextStack.pop();
        }
    }

    _adjustMemoryConfiguration() {
        const activeConcepts = this.nar.state.hypergraph.size;
        if (activeConcepts > this.config.beliefCapacityAdjustmentThresholdHigh) {
            this.nar.config.beliefCapacity = Math.max(this.config.minBeliefCapacity, Math.floor(this.nar.config.beliefCapacity * this.config.beliefCapacityAdjustmentFactor));
        } else if (activeConcepts < this.config.beliefCapacityAdjustmentThresholdLow) {
            this.nar.config.beliefCapacity = Math.min(this.config.maxBeliefCapacity, Math.ceil(this.nar.config.beliefCapacity * (1 + (1 - this.config.beliefCapacityAdjustmentFactor))));
        }
    }

    allocateResources(task, context = {}) {
        let basePriority = this.config.basePriority[task.type] || this.config.basePriority.default;

        if (context.urgency) {
            basePriority = Math.min(1.0, basePriority + context.urgency * this.config.urgencyPriorityFactor);
        }
        if (context.importance) {
            basePriority = Math.min(1.0, basePriority + context.importance * this.config.importancePriorityFactor);
        }

        const availability = this._getResourceAvailability();
        const priority = basePriority * availability;

        let durability;
        if (task.type === 'question' || task.type === 'critical-event') {
            durability = this.config.durability.high;
        } else {
            durability = this.config.durability.low;
        }

        const quality = Math.sqrt(availability) * this.config.qualityAvailabilityFactor;

        return new Budget(priority, durability, quality);
    }

    _getResourceAvailability() {
        const recentUsage = Math.min(this.nar.state.eventQueue.heap.length / this.config.eventQueueUsageNormalization, 1.0);
        return Math.max(this.config.resourceAvailabilityMin, 1.0 - recentUsage * this.config.resourceAvailabilityUsageFactor);
    }

    pruneLowValuePaths() {
        const threshold = this.config.lowValuePathPruningThreshold;
        const eventQueue = this.nar.state.eventQueue;
        if (!eventQueue || eventQueue.heap.length === 0) {
            return 0;
        }

        const originalSize = eventQueue.heap.length;
        const pathsToKeep = [];
        for (const event of eventQueue.heap) {
            if (event.budget.total() >= threshold) {
                pathsToKeep.push(event);
            }
        }

        const prunedCount = originalSize - pathsToKeep.length;

        if (prunedCount > 0) {
            eventQueue.heap = pathsToKeep;

            for (let i = Math.floor(eventQueue.heap.length / 2) - 1; i >= 0; i--) {
                eventQueue._siftDown(i);
            }

            this.nar.emit('pruning', {
                type: 'low-value-paths',
                count: prunedCount
            });
        }

        return prunedCount;
    }
}
