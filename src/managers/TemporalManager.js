import { TemporalReasoner } from './TemporalReasoner.js';

/**
 * Exports the TemporalReasoner as the default TemporalManager.
 * This ensures the system uses the more sophisticated temporal
 * reasoning capabilities, including constraint propagation.
 */
export { TemporalReasoner as TemporalManager };
