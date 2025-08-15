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

    it('robustRule should create a base rule and an exception rule', () => {
        const nar = new NARHyper({ useAdvanced: true, logLevel: 'error' });
        const { baseRule, exceptionRule } = nar.api.robustRule(
            'Inheritance(Term(X),Term(bird))',
            'Inheritance(Term(X),Term(flyer))',
            'Inheritance(Term(X),Term(penguin))'
        );

        const base = nar.state.hypergraph.get(baseRule);
        const exception = nar.state.hypergraph.get(exceptionRule);

        expect(base).toBeDefined();
        expect(base.type).toBe('Implication');

        expect(exception).toBeDefined();
        expect(exception.type).toBe('Implication');

        // Check that the exception rule is linked to the base rule
        const exceptionLink = nar.state.hypergraph.get(`isExceptionTo(${exceptionRule},${baseRule})`);
        expect(exceptionLink).toBeDefined();
    });

    it('citedBelief should create a structured citation', () => {
        const nar = new NARHyper({ useAdvanced: true, logLevel: 'error' });
        const statement = '<penguin --> flyer>. %0.1;0.9%';
        const citation = { source: 'biology_textbook', page: 42 };

        const { beliefId, citationId } = nar.api.citedBelief(statement, citation);

        const belief = nar.state.hypergraph.get(beliefId);
        expect(belief).toBeDefined();
        expect(belief.getStrongestBelief().truth.frequency).toBe(0.1);

        const citationHyperedge = nar.state.hypergraph.get(citationId);
        expect(citationHyperedge).toBeDefined();
        expect(citationHyperedge.type).toBe('Citation');
        expect(citationHyperedge.args).toContain('has_source(biology_textbook)');
        expect(citationHyperedge.args).toContain('has_page(42)');

        const link = nar.state.hypergraph.get(`hasCitation(${beliefId},${citationId})`);
        expect(link).toBeDefined();
    });
});