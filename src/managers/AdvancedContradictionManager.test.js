import { NARHyper } from '../NARHyper.js';
import { AdvancedContradictionManager } from './AdvancedContradictionManager.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';

describe('AdvancedContradictionManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper({
            useAdvanced: true,
            modules: {
                ContradictionManager: AdvancedContradictionManager
            }
        });
    });

    test('should resolve contradiction by dominant evidence', () => {
        const term = id('Inheritance', ['bird', 'flyer']);

        // Add two contradictory beliefs
        nar.api.inheritance('bird', 'flyer', {truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9)}); // Strong belief
        nar.api.inheritance('bird', 'flyer', {truth: new TruthValue(0.1, 0.9), budget: new Budget(0.3, 0.9, 0.9)}); // Weak belief

        const hyperedge = nar.state.hypergraph.get(term);
        expect(hyperedge.beliefs.length).toBe(2);

        // Add evidence to make the first belief dominant
        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.9);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.1);
        nar.contradictionManager.addEvidence(term, belief1.id, { source: 'textbook', strength: 0.9 });
        nar.contradictionManager.addEvidence(term, belief2.id, { source: 'rumor', strength: 0.2 });

        nar.contradictionManager.detectContradiction(term);
        const result = nar.contradictionManager.manualResolve(term, 'dominant_evidence');
        expect(result).not.toBeNull();

        const finalHyperedge = nar.state.hypergraph.get(term);
        expect(finalHyperedge.beliefs.length).toBe(2);
        expect(finalHyperedge.getStrongestBelief().truth.frequency).toBe(0.9);

        const weakerBelief = finalHyperedge.beliefs.find(b => b.truth.frequency !== 0.9);
        expect(weakerBelief.truth.confidence).toBeLessThan(0.9);
        expect(weakerBelief.truth.doubt).toBeGreaterThan(0.4);
    });

    test('should resolve by creating a contextual specialization', () => {
        const term = id('Inheritance', ['penguin', 'flyer']);

        nar.api.inheritance('penguin', 'flyer', {truth: new TruthValue(0.1, 0.9), budget: new Budget(0.8, 0.9, 0.9)}); // Belief 1
        nar.api.inheritance('penguin', 'flyer', {truth: new TruthValue(0.9, 0.9), budget: new Budget(0.81, 0.9, 0.9)}); // Belief 2 (Slightly higher budget)

        // Add evidence with different sources
        const hyperedge = nar.state.hypergraph.get(term);
        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.1);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.9);
        nar.contradictionManager.addEvidence(term, belief1.id, { source: 'biology_book', strength: 0.8 });
        nar.contradictionManager.addEvidence(term, belief2.id, { source: 'common_sense', strength: 0.8 });


        nar.contradictionManager.detectContradiction(term);
        const result = nar.contradictionManager.manualResolve(term, 'specialize');
        expect(result).not.toBeNull();

        // Original concept should have one belief left
        const originalHyperedge = nar.state.hypergraph.get(term);
        expect(originalHyperedge.beliefs.length).toBe(1);

        // A new specialized concept should be created
        const specializedTermId = `${term}|context:biology_book`;
        expect(nar.state.hypergraph.has(specializedTermId)).toBe(true);
        const specializedHyperedge = nar.state.hypergraph.get(specializedTermId);
        expect(specializedHyperedge.getTruth().frequency).toBe(0.1);
    });

    test('should resolve by merging beliefs when no other strategy applies', () => {
        const term = id('Inheritance', ['bat', 'mammal']);
        nar.config.useRecencyBias = false; // Ensure recency bias doesn't trigger

        // Beliefs are contradictory but not enough for dominant evidence or specialization
        // These values are chosen to pass the new _areContradictory check
        nar.api.inheritance('bat', 'mammal', { truth: new TruthValue(0.8, 0.8), budget: new Budget(0.8, 0.9, 0.9) });
        nar.api.inheritance('bat', 'mammal', { truth: new TruthValue(0.1, 0.8), budget: new Budget(0.78, 0.9, 0.9) });

        const hyperedge = nar.state.hypergraph.get(term);
        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.8);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.1);

        // Add evidence with the same source and similar strength
        nar.contradictionManager.addEvidence(term, belief1.id, { source: 'default', strength: 0.8 });
        nar.contradictionManager.addEvidence(term, belief2.id, { source: 'default', strength: 0.78 });

        nar.contradictionManager.detectContradiction(term);
        nar.contradictionManager.resolveContradictions(); // Use automatic resolution

        const contradictionData = nar.contradictionManager.contradictions.get(term);
        expect(contradictionData.resolved).toBe(true);
        expect(contradictionData.resolutionStrategy).toBe('merge');

        const finalHyperedge = nar.state.hypergraph.get(term);
        expect(finalHyperedge.beliefs.length).toBe(1);

        // Check that the new truth value reflects the merge
        expect(finalHyperedge.getTruth().confidence).toBeLessThan(0.75); // Should be penalized
    });

    test('_areContradictory should correctly identify nuanced contradictions', () => {
        const manager = nar.contradictionManager;

        // Strong contradiction: high freq diff, high avg confidence
        let truth1 = new TruthValue(0.9, 0.8);
        let truth2 = new TruthValue(0.1, 0.8);
        expect(manager._areContradictory(truth1, truth2)).toBe(true);

        // Moderate contradiction: medium freq diff, medium-high confidence diff
        truth1 = new TruthValue(0.7, 0.9);
        truth2 = new TruthValue(0.3, 0.4);
        expect(manager._areContradictory(truth1, truth2)).toBe(true);

        // Not a contradiction: low freq diff
        truth1 = new TruthValue(0.5, 0.9);
        truth2 = new TruthValue(0.6, 0.9);
        expect(manager._areContradictory(truth1, truth2)).toBe(false);

        // Not a contradiction: low confidence
        truth1 = new TruthValue(0.9, 0.3);
        truth2 = new TruthValue(0.1, 0.4);
        expect(manager._areContradictory(truth1, truth2)).toBe(false);
    });

    test('_calculateEvidenceStrength should factor in source reliability', () => {
        const term = id('Inheritance', ['sun', 'star']);
        nar.api.inheritance('sun', 'star', {truth: new TruthValue(0.99, 0.9), budget: new Budget(0.9, 0.9, 0.9)});

        // Set source reliabilities
        nar.state.sourceReliability = new Map();
        nar.state.sourceReliability.set('nasa_website', 0.95);
        nar.state.sourceReliability.set('random_blog', 0.2);

        const hyperedge = nar.state.hypergraph.get(term);
        const belief = hyperedge.beliefs[0];

        // Add evidence from a reliable source
        nar.contradictionManager.addEvidence(term, belief.id, { source: 'nasa_website', strength: 0.9 });

        const strength1 = nar.contradictionManager._calculateEvidenceStrength(term, belief);

        // Add evidence from an unreliable source
        nar.contradictionManager.addEvidence(term, belief.id, { source: 'random_blog', strength: 0.9 });
        const strength2 = nar.contradictionManager._calculateEvidenceStrength(term, belief);

        expect(strength1).toBeGreaterThan(0.8);
        expect(strength2).toBeGreaterThan(strength1); // More evidence, even if less reliable, should still add some strength

        // Manually calculate expected strength to verify logic
        const intrinsicWeight = nar.config.intrinsicStrengthWeight || 0.2;
        const evidenceWeight = nar.config.evidenceStrengthWeight || 0.8;
        const sourceReliabilityWeight = nar.config.sourceReliabilityWeight || 0.5;
        const totalWeight = intrinsicWeight + evidenceWeight + sourceReliabilityWeight;

        const intrinsicStrength = belief.truth.expectation() * belief.budget.priority;
        const totalEvidenceStrength = 0.9;
        const sourceReliability = 0.9 * 0.95;
        const expectedStrength1 = (intrinsicStrength * intrinsicWeight + totalEvidenceStrength * evidenceWeight + sourceReliability * sourceReliabilityWeight) / totalWeight;

        expect(strength1).toBeCloseTo(expectedStrength1);
    });

    test('should automatically select "specialize" strategy for different contexts', () => {
        const term = id('Inheritance', ['penguin', 'flyer']);

        nar.api.inheritance('penguin', 'flyer', { truth: new TruthValue(0.1, 0.9), budget: new Budget(0.8, 0.9, 0.9) }); // Belief 1 from a biology book
        nar.api.inheritance('penguin', 'flyer', { truth: new TruthValue(0.9, 0.9), budget: new Budget(0.81, 0.9, 0.9) }); // Belief 2 from common sense

        // Add evidence with different sources to create distinct contexts
        const hyperedge = nar.state.hypergraph.get(term);
        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.1);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.9);
        nar.contradictionManager.addEvidence(term, belief1.id, { source: 'biology_book', strength: 0.8 });
        nar.contradictionManager.addEvidence(term, belief2.id, { source: 'common_sense', strength: 0.8 });

        nar.contradictionManager.detectContradiction(term);
        nar.contradictionManager.resolveContradictions(); // Use automatic resolution

        const contradictionData = nar.contradictionManager.contradictions.get(term);
        expect(contradictionData.resolved).toBe(true);
        expect(contradictionData.resolutionStrategy).toBe('specialize');

        // Verify that a new specialized concept was created
        const specializedTermId = `${term}|context:biology_book`;
        expect(nar.state.hypergraph.has(specializedTermId)).toBe(true);

        // Verify that a similarity link was created
        const similarityId = id('Similarity', [specializedTermId, term]);
        expect(nar.state.hypergraph.has(similarityId)).toBe(true);
    });
});