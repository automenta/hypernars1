import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';
import { AdvancedContradictionManager } from '../managers/AdvancedContradictionManager.js';

// Use the AdvancedContradictionManager for these tests
const config = {
    modules: {
        ContradictionManager: AdvancedContradictionManager
    }
};

describe('AdvancedContradictionManager', () => {

    it('should resolve a contradiction in favor of the belief with stronger evidence', () => {
        const nar = new NARHyper(config);
        const termId = id('Term', ['a']);

        // Add two contradictory beliefs
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.1, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(termId);
        expect(hyperedge.beliefs.length).toBe(2); // Both beliefs should exist initially

        // Add evidence. Belief 0 has frequency 0.9, belief 1 has frequency 0.1.
        nar.contradictionManager.addEvidence(termId, { source: 'A', strength: 0.9, beliefIndex: 0 }); // Strong evidence for the first belief
        nar.contradictionManager.addEvidence(termId, { source: 'B', strength: 0.2, beliefIndex: 1 }); // Weak evidence for the second

        // Resolve the contradiction
        const result = nar.contradictionManager.resolve(termId);

        expect(result.resolved).toBe(true);
        expect(hyperedge.beliefs.length).toBe(1); // The weaker belief should be removed
        expect(hyperedge.getStrongestBelief().truth.frequency).toBe(0.9);
    });

    it('should not resolve a contradiction if evidence strength is too similar', () => {
        const nar = new NARHyper(config);
        const termId = id('Term', ['b']);

        nar.api.addHyperedge('Term', ['b'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });
        nar.api.addHyperedge('Term', ['b'], { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.8, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(termId);

        // Add evidence of similar strength
        nar.contradictionManager.addEvidence(termId, { source: 'A', strength: 0.8, beliefIndex: 0 });
        nar.contradictionManager.addEvidence(termId, { source: 'B', strength: 0.7, beliefIndex: 1 });

        const result = nar.contradictionManager.resolve(termId);

        expect(result.resolved).toBe(false);
        expect(result.reason).toBe('Insufficient evidence difference');
        expect(hyperedge.beliefs.length).toBe(2); // Both beliefs should remain
    });

    it('should provide a detailed analysis of a contradiction', () => {
        const nar = new NARHyper(config);
        const termId = id('Term', ['c']);

        nar.api.addHyperedge('Term', ['c'], { truth: new TruthValue(0.9, 0.8), budget: new Budget(0.8, 0.9, 0.9) });
        nar.api.addHyperedge('Term', ['c'], { truth: new TruthValue(0.2, 0.7), budget: new Budget(0.7, 0.9, 0.9) });

        nar.contradictionManager.addEvidence(termId, { source: 'A', strength: 0.9, beliefIndex: 0 });
        nar.contradictionManager.addEvidence(termId, { source: 'B', strength: 0.3, beliefIndex: 1 });

        const analysis = nar.contradictionManager.analyze(termId);

        expect(analysis).toBeDefined();
        expect(analysis.contradictions.length).toBe(2);

        // The contradictions should be sorted by evidence strength
        expect(analysis.contradictions[0].truth.frequency).toBe(0.9);
        expect(analysis.contradictions[1].truth.frequency).toBe(0.2);

        expect(analysis.contradictions[0].evidence.length).toBe(1);
        expect(analysis.contradictions[0].evidence[0].source).toBe('A');
        expect(analysis.contradictions[0].evidenceStrength).toBeGreaterThan(analysis.contradictions[1].evidenceStrength);

        expect(analysis.resolutionSuggestion.resolved).toBe(true);
    });
});
