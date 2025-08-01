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
        const result = nar.expressionEvaluator.parse('¬(a --> b) %0.7;0.8%');

        expect(result.type).toBe('Inheritance');
        expect(result.args[0].type).toBe('Term');
        expect(result.args[0].args[0]).toBe('a');
        expect(result.args[1].type).toBe('Term');
        expect(result.args[1].args[0]).toBe('b');

        expect(result.truth.frequency).toBeCloseTo(0.3); // 1.0 - 0.7
        expect(result.truth.confidence).toBe(0.8);
    });

    it('should handle nested negations', () => {
        const result = nar.expressionEvaluator.parse('¬¬(a --> b) %0.9;0.9%');

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

    describe('Complex Expression Parsing', () => {
        it('should correctly handle operator precedence (&& before -->)', () => {
            const result = nar.expressionEvaluator.parse('a && b --> c');

            expect(result.type).toBe('Inheritance');
            expect(result.args[0].type).toBe('Conjunction');
            expect(result.args[0].args[0].args[0]).toBe('a');
            expect(result.args[0].args[1].args[0]).toBe('b');
            expect(result.args[1].type).toBe('Term');
            expect(result.args[1].args[0]).toBe('c');
        });

        it('should correctly handle operator precedence (<-> before &&)', () => {
            const result = nar.expressionEvaluator.parse('a <-> b && c <-> d');

            expect(result.type).toBe('Conjunction');
            expect(result.args[0].type).toBe('Similarity');
            expect(result.args[1].type).toBe('Similarity');
        });

        it('should respect parentheses to override precedence', () => {
            const result = nar.expressionEvaluator.parse('(a && b) --> (c || d)');

            expect(result.type).toBe('Inheritance');
            expect(result.args[0].type).toBe('Conjunction');
            expect(result.args[1].type).toBe('Disjunction');
        });

        it('should handle deeply nested expressions', () => {
            const result = nar.expressionEvaluator.parse('((a --> b) && (b --> c)) ==> (a --> c)');

            expect(result.type).toBe('Implication'); // The ==> is the root
            const premise = result.args[0];
            const conclusion = result.args[1];

            expect(premise.type).toBe('Conjunction');
            expect(premise.args[0].type).toBe('Inheritance');
            expect(premise.args[0].args[0].args[0]).toBe('a');
            expect(premise.args[0].args[1].args[0]).toBe('b');

            expect(premise.args[1].type).toBe('Inheritance');
            expect(premise.args[1].args[0].args[0]).toBe('b');
            expect(premise.args[1].args[1].args[0]).toBe('c');

            expect(conclusion.type).toBe('Inheritance');
            expect(conclusion.args[0].args[0]).toBe('a');
            expect(conclusion.args[1].args[0]).toBe('c');
        });

        it('should parse variables correctly', () => {
            const result = nar.expressionEvaluator.parse('($x --> living_thing) ==> ($x --> mortal)');
            expect(result.type).toBe('Implication');
            expect(result.args[0].type).toBe('Inheritance');
            expect(result.args[0].args[0].type).toBe('Variable');
            expect(result.args[0].args[0].args[0]).toBe('$x');
        });
    });
});
