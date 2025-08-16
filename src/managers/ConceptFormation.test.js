import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {NAR} from '../NAR.js';
import {ConceptFormation} from './ConceptFormation.js';

describe('ConceptFormation', () => {
    let nar;
    let conceptFormation;

    beforeEach(() => {
        nar = new NAR({useAdvanced: true});
        conceptFormation = nar.conceptFormation;
        nar.run = jest.fn(); // Mock run to avoid long-running processes
    });

    it('should track usage of hyperedges', () => {
        const hyperedge1 = nar.api.inheritance('A', 'B');
        nar.state.activations.set(hyperedge1.args[0], 0.6); // Activate 'A'

        const trackUsageSpy = jest.spyOn(conceptFormation.patternTracker, 'recordPattern');
        conceptFormation.trackUsage(hyperedge1.id, 0.8, {priority: 0.9});

        expect(trackUsageSpy).toHaveBeenCalled();
        const patternData = conceptFormation.patternTracker.patterns.get(hyperedge1.id);
        expect(patternData).toBeDefined();
        expect(patternData.count).toBe(1);
    });

    it('should discover new concepts from frequent patterns', () => {
        // Manually create a frequent pattern for testing
        const pattern = {
            terms: ['termA', 'termB'],
            count: 5,
            signature: 'termA&termB',
            support: 0.8,
            confidence: 0.9
        };
        conceptFormation.patternTracker.patterns.set(pattern.signature, pattern);
        jest.spyOn(conceptFormation.patternTracker, 'getFrequentPatterns').mockReturnValue([pattern]);

        const termSpy = jest.spyOn(nar.api, 'term');
        const inheritanceSpy = jest.spyOn(nar.api, 'inheritance');

        const newConcepts = conceptFormation.discoverNewConcepts(0.7, 0.8);

        expect(newConcepts.length).toBe(1);
        expect(termSpy).toHaveBeenCalled();
        expect(inheritanceSpy).toHaveBeenCalledTimes(2);
    });
});
