import { Budget } from './Budget.js';

describe('Budget', () => {
  describe('constructor', () => {
    it('should create a Budget with given priority, durability, and quality', () => {
      const budget = new Budget(0.8, 0.7, 0.9);
      expect(budget.priority).toBe(0.8);
      expect(budget.durability).toBe(0.7);
      expect(budget.quality).toBe(0.9);
    });

    it('should clamp values to be between 0 and 1', () => {
      const budget = new Budget(1.5, -0.5, 5);
      expect(budget.priority).toBe(1);
      expect(budget.durability).toBe(0);
      expect(budget.quality).toBe(1);
    });
  });

  describe('total', () => {
    it('should calculate the average of priority, durability, and quality', () => {
      const budget = new Budget(0.9, 0.6, 0.3);
      expect(budget.total()).toBeCloseTo(0.6);
    });
  });

  describe('scale', () => {
    it('should scale all components by a factor', () => {
      const budget = new Budget(0.8, 0.6, 0.4);
      const scaled = budget.scale(0.5);
      expect(scaled.priority).toBe(0.4);
      expect(scaled.durability).toBe(0.3);
      expect(scaled.quality).toBe(0.2);
    });
  });

  describe('merge', () => {
    it('should merge two budgets by averaging their components', () => {
      const b1 = new Budget(1.0, 0.8, 0.6);
      const b2 = new Budget(0.0, 0.2, 0.4);
      const merged = b1.merge(b2);
      expect(merged.priority).toBe(0.5);
      expect(merged.durability).toBe(0.5);
      expect(merged.quality).toBe(0.5);
    });
  });

  describe('equivalent', () => {
    it('should return true for budgets with similar components', () => {
      const b1 = new Budget(0.8, 0.8, 0.8);
      const b2 = new Budget(0.81, 0.79, 0.82);
      expect(b1.equivalent(b2)).toBe(true);
    });

    it('should return false for budgets with different components', () => {
      const b1 = new Budget(0.8, 0.8, 0.8);
      const b2 = new Budget(0.9, 0.8, 0.8);
      expect(b1.equivalent(b2)).toBe(false);
    });
  });

  describe('static full', () => {
    it('should return a budget with all components set to 1.0', () => {
      const fullBudget = Budget.full();
      expect(fullBudget.priority).toBe(1.0);
      expect(fullBudget.durability).toBe(1.0);
      expect(fullBudget.quality).toBe(1.0);
    });
  });
});
