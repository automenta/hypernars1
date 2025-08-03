import { describe, it, expect, jest } from '@jest/globals';
import { Hyperedge } from './Hyperedge.js';
import { TruthValue } from './TruthValue.js';
import { Budget } from './Budget.js';

const createMockNar = () => ({
  // Mock any nar properties or methods needed by Hyperedge
});

describe('Hyperedge', () => {
  let nar;

  beforeEach(() => {
    nar = createMockNar();
  });

  it('should be constructed with correct properties', () => {
    const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', ['arg1', 'arg2']);
    expect(hyperedge.id).toBe('TestID');
    expect(hyperedge.type).toBe('TestType');
    expect(hyperedge.args).toEqual(['arg1', 'arg2']);
    expect(hyperedge.beliefs).toEqual([]);
    expect(hyperedge.nar).toBe(nar);
  });

  describe('revise', () => {
    it('should add a new belief', () => {
      const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
      const truth = new TruthValue(0.9, 0.9);
      const budget = new Budget(0.9, 0.9, 0.9);

      const { newBelief, needsUpdate } = hyperedge.revise({ truth, budget });

      expect(hyperedge.beliefs.length).toBe(1);
      expect(hyperedge.beliefs[0]).toBe(newBelief);
      expect(newBelief.truth).toBe(truth);
      expect(newBelief.budget).toBe(budget);
      expect(needsUpdate).toBe(true);
    });

    it('should sort beliefs by budget priority', () => {
      const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
      const truth1 = new TruthValue(0.5, 0.9);
      const budget1 = new Budget(0.5, 0.9, 0.9); // lower priority
      const truth2 = new TruthValue(0.8, 0.9);
      const budget2 = new Budget(0.8, 0.9, 0.9); // higher priority

      hyperedge.revise({ truth: truth1, budget: budget1 });
      hyperedge.revise({ truth: truth2, budget: budget2 });

      expect(hyperedge.beliefs.length).toBe(2);
      expect(hyperedge.getStrongestBelief().budget.priority).toBe(0.8);
    });

    it('should not exceed belief capacity', () => {
      const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
      const beliefCapacity = 3;

      for (let i = 1; i <= 5; i++) {
        hyperedge.revise({
          truth: new TruthValue(0.1 * i, 0.9),
          budget: new Budget(0.1 * i, 0.9, 0.9),
          beliefCapacity: beliefCapacity
        });
      }

      expect(hyperedge.beliefs.length).toBe(beliefCapacity);
      // The belief with the lowest priority (0.1 and 0.2) should be evicted
      expect(hyperedge.beliefs.map(b => b.budget.priority)).not.toContain(0.1);
      expect(hyperedge.beliefs.map(b => b.budget.priority)).not.toContain(0.2);
    });
  });

  describe('getters', () => {
    it('getStrongestBelief should return the belief with the highest priority', () => {
      const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
      const budget1 = new Budget(0.5, 0.9, 0.9);
      const budget2 = new Budget(0.8, 0.9, 0.9);
      hyperedge.revise({ truth: new TruthValue(0.5, 0.9), budget: budget1 });
      hyperedge.revise({ truth: new TruthValue(0.8, 0.9), budget: budget2 });

      expect(hyperedge.getStrongestBelief().budget).toBe(budget2);
    });

    it('getTruth should return the truth of the strongest belief', () => {
        const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
        const truth1 = new TruthValue(0.5, 0.9);
        const truth2 = new TruthValue(0.8, 0.9);
        hyperedge.revise({ truth: truth1, budget: new Budget(0.5, 0.9, 0.9) });
        hyperedge.revise({ truth: truth2, budget: new Budget(0.8, 0.9, 0.9) });

        expect(hyperedge.getTruth()).toBe(truth2);
    });

    it('getTruth should return unknown truth if no beliefs', () => {
        const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
        const unknownTruth = TruthValue.unknown();
        // We need to compare the values, not the object instances
        expect(hyperedge.getTruth().frequency).toBe(unknownTruth.frequency);
        expect(hyperedge.getTruth().confidence).toBe(unknownTruth.confidence);
    });

    it('getTruthExpectation should return expectation of strongest belief', () => {
        const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
        const truth = new TruthValue(0.8, 0.5);
        hyperedge.revise({ truth: truth, budget: new Budget(0.9, 0.9, 0.9) });
        expect(hyperedge.getTruthExpectation()).toBeCloseTo(truth.expectation());
    });

    it('getTruthExpectation should return 0.5 if no beliefs', () => {
        const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
        expect(hyperedge.getTruthExpectation()).toBe(0.5);
    });
  });

  describe('toJSON', () => {
    it('should return a serializable JSON object', () => {
      const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', ['arg1']);
      const truth = new TruthValue(0.9, 0.9, 0.8, 0.1);
      const budget = new Budget(0.9, 0.9, 0.9);
      hyperedge.revise({ truth, budget });

      const json = hyperedge.toJSON();

      expect(json.id).toBe('TestID');
      expect(json.type).toBe('TestType');
      expect(json.args).toEqual(['arg1']);
      expect(json.beliefs.length).toBe(1);
      expect(json.beliefs[0].truth).toEqual({ frequency: 0.9, confidence: 0.9, priority: 0.8, doubt: 0.1 });
      expect(json.beliefs[0].budget).toEqual({ priority: 0.9, durability: 0.9, quality: 0.9 });
    });
  });

  // Failing test
  it('This test should fail: should retrieve the weakest belief', () => {
    const hyperedge = new Hyperedge(nar, 'TestID', 'TestType', []);
    const budget1 = new Budget(0.5, 0.9, 0.9);
    const budget2 = new Budget(0.8, 0.9, 0.9);
    hyperedge.revise({ truth: new TruthValue(0.5, 0.9), budget: budget1 });
    hyperedge.revise({ truth: new TruthValue(0.8, 0.9), budget: budget2 });

    // This method does not exist
    const weakestBelief = hyperedge.getWeakestBelief();
    expect(weakestBelief.budget).toBe(budget1);
  });
});
