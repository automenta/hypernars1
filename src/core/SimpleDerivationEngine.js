import { DerivationEngineBase } from './DerivationEngineBase.js';

/**
 * A simple, no-op implementation of a derivation engine.
 * It does not perform any inference.
 */
export class SimpleDerivationEngine extends DerivationEngineBase {
    constructor(nar) {
        super(nar);
    }

    /**
     * No-op.
     * @param {object} event
     */
    applyDerivationRules(event) {
        // Does nothing.
    }
}
