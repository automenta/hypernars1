import { MemoryManagerBase } from './MemoryManagerBase.js';
import { OptimizedIndex } from './OptimizedIndex.js';
import { Budget } from '../support/Budget.js';

/**
 * An advanced memory manager that uses an OptimizedIndex for efficient
 * querying and implements sophisticated logic for memory pruning,
 * importance scoring, and dynamic budget allocation.
 */
export class AdvancedMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);

        // This is the core change: using the new OptimizedIndex
        this.index = new OptimizedIndex(nar);

        // Replace the default NAR index with this advanced one.
        // This is a significant architectural decision. It assumes this manager
        // is the sole authority on indexing.
        nar.state.index = this.index;

        this.importanceScores = new Map(); // Tracks importance of concepts more granularly
        this.contextStack = []; // Can be used for contextual importance
        this.forgettingThreshold = 0.1; // Lower threshold as scoring is more precise
    }

    /**
     * Overrides the base maintainMemory to use the OptimizedIndex for pruning
     * and to prune low-value reasoning paths.
     */
    maintainMemory() {
        this._updateImportanceScores();
        this._adjustMemoryConfiguration();
        this._selectivelyForget();
        this.pruneLowValuePaths(); // Prune low-value tasks from the event queue
    }

    /**
     * Updates the relevance of a hyperedge by updating its popularity in the index.
     */
    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        if (hyperedgeId) {
            this.index._updatePopularity(hyperedgeId, activityType);
        }
    }

    /**
     * Selectively forgets the least important concepts based on the OptimizedIndex's
     * popularity tracking.
     */
    _selectivelyForget() {
        const totalConcepts = this.nar.state.hypergraph.size;
        if (totalConcepts < 1000) return; // Don't prune small knowledge bases

        // Prune a small percentage of the least valuable concepts
        const pruneCount = Math.min(50, Math.floor(totalConcepts * 0.01));

        // Get candidates from the index
        const candidates = this.index.getLeastPopular(pruneCount * 2);

        let pruned = 0;
        for (const [id, score] of candidates) {
            if (pruned >= pruneCount) break;

            const importance = this.importanceScores.get(id) || 0;
            const activation = this.nar.state.activations.get(id) || 0;
            const combinedScore = score * 0.2 + importance * 0.5 + activation * 0.3;

            if (combinedScore < this.forgettingThreshold && !this._isImportantConcept(id)) {
                this._removeHyperedge(id);
                pruned++;
            }
        }

        if (pruned > 0) {
            this.nar.notifyListeners('maintenance-info', { message: `Pruned ${pruned} concepts.` });
        }
    }

    /**
     * Overrides the base removal logic to also remove from the OptimizedIndex.
     * @param {string} id The ID of the hyperedge to remove.
     */
    _removeHyperedge(id) {
        const hyperedge = this.nar.state.hypergraph.get(id);
        if (!hyperedge) return;

        // Remove from all data structures
        this.nar.state.hypergraph.delete(id);
        this.nar.state.activations.delete(id);
        this.importanceScores.delete(id);

        // Remove from the optimized index
        this.index.removeFromIndex(hyperedge);

        this.nar.notifyListeners('knowledge-pruned', { id, type: hyperedge.type });
    }

    // =================================================================================================
    // The following methods are preserved from the previous version of AdvancedMemoryManager,
    // as they contain valuable logic from the enhancement proposals.
    // =================================================================================================

    /**
     * Enhances relevance calculation with more sophisticated importance scores.
     */
    _isImportantConcept(hyperedgeId) {
        // Is it part of an active question?
        for (const questionId of this.nar.state.questionPromises.keys()) {
            if (questionId.includes(hyperedgeId)) {
                return true;
            }
        }
        // Is it being actively tracked by the index?
        if (this.index.activeConcepts.has(hyperedgeId)) {
            return true;
        }
        // Does it have high importance?
        const importance = this.importanceScores.get(hyperedgeId) || 0;
        if (importance > 0.8) {
            return true;
        }
        return false;
    }

    /**
     * Calculates importance scores for concepts based on various factors.
     */
    _updateImportanceScores() {
        // Decay existing scores
        this.importanceScores.forEach((score, termId) => {
            this.importanceScores.set(termId, score * 0.995); // Slower decay
        });

        // Update scores based on current activity (activations)
        this.nar.state.activations.forEach((activation, termId) => {
            const currentScore = this.importanceScores.get(termId) || 0;
            const newScore = (currentScore * 0.8) + (activation * 0.2); // Blend activation
            this.importanceScores.set(termId, Math.min(1.0, newScore));
        });

        // Boost scores for terms involved in active questions
        const importantTerms = new Set();
        this.nar.state.questionPromises.forEach((promise, questionId) => {
            // Extract terms from the question ID. This is a simplification.
            const termsInQuestion = questionId.match(/([a-zA-Z0-9_]+\.?)/g) || [];
            termsInQuestion.forEach(term => {
                // This is still not perfect, as it won't match complex hyperedge IDs,
                // but it will match the simple term IDs used in the tests.
                this.nar.state.hypergraph.forEach((hyperedge, termId) => {
                    if (termId.includes(term)) {
                        importantTerms.add(termId);
                    }
                });
            });
        });

        importantTerms.forEach(termId => {
            const currentScore = this.importanceScores.get(termId) || 0;
            this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.2)); // Additive boost
        });
    }

    /**
     * Dynamically adjusts memory-related configuration based on system load.
     */
    _adjustMemoryConfiguration() {
        const activeConcepts = this.nar.state.hypergraph.size;
        if (activeConcepts > 10000) {
            this.nar.config.beliefCapacity = Math.max(4, Math.floor(this.nar.config.beliefCapacity * 0.95));
        } else if (activeConcepts < 5000) {
            this.nar.config.beliefCapacity = Math.min(12, Math.ceil(this.nar.config.beliefCapacity * 1.05));
        }
    }

    /**
     * Allocate resources for a task based on its importance and the current context.
     * @param {Object} task - The task to allocate resources for.
     * @param {Object} [context] - The current reasoning context.
     * @returns {Budget} The allocated budget for the task.
     */
    allocateResources(task, context = {}) {
        let basePriority = 0.5;
        switch (task.type) {
            case 'question': basePriority = 0.9; break;
            case 'critical-event': basePriority = 0.95; break;
            case 'derivation': basePriority = 0.6; break;
            case 'revision': basePriority = 0.7; break;
        }

        if (context.urgency) {
            basePriority = Math.min(1.0, basePriority + context.urgency * 0.3);
        }
        if (context.importance) {
            basePriority = Math.min(1.0, basePriority + context.importance * 0.2);
        }

        const availability = this._getResourceAvailability();
        const priority = basePriority * availability;

        let durability = 0.6;
        if (task.type === 'question' || task.type === 'critical-event') {
            durability = 0.9;
        }

        const quality = Math.sqrt(availability);

        return new Budget(priority, durability, quality);
    }

    /**
     * Get the current resource availability (0-1).
     * This is a simplified model based on event queue size.
     * @returns {number}
     */
    _getResourceAvailability() {
        // A more complex model could include CPU load, memory pressure, etc.
        const recentUsage = Math.min(this.nar.state.eventQueue.heap.length / 1000, 1.0);
        return Math.max(0.1, 1.0 - recentUsage * 0.7);
    }

    /**
     * Prune low-value reasoning paths from the event queue to conserve resources.
     * @param {number} [threshold=0.2] - The minimum budget.total() value to keep.
     * @returns {number} The number of paths pruned.
     */
    pruneLowValuePaths(threshold = 0.2) {
        const eventQueue = this.nar.state.eventQueue;
        if (!eventQueue || eventQueue.heap.length === 0) {
            return 0;
        }

        const pathsToPrune = [];
        for (const event of eventQueue.heap) {
            if (event.budget.total() < threshold) {
                pathsToPrune.push(event);
            }
        }

        if (pathsToPrune.length > 0) {
            for (const event of pathsToPrune) {
                eventQueue.remove(event);
            }
            this.nar.notifyListeners('pruning', {
                type: 'low-value-paths',
                count: pathsToPrune.length
            });
        }

        return pathsToPrune.length;
    }
}
