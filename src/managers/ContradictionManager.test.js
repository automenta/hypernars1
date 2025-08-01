import { describe, it, expect, jest } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';

describe('AdvancedContradictionManager', () => {

    it('should accept a new belief if its evidence is significantly stronger', () => {
        const nar = new NARHyper();
        const termId = id('Term', ['a']);

        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.1, 0.9, 0.9) });
        nar.api.addHyperedge('Term', ['a'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(termId);
        const finalBelief = hyperedge.getStrongestBelief();

        // The new belief should have won
        expect(finalBelief.truth.frequency).toBe(0.9);
        expect(hyperedge.beliefs.length).toBe(1); // The old one should be replaced
    });

    it('should reject a new belief if its evidence is significantly weaker', () => {
        const nar = new NARHyper();
        const termId = id('Term', ['b']);

        nar.api.addHyperedge('Term', ['b'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });
        nar.api.addHyperedge('Term', ['b'], { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.1, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(termId);
        const finalBelief = hyperedge.getStrongestBelief();

        // The original belief should remain
        expect(finalBelief.truth.frequency).toBe(0.9);
        expect(hyperedge.beliefs.length).toBe(1);
    });

    it('should merge beliefs of similar strength', () => {
        const nar = new NARHyper();
        const termId = id('Term', ['c']);

        nar.api.addHyperedge('Term', ['c'], { truth: new TruthValue(0.9, 0.8), budget: new Budget(0.8, 0.9, 0.9) });
        nar.api.addHyperedge('Term', ['c'], { truth: new TruthValue(0.1, 0.8), budget: new Budget(0.8, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(termId);
        const finalBelief = hyperedge.getStrongestBelief();

        // The frequency should be revised towards the middle (0.5)
        expect(finalBelief.truth.frequency).toBeCloseTo(0.5);
        // Confidence should be higher as it's a revision of two confident beliefs
        expect(finalBelief.truth.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should split a concept when a contextual contradiction occurs', () => {
        const nar = new NARHyper();
        const originalId = id('Inheritance', ['bird', 'flyer']);

        // Add a general belief
        nar.api.addHyperedge('Inheritance', ['bird', 'flyer'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });

        // Mock the context detection to force a split
        jest.spyOn(nar.contradictionManager, '_determineContradictionContext').mockReturnValue({ type: 'contextual' });

        // Add a contradictory belief that will now be treated as contextual
        nar.api.addHyperedge('Inheritance', ['bird', 'flyer'], { truth: new TruthValue(0.1, 0.99), budget: new Budget(0.95, 0.9, 0.9) });

        const originalHyperedge = nar.state.hypergraph.get(originalId);
        // The original hyperedge should still have its original belief, as the new one was split off
        expect(originalHyperedge.getStrongestBelief().truth.frequency).toBe(0.9);

        // A new hyperedge should be created for the specific context
        const newConceptId = `${originalId}|context:contextual`;
        const newHyperedge = nar.state.hypergraph.get(newConceptId);
        expect(newHyperedge).toBeDefined();
        expect(newHyperedge.type).toBe('Inheritance');
        // And it should contain the new belief
        expect(newHyperedge.getStrongestBelief().truth.frequency).toBe(0.1);
    });

    it('should accept a newer belief in a temporal context', () => {
        const nar = new NARHyper();
        const termId = id('Term', ['d']);
        const originalTime = Date.now();

        // Mock Date.now to control timestamps
        const dateSpy = jest.spyOn(Date, 'now');

        // Add the first belief at an "old" time
        dateSpy.mockReturnValue(originalTime);
        nar.api.addHyperedge('Term', ['d'], { truth: new TruthValue(0.9, 0.8), budget: new Budget(0.8, 0.9, 0.9) });

        // Add the second, contradictory belief at a "newer" time
        dateSpy.mockReturnValue(originalTime + 2000); // 2 seconds later
        nar.api.addHyperedge('Term', ['d'], { truth: new TruthValue(0.1, 0.8), budget: new Budget(0.8, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(termId);
        const finalBelief = hyperedge.getStrongestBelief();

        // The newer belief (frequency 0.1) should have been accepted
        expect(finalBelief.truth.frequency).toBe(0.1);
        expect(hyperedge.beliefs.length).toBe(1);

        // Restore the spy
        dateSpy.mockRestore();
    });
});
