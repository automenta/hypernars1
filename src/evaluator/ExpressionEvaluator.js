import { AdvancedExpressionEvaluator } from './AdvancedExpressionEvaluator.js';

/**
 * Exports the AdvancedExpressionEvaluator as the default ExpressionEvaluator.
 * This ensures the system uses the more sophisticated NAL parser and breaks
 * the circular dependency.
 */
export { AdvancedExpressionEvaluator as ExpressionEvaluator };
