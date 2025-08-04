export class LearningEngineBase {
    constructor(nar) {
        if (this.constructor === LearningEngineBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    applyLearning() {
        throw new Error("Method 'applyLearning()' must be implemented.");
    }

    recordExperience(action, outcome = {}) {
        throw new Error("Method 'recordExperience()' must be implemented.");
    }
}
