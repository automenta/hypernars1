import { MemoryManagerBase } from './MemoryManagerBase.js';
import { OptimizedIndex } from './OptimizedIndex.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';

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
     * Selectively forgets concepts based on a probabilistic model, considering
     * their importance, activation, and popularity. This aligns with `enhance.f.md`.
     */
    _selectivelyForget() {
        const totalConcepts = this.nar.state.hypergraph.size;
        if (totalConcepts < 1000) return; // Don't prune small knowledge bases

        let prunedCount = 0;
        // To avoid performance issues on large graphs, only check a random subset of concepts each time.
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

            // Normalize popularity - this is a simple heuristic
            const normalizedPopularity = Math.min(1, popularity / 100);

            // Calculate a score where lower is worse
            const retentionScore = importance * 0.6 + activation * 0.3 + normalizedPopularity * 0.1;

            // The probability of forgetting increases as the retention score decreases.
            const forgettingProbability = Math.pow(1 - retentionScore, 2);

            if (Math.random() < forgettingProbability) {
                // Nuanced forgetting: first, prune weak beliefs.
                if (hyperedge.beliefs.length > 1) {
                    // Sort by budget total (priority * quality * durability) to find weakest
                    hyperedge.beliefs.sort((a, b) => a.budget.total() - b.budget.total());
                    const weakestBelief = hyperedge.beliefs.shift(); // Remove the weakest
                    this.nar.emit('belief-pruned', { hyperedgeId: id, belief: weakestBelief });
                } else {
                    // If only one belief is left and its score is low, forget the whole concept.
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

        this.nar.emit('knowledge-pruned', { id, type: hyperedge.type });
    }

    // =================================================================================================
    // The following methods are preserved from the previous version of AdvancedMemoryManager,
    // as they contain valuable logic from the enhancement proposals.
    // =================================================================================================

    /**
     * Enhances relevance calculation with more sophisticated importance scores.
     */
    _isImportantConcept(hyperedgeId) {
        // Method 1: Check if the concept is part of any active question.
        // This is the most reliable way to determine immediate importance.
        const importantTermsInQuestions = new Set();
        const extractTerms = (parsed) => {
            if (!parsed) return;
            // We are interested in the ID of the term itself, which is a hyperedge
            if (parsed.type === 'Term') {
                importantTermsInQuestions.add(id(parsed.type, parsed.args));
            }
            if (parsed.args) {
                parsed.args.forEach(arg => {
                    // Recursively extract from complex arguments
                    if (typeof arg === 'object' && arg !== null) {
                        extractTerms(arg);
                    }
                });
            }
        };

        this.nar.state.questionPromises.forEach((promise, questionId) => {
            try {
                // Questions are stored with a "Question(...)" wrapper
                const match = questionId.match(/^Question\((.*)\)$/);
                if (match) {
                    const questionContent = match[1];
                    // Use the system's own parser to robustly find terms
                    const parsedQuestion = this.nar.expressionEvaluator.parse(questionContent);
                    extractTerms(parsedQuestion);
                }
            } catch (e) {
                // Ignore parsing errors, as some questions might be malformed during testing.
            }
        });

        if (importantTermsInQuestions.has(hyperedgeId)) {
            return true;
        }

        // Method 2: Check if it's being actively tracked by the index.
        if (this.index.activeConcepts.has(hyperedgeId)) {
            return true;
        }

        // Method 3: Check if it has a high importance score from past activity.
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
        const extractTerms = (parsed) => {
            if (!parsed) return;
            if (parsed.type === 'Term') {
                importantTerms.add(id(parsed.type, parsed.args));
            }
            if (parsed.args) {
                parsed.args.forEach(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        extractTerms(arg);
                    }
                });
            }
        };

        this.nar.state.questionPromises.forEach((promise, questionId) => {
            try {
                const match = questionId.match(/^Question\((.*)\)$/);
                if (match) {
                    const questionContent = match[1];
                    const parsedQuestion = this.nar.expressionEvaluator.parse(questionContent);
                    extractTerms(parsedQuestion);
                }
            } catch (e) {
                // Ignore parsing errors for this purpose
            }
        });

        importantTerms.forEach(termId => {
            const currentScore = this.importanceScores.get(termId) || 0;
            this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.2)); // Additive boost
        });

        // Boost scores for concepts that recently led to success
        this.nar.learningEngine.recentSuccesses?.forEach(termId => {
            const currentScore = this.importanceScores.get(termId) || 0;
            this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.1)); // Smaller boost for success
        });

        // Boost scores for concepts in the current reasoning context
        if (this.contextStack.length > 0) {
            const currentContext = this.contextStack[this.contextStack.length - 1];
            // Assuming context is an array of term IDs
            currentContext.forEach(termId => {
                const currentScore = this.importanceScores.get(termId) || 0;
                this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.3)); // Context is highly important
            });
        }
    }

    /**
     * Pushes a new context onto the reasoning stack.
     * @param {string[]} context - An array of term IDs relevant to the context.
     */
    pushContext(context) {
        this.contextStack.push(context);
    }

    /**
     * Pops the current context from the reasoning stack.
     */
    popContext() {
        if (this.contextStack.length > 0) {
            this.contextStack.pop();
        }
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

        // Factor in meta-reasoner's resource allocation policy
        const metaAlloc = this.nar.metaReasoner.resourceAllocation;
        if (task.type === 'derivation' && metaAlloc.derivation) {
            basePriority *= (0.5 + metaAlloc.derivation); // Scale by allocation
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

        const originalSize = eventQueue.heap.length;
        const pathsToKeep = [];
        for (const event of eventQueue.heap) {
            if (event.budget.total() >= threshold) {
                pathsToKeep.push(event);
            }
        }

        const prunedCount = originalSize - pathsToKeep.length;

        if (prunedCount > 0) {
            // Rebuild the heap. This is simpler and safer than implementing a `remove`
            // method for the PriorityQueue.
            eventQueue.heap = pathsToKeep;

            // We need to restore the heap property. A simple way is to sift down from the top.
            // A full re-heapify would be more correct, but sifting the first half is sufficient.
            for (let i = Math.floor(eventQueue.heap.length / 2) - 1; i >= 0; i--) {
                eventQueue._siftDown(i); // Assuming _siftDown can take an index
            }

            this.nar.emit('pruning', {
                type: 'low-value-paths',
                count: prunedCount
            });
        }

        return prunedCount;
    }
}
