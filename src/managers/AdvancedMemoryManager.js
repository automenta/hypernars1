import { MemoryManagerBase } from './MemoryManagerBase.js';
import { OptimizedIndex } from './OptimizedIndex.js';
import { Budget } from '../support/Budget.js';
import { extractTerms } from '../support/termExtraction.js';

export class AdvancedMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);

        this.index = new OptimizedIndex(nar);
        nar.state.index = this.index;

        this.importanceScores = new Map();
        this.contextStack = [];
        this.forgettingThreshold = 0.1;
    }

    maintainMemory() {
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
        if (totalConcepts < 1000) return;

        let prunedCount = 0;
        const conceptsToCheck = new Set();
        const sampleSize = Math.min(totalConcepts, 200);
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

            const normalizedPopularity = Math.min(1, popularity / 100);

            const retentionScore = importance * 0.6 + activation * 0.3 + normalizedPopularity * 0.1;

            const forgettingProbability = Math.pow(1 - retentionScore, 2);

            if (Math.random() < forgettingProbability) {
                if (hyperedge.beliefs.length > 1) {
                    hyperedge.beliefs.sort((a, b) => a.budget.total() - b.budget.total());
                    const weakestBelief = hyperedge.beliefs.shift();
                    this.nar.emit('belief-pruned', { hyperedgeId: id, belief: weakestBelief });
                } else {
                    if (retentionScore < this.forgettingThreshold) {
                        this._removeHyperedge(id);
                        prunedCount++;
                    }
                }
            }
        }

        if (prunedCount > 0) {
            this.nar.emit('maintenance-info', { message: `Pruned ${prunedCount} concepts.` });
        }
    }

    _removeHyperedge(id) {
        const hyperedge = this.nar.state.hypergraph.get(id);
        if (!hyperedge) return;

        this.nar.state.hypergraph.delete(id);
        this.nar.state.activations.delete(id);
        this.importanceScores.delete(id);

        this.index.removeFromIndex(hyperedge);

        this.nar.emit('knowledge-pruned', { id, type: hyperedge.type });
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
            this.importanceScores.set(termId, score * 0.995);
        });

        this.nar.state.activations.forEach((activation, termId) => {
            const currentScore = this.importanceScores.get(termId) || 0;
            const newScore = (currentScore * 0.8) + (activation * 0.2);
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
            this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.2));
        });

        this.nar.learningEngine.recentSuccesses?.forEach(termId => {
            const currentScore = this.importanceScores.get(termId) || 0;
            this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.1));
        });

        if (this.contextStack.length > 0) {
            const currentContext = this.contextStack[this.contextStack.length - 1];
            currentContext.forEach(termId => {
                const currentScore = this.importanceScores.get(termId) || 0;
                this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.3));
            });
        }

        // Placeholder for goal-based importance boosting
        if (this.nar.goalManager && this.nar.goalManager.getActiveGoals) {
            const activeGoals = this.nar.goalManager.getActiveGoals();
            activeGoals.forEach(goal => {
                // Boost importance of concepts related to the goal
                const relatedTerms = this.nar.goalManager.getRelatedTerms(goal.id);
                relatedTerms.forEach(termId => {
                    const currentScore = this.importanceScores.get(termId) || 0;
                    this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.4 * goal.priority));
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
        if (activeConcepts > 10000) {
            this.nar.config.beliefCapacity = Math.max(4, Math.floor(this.nar.config.beliefCapacity * 0.95));
        } else if (activeConcepts < 5000) {
            this.nar.config.beliefCapacity = Math.min(12, Math.ceil(this.nar.config.beliefCapacity * 1.05));
        }
    }

    allocateResources(task, context = {}) {
        const fullContext = {
            ...context,
            systemLoad: this.nar.state.eventQueue.heap.length / 1000,
            noveltyScore: context.noveltyScore || 0, // Should be provided by caller
            successHistory: context.successHistory || 0, // Should be provided by caller
            minPriorityThreshold: this.nar.config.minPriorityThreshold,
            minDurabilityThreshold: this.nar.config.minDurabilityThreshold,
        };

        return Budget.dynamicAllocate(task, fullContext);
    }

    _getResourceAvailability() {
        const recentUsage = Math.min(this.nar.state.eventQueue.heap.length / 1000, 1.0);
        return Math.max(0.1, 1.0 - recentUsage * 0.7);
    }

    pruneLowValuePaths(threshold = 0.2) {
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
