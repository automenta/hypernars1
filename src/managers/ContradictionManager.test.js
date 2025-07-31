import { describe, it, expect, jest } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { ContradictionManager } from './ContradictionManager.js';
import { SimpleContradictionManager } from './SimpleContradictionManager.js';
import { id } from '../support/utils.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';

describe('ContradictionManager', () => {
    it('should detect a contradiction when opposing beliefs are added', () => {
        const nar = new NARHyper();
        const termId = id('Term', ['a']);

        // Add two beliefs with different budgets to ensure they are both stored
        nar.addHyperedge('Term', ['a'], { truth: new TruthValue(1.0, 0.9), budget: new Budget(1.0, 0.9, 0.9) });
        nar.addHyperedge('Term', ['a'], { truth: new TruthValue(0.0, 0.9), budget: new Budget(0.9, 1.0, 1.0) });

        const wasContradictionDetected = nar.contradictionManager.detectContradictions(termId);

        expect(wasContradictionDetected).toBe(true);
        expect(nar.contradictionManager.contradictions.size).toBe(1);
    });

    it('should resolve a contradiction using evidence-weighted revision', () => {
        const nar = new NARHyper({
            managers: { ContradictionManager: ContradictionManager }
        });
        const termId = id('Term', ['b']);

        // Belief 1: Strong positive evidence
        nar.addHyperedge('Term', ['b'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9) });
        // Belief 2: Weak negative evidence
        nar.addHyperedge('Term', ['b'], { truth: new TruthValue(0.1, 0.6), budget: new Budget(0.3, 0.8, 0.8) });

        nar.contradictionManager.detectContradictions(termId);
        nar.contradictionManager.resolveContradictions();

        const finalTruth = nar.getTruth(termId);

        // The weighted average should be closer to 0.9 than 0.1
        expect(finalTruth.frequency).toBeGreaterThan(0.7);
        // The contradiction should be marked as resolved
        const contradiction = nar.contradictionManager.contradictions.values().next().value;
        expect(contradiction.resolved).toBe(true);
    });

    it('should resolve a contradiction by creating a contextual split', () => {
        const nar = new NARHyper({
            managers: { ContradictionManager: ContradictionManager }
        });
        const originalId = id('Inheritance', ['bird', 'flyer']);

        // Add a general belief
        nar.addHyperedge('Inheritance', ['bird', 'flyer'], { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9), context: 'general' });

        // Add a contradictory belief with a specific context
        const penguinBelief = {
            truth: new TruthValue(0.1, 0.99),
            budget: new Budget(0.95, 0.9, 0.9),
            context: 'penguin_case' // specific context
        };
        nar.addHyperedge('Inheritance', ['bird', 'flyer'], penguinBelief);

        nar.contradictionManager.detectContradictions(originalId);

        nar.contradictionManager.resolveContradictions();

        const originalHyperedge = nar.hypergraph.get(originalId);

        // The original belief should now only contain the general truth
        expect(originalHyperedge.beliefs.length).toBe(1);
        expect(originalHyperedge.beliefs[0].context).toBe('general');

        // A new hyperedge should be created for the specific context
        const newConceptId = `${originalId}|penguin_case`;
        const newHyperedge = nar.hypergraph.get(newConceptId);
        expect(newHyperedge).toBeDefined();
        expect(newHyperedge.type).toBe('Inheritance');
        expect(newHyperedge.getTruth().frequency).toBe(0.1);
    });
});
