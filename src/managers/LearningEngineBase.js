export class LearningEngineBase {
    constructor(nar, config) {
        if (this.constructor === LearningEngineBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
        this.config = config;
    }

    applyLearning() {
        throw new Error("Method 'applyLearning()' must be implemented.");
    }

    recordExperience(action, outcome = {}) {
        throw new Error("Method 'recordExperience()' must be implemented.");
    }
}
