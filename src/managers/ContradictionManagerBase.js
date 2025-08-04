export class ContradictionManagerBase {
    constructor(nar) {
        if (this.constructor === ContradictionManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    detectContradictions(hyperedgeId) {
        throw new Error("Method 'detectContradictions()' must be implemented.");
    }

    resolveContradictions() {
        throw new Error("Method 'resolveContradictions()' must be implemented.");
    }
}
