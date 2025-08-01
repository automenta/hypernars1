import { MemoryManager } from './MemoryManager.js';

/**
 * An advanced memory manager that builds upon the standard MemoryManager
 * by adding dynamic configuration adjustment and more sophisticated importance scoring.
 */
export class AdvancedMemoryManager extends MemoryManager {
    constructor(nar) {
        super(nar);
        this.importanceScores = new Map(); // Tracks importance of concepts more granularly
        this.contextStack = []; // Can be used for contextual importance
    }

    /**
     * Overrides the base maintainMemory to add dynamic configuration adjustments.
     */
    maintainMemory() {
        super.maintainMemory(); // Run the standard decay and forgetting logic

        // Advanced features
        this._updateImportanceScores();
        this._adjustMemoryConfiguration();
        this._compactMemoryStructures(); // Future-proofing with stubs
    }

    /**
     * Enhances relevance calculation with more sophisticated importance scores.
     * @override
     */
    _isImportantConcept(hyperedgeId) {
        // Use the more basic importance check from the parent class
        if (super._isImportantConcept(hyperedgeId)) {
            return true;
        }

        // Add more advanced checks
        const importance = this.importanceScores.get(hyperedgeId) || 0;
        if (importance > 0.6) { // Stricter threshold for this advanced check
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

        // Boost scores for terms involved in active questions
        this.nar.state.questionPromises.forEach((_, questionId) => {
            const terms = this._extractTermsFromQuestion(questionId);
            terms.forEach(termString => {
                // Convert term string to term ID
                const termId = `Term(${termString})`;
                if (this.nar.state.hypergraph.has(termId)) {
                    const currentScore = this.importanceScores.get(termId) || 0;
                    this.importanceScores.set(termId, Math.min(1.0, currentScore + 0.2));
                }
            });
        });

        // Boost scores for recently derived terms (if learning engine is advanced enough)
        if (this.nar.learningEngine?.recentSuccesses) {
            Array.from(this.nar.learningEngine.recentSuccesses)
                .filter(successId => this.nar.state.hypergraph.has(successId))
                .forEach(successId => {
                    const currentScore = this.importanceScores.get(successId) || 0;
                    this.importanceScores.set(
                        successId,
                        Math.min(1.0, currentScore + 0.15)
                    );
                });
        }
    }

    /**
     * Dynamically adjusts memory-related configuration based on system load.
     */
    _adjustMemoryConfiguration() {
        const activeConcepts = this.nar.state.hypergraph.size;

        // Adjust belief capacity based on memory pressure
        if (activeConcepts > 10000) {
            this.nar.config.beliefCapacity = Math.max(4, Math.floor(this.nar.config.beliefCapacity * 0.95));
        } else if (activeConcepts < 5000) {
            this.nar.config.beliefCapacity = Math.min(12, Math.ceil(this.nar.config.beliefCapacity * 1.05));
        }

        // Adjust temporal horizon based on number of temporal links
        const activeTemporal = this.nar.state.temporalLinks?.size || 0;
        this.nar.config.temporalHorizon = Math.max(2, Math.min(20,
            5 + Math.floor(activeTemporal / 1000)
        ));
    }

    /**
     * Stubs for future memory compaction and optimization logic.
     */
    _compactMemoryStructures() {
        // In the future, this could trigger compaction of caches and indexes.
        // For now, it's a placeholder.
        if (Math.random() < 0.01) { // Run very infrequently
            this._compactPathCache();
        }
    }

    _compactPathCache() {
        // Placeholder for future logic to remove old/redundant path cache entries.
        this.nar.notifyListeners('maintenance-info', { message: 'Path cache compaction (stub)' });
    }

    /**
     * Extracts terms from a question string for importance boosting.
     * @param {string} questionId - The ID of the question.
     * @returns {Set<string>} A set of terms found in the question.
     */
    _extractTermsFromQuestion(questionId) {
        const question = questionId.replace(/^Question\(|\)\|.*$/g, '');
        const terms = new Set();
        // A simple regex to find sequences of letters/numbers, ignoring NAL operators
        // Updated regex to include periods, to correctly capture terms like "term."
        const termRegex = /[a-zA-Z0-9_.]+/g;
        let match;
        while ((match = termRegex.exec(question)) !== null) {
            // Avoid adding common NAL type names as terms
            if (!['Term', 'Inheritance', 'Similarity', 'Implication'].includes(match[0])) {
                terms.add(match[0]);
            }
        }
        return terms;
    }

    /**
     * Dynamically allocates a budget for a new task or belief.
     * @param {object} [context={}] - Context about the task (e.g., novelty, importance).
     * @returns {Budget} A new budget object.
     */
    dynamicBudgetAllocation(task, context = {}) {
        // Base priority on task type
        let basePriority = 0.5;
        if (task) {
            switch (task.type) {
                case 'question': basePriority = 0.9; break;
                case 'critical-event': basePriority = 0.95; break;
                case 'derivation': basePriority = 0.6; break;
                case 'revision': basePriority = 0.7; break;
            }
        }

        // Adjust based on context from MetaReasoner or other sources
        if (context.urgency) {
            basePriority = Math.min(1.0, basePriority + context.urgency * 0.3);
        }
        if (context.importance) {
            basePriority = Math.min(1.0, basePriority + context.importance * 0.2);
        }
        if (context.noveltyScore) {
            basePriority = Math.min(1.0, basePriority + context.noveltyScore * 0.15);
        }

        // Adjust based on system load
        const queueSize = this.nar.state.eventQueue.heap.length;
        const systemLoad = Math.min(queueSize / 1000, 1.0);
        const availability = Math.max(0.1, 1.0 - systemLoad * 0.7);
        const priority = basePriority * availability;

        // Determine durability based on task nature
        let durability;
        if (task && (task.type === 'question' || task.type === 'critical-event')) {
            durability = 0.9; // Need sustained attention
        } else {
            durability = 0.6; // Shorter attention span for derivations
        }

        // Quality depends on resource availability
        const quality = Math.sqrt(availability);

        return new this.nar.Budget(
            Math.max(priority, this.nar.config.minPriorityThreshold || 0.01),
            Math.max(durability, this.nar.config.minDurabilityThreshold || 0.01),
            quality
        );
    }

    /**
     * Calculate comprehensive priority score for a task, for competition resolution.
     */
    _calculatePriorityScore(task) {
        const { budget, activation, pathLength = 1, temporalUrgency = 0 } = task;

        // Base priority components
        const priorityComponent = budget.priority * 0.4;
        const activationComponent = (activation || 0) * 0.3;
        const qualityComponent = budget.quality * 0.2;
        const urgencyComponent = temporalUrgency * 0.1;

        // Path length penalty (shorter paths preferred)
        const pathPenalty = 1 / (1 + pathLength * 0.1);

        return (priorityComponent + activationComponent + qualityComponent + urgencyComponent) *
            pathPenalty *
            this._calculateNoveltyBonus(task);
    }

    /**
     * Calculate novelty bonus for potentially new information.
     */
    _calculateNoveltyBonus(task) {
        if (!task.target) return 1.0;
        const hyperedge = this.nar.state.hypergraph.get(task.target);
        if (!hyperedge || hyperedge.beliefs.length === 0) return 1.2; // New concept gets bonus

        // Check if this would create a significantly different belief
        const existingFrequencies = hyperedge.beliefs.map(b => b.truth.frequency);
        const newFrequency = task.truth ? task.truth.frequency : 0.5;

        const maxDiff = Math.max(...existingFrequencies.map(f => Math.abs(f - newFrequency)));
        if (maxDiff > 0.3) return 1.1; // Significant difference gets bonus

        return 1.0; // No bonus for similar beliefs
    }
}
