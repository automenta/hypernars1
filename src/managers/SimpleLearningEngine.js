import { LearningEngineBase } from './LearningEngineBase.js';

/**
 * A simple, no-op implementation of a learning engine.
 * It performs no learning.
 */
export class SimpleLearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
    }

    /**
     * No-op.
     */
    applyLearning() {
        // Does nothing.
    }

    /**
     * No-op.
     * @param {object} event
     * @param {object} [outcome={}]
     */
    recordExperience(event, outcome = {}) {
        // Does nothing.
    }
}
