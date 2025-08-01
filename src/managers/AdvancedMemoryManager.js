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
            this.nar.learningEngine.recentSuccesses
                .filter(success => Date.now() - success.timestamp < 10000) // Last 10 seconds
                .forEach(success => {
                    const currentScore = this.importanceScores.get(success.hyperedgeId) || 0;
                    this.importanceScores.set(
                        success.hyperedgeId,
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
}
