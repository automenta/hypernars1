import { describe, it, expect, beforeEach } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { GoalManager } from './GoalManager.js';

describe('GoalManager', () => {
  let nar;
  let goalManager;

  beforeEach(() => {
    nar = new NARHyper();
    goalManager = nar.goalManager;
  });

  it('should add a new goal', () => {
    const description = 'achieve_world_peace';
    const utility = 0.99;

    const goalId = goalManager.addGoal(description, utility);

    const goals = goalManager.getActiveGoals();
    expect(goals.length).toBe(1);

    const goal = goals[0];
    expect(goal.id).toBe(goalId);
    expect(goal.description).toBe(description);
    expect(goal.utility).toBe(utility);
    expect(goal.status).toBe('active');
  });
});
