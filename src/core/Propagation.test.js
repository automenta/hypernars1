import { describe, it, expect, beforeEach } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { Budget } from '../support/Budget.js';

describe('Propagation', () => {
  let nar;
  let propagation;

  beforeEach(() => {
    nar = new NARHyper();
    propagation = nar.propagation;
  });

  it('should add a valid event to the event queue', () => {
    const event = {
      target: 'some_target',
      activation: 0.8,
      budget: new Budget({ priority: 0.9, durability: 0.9, quality: 0.9 }),
      pathHash: 123,
      pathLength: 1,
      derivationPath: []
    };

    propagation.propagate(event);

    expect(nar.state.eventQueue.length).toBe(1);
    expect(nar.state.eventQueue.peek()).toEqual(event);
  });

  it('should not add an event with low budget to the queue', () => {
    const event = {
      target: 'some_target',
      activation: 0.8,
      budget: new Budget({ priority: 0.01, durability: 0.9, quality: 0.9 }),
      pathHash: 123,
      pathLength: 1,
      derivationPath: []
    };

    propagation.propagate(event);

    expect(nar.state.eventQueue.length).toBe(0);
  });

  it('should not add an event with a long path to the queue', () => {
    const event = {
      target: 'some_target',
      activation: 0.8,
      budget: new Budget({ priority: 0.9, durability: 0.9, quality: 0.9 }),
      pathHash: 123,
      pathLength: nar.config.maxPathLength + 1,
      derivationPath: []
    };

    propagation.propagate(event);

    expect(nar.state.eventQueue.length).toBe(0);
  });

  it('should not add an event that creates a loop', () => {
    const event = {
      target: 'some_target',
      activation: 0.8,
      budget: new Budget({ priority: 0.9, durability: 0.9, quality: 0.9 }),
      pathHash: 123,
      pathLength: 1,
      derivationPath: []
    };

    // First propagation should succeed
    propagation.propagate(event);
    expect(nar.state.eventQueue.length).toBe(1);

    // Second propagation with the same target and pathHash should be blocked
    nar.state.eventQueue.pop(); // Clear the queue for the next check
    propagation.propagate(event);
    expect(nar.state.eventQueue.length).toBe(0);
  });
});
