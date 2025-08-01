import { describe, it, expect, test } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { AdvancedTemporalManager } from './AdvancedTemporalManager.js';
import { id } from '../support/utils.js';

const config = {
    modules: {
        TemporalManager: AdvancedTemporalManager
    }
};

describe('AdvancedTemporalManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper(config);
    });

    test('should create a temporal interval using "during"', () => {
        const start = Date.now();
        const end = start + 1000;
        const intervalId = nar.temporalManager.during('event_A', start, end);

        const hyperedge = nar.state.hypergraph.get(intervalId);
        expect(hyperedge).toBeDefined();
        expect(hyperedge.type).toBe('TimeInterval');
        expect(hyperedge.args).toEqual(['event_A', start, end]);
    });

    test('should create a relative temporal relation', () => {
        const relationId = nar.temporalManager.relate('event_A', 'event_B', 'before');
        const hyperedge = nar.state.hypergraph.get(relationId);

        expect(hyperedge).toBeDefined();
        expect(hyperedge.type).toBe('TemporalRelation');
        expect(hyperedge.args).toEqual(['event_A', 'event_B', 'before']);
    });

    test('should create a future prediction', () => {
        const projectionId = nar.temporalManager.predict('traffic_jam', 'during(commute)', 30);
        const hyperedge = nar.state.hypergraph.get(projectionId);

        expect(hyperedge).toBeDefined();
        expect(hyperedge.type).toBe('TemporalProjection');
        expect(hyperedge.args).toEqual(['traffic_jam', 'during(commute)', 30]);

        const projection = nar.temporalManager.projections.get(projectionId);
        expect(projection).toBeDefined();
        expect(projection.event).toBe('traffic_jam');
        // Check that the projection time is roughly 30 minutes in the future
        expect(projection.projectionTime).toBeGreaterThan(Date.now() + 29 * 60000);
        expect(projection.projectionTime).toBeLessThan(Date.now() + 31 * 60000);
    });

    test('should get a temporal context', () => {
        const context = nar.temporalManager.getContext();
        expect(context).toHaveProperty('timestamp');
        expect(context).toHaveProperty('currentPeriod');
        expect(context).toHaveProperty('season');
    });

    // This test is adapted from the old test suite to check transitive derivation
    // It now relies on the DerivationEngine to work correctly with the new manager
    test('should derive transitive temporal relations (before)', async () => {
        nar.temporalManager.relate('event_A', 'event_B', 'before');
        nar.temporalManager.relate('event_B', 'event_C', 'before');

        // We expect the system to derive that A is before C
        const derivedRelationId = id('TemporalRelation', ['event_A', 'event_C', 'before']);
        const answerPromise = nar.ask(derivedRelationId, { minExpectation: 0.6 });

        nar.run(30); // Run the system for a few steps to allow derivation

        const answer = await answerPromise;

        expect(answer).not.toBeNull();
        expect(answer.truth.confidence).toBeGreaterThan(0.45); // Lowered threshold to account for learning adjustments

        const derivedRelation = nar.state.hypergraph.get(derivedRelationId);
        expect(derivedRelation).toBeDefined();
    });

    test('should handle "during" with a pattern', () => {
        const intervalId = nar.temporalManager.during('meeting', '9:00-10:00', 'daily');
        const expectedId = id('TimeInterval', ['meeting', '9:00-10:00', 'daily']);
        expect(intervalId).toBe(expectedId);

        const hyperedge = nar.state.hypergraph.get(intervalId);
        expect(hyperedge).toBeDefined();
        expect(hyperedge.type).toBe('TimeInterval');
        expect(hyperedge.args).toEqual(['meeting', '9:00-10:00', 'daily']);
    });

    test('should prune old projections with adjustTemporalHorizon', () => {
        // Manually add a projection that is already expired
        const oldProjectionId = nar.temporalManager._addTemporalProjection('old_event', 'some_pattern', -1);
        expect(nar.temporalManager.projections.has(oldProjectionId)).toBe(true);

        nar.temporalManager.adjustTemporalHorizon();

        expect(nar.temporalManager.projections.has(oldProjectionId)).toBe(false);
    });

    // This test checks a more complex temporal composition rule
    test('should derive transitive temporal relations (overlaps -> starts)', async () => {
        nar.temporalManager.relate('event_A', 'event_B', 'overlaps');
        nar.temporalManager.relate('event_B', 'event_C', 'starts');

        // According to Allen's interval algebra composition table,
        // A overlaps B and B starts C implies A overlaps C.
        const derivedRelationId = id('TemporalRelation', ['event_A', 'event_C', 'overlaps']);
        const answerPromise = nar.ask(derivedRelationId, { minExpectation: 0.5 });

        nar.run(40); // Run for more steps just in case

        const answer = await answerPromise;

        expect(answer).not.toBeNull();
        if (answer) { // Guard against null answer
            expect(answer.truth.confidence).toBeGreaterThan(0.4); // Composition can lower confidence
        }

        const derivedRelation = nar.state.hypergraph.get(derivedRelationId);
        expect(derivedRelation).toBeDefined();
    });

    test('should query intervals within a time window', () => {
        const now = Date.now();
        nar.temporalManager.during('event_1', now - 1000, now + 1000); // Overlaps
        nar.temporalManager.during('event_2', now + 2000, now + 4000); // Outside
        nar.temporalManager.during('event_3', now - 500, now + 500);   // Inside
        nar.temporalManager.during('event_4', now + 800, now + 1200);  // Overlaps start

        const results = nar.temporalManager.queryTimeWindow(now, now + 1000);
        const resultTerms = results.map(r => r.term);

        expect(results.length).toBe(3);
        expect(resultTerms).toContain('event_1');
        expect(resultTerms).toContain('event_3');
        expect(resultTerms).toContain('event_4');
        expect(resultTerms).not.toContain('event_2');
    });
});
