import { NARHyper } from '../NARHyper.js';
import { TruthValue } from '../support/TruthValue.js';

describe('AdvancedExpressionEvaluator', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper();
    });

    it('should parse a simple negated term and invert the truth frequency', () => {
        const result = nar.expressionEvaluator.parse('¬term1 %0.8;0.9%');

        expect(result.type).toBe('Term');
        expect(result.args[0]).toBe('term1');
        expect(result.truth.frequency).toBeCloseTo(0.2); // 1.0 - 0.8
        expect(result.truth.confidence).toBe(0.9);
    });

    it('should parse a negated inheritance statement', () => {
        const result = nar.expressionEvaluator.parse('¬<a --> b> %0.7;0.8%');

        expect(result.type).toBe('Inheritance');
        expect(result.args[0].type).toBe('Term');
        expect(result.args[0].args[0]).toBe('a');
        expect(result.args[1].type).toBe('Term');
        expect(result.args[1].args[0]).toBe('b');

        expect(result.truth.frequency).toBeCloseTo(0.3); // 1.0 - 0.7
        expect(result.truth.confidence).toBe(0.8);
    });

    it('should handle nested negations', () => {
        const result = nar.expressionEvaluator.parse('¬¬<a --> b> %0.9;0.9%');

        expect(result.type).toBe('Inheritance');
        expect(result.truth.frequency).toBeCloseTo(0.9); // 1.0 - (1.0 - 0.9)
        expect(result.truth.confidence).toBe(0.9);
    });

    it('should handle negation with default truth value', () => {
        const result = nar.expressionEvaluator.parse('¬term2');

        expect(result.type).toBe('Term');
        expect(result.args[0]).toBe('term2');
        // Default truth is f=1.0, c=0.9
        expect(result.truth.frequency).toBeCloseTo(0.0); // 1.0 - 1.0
        expect(result.truth.confidence).toBe(0.9);
    });
});
