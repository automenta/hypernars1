import {TruthValue} from './TruthValue.js';

describe('TruthValue', () => {
    describe('constructor', () => {
        it('should create a TruthValue with given frequency and confidence', () => {
            const tv = new TruthValue(0.8, 0.9);
            expect(tv.frequency).toBe(0.8);
            expect(tv.confidence).toBe(0.9);
            expect(tv.priority).toBe(1.0);
        });

        it('should clamp frequency and confidence to be between 0 and 1', () => {
            const tv = new TruthValue(1.5, -0.5);
            expect(tv.frequency).toBe(1);
            expect(tv.confidence).toBe(0);
        });
    });

    describe('expectation', () => {
        it('should calculate the expectation value correctly', () => {














            const tv = new TruthValue(0.8, 0.9);
            expect(tv.expectation()).toBeCloseTo(0.77);
        });
    });

    describe('static methods', () => {
        it('revise should calculate the weighted average', () => {
            const t1 = new TruthValue(1.0, 0.9, 1.0);
            const t2 = new TruthValue(0.0, 0.8, 1.0);
            const revised = TruthValue.revise(t1, t2);
            expect(revised.frequency).toBeCloseTo(0.5);

            expect(revised.confidence).toBeCloseTo(0.98);
        });

        it('transitive should calculate transitive confidence', () => {
            const t1 = new TruthValue(0.8, 0.9);
            const t2 = new TruthValue(0.7, 0.8);
            const result = TruthValue.transitive(t1, t2);
            expect(result.frequency).toBeCloseTo(0.56);
            expect(result.confidence).toBeCloseTo(0.72);
        });

        it('certain should return a certain truth value', () => {
            const tv = TruthValue.certain();
            expect(tv.frequency).toBe(1.0);
            expect(tv.confidence).toBe(0.9);
        });

        it('unknown should return an unknown truth value', () => {
            const tv = TruthValue.unknown();
            expect(tv.frequency).toBe(0.5);
            expect(tv.confidence).toBe(0.1);
        });
    });

    describe('negation', () => {
        it('negate() should return a new TruthValue with inverted frequency', () => {
            const t1 = new TruthValue(0.8, 0.9, 0.7);
            const negated = t1.negate();
            expect(negated.frequency).toBeCloseTo(0.2);
            expect(negated.confidence).toBe(0.9);
            expect(negated.priority).toBe(0.7);

            expect(negated).not.toBe(t1);
        });

        it('static negation() should return a new TruthValue with inverted frequency', () => {
            const t1 = new TruthValue(0.3, 0.5, 0.6);
            const negated = TruthValue.negation(t1);
            expect(negated.frequency).toBeCloseTo(0.7);
            expect(negated.confidence).toBe(0.5);
            expect(negated.priority).toBe(0.6);
            expect(negated).not.toBe(t1);
        });
    });

    describe('expectation', () => {
        it('should be 0.05 if frequency is 0', () => {
            const tv = new TruthValue(0, 0.9);
            expect(tv.expectation()).toBeCloseTo(0.05);
        });

        it('should be equal to 0.95 if frequency is 1', () => {
            const tv = new TruthValue(1, 0.9);
            expect(tv.expectation()).toBeCloseTo(0.95);
        });

        it('should be 0.5 if confidence is 0', () => {
            const tv = new TruthValue(0.8, 0);
            expect(tv.expectation()).toBe(0.5);
        });

        it('should be equal to frequency if confidence is 1', () => {
            const tv = new TruthValue(0.8, 1);
            expect(tv.expectation()).toBeCloseTo(0.8);
        });



        it('should fail: expectation formula should match an alternative NARS standard', () => {
            const tv = new TruthValue(0.8, 0.9);
            const alternativeExpectation = 0.9 * (0.8 - 0.5) + 0.5;
            expect(tv.expectation()).toBeCloseTo(alternativeExpectation);
        });
    });

    describe('transitive', () => {




        it('should fail: transitive confidence should not be excessively penalized by frequency difference', () => {
            const t1 = new TruthValue(0.9, 0.9);
            const t2 = new TruthValue(0.1, 0.9);
            const result = TruthValue.transitive(t1, t2);




            expect(result.confidence).toBeGreaterThan(0.5);
        });
    });

    describe('revise', () => {



        it('should fail: revision confidence should be strengthened by new evidence, not averaged', () => {
            const t1 = new TruthValue(0.8, 0.6, 1.0);
            const t2 = new TruthValue(0.8, 0.7, 1.0);
            const revised = TruthValue.revise(t1, t2);




            const maxConfidence = Math.max(t1.confidence, t2.confidence);
            expect(revised.confidence).toBeGreaterThan(maxConfidence);
        });
    });

});
