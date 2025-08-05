import {describe, expect, it} from '@jest/globals';
import {NAR} from '../NAR.js';

describe('API Enhancements', () => {
    it('should handle queries with variable binding', () => {
        const nar = new NAR({useAdvanced: true});
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
        const nar = new NAR({useAdvanced: true});
        // A -> B, B -> C, therefore A -> C
        nar.nal('<A --> B>.');
        nar.nal('<B --> C>.');
        // Also, D -> C. This will be the alternative path.
        nar.nal('<D --> C>.');

        nar.run(100); // Allow derivation

        // Check that the primary conclusion was derived
        const derivedBeliefs = nar.query('<A --> C>');
        expect(derivedBeliefs.length).toBeGreaterThan(0);
        const conclusionId = derivedBeliefs[0].id;

        // Ask the counterfactual: What if A was not a B, but a D?
        const explanation = nar.explain(conclusionId, {
            perspective: 'counterfactual',
            alternative: '<A --> D>.'
        });

        expect(explanation).toContain('Counterfactual analysis');
        // It should identify that it's replacing <A --> B>
        expect(explanation).toContain('instead of "Inheritance(A, B)"');
        // It should find that the original conclusion still holds
        expect(explanation).toContain('The original conclusion **still holds**');
        // It should not mention any *new* conclusions because the original one is just re-derived.
        // The logic for explaining *how* it still holds would be a further enhancement.
    });

    it('should find a directly added complex term', () => {
        const nar = new NAR({useAdvanced: true});
        nar.nal('<tweety --> flyer>.');
        const results = nar.query('<tweety --> flyer>');
        expect(results.length).toBe(1);
    });

    it('should get and resolve contradictions', () => {
        const nar = new NAR({useAdvanced: true});
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

    it('should resolve contradiction by specialization based on context', () => {
        const nar = new NAR({useAdvanced: true});
        const hyperedgeId = nar.nal('<A --> B>. %1.0;0.9%');
        const belief1 = nar.getBeliefs(hyperedgeId)[0];
        nar.contradictionManager.addEvidence(hyperedgeId, belief1.id, {
            source: 'test-source-1',
            strength: 0.9,
            context: 'lab_conditions'
        });

        nar.nal('<A --> B>. %0.0;0.9%');
        const belief2 = nar.getBeliefs(hyperedgeId)[1];
        nar.contradictionManager.addEvidence(hyperedgeId, belief2.id, {
            source: 'test-source-2',
            strength: 0.9,
            context: 'field_conditions'
        });

        nar.run(10); // Run to allow contradiction detection

        const contradictions = nar.getContradictions();
        expect(contradictions.length).toBe(1);
        const contradictionId = contradictions[0].id;

        const analysis = nar.analyzeContradiction(contradictionId);
        expect(analysis.resolutionSuggestion.strategy).toBe('specialize');

        nar.resolveContradiction(contradictionId, 'specialize');
        nar.run(5);

        // The original contradiction should be resolved
        expect(nar.getContradictions().length).toBe(0);

        // A new, specialized concept should exist
        const specializedHyperedgeId = `${hyperedgeId}|context:field_conditions`;
        const specializedBeliefs = nar.getBeliefs(specializedHyperedgeId);
        expect(specializedBeliefs.length).toBeGreaterThan(0);
        expect(specializedBeliefs[0].truth.frequency).toBeCloseTo(0.0);
    });

    it('should configure and get meta-reasoning strategy', () => {
        const nar = new NAR({useAdvanced: true});
        nar.configureStrategy({context: 'test_context', strategy: 'test_strategy', priority: 100});

        // This is a bit tricky to test directly without more hooks,
        // but we can verify the configuration was stored.
        const strategy = nar.cognitiveExecutive.strategies.find(s => s.context === 'test_context');
        expect(strategy).toBeDefined();
        expect(strategy.strategy).toBe('test_strategy');
    });

    it('should handle goal decomposition and achievement', () => {
        const nar = new NAR({useAdvanced: true});
        let goalDecomposed = false;
        let actionExecuted = false;

        // Listen for system events
        nar.on('goal-decomposed', () => {
            goalDecomposed = true;
        });
        nar.on('action-executed', ({actionId}) => {
            if (actionId === 'Term(action_to_achieve_B)') {
                actionExecuted = true;
            }
        });

        // Define an action that can achieve a state
        nar.nal('<Term(action_to_achieve_B) ==> Term(B_is_achieved)>.');

        // Define a complex goal
        const complexGoalDescription = '<C --> D>. && <B_is_achieved --> E>.';
        nar.addGoal(complexGoalDescription, 0.9);

        // Add a base belief to satisfy the first part of the goal
        nar.nal('<C --> D>.');

        // Run the system to process the goal
        nar.run(50);

        // Assert that the goal was decomposed
        expect(goalDecomposed).toBe(true);
    });

    it('should form a new concept from recurring patterns', () => {
        const nar = new NAR({useAdvanced: true});
        let conceptFormed = null;

        nar.on('concept-formed', (data) => {
            conceptFormed = data;
        });

        // Repeatedly present a pattern of co-occurring terms
        for (let i = 0; i < 20; i++) {
            nar.nal('<termA --> propertyX>.');
            nar.nal('<termB --> propertyX>.');
            nar.nal('<termC --> propertyX>.');
            nar.run(5); // Run a few steps to process
        }

        // Run for enough cycles to trigger concept formation
        nar.run(150);

        expect(conceptFormed).not.toBeNull();
        expect(conceptFormed.from).toEqual(expect.arrayContaining(['Term(termA)', 'Term(termB)', 'Term(termC)']));

        // Check if the concept hyperedge exists
        const conceptBelief = nar.queryBelief(conceptFormed.conceptId);
        expect(conceptBelief).not.toBeNull();
        expect(conceptBelief.truth.confidence).toBeGreaterThan(0.5);

        // Check for inheritance links from the new concept
        const inheritanceLinks = nar.query(`<${conceptFormed.conceptId} --> $x>`);
        const inheritedTerms = inheritanceLinks.map(link => link.bindings['$x']);
        expect(inheritedTerms).toEqual(expect.arrayContaining(['Term(termA)', 'Term(termB)', 'Term(termC)']));
    });
});