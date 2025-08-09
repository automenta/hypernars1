import {describe, expect, it} from '@jest/globals';
import {composeTemporalRelations, getInverseTemporalRelation} from './temporalUtils.js';

describe('Temporal Utils', () => {
    describe('getInverseTemporalRelation', () => {
        it('should return the correct inverse for each relation', () => {
            expect(getInverseTemporalRelation('before')).toBe('after');
            expect(getInverseTemporalRelation('after')).toBe('before');
            expect(getInverseTemporalRelation('meets')).toBe('metBy');
            expect(getInverseTemporalRelation('metBy')).toBe('meets');
            expect(getInverseTemporalRelation('overlaps')).toBe('overlappedBy');
            expect(getInverseTemporalRelation('overlappedBy')).toBe('overlaps');
            expect(getInverseTemporalRelation('during')).toBe('contains');
            expect(getInverseTemporalRelation('contains')).toBe('during');
            expect(getInverseTemporalRelation('starts')).toBe('startedBy');
            expect(getInverseTemporalRelation('startedBy')).toBe('starts');
            expect(getInverseTemporalRelation('finishes')).toBe('finishedBy');
            expect(getInverseTemporalRelation('finishedBy')).toBe('finishes');
            expect(getInverseTemporalRelation('equals')).toBe('equals');
        });
    });

    describe('composeTemporalRelations', () => {
        it('should compose "before" and "before" to "before"', () => {
            const result = composeTemporalRelations('before', 'before');
            expect(result).toEqual(['before']);
        });

        it('should compose "meets" and "starts" to "starts"', () => {
            const result = composeTemporalRelations('meets', 'starts');
            expect(result).toEqual(['starts']);
        });

        it('should compose "overlaps" and "during" to complex result', () => {
            const result = composeTemporalRelations('overlaps', 'during');
            expect(result).toEqual(expect.arrayContaining(['during', 'overlaps', 'finishes']));
        });

        it('should return null for undefined compositions', () => {
            const result = composeTemporalRelations('during', 'before');
            expect(result).toBeNull();
        });

        it('should use inverse relations for composition', () => {
            const result = composeTemporalRelations('after', 'after');
            expect(result).toEqual(['after']);
        });
    });
});
