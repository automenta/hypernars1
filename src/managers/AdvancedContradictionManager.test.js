import { NARHyper } from '../NARHyper.js';
import { AdvancedContradictionManager } from './AdvancedContradictionManager.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';

describe('AdvancedContradictionManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper({
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
        nar.contradictionManager.addEvidence(term, { source: 'textbook', strength: 0.9, beliefIndex: 0 });
        nar.contradictionManager.addEvidence(term, { source: 'rumor', strength: 0.2, beliefIndex: 1 });

        const resolution = nar.contradictionManager.resolve(term);

        expect(resolution.resolved).toBe(true);
        expect(resolution.reason).toBe('dominant_evidence');

        const finalHyperedge = nar.state.hypergraph.get(term);
        expect(finalHyperedge.beliefs.length).toBe(1);
        expect(finalHyperedge.getTruth().frequency).toBe(0.9);
    });

    test('should resolve by creating a contextual specialization', () => {
        const term = id('Inheritance', ['penguin', 'flyer']);

        nar.api.inheritance('penguin', 'flyer', {truth: new TruthValue(0.1, 0.9), budget: new Budget(0.8, 0.9, 0.9)}); // Belief 1
        nar.api.inheritance('penguin', 'flyer', {truth: new TruthValue(0.9, 0.9), budget: new Budget(0.8, 0.9, 0.9)}); // Belief 2 (Contradictory)

        // Add evidence with different sources
        nar.contradictionManager.addEvidence(term, { source: 'biology_book', strength: 0.8, beliefIndex: 0 });
        nar.contradictionManager.addEvidence(term, { source: 'common_sense', strength: 0.8, beliefIndex: 1 });

        const resolution = nar.contradictionManager.resolve(term);

        expect(resolution.resolved).toBe(true);
        expect(resolution.reason).toBe('specialized');

        // Original concept should have one belief left
        const originalHyperedge = nar.state.hypergraph.get(term);
        expect(originalHyperedge.beliefs.length).toBe(1);

        // A new specialized concept should be created
        const specializedTermId = resolution.newHyperedge;
        expect(nar.state.hypergraph.has(specializedTermId)).toBe(true);
        const specializedHyperedge = nar.state.hypergraph.get(specializedTermId);
        expect(specializedHyperedge.getTruth().frequency).toBe(0.1); // It's the weaker belief that gets specialized
        expect(specializedHyperedge.id).toContain('|context:biology_book');
    });

    test('should resolve by merging beliefs with similar evidence', () => {
        const term = id('Inheritance', ['bat', 'mammal']);

        nar.api.inheritance('bat', 'mammal', {truth: new TruthValue(0.9, 0.8), budget: new Budget(0.8, 0.9, 0.9)});
        nar.api.inheritance('bat', 'mammal', {truth: new TruthValue(0.85, 0.85), budget: new Budget(0.78, 0.9, 0.9)});

        const hyperedge = nar.state.hypergraph.get(term);
        // Add evidence with the same source (or no specific source)
        nar.contradictionManager.addEvidence(term, { source: 'default', strength: 0.8, beliefIndex: 0 });
        nar.contradictionManager.addEvidence(term, { source: 'default', strength: 0.78, beliefIndex: 1 });

        const resolution = nar.contradictionManager.resolve(term);

        expect(resolution.resolved).toBe(true);
        expect(resolution.reason).toBe('merged');

        const finalHyperedge = nar.state.hypergraph.get(term);
        expect(finalHyperedge.beliefs.length).toBe(1);

        // Check that confidence was revised and then penalized
        const expectedTruth = TruthValue.revise(new TruthValue(0.9, 0.8), new TruthValue(0.85, 0.85));
        const expectedConfidence = expectedTruth.confidence * 0.8;
        expect(finalHyperedge.getTruth().confidence).toBeCloseTo(expectedConfidence);
    });

    test('_calculateEvidenceStrength should factor in source reliability', () => {
        const term = id('Inheritance', ['sun', 'star']);
        nar.api.inheritance('sun', 'star', {truth: new TruthValue(0.99, 0.9), budget: new Budget(0.9, 0.9, 0.9)});

        // Set source reliabilities
        nar.state.sourceReliability.set('nasa_website', 0.95);
        nar.state.sourceReliability.set('random_blog', 0.2);

        // Add evidence from a reliable source
        nar.contradictionManager.addEvidence(term, { source: 'nasa_website', strength: 0.9, beliefIndex: 0 });

        const hyperedge = nar.state.hypergraph.get(term);
        const belief = hyperedge.beliefs[0];

        const strength1 = nar.contradictionManager._calculateEvidenceStrength(term, belief);

        // Add evidence from an unreliable source
        nar.contradictionManager.addEvidence(term, { source: 'random_blog', strength: 0.9, beliefIndex: 0 });
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
});
