import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from '@jest/globals';
import { System } from './System.js';

// Mock NAR object and its components
const createMockNar = () => ({
    state: {
        currentStep: 0,
        stepsSinceMaintenance: 0,
        eventQueue: {
            pop: jest.fn(),
            heap: { length: 0 },
        },
        activations: new Map(),
        pathCache: new Map(),
        index: {
            questionCache: new Map(),
        },
        questionPromises: new Map(),
    },
    config: {
        budgetThreshold: 0.1,
        memoryMaintenanceInterval: 100,
    },
    memoryManager: {
        updateRelevance: jest.fn(),
        maintainMemory: jest.fn(),
    },
    propagation: {
        updateActivation: jest.fn(),
        propagateWave: jest.fn(),
    },
    derivationEngine: {
        applyDerivationRules: jest.fn(),
    },
    questionHandler: {
        _resolveQuestion: jest.fn(),
    },
    contradictionManager: {
        resolveContradictions: jest.fn(),
    },
    cognitiveExecutive: {
        selfMonitor: jest.fn(),
    },
    learningEngine: {
        applyLearning: jest.fn(),
    },
    temporalManager: {
        adjustTemporalHorizon: jest.fn(),
    },
    goalManager: {
        processGoals: jest.fn(),
    },
    emit: jest.fn(),
});

describe('System', () => {
    let nar;
    let system;

    beforeEach(() => {
        nar = createMockNar();
        system = new System(nar);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('step', () => {
        it('should not process an event if budget is below threshold', () => {
            nar.state.eventQueue.pop.mockReturnValue({
                budget: { priority: 0.05 },
            });
            const result = system.step();
            expect(result).toBe(false);
            expect(
                nar.derivationEngine.applyDerivationRules
            ).not.toHaveBeenCalled();
        });

        it('should process a valid event', () => {
            const event = {
                target: 'concept1',
                budget: { priority: 0.5 },
                activation: 0.8,
            };
            nar.state.eventQueue.pop.mockReturnValue(event);
            nar.state.eventQueue.heap.length = 1;

            const result = system.step();

            expect(result).toBe(true);
            expect(nar.state.currentStep).toBe(1);
            expect(nar.memoryManager.updateRelevance).toHaveBeenCalledWith(
                'concept1',
                'processing',
                0.5
            );
            expect(nar.propagation.updateActivation).toHaveBeenCalledWith(
                'concept1',
                0.8
            );
            expect(
                nar.derivationEngine.applyDerivationRules
            ).toHaveBeenCalledWith(event);
            expect(nar.propagation.propagateWave).toHaveBeenCalledWith(event);
            expect(nar.emit).toHaveBeenCalledWith('step', expect.any(Object));
        });

        it('should trigger maintenance cycle after enough steps', () => {
            nar.state.stepsSinceMaintenance =
                nar.config.memoryMaintenanceInterval - 1;
            const event = { target: 'concept1', budget: { priority: 0.5 } };
            nar.state.eventQueue.pop.mockReturnValue(event);

            system.step();

            expect(nar.memoryManager.maintainMemory).toHaveBeenCalled();
            expect(
                nar.contradictionManager.resolveContradictions
            ).toHaveBeenCalled();
            expect(nar.cognitiveExecutive.selfMonitor).toHaveBeenCalled();
            expect(nar.learningEngine.applyLearning).toHaveBeenCalled();
            expect(
                nar.temporalManager.adjustTemporalHorizon
            ).toHaveBeenCalled();
            expect(nar.goalManager.processGoals).toHaveBeenCalled();
            expect(nar.state.stepsSinceMaintenance).toBe(0);
        });

        it('should handle an empty event queue gracefully', () => {
            nar.state.eventQueue.pop.mockReturnValue(null);
            const result = system.step();
            expect(result).toBe(false);
            expect(nar.emit).not.toHaveBeenCalled();
        });
    });

    describe('run', () => {
        it('should run for a specified number of steps', () => {
            // Let's make the step function do something minimal
            let counter = 0;
            system.step = jest.fn(() => {
                counter++;
                return counter <= 5;
            });

            system.run(5);

            expect(system.step).toHaveBeenCalledTimes(5);
        });

        it('should stop if step returns false', () => {
            system.step = jest
                .fn()
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false);

            system.run(10); // Ask for 10 steps

            expect(system.step).toHaveBeenCalledTimes(3);
        });
    });
});
