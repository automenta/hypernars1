import {describe, expect, it} from '@jest/globals';
import {NARHyper} from './NARHyper.js';

describe('NARHyper Core', () => {
    it('should handle wildcard queries', () => {
        const nar = new NARHyper({useAdvanced: true});
        nar.nal('term1.');
        nar.nal('term2.');
        nar.inheritance('bird', 'animal');

        const results = nar.query('Term(*)', {limit: 5});
        expect(results.length).toBe(2);
        expect(results.map(r => r.id)).toContain('Term(term1)');
        expect(results.map(r => r.id)).toContain('Term(term2)');

        const allResults = nar.query('*', {limit: 5});
        expect(allResults.length).toBe(3);
    });
});