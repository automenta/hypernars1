import { describe, it, expect, jest } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { id } from '../support/utils.js';

describe('AdvancedTemporalManager', () => {
    it('should create a temporal interval using during()', () => {
        const nar = new NARHyper();
        const term = 'meeting';
        const start = '09:00';
        const end = '10:00';

        const intervalId = nar.temporalManager.during(term, start, end);
        const expectedId = id('TemporalInterval', [term, start, end, null]);

        expect(intervalId).toBe(expectedId);
        const hyperedge = nar.state.hypergraph.get(intervalId);
        expect(hyperedge).toBeDefined();
        expect(hyperedge.type).toBe('TemporalInterval');
    });

    it('should create a temporal relation using relate()', () => {
        const nar = new NARHyper();
        const term1 = 'lunch';
        const term2 = 'afternoon_meeting';
        const relation = 'before';

        const relationId = nar.temporalManager.relate(term1, term2, relation);
        const expectedId = id('TemporalRelation', [term1, term2, relation]);

        expect(relationId).toBe(expectedId);
        const hyperedge = nar.state.hypergraph.get(relationId);
        expect(hyperedge).toBeDefined();
        expect(hyperedge.type).toBe('TemporalRelation');
    });

    it('should trigger transitive temporal derivation in the engine', () => {
        const nar = new NARHyper();

        // Spy on the derivation engine to see if it's triggered
        const derivationSpy = jest.spyOn(nar.derivationEngine, 'applyDerivationRules');

        // A before B
        nar.temporalManager.relate('A', 'B', 'before');
        // B before C
        nar.temporalManager.relate('B', 'C', 'before');

        // Manually run a few steps to allow derivation to occur
        nar.step();
        nar.step();
        nar.step();
        nar.step();

        // Check if the derivation engine was called for a TemporalRelation
        const wasTemporalRuleCalled = derivationSpy.mock.calls.some(call => {
            const event = call[0];
            const hyperedge = nar.state.hypergraph.get(event.target);
            return hyperedge?.type === 'TemporalRelation';
        });
        expect(wasTemporalRuleCalled).toBe(true);

        // Check if the transitive conclusion (A before C) exists
        const conclusionId = id('TemporalRelation', ['A', 'C', 'before']);
        const conclusion = nar.state.hypergraph.get(conclusionId);
        expect(conclusion).toBeDefined();
    });
});
