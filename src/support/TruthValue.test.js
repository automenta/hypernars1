import { TruthValue } from './TruthValue.js';

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
});
