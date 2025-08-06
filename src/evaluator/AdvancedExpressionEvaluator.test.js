import {NAR} from '../NAR.js';

describe('AdvancedExpressionEvaluator', () => {
    let nar;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should parse a simple negated term', () => {
        const result = nar.expressionEvaluator.parse('!term1 %0.8;0.9%');
        expect(result.type).toBe('Negation');
        expect(result.args[0].type).toBe('Term');
        expect(result.args[0].args[0]).toBe('term1');
        expect(result.truth.frequency).toBe(0.8);
    });

    it('should parse a negated inheritance statement', () => {
        const result = nar.expressionEvaluator.parse('!(a --> b) %0.7;0.8%');
        expect(result.type).toBe('Negation');
        const inner = result.args[0];
        expect(inner.type).toBe('Inheritance');
        expect(inner.args[0].type).toBe('Term');
        expect(inner.args[0].args[0]).toBe('a');
        expect(inner.args[1].type).toBe('Term');
        expect(inner.args[1].args[0]).toBe('b');
        expect(result.truth.frequency).toBe(0.7);
        expect(result.truth.confidence).toBe(0.8);
    });

    it('should handle nested negations', () => {
        const result = nar.expressionEvaluator.parse('!!(a --> b) %0.9;0.9%');
        expect(result.type).toBe('Negation');
        expect(result.args[0].type).toBe('Negation');
        const inner = result.args[0].args[0];
        expect(inner.type).toBe('Inheritance');

        expect(result.truth.frequency).toBe(0.9);
        expect(result.truth.confidence).toBe(0.9);
    });

    it('should handle negation with default truth value', () => {
        const result = nar.expressionEvaluator.parse('!term2');
        expect(result.type).toBe('Negation');
        expect(result.args[0].type).toBe('Term');
        expect(result.args[0].args[0]).toBe('term2');
        expect(result.truth.frequency).toBe(1.0);
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

            expect(result.type).toBe('Implication');
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

        it('should correctly parse content inside angle-brackets', () => {
            const result = nar.expressionEvaluator.parse('<a --> b>');

            expect(result.type).toBe('Inheritance');
            expect(result.args[0].args[0]).toBe('a');
            expect(result.args[1].args[0]).toBe('b');
        });
    });
});
