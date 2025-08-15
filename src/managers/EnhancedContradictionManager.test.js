import { jest } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';

describe('EnhancedContradictionManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper({
            useEnhanced: true, // Use the enhanced managers
            logLevel: 'error'
        });
    });

    test('should use EnhancedContradictionManager when useEnhanced is true', () => {
        expect(nar.contradictionManager.constructor.name).toBe('EnhancedContradictionManager');
    });

    test('should retain both beliefs if one is significantly stronger, but update strongest', () => {
        const hyperedgeId = nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.1, 0.9, 0.9) });

        // Add a much stronger belief
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(hyperedgeId);

        // Per user feedback, we retain beliefs for redundancy. The proactive revision should keep both.
        // The `revise` call inside the contradiction handler will add the new belief.
        expect(hyperedge.beliefs.length).toBe(2);
        // But the strongest belief should be the new, stronger one.
        expect(hyperedge.getStrongestBelief().truth.frequency).toBe(0.9);
    });

    test('should reject a new belief if it is significantly weaker', () => {
        const hyperedgeId = nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });

        // Add a much weaker belief
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.1, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(hyperedgeId);
        // The weaker belief is rejected, so only the original one remains.
        expect(hyperedge.beliefs.length).toBe(1);
        expect(hyperedge.getStrongestBelief().truth.frequency).toBe(0.9);
    });

    test('should merge beliefs of similar strength', () => {
        const hyperedgeId = nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.8, 0.9), budget: new Budget(0.8, 0.9, 0.9) });

        // Add a belief with similar strength but different frequency
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.2, 0.9), budget: new Budget(0.8, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(hyperedgeId);
        const finalBelief = hyperedge.getStrongestBelief();

        // The two beliefs are merged into one new belief.
        expect(hyperedge.beliefs.length).toBe(1);
        // The frequency should be somewhere between 0.2 and 0.8
        expect(finalBelief.truth.frequency).toBeGreaterThan(0.2);
        expect(finalBelief.truth.frequency).toBeLessThan(0.8);
        // Confidence should be penalized
        expect(finalBelief.truth.confidence).toBeLessThan(0.9);
    });

    test('should split concept if contexts are different', () => {
        // Mock the context detection to force a split
        jest.spyOn(nar.contradictionManager, '_determineContradictionContext').mockImplementation((b1, b2) => {
            if (b2.truth.frequency > 0.5) {
                return { type: 'default', id: 'default_context' };
            }
            return { type: 'special', id: 'special_context' };
        });

        const originalId = nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.9, 0.9) });

        // Add a contradictory belief that will be determined to have a different context
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.1, 0.9) });

        const originalHyperedge = nar.state.hypergraph.get(originalId);
        const newHyperedgeId = 'Term(a)|context:special_context';
        const newHyperedge = nar.state.hypergraph.get(newHyperedgeId);

        // The original hyperedge should still have its belief
        expect(originalHyperedge.beliefs.length).toBe(1);
        expect(originalHyperedge.getStrongestBelief().truth.frequency).toBe(0.9);

        // A new hyperedge should be created for the new context
        expect(newHyperedge).toBeDefined();
        expect(newHyperedge.beliefs.length).toBe(1);
        expect(newHyperedge.getStrongestBelief().truth.frequency).toBe(0.1);

        // A similarity link should exist between them
        const similarityLink = nar.state.hypergraph.get(`Similarity(${newHyperedgeId},${originalId})`);
        expect(similarityLink).toBeDefined();
    });
});
