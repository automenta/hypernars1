export default {
    name: '52. Enhanced Contradiction Management',
    description: 'Tests the evidence-based contradiction resolution and analysis capabilities.',
    steps: [
        {
            name: 'Introduce contradictory beliefs',
            action: (nar) => {
                // Belief 1: Birds can fly.
                nar.nal('(bird --> flyer). %0.9;0.9%');
                // Belief 2: Birds cannot fly.
                nar.nal('(bird --> flyer). %0.1;0.9%');
                nar.run(10);
            },
            assert: (nar) => {
                const birdIsFlyerId = nar.inheritance('bird', 'flyer');
                const beliefs = nar.getBeliefs(birdIsFlyerId);
                // Check that two contradictory beliefs are held for the same concept.
                return beliefs && beliefs.length === 2;
            }
        },
        {
            name: 'Add evidence to one belief',
            action: (nar) => {
                const birdIsFlyerId = nar.inheritance('bird', 'flyer');
                // Assuming the API from enhance.a.md is implemented.
                // Add strong evidence for the positive belief.
                nar.contradictions.addEvidence(birdIsFlyerId, {
                    source: 'ScientificAmerican',
                    strength: 0.95,
                    type: 'direct'
                });
                nar.run(10);
            },
            assert: (nar) => {
                // Check that the evidence was recorded.
                const birdIsFlyerId = nar.inheritance('bird', 'flyer');
                const hyperedge = nar.getHyperedge(birdIsFlyerId); // Assuming a getter for the raw hyperedge
                return hyperedge && hyperedge.evidence && hyperedge.evidence.some(e => e.source === 'ScientificAmerican');
            }
        },
        {
            name: 'Attempt to resolve contradiction based on evidence',
            action: (nar) => {
                const birdIsFlyerId = nar.inheritance('bird', 'flyer');
                // Attempt to resolve the contradiction.
                nar.contradictions.resolve(birdIsFlyerId);
                nar.run(10);
            },
            assert: (nar) => {
                // The stronger belief should have won, leaving only one belief.
                const birdIsFlyerId = nar.inheritance('bird', 'flyer');
                const beliefs = nar.getBeliefs(birdIsFlyerId);
                // The resolution logic in enhance.a.md suggests the stronger belief survives.
                return beliefs && beliefs.length === 1 && beliefs[0].truth.expectation() > 0.5;
            }
        },
        {
            name: 'Analyze a remaining contradiction',
            action: (nar) => {
                // Create a new, unresolved contradiction.
                nar.nal('(cat --> friendly). %0.8;0.9%');
                nar.nal('(cat --> friendly). %0.2;0.9%');
                // Add some weaker, inconclusive evidence.
                const catIsFriendlyId = nar.inheritance('cat', 'friendly');
                nar.contradictions.addEvidence(catIsFriendlyId, { source: 'observation1', strength: 0.6 });
                nar.contradictions.addEvidence(catIsFriendlyId, { source: 'observation2', strength: 0.5 });
                nar.run(10);
            },
            assert: (nar) => {
                // Check if the analysis report can be generated.
                const catIsFriendlyId = nar.inheritance('cat', 'friendly');
                const analysis = nar.contradictions.analyze(catIsFriendlyId);
                // The analysis should contain the list of contradictions and a suggestion.
                return analysis &&
                       analysis.contradictions &&
                       analysis.contradictions.length === 2 &&
                       analysis.resolutionSuggestion &&
                       analysis.resolutionSuggestion.resolved === false; // Because evidence is not strong enough to resolve.
            }
        }
    ]
};
