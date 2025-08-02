import { describe, it, expect, beforeEach } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';

describe('TemporalReasoner', () => {
    let nar;
    let temporalReasoner;

    beforeEach(() => {
        nar = new NARHyper({ useAdvanced: true });
        temporalReasoner = nar.temporalManager;
    });

    it('should correctly infer a "before" relationship through transitivity', () => {
        const eventA = 'eventA';
        const eventB = 'eventB';
        const eventC = 'eventC';

        temporalReasoner.addConstraint(eventA, eventB, 'before');
        temporalReasoner.addConstraint(eventB, eventC, 'before');

        const inferred = temporalReasoner.inferRelationship(eventA, eventC);
        expect(inferred).not.toBeNull();
        expect(inferred.relation).toBe('before');
    });

    it('should correctly compose "meets" and "starts" to infer "overlaps"', () => {
        const interval1 = temporalReasoner.interval('interval1', 1000, 2000);
        const interval2 = temporalReasoner.interval('interval2', 2000, 3000);
        const interval3 = temporalReasoner.interval('interval3', 2000, 4000);

        temporalReasoner.addConstraint(interval1, interval2, 'meets');
        temporalReasoner.addConstraint(interval2, interval3, 'starts');

        const inferred = temporalReasoner.inferRelationship(interval1, interval3);
        expect(inferred).not.toBeNull();
        // According to Allen's algebra, meets + starts = overlaps
        expect(inferred.relation).toBe('overlaps');
    });

    it('should handle a chain of temporal relations', () => {
        const actions = ['wake_up', 'get_dressed', 'eat_breakfast', 'leave_for_work'];
        for (let i = 0; i < actions.length - 1; i++) {
            temporalReasoner.addConstraint(actions[i], actions[i+1], 'before');
        }

        const inferred = temporalReasoner.inferRelationship('wake_up', 'leave_for_work');
        expect(inferred).not.toBeNull();
        expect(inferred.relation).toBe('before');
    });

    it('should return null for contradictory constraints', () => {
        const eventX = 'eventX';
        const eventY = 'eventY';

        temporalReasoner.addConstraint(eventX, eventY, 'before');
        // Adding a contradictory constraint should be handled gracefully
        const contradictoryConstraint = temporalReasoner.addConstraint(eventX, eventY, 'after');

        expect(contradictoryConstraint).toBeNull();
    });

    it('should generate a natural language description', () => {
        const event1 = 'meeting_starts';
        const event2 = 'presentation_due';
        temporalReasoner.addConstraint(event1, event2, 'after');

        const description = temporalReasoner.describeTemporalRelationship(event1, event2);
        expect(description).toBe(`The event "${event1}" happens after the event "${event2}".`);
    });

    it('should return an array of possible relations for ambiguous compositions', () => {
        const eventA = 'eventA';
        const eventB = 'eventB';
        const eventC = 'eventC';

        // A is before B
        temporalReasoner.addConstraint(eventA, eventB, 'before');
        // B is during C
        temporalReasoner.addConstraint(eventB, eventC, 'during');

        // The relationship between A and C is ambiguous
        const inferred = temporalReasoner.inferRelationship(eventA, eventC);
        expect(inferred).not.toBeNull();

        const expectedRelations = ['before', 'meets', 'overlaps', 'starts', 'during'];
        expect(Array.isArray(inferred.relation)).toBe(true);
        expect(inferred.relation).toHaveLength(expectedRelations.length);
        expect(inferred.relation.sort()).toEqual(expectedRelations.sort());
    });
});