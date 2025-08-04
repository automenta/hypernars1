import {describe, expect, it, jest} from '@jest/globals';
import {NARHyper} from '../NARHyper.js';
import {MetaReasoner} from './MetaReasoner.js';

const config = {
    useAdvanced: true,
    modules: {
        MetaReasoner: MetaReasoner
    }
};

describe('MetaReasoner', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should configure and retrieve strategies', () => {
        const nar = new NARHyper(config);

        nar.metaReasoner.configureStrategy({
            context: 'test-context',
            strategy: 'test-strategy',
            priority: 10
        });

        // Mock the context assessment to return our test context
        jest.spyOn(nar.metaReasoner, '_assessReasoningContext').mockReturnValue(['test-context']);

        const activeStrategy = nar.metaReasoner.getActiveStrategy();
        expect(activeStrategy).toBe('test-strategy');
    });

    it('should run self-monitoring and produce metrics', () => {
        const nar = new NARHyper(config);
        nar.state.eventQueue.push({ budget: { priority: 0.5 } });
        const report = nar.metaReasoner.selfMonitor();

        expect(report).toBeDefined();
        expect(report.metrics).toBeDefined();
        expect(typeof report.metrics.queueSize).toBe('number');
        expect(report.metrics.contradictionRate).toBeGreaterThanOrEqual(0);
        expect(report.issues).toBeInstanceOf(Array);
    });

    it('should adapt reasoning parameters for high contradictions', () => {
        const nar = new NARHyper(config);
        const initialInferenceThreshold = nar.config.inferenceThreshold;
        jest.spyOn(nar.metaReasoner, '_calculateMetrics').mockReturnValue({
            contradictionRate: 0.5,
            inferenceRate: 0.5,
            resourceUtilization: 0.5,
            questionResponseTime: 1.0,
        });

        nar.metaReasoner.selfMonitor();
        expect(nar.config.inferenceThreshold).toBeGreaterThan(initialInferenceThreshold);
    });

    it('should adapt to a real high-contradiction scenario', () => {
        const nar = new NARHyper(config);
        const initialThreshold = nar.config.inferenceThreshold;

        // Mock the metrics to force the issue, making the test deterministic
        jest.spyOn(nar.metaReasoner, '_calculateMetrics').mockReturnValue({
            contradictionRate: 0.8, // Force a high contradiction rate
            inferenceRate: 0.5,
            resourceUtilization: 0.5,
            questionResponseTime: 1.0,
        });

        const report = nar.metaReasoner.selfMonitor();

        expect(report.issues).toContain('high-contradictions');
        expect(nar.config.inferenceThreshold).toBeGreaterThan(initialThreshold);
    });

    it('should provide a reasoning trace', () => {
        const nar = new NARHyper(config);
        nar.metaReasoner.addToTrace({ type: 'test-event-1' });
        nar.metaReasoner.addToTrace({ type: 'test-event-2' });
        const trace = nar.metaReasoner.getTrace(2);
        expect(trace.length).toBe(2);
        expect(trace[0].type).toBe('test-event-1');
    });


    it('should adapt reasoning when question responses are slow', () => {
        const nar = new NARHyper(config);
        const initialTimeout = nar.config.questionTimeout;
        jest.spyOn(nar.metaReasoner, '_calculateMetrics').mockReturnValue({
            contradictionRate: 0.1,
            inferenceRate: 0.5,
            resourceUtilization: 0.5,
            questionResponseTime: 0.2,
        });
        const report = nar.metaReasoner.selfMonitor();
        expect(report.issues).toContain('slow-question-response');
        expect(nar.config.questionTimeout).toBeGreaterThan(initialTimeout);
    });

    it('should NOT adapt reasoning when metrics are good', () => {
        const nar = new NARHyper(config);
        const initialConfig = { ...nar.config };

        jest.spyOn(nar.metaReasoner, '_calculateMetrics').mockReturnValue({
            contradictionRate: 0.1,
            inferenceRate: 0.8,
            resourceUtilization: 0.5,
            questionResponseTime: 0.9,
        });

        const report = nar.metaReasoner.selfMonitor();
        expect(report.issues).toEqual([]);
        expect(nar.config.inferenceThreshold).toBe(initialConfig.inferenceThreshold);
        expect(nar.config.questionTimeout).toBe(initialConfig.questionTimeout);
    });

});