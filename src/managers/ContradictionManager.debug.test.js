import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';
import { AdvancedContradictionManager } from './AdvancedContradictionManager.js';

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
        nar.api.inheritance('bat', 'mammal', {truth: new TruthValue(0.2, 0.85), budget: new Budget(0.78, 0.9, 0.9)});

        const hyperedge = nar.state.hypergraph.get(term);
        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.9);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.2);
        nar.contradictionManager.addEvidence(term, belief1.id, { source: 'default', strength: 0.8 });
        nar.contradictionManager.addEvidence(term, belief2.id, { source: 'default', strength: 0.78 });

        nar.contradictionManager.detectContradiction(term);

        const contradictionData = nar.contradictionManager.contradictions.get(term);
        const strategyName = nar.contradictionManager._selectResolutionStrategy(term, contradictionData);

        expect(strategyName).toBe('merge');

        const result = nar.contradictionManager.manualResolve(term, 'merge');
        expect(result).not.toBeNull();
    });
});
