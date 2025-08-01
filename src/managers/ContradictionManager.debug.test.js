import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';
import { AdvancedContradictionManager } from '../managers/AdvancedContradictionManager.js';

const config = {
    modules: {
        ContradictionManager: AdvancedContradictionManager
    }
};

describe('ContradictionManager Debug', () => {
    it('should correctly select and execute the merge strategy', () => {
        const nar = new NARHyper(config);
        const term = id('Inheritance', ['bat', 'mammal']);

        nar.api.inheritance('bat', 'mammal', {truth: new TruthValue(0.9, 0.8), budget: new Budget(0.8, 0.9, 0.9)});
        nar.api.inheritance('bat', 'mammal', {truth: new TruthValue(0.85, 0.85), budget: new Budget(0.78, 0.9, 0.9)});

        nar.contradictionManager.addEvidence(term, { source: 'default', strength: 0.8, beliefIndex: 0 });
        nar.contradictionManager.addEvidence(term, { source: 'default', strength: 0.78, beliefIndex: 1 });

        nar.contradictionManager.detectContradiction(term);

        const contradictionData = nar.contradictionManager.contradictions.get(term);
        const strategyName = nar.contradictionManager._selectResolutionStrategy(term, contradictionData);

        console.log('Selected Strategy:', strategyName);
        expect(strategyName).toBe('merge');

        const result = nar.contradictionManager.manualResolve(term, 'merge');
        console.log('Merge Result:', result);
        expect(result).not.toBeNull();
    });
});
