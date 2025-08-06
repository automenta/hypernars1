import {beforeEach, describe, expect, it} from '@jest/globals';
import {NAR} from '../NAR.js';
import {Budget} from '../support/Budget.js';

describe('Propagation', () => {
    let nar;
    let propagation;

    beforeEach(() => {
        nar = new NAR({budgetThreshold: 0.1});
        propagation = nar.propagation;

        nar.state.eventQueue = new nar.state.eventQueue.constructor((a, b) => b.budget.priority - a.budget.priority);
    });

    it('should add a valid event to the event queue', () => {
        const event = {
            target: 'some_target',
            activation: 0.8,
            budget: new Budget({priority: 0.9, durability: 0.9, quality: 0.9}),
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
            budget: new Budget(0.01, 0.9, 0.9),
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
            budget: new Budget({priority: 0.9, durability: 0.9, quality: 0.9}),
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
            budget: new Budget({priority: 0.9, durability: 0.9, quality: 0.9}),
            pathHash: 123,
            pathLength: 1,
            derivationPath: []
        };


        propagation.propagate(event);
        expect(nar.state.eventQueue.length).toBe(1);


        nar.state.eventQueue.pop();
        propagation.propagate(event);
        expect(nar.state.eventQueue.length).toBe(0);
    });
});
