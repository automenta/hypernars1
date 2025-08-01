import { NARHyper } from '../NARHyper.js';

describe('AdvancedTemporalManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper();
    });

    test('should load the AdvancedTemporalManager', () => {
        expect(nar.temporalManager._isAdvanced).toBe(true);
    });

    test('should create and retrieve a temporal interval', () => {
        const start = Date.now();
        const end = start + 1000;
        nar.temporalManager.interval('event_A', start, end);

        const results = nar.temporalManager.query('event_A');
        expect(results).toHaveLength(1);
        expect(results[0].term).toBe('event_A');
        expect(results[0].start).toBe(start);
        expect(results[0].end).toBe(end);
    });

    test('should correctly relate two intervals with "before"', () => {
        const t1 = nar.temporalManager.interval('event_A', 1000, 2000);
        const t2 = nar.temporalManager.interval('event_B', 3000, 4000);

        const relationId = nar.temporalManager.relate(t1, t2);
        const relation = nar.state.hypergraph.get(relationId);

        expect(relation.type).toBe('TemporalRelation');
        expect(relation.args).toEqual([t1, t2, 'before']);
    });

    test('should derive transitive temporal relations (before)', async () => {
        const t1 = nar.temporalManager.interval('event_A', 1000, 2000);
        const t2 = nar.temporalManager.interval('event_B', 3000, 4000);
        const t3 = nar.temporalManager.interval('event_C', 5000, 6000);

        nar.temporalManager.relate(t1, t2);
        nar.temporalManager.relate(t2, t3);

        const derivedRelationId = `TemporalRelation(${t1},${t3},before)`;
        const answerPromise = nar.ask(derivedRelationId, { minExpectation: 0.6 });

        nar.run(30);

        const answer = await answerPromise;

        expect(answer).not.toBeNull();
        expect(answer.truth.confidence).toBeGreaterThan(0.5);

        const derivedRelation = nar.state.hypergraph.get(derivedRelationId);
        expect(derivedRelation).toBeDefined();
        expect(derivedRelation.getStrongestBelief().premises).toBeDefined();
        expect(derivedRelation.getStrongestBelief().premises.length).toBe(2);
    });

    test('should derive transitive temporal relations (during)', async () => {
        const t1 = nar.temporalManager.interval('event_A', 1000, 5000);
        const t2 = nar.temporalManager.interval('event_B', 2000, 4000); // B during A
        const t3 = nar.temporalManager.interval('event_C', 2500, 3500); // C during B

        nar.temporalManager.relate(t2, t1); // Should compute 'during'
        nar.temporalManager.relate(t3, t2); // Should compute 'during'

        const derivedRelationId = `TemporalRelation(${t3},${t1},during)`;
        const answerPromise = nar.ask(derivedRelationId, { minExpectation: 0.6 });

        nar.run(30);

        const answer = await answerPromise;

        expect(answer).not.toBeNull();
        expect(answer.truth.confidence).toBeGreaterThan(0.5);
    });
});
