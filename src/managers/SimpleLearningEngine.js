import { LearningEngineBase } from './LearningEngineBase.js';

export class SimpleLearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
    }

    applyLearning() {}

    recordExperience(event, outcome = {}) {}
}
