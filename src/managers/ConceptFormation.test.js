import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NAR } from '../NAR.js';

describe('ConceptFormation', () => {
    let nar;

    beforeEach(() => {
        nar = new NAR({ useAdvanced: true });
    });

    it('should be instantiated in NARHyper', () => {
        expect(nar.conceptFormation).toBeDefined();
    });

    it('should track usage of hyperedges', () => {
        const trackUsageSpy = jest.spyOn(nar.conceptFormation, 'trackUsage');

        nar.api.nal('<A --> B>.');
        nar.run(1);

        expect(trackUsageSpy).toHaveBeenCalled();
    });

    it('should discover new concepts', () => {
        nar.api.nal('<A --> B>.');
        nar.api.nal('<A --> C>.');
        nar.api.nal('<B --> C>.');

        nar.run(10);

        const newConcepts = nar.conceptFormation.discoverNewConcepts(2, 0.7);

        expect(newConcepts.length).toBeGreaterThan(0);
    });
});
