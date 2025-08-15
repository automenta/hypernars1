import {beforeEach, describe, expect, it} from '@jest/globals';
import {NAR} from '../NAR.js';
import {TruthValue} from '../support/TruthValue.js';

describe('AdvancedContradictionManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NAR({useAdvanced: true});
    });

    it('should merge contradictory beliefs upon introduction', () => {
        const term = '<A --> B>';
        const truth1 = new TruthValue(0.9, 0.9);
        const truth2 = new TruthValue(0.1, 0.9);

        nar.nal(`${term}. %${truth1.frequency};${truth1.confidence}%`);
        nar.nal(`${term}. %${truth2.frequency};${truth2.confidence}%`);

        const parsedTerm = nar.expressionEvaluator.parse(term);
        const termId = nar.expressionEvaluator._getParsedStructureId(parsedTerm);
        const hyperedge = nar.state.hypergraph.get(termId);
        expect(hyperedge.beliefs.length).toBe(2);

        nar.contradictionManager.resolveContradictions();

        const updatedHyperedge = nar.state.hypergraph.get(termId);
        expect(updatedHyperedge.beliefs.length).toBe(2);

        const expectedTruth = TruthValue.revise(truth1, truth2);

        for (const belief of updatedHyperedge.beliefs) {
            expect(belief.truth.frequency).toBeCloseTo(expectedTruth.frequency);
            expect(belief.truth.confidence).toBeCloseTo(expectedTruth.confidence);
        }
    });

    it('should not detect a contradiction if beliefs are revised away', () => {
        const term = '<A --> C>';
        nar.nal(`${term}. %0.9;0.8%`);
        nar.nal(`${term}. %0.2;0.6%`);

        nar.run(5); // Allow time for processing

        const contradictions = nar.getContradictions();
        expect(contradictions.length).toBe(0);
    });

    it('should handle evidence and context without causing errors', () => {
        const term = '<A --> D>';
        const hyperedgeId = nar.nal(`${term}. %0.1;0.8%`);
        const belief1 = nar.getBeliefs(hyperedgeId)[0];

        expect(() => {
            nar.contradictionManager.addEvidence(hyperedgeId, belief1.id, {
                source: 'test',
                strength: 0.9,
                context: 'test_context'
            });
        }).not.toThrow();
    });
});
