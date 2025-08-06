import {describe, expect, it} from '@jest/globals';
import {NAR} from '../NAR.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {id} from '../support/utils.js';
import {AdvancedContradictionManager} from './AdvancedContradictionManager.js';


const config = {
    useAdvanced: true,
    modules: {
        ContradictionManager: AdvancedContradictionManager
    }
};

describe('AdvancedContradictionManager', () => {

    it('should resolve a contradiction in favor of the belief with stronger evidence', () => {
        const nar = new NAR(config);
        const termId = id('Term', ['a']);


        nar.api.addHyperedge('Term', ['a'], {truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9)});
        nar.api.addHyperedge('Term', ['a'], {truth: new TruthValue(0.1, 0.9), budget: new Budget(0.1, 0.9, 0.9)});

        const hyperedge = nar.state.hypergraph.get(termId);
        expect(hyperedge.beliefs.length).toBe(2);

        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.9);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.1);
        nar.contradictionManager.addEvidence(termId, belief1.id, {source: 'A', strength: 0.9});
        nar.contradictionManager.addEvidence(termId, belief2.id, {source: 'B', strength: 0.2});


        nar.contradictionManager.detectContradiction(termId);
        const result = nar.contradictionManager.manualResolve(termId, 'dominant_evidence');

        expect(result).not.toBeNull();
        expect(hyperedge.beliefs.length).toBe(2);
        expect(hyperedge.getStrongestBelief().truth.frequency).toBe(0.9);

        const weakerBelief = hyperedge.beliefs.find(b => b.truth.frequency !== 0.9);
        expect(weakerBelief.truth.confidence).toBeLessThan(0.9);
        expect(weakerBelief.truth.doubt).toBeGreaterThan(0.4);
    });

    it('should specialize a concept (split) when evidence strength is similar', () => {
        const nar = new NAR(config);
        const termId = id('Term', ['b']);


        nar.api.addHyperedge('Term', ['b'], {truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9)});
        nar.api.addHyperedge('Term', ['b'], {truth: new TruthValue(0.2, 0.4), budget: new Budget(0.85, 0.9, 0.9)});

        const hyperedge = nar.state.hypergraph.get(termId);

        const belief1 = hyperedge.beliefs.find(b => b.truth.frequency === 0.9);
        const belief2 = hyperedge.beliefs.find(b => b.truth.frequency === 0.2);
        nar.contradictionManager.addEvidence(termId, belief1.id, {source: 'SourceA', strength: 0.8});
        nar.contradictionManager.addEvidence(termId, belief2.id, {source: 'SourceB', strength: 0.78});


        nar.contradictionManager.detectContradiction(termId);
        const result = nar.contradictionManager.manualResolve(termId, 'specialize');


        expect(result).not.toBeNull();
        expect(result.reason).toBe('specialized');


        const updatedOriginalHyperedge = nar.state.hypergraph.get(termId);
        expect(updatedOriginalHyperedge.beliefs.length).toBe(1);
        expect(updatedOriginalHyperedge.getStrongestBelief().truth.frequency).toBe(0.9);


        const newHyperedgeId = `${termId}|context:SourceB`;

        const newHyperedge = nar.state.hypergraph.get(newHyperedgeId);
        expect(newHyperedge).toBeDefined();
        expect(newHyperedge.type).toBe('Term');
        expect(newHyperedge.beliefs.length).toBe(1);
        expect(newHyperedge.getStrongestBelief().truth.frequency).toBe(0.2);
    });

    it('should provide a detailed analysis of a contradiction without side-effects', () => {
        const nar = new NAR(config);
        const termId = id('Term', ['c']);

        nar.api.addHyperedge('Term', ['c'], {truth: new TruthValue(0.9, 0.8), budget: new Budget(0.8, 0.9, 0.9)});
        nar.api.addHyperedge('Term', ['c'], {truth: new TruthValue(0.2, 0.7), budget: new Budget(0.7, 0.9, 0.9)});

        const hyperedgeBefore = nar.state.hypergraph.get(termId);
        const belief1 = hyperedgeBefore.beliefs.find(b => b.truth.frequency === 0.9);
        const belief2 = hyperedgeBefore.beliefs.find(b => b.truth.frequency === 0.2);
        nar.contradictionManager.addEvidence(termId, belief1.id, {source: 'A', strength: 0.9});
        nar.contradictionManager.addEvidence(termId, belief2.id, {source: 'B', strength: 0.3});
        const beliefCountBefore = hyperedgeBefore.beliefs.length;

        const analysis = nar.contradictionManager.analyze(termId);

        const hyperedgeAfter = nar.state.hypergraph.get(termId);
        const beliefCountAfter = hyperedgeAfter.beliefs.length;


        expect(beliefCountAfter).toBe(beliefCountBefore);

        expect(analysis).toBeDefined();
        expect(analysis.contradictions.length).toBe(2);


        expect(analysis.contradictions[0].truth.frequency).toBe(0.9);
        expect(analysis.contradictions[1].truth.frequency).toBe(0.2);

        expect(analysis.contradictions[0].evidence.length).toBe(1);
        expect(analysis.contradictions[0].evidence[0].source).toBe('A');
        expect(analysis.contradictions[0].evidenceStrength).toBeGreaterThan(analysis.contradictions[1].evidenceStrength);


        expect(analysis.resolutionSuggestion.strategy).toBe('dominant_evidence');
    });

    it.skip('should find and resolve all detected contradictions via resolveContradictions()', () => {
        const nar = new NAR(config);


        const termId1 = id('Term', ['d']);
        nar.api.addHyperedge('Term', ['d'], {truth: new TruthValue(0.8, 0.9), budget: new Budget(0.8, 0.9, 0.9)});
        nar.api.addHyperedge('Term', ['d'], {truth: new TruthValue(0.3, 0.9), budget: new Budget(0.7, 0.9, 0.9)});
        let hyperedge1 = nar.state.hypergraph.get(termId1);
        let belief1_1 = hyperedge1.beliefs.find(b => b.truth.frequency === 0.8);
        let belief1_2 = hyperedge1.beliefs.find(b => b.truth.frequency === 0.3);
        nar.contradictionManager.addEvidence(termId1, belief1_1.id, {source: 'A', strength: 0.7});
        nar.contradictionManager.addEvidence(termId1, belief1_2.id, {source: 'B', strength: 0.5});
        nar.contradictionManager.detectContradiction(termId1);


        const termId2 = id('Term', ['e']);
        nar.api.addHyperedge('Term', ['e'], {truth: new TruthValue(0.9, 0.9), budget: new Budget(0.9, 0.9, 0.9)});
        nar.api.addHyperedge('Term', ['e'], {truth: new TruthValue(0.2, 0.9), budget: new Budget(0.88, 0.9, 0.9)});
        let hyperedge2 = nar.state.hypergraph.get(termId2);
        let belief2_1 = hyperedge2.beliefs.find(b => b.truth.frequency === 0.9);
        let belief2_2 = hyperedge2.beliefs.find(b => b.truth.frequency === 0.2);
        nar.contradictionManager.addEvidence(termId2, belief2_1.id, {source: 'C', strength: 0.8});
        nar.contradictionManager.addEvidence(termId2, belief2_2.id, {source: 'D', strength: 0.78});
        nar.contradictionManager.detectContradiction(termId2);


        nar.contradictionManager.resolveContradictions();

        const hyperedge1_after = nar.state.hypergraph.get(termId1);
        const hyperedge2_after = nar.state.hypergraph.get(termId2);


        expect(hyperedge1_after.beliefs.length).toBe(1);
        expect(hyperedge2_after.beliefs.length).toBe(1);
    });
});