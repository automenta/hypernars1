import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {NAR} from '../NAR.js';

describe('CognitiveExecutive', () => {
    let nar;

    beforeEach(() => {
        nar = new NAR({useAdvanced: true});
    });

    it('should be instantiated in NARHyper', () => {
        expect(nar.cognitiveExecutive).toBeDefined();
    });

    it('should monitor derivation rules', () => {
        const monitorDerivationSpy = jest.spyOn(nar.cognitiveExecutive, 'monitorDerivation');

        nar.api.nal('<A --> B>.');
        nar.api.nal('<B --> C>.');
        nar.run(10);

        expect(monitorDerivationSpy).toHaveBeenCalled();
    });

    it('should adapt rule priorities based on performance', () => {

        nar.cognitiveExecutive.monitorDerivation('Inheritance', true, 10, 0.8);
        nar.cognitiveExecutive.monitorDerivation('Similarity', false, 20, 0.1);

        const initialInheritancePriority = nar.derivationEngine.rules.get('Inheritance').priority;

        nar.cognitiveExecutive.adaptRulePriorities();

        const newInheritancePriority = nar.derivationEngine.rules.get('Inheritance').priority;



        expect(newInheritancePriority).not.toBe(initialInheritancePriority);
    });
});
