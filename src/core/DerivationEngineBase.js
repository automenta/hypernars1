/**
 * Abstract base class for Derivation Engines.
 * Defines the interface that all derivation engines must implement.
 */
export class DerivationEngineBase {
    constructor(nar, config) {
        if (this.constructor === DerivationEngineBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
        this.config = config;
    }

    /**
     * Applies derivation rules to a given event.
     * This is the main entry point for the derivation process.
     * @param {object} event - The event to process.
     */
    applyDerivationRules(event) {
        throw new Error("Method 'applyDerivationRules()' must be implemented.");
    }
}
