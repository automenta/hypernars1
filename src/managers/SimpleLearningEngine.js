import {LearningEngineBase} from './LearningEngineBase.js';

export class SimpleLearningEngine extends LearningEngineBase {
    constructor(nar, config) {
        super(nar, config);
    }

    applyLearning() {
    }

    recordExperience(event, outcome = {}) {
    }
}
