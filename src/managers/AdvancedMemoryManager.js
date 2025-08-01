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
     * Overrides the base maintainMemory to use the OptimizedIndex for pruning.
     */
    maintainMemory() {
        // Advanced features from the previous version of this file
        this._updateImportanceScores();
        this._adjustMemoryConfiguration();

        // New forgetting logic based on the OptimizedIndex
        this._selectivelyForget();
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
            this.importanceScores.set(termId, score * 0.95);
        });

        // Update scores based on current activity (activations)
        this.nar.state.activations.forEach((activation, termId) => {
            const currentScore = this.importanceScores.get(termId) || 0;
            const newScore = (currentScore * 0.7) + (activation * 0.3);
            this.importanceScores.set(termId, Math.min(1.0, newScore));
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
     * Dynamically allocates a budget for a new task or belief.
     */
    dynamicBudgetAllocation(task, context = {}) {
        let basePriority = 0.5;
        if (task) {
            switch (task.type) {
                case 'question': basePriority = 0.9; break;
                case 'critical-event': basePriority = 0.95; break;
                case 'derivation': basePriority = 0.6; break;
                case 'revision': basePriority = 0.7; break;
            }
        }
        if (context.urgency) basePriority = Math.min(1.0, basePriority + context.urgency * 0.3);
        if (context.importance) basePriority = Math.min(1.0, basePriority + context.importance * 0.2);
        if (context.noveltyScore) basePriority = Math.min(1.0, basePriority + context.noveltyScore * 0.15);

        const queueSize = this.nar.state.eventQueue.heap.length;
        const systemLoad = Math.min(queueSize / 1000, 1.0);
        const availability = Math.max(0.1, 1.0 - systemLoad * 0.7);
        const priority = basePriority * availability;

        let durability = 0.6;
        if (task && (task.type === 'question' || task.type === 'critical-event')) {
            durability = 0.9;
        }

        const quality = Math.sqrt(availability);

        return new Budget(
            Math.max(priority, this.nar.config.minPriorityThreshold || 0.01),
            Math.max(durability, this.nar.config.minDurabilityThreshold || 0.01),
            quality
        );
    }
}
