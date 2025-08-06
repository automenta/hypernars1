export class DerivationEngineBase {
    constructor(nar) {
        if (this.constructor === DerivationEngineBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    applyDerivationRules(event) {
        throw new Error("Method 'applyDerivationRules()' must be implemented.");
    }
}
