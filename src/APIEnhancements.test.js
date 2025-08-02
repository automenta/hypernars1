import { describe, it, expect } from '@jest/globals';
import { NARHyper } from './NARHyper.js';

describe('API Enhancements', () => {
    it('should handle queries with variable binding', () => {
        const nar = new NARHyper({ useAdvanced: true });
        nar.inheritance('bird', 'animal');
        nar.inheritance('robin', 'bird');
        nar.inheritance('sparrow', 'bird');
        nar.inheritance('penguin', 'bird');
        nar.nal('<penguin --> flyer>. %0.1;0.9%'); // Penguins don't fly

        const results = nar.query('<$x --> bird>');

        expect(results.length).toBe(3);
        const boundTerms = results.map(r => r.bindings['$x']);
        expect(boundTerms).toContain('robin');
        expect(boundTerms).toContain('sparrow');
        expect(boundTerms).toContain('penguin');
    });

    it('should provide counterfactual explanations', () => {
        const nar = new NARHyper({ useAdvanced: true });
        nar.nal('<tweety --> bird>.');
        nar.nal('<bird --> flyer>.');
        nar.run(50); // Allow derivation

        console.log('Hypergraph state after run:', nar.saveState());

        // Query for the derived belief using the correct NAL syntax
        const derivedBeliefs = nar.query('<tweety --> flyer>');
        expect(derivedBeliefs.length).toBeGreaterThan(0);
        const conclusionId = derivedBeliefs[0].id;
        const explanation = nar.explain(conclusionId, {
            perspective: 'counterfactual',
            alternative: '<tweety --> penguin>.'
        });

        expect(explanation).toContain('Counterfactual analysis');
        expect(explanation).toContain('If we assume "<tweety --> penguin>." instead of');
    });

    it('should find a directly added complex term', () => {
        const nar = new NARHyper({ useAdvanced: true });
        nar.nal('<tweety --> flyer>.');
        const results = nar.query('<tweety --> flyer>');
        expect(results.length).toBe(1);
    });

    it('should get and resolve contradictions', () => {
        const nar = new NARHyper({ useAdvanced: true });
        nar.nal('<water --> wet>. %1.0;0.9%');
        nar.nal('<water --> wet>. %0.0;0.9%');

        nar.run(5);

        const contradictions1 = nar.getContradictions();
        expect(contradictions1.length).toBe(1);
        const contradictionId = contradictions1[0].id;

        const analysis = nar.analyzeContradiction(contradictionId);
        expect(analysis.resolutionSuggestion.strategy).toBe('merge');

        nar.resolveContradiction(contradictionId, 'merge');

        nar.run(5);

        const contradictions2 = nar.getContradictions();
        expect(contradictions2.length).toBe(0);
    });

    it('should configure and get meta-reasoning strategy', () => {
        const nar = new NARHyper({ useAdvanced: true });
        nar.configureMetaStrategy({ context: 'test_context', strategy: 'test_strategy', priority: 100 });

        // This is a bit tricky to test directly without more hooks,
        // but we can verify the configuration was stored.
        const strategy = nar.metaReasoner.strategies.find(s => s.context === 'test_context');
        expect(strategy).toBeDefined();
        expect(strategy.strategy).toBe('test_strategy');
    });
});