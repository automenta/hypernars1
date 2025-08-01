import { describe, it, expect, jest } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { MetaReasoner } from './MetaReasoner.js';

const config = {
    modules: {
        MetaReasoner: MetaReasoner
    }
};

describe('MetaReasoner', () => {

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

        // Add some activity to generate metrics
        nar.state.eventQueue.push({ budget: { priority: 0.5 } });
        nar.metaReasoner.addToTrace({ type: 'contradiction-resolved' });

        const report = nar.metaReasoner.selfMonitor();

        expect(report).toBeDefined();
        expect(report.metrics).toBeDefined();
        expect(report.metrics.queueSize).toBe(1);
        expect(report.metrics.contradictionRate).toBeGreaterThan(0);
        expect(report.issues).toBeInstanceOf(Array);
    });

    it('should adapt reasoning parameters based on detected issues', () => {
        const nar = new NARHyper(config);
        const initialInferenceThreshold = nar.config.inferenceThreshold;

        // Mock the metric calculators to force ONLY the desired issue
        jest.spyOn(nar.metaReasoner, '_calculateContradictionRate').mockReturnValue(0.5); // high-contradictions
        jest.spyOn(nar.metaReasoner, '_calculateInferenceRate').mockReturnValue(0.5); // normal inference rate

        nar.metaReasoner.selfMonitor();

        // With high contradictions, the inference threshold should be increased (to be more skeptical)
        expect(nar.config.inferenceThreshold).toBeCloseTo(initialInferenceThreshold * 1.05);
    });

    it('should provide a reasoning trace', () => {
        const nar = new NARHyper(config);

        nar.metaReasoner.addToTrace({ type: 'test-event-1' });
        nar.metaReasoner.addToTrace({ type: 'test-event-2' });

        const trace = nar.metaReasoner.getTrace(2);

        expect(trace.length).toBe(2);
        expect(trace[0].type).toBe('test-event-1');
        expect(trace[1].type).toBe('test-event-2');
    });
});
