import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { GoalManager } from './GoalManager.js';
import { TruthValue } from '../support/TruthValue.js';

// Mock the Date.now() to control time-based tests
const mockNow = 1700000000000;
jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

describe('GoalManager', () => {
  let nar;
  let goalManager;

  beforeEach(() => {
    // Use the advanced configuration to ensure all features are available
    nar = new NARHyper({ useAdvanced: true });
    goalManager = nar.goalManager;
    // Mock the emit function to spy on events
    nar.emit = jest.fn();
  });

  it('should add a new goal and emit an event', () => {
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

    expect(nar.emit).toHaveBeenCalledWith('goal-added', { goal: expect.any(Object) });
  });

  it('should abandon a goal if the deadline is passed', () => {
    const description = 'finish_report';
    const utility = 0.8;
    const deadline = mockNow - 1000; // Deadline is in the past

    const goalId = goalManager.addGoal(description, utility, { deadline });

    // Process goals to check their status
    goalManager.processGoals();

    const goal = goalManager.goals.get(goalId);
    expect(goal.status).toBe('abandoned');
    expect(nar.emit).toHaveBeenCalledWith('goal-abandoned', { goalId, reason: 'deadline' });
  });

  it('should achieve a goal if its condition is met in the knowledge base', () => {
    const description = 'sky_is_blue';
    const utility = 0.9;

    // Mock the query system to simulate the goal condition being met
    nar.query = jest.fn().mockReturnValue([{ truth: new TruthValue(0.9, 0.9) }]);

    const goalId = goalManager.addGoal(description, utility);
    goalManager.processGoals();

    const goal = goalManager.goals.get(goalId);
    expect(goal.status).toBe('achieved');
    expect(nar.query).toHaveBeenCalledWith(description, { minExpectation: 0.7 });
    expect(nar.emit).toHaveBeenCalledWith('goal-achieved', { goalId });
  });

  it('should prioritize the goal with the highest urgency', () => {
    const urgentGoalDesc = 'urgent_task';
    const normalGoalDesc = 'normal_task';

    // Urgent goal: high utility, approaching deadline
    const urgentGoalId = goalManager.addGoal(urgentGoalDesc, 0.9, { deadline: mockNow + 1000 });
    // Normal goal: lower utility, no deadline
    const normalGoalId = goalManager.addGoal(normalGoalDesc, 0.5);

    // Mock _processGoal to see which one is chosen
    const processGoalSpy = jest.spyOn(goalManager, '_processGoal').mockImplementation(() => {});

    goalManager.processGoals();

    expect(processGoalSpy).toHaveBeenCalledWith(urgentGoalId);

    processGoalSpy.mockRestore();
  });

  it('should not process a goal that is not active', () => {
    const description = 'already_achieved';
    const utility = 0.7;
    const goalId = goalManager.addGoal(description, utility);

    const goal = goalManager.goals.get(goalId);
    goal.status = 'achieved'; // Manually set status

    const processGoalSpy = jest.spyOn(goalManager, '_processGoal');
    goalManager.processGoals();

    expect(processGoalSpy).not.toHaveBeenCalled();
    processGoalSpy.mockRestore();
  });

  // This test verifies that the system can initiate the decomposition of a complex goal.
  // Note: The actual creation of subgoals is not yet fully implemented (see GoalManager.js),
  // but the parent goal's status should be correctly updated to 'waiting'.
  it('should identify a complex goal and set its status to waiting for decomposition', () => {
    const subGoal1 = '<a --> b>';
    const subGoal2 = '<c --> d>';
    const complexGoalDesc = `(&&, ${subGoal1}, ${subGoal2})`;

    // Mock the expression evaluator to return a parsed conjunction
    nar.expressionEvaluator.parse = jest.fn().mockReturnValue({
      type: 'Conjunction',
      args: [
        { type: 'Implication', args: ['a', 'b'] },
        { type: 'Implication', args: ['c', 'd'] },
      ],
    });

    // Mock the query to say the goal is not yet achieved
    nar.query = jest.fn().mockReturnValue([]);

    const goalId = goalManager.addGoal(complexGoalDesc, 0.9);
    goalManager.processGoals();

    const goal = goalManager.goals.get(goalId);
    // A correct implementation would set it to 'waiting'.
    expect(goal.status).toBe('waiting');
    expect(nar.emit).toHaveBeenCalledWith('goal-decomposed', expect.any(Object));
  });
});
