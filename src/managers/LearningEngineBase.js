/**
 * Abstract base class for Learning Engines.
 * Defines the interface that all learning engines must implement.
 */
export class LearningEngineBase {
    constructor(nar) {
        if (this.constructor === LearningEngineBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    /**
     * Applies any learned knowledge or performs learning-related maintenance.
     */
    applyLearning() {
        throw new Error("Method 'applyLearning()' must be implemented.");
    }

    /**
     * Records an experience or event for the learning engine to process.
     * @param {object} event - The event or experience to record.
     * @param {object} [outcome={}] - The outcome of the event.
     */
    recordExperience(action, outcome = {}) {
        throw new Error("Method 'recordExperience()' must be implemented.");
    }
}
