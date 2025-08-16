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
        const activeNeighborKey = 'A'; // Based on the active neighbor 'A' with activation > 0.4
        const patternData = conceptFormation.patternTracker.patterns.get(activeNeighborKey);
        expect(patternData).toBeDefined();
        expect(patternData.occurrences).toBe(1);
    });

    it('should discover new concepts from frequent patterns', () => {
        // Manually create a frequent pattern for testing
        const patternKey = 'termA|termB';
        const pattern = {
            terms: ['termA', 'termB'],
            support: 5, // A high enough support to be considered frequent
            totalActivation: 4,
            totalPriority: 4.5,
            occurrences: 5,
        };
        conceptFormation.patternTracker.patterns.set(patternKey, pattern);

        const termSpy = jest.spyOn(nar.api, 'term').mockReturnValue(nar.api.addHyperedge('Term', ['newConcept']));
        const inheritanceSpy = jest.spyOn(nar.api, 'inheritance').mockReturnValue(nar.api.addHyperedge('Inheritance', ['termA', 'newConcept']));

        const newConcepts = conceptFormation.discoverNewConcepts(0.6, 0.8);

        expect(newConcepts.length).toBe(1);
        expect(termSpy).toHaveBeenCalled();
        expect(inheritanceSpy).toHaveBeenCalledTimes(2); // One for each term in the pattern
    });
});
