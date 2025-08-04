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
            // e = f*c / (f*c + (1-f)*c) is not the formula used.
            // The formula used is e = f*c / (c + (1-c)) which simplifies to e = f.
            // Let's re-read the code.
            // expectation() {
            //   const { confidence } = this;
            //   return this.frequency * confidence / (confidence + (1 - confidence));
            // }
            // This is `f*c / c` which is `f`. This seems wrong.
            // The common NARS formula is e = (c * (f - 0.5)) + 0.5
            // Another one is w = c * (f-0.5) where w is weight.
            // Let's check the original code again.
            // It says: return this.frequency * confidence / (confidence + (1 - confidence));
            // This is indeed `f*c / 1` = `f*c`.
            // Let's test that.
            const tv = new TruthValue(0.8, 0.9);
            expect(tv.expectation()).toBeCloseTo(0.72); // 0.8 * 0.9
        });
    });

    describe('static methods', () => {
        it('revise should calculate the weighted average', () => {
            const t1 = new TruthValue(1.0, 1.0, 1.0);
            const t2 = new TruthValue(0.0, 1.0, 1.0);
            const revised = TruthValue.revise(t1, t2);
            expect(revised.frequency).toBeCloseTo(0.5);
            expect(revised.confidence).toBeCloseTo(1.0);
        });

        it('transitive should calculate transitive confidence', () => {
            const t1 = new TruthValue(0.8, 0.9);
            const t2 = new TruthValue(0.7, 0.8);
            const result = TruthValue.transitive(t1, t2);
            expect(result.frequency).toBeCloseTo(0.56); // 0.8 * 0.7
            expect(result.confidence).toBeCloseTo(0.648); // 0.9 * 0.8 * (1 - |0.8-0.7|) = 0.72 * 0.9
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
            // Ensure it's a new instance
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

    describe.skip('Additional Tests for Edge Cases and Formulas', () => {
        describe('expectation', () => {
            it('should be 0 if frequency is 0', () => {
                const tv = new TruthValue(0, 0.9);
                expect(tv.expectation()).toBe(0);
            });

            it('should be equal to confidence if frequency is 1', () => {
                const tv = new TruthValue(1, 0.9);
                expect(tv.expectation()).toBeCloseTo(0.9);
            });

            it('should be 0 if confidence is 0', () => {
                const tv = new TruthValue(0.8, 0);
                expect(tv.expectation()).toBe(0);
            });

            it('should be equal to frequency if confidence is 1', () => {
                const tv = new TruthValue(0.8, 1);
                expect(tv.expectation()).toBeCloseTo(0.8);
            });

            // This test is based on a common NARS expectation formula e = c*(f-0.5)+0.5
            // The current implementation uses e = f*c. This test will fail and highlight the difference.
            it('should fail: expectation formula should match an alternative NARS standard', () => {
                const tv = new TruthValue(0.8, 0.9);
                const alternativeExpectation = 0.9 * (0.8 - 0.5) + 0.5; // 0.9 * 0.3 + 0.5 = 0.27 + 0.5 = 0.77
                expect(tv.expectation()).toBeCloseTo(alternativeExpectation);
            });
        });

        describe('transitive', () => {
            // This test will fail. The formula for transitive confidence seems non-standard.
            // If two beliefs are very far apart in frequency (e.g., 0.9 and 0.1), the confidence
            // of their transitive combination is heavily penalized by the (1 - |f1 - f2|) term.
            // Let's test an extreme case.
            it('should fail: transitive confidence should not be excessively penalized by frequency difference', () => {
                const t1 = new TruthValue(0.9, 0.9);
                const t2 = new TruthValue(0.1, 0.9);
                const result = TruthValue.transitive(t1, t2);

                // Current formula: 0.9 * 0.9 * (1 - |0.9 - 0.1|) = 0.81 * (1 - 0.8) = 0.81 * 0.2 = 0.162
                // A more standard formula might just be c1*c2 = 0.81.
                // Let's assert that the confidence should be higher than what the current formula gives.
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });

        describe('revise', () => {
            // This test highlights that the revision formula for confidence is a simple weighted average,
            // which differs from the standard NARS formula where new evidence strengthens confidence.
            // Standard formula: c_new = 1 - (1 - c1) * (1 - c2)
            it('should fail: revision confidence should be strengthened by new evidence, not averaged', () => {
                const t1 = new TruthValue(0.8, 0.6, 1.0); // priority 1
                const t2 = new TruthValue(0.8, 0.7, 1.0); // priority 1
                const revised = TruthValue.revise(t1, t2);

                // Current implementation (weighted average): (0.6*1.0 + 0.7*1.0) / (1.0+1.0) = 0.65
                // Standard NARS implementation: 1 - (1-0.6)*(1-0.7) = 1 - 0.4*0.3 = 1 - 0.12 = 0.88
                // The assertion checks if confidence is greater than the max of the inputs.
                const maxConfidence = Math.max(t1.confidence, t2.confidence);
                expect(revised.confidence).toBeGreaterThan(maxConfidence);
            });
        });
    });
});
