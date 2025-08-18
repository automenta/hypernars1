import {AdvancedDerivationEngine} from './AdvancedDerivationEngine.js';

/**
 * The SimpleDerivationEngine was a stub. For the system to be functional in simple mode,
 * it needs to use the advanced engine's logic.
 */
export class SimpleDerivationEngine extends AdvancedDerivationEngine {
    constructor(nar, config) {
        super(nar, config);
    }
}
