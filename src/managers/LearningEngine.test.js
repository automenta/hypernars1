import {beforeEach, describe, expect, test} from '@jest/globals';
import {NAR} from '../NAR.js';
import {id} from '../support/utils.js';
import {TruthValue} from '../support/TruthValue.js';

describe('AdvancedLearningEngine', () => {
    let nar;
    let learningEngine;

    beforeEach(() => {
        nar = new NAR({useAdvanced: true});
        learningEngine = nar.learningEngine;
    });

    test('should reinforce premises of a successful outcome', () => {
        const premiseId = nar.api.inheritance('A', 'B', {truth: new TruthValue(0.8, 0.8)});
        const conclusionId = nar.api.inheritance('A', 'C', {premises: [premiseId]});

        const initialConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;

        learningEngine.recordExperience({conclusionId}, {success: true});

        const finalConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;
        expect(finalConfidence).toBeGreaterThan(initialConfidence);
    });

    test('should weaken premises of a failed outcome', () => {
        const premiseId = nar.api.inheritance('X', 'Y', {truth: new TruthValue(0.8, 0.8)});
        const conclusionId = nar.api.inheritance('X', 'Z', {premises: [premiseId]});

        const initialConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;

        learningEngine.recordExperience({conclusionId}, {success: false});

        const finalConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;
        expect(finalConfidence).toBeLessThan(initialConfidence);
    });

    test('should update rule productivity stats', () => {

        const premiseId = nar.api.inheritance('bird', 'animal');
        const conclusionId = nar.api.inheritance('tweety', 'animal', {
            premises: [premiseId],
            derivedBy: 'transitivity'
        });


        learningEngine.recordExperience({conclusionId}, {success: true});

        const transitivityStats = learningEngine.getRuleProductivityStats().get('transitivity');
        expect(transitivityStats).toBeDefined();
        expect(transitivityStats.successes).toBe(1);
        expect(transitivityStats.attempts).toBe(1);


        const conclusion2Id = nar.api.inheritance('penguin', 'flyer', {
            premises: [premiseId],
            derivedBy: 'transitivity'
        });
        learningEngine.recordExperience({conclusionId: conclusion2Id}, {success: false});

        const updatedTransitivityStats = learningEngine.getRuleProductivityStats().get('transitivity');
        expect(updatedTransitivityStats.successes).toBe(1);
        expect(updatedTransitivityStats.attempts).toBe(2);
    });

    test('should create a shortcut rule from a frequently successful reasoning path', () => {

        const premise1Id = nar.api.implication('A', 'B');
        const premise2Id = nar.api.implication('B', 'C');

        const conclusionId = nar.api.term('C', {premises: [premise1Id, premise2Id]});


        for (let i = 0; i < 60; i++) {
            learningEngine.experienceBuffer.push({
                premises: [premise1Id, premise2Id],
                conclusion: conclusionId,
                success: true,
                accuracy: 0.95
            });
        }


        learningEngine.applyLearning();


        const conjunctionId = id('Conjunction', [premise1Id, premise2Id].sort());
        const shortcutRuleId = id('Implication', [conjunctionId, conclusionId]);
        const shortcutRule = nar.state.hypergraph.get(shortcutRuleId);

        expect(shortcutRule).toBeDefined();
        expect(shortcutRule.type).toBe('Implication');
        expect(shortcutRule.getTruth().confidence).toBeGreaterThan(0.8);
    });

    test('should create an ActionConsequence mapping from an outcome', () => {
        const actionId = nar.api.term('press_button');
        const consequenceTerm = 'light_turns_on';

        const context = {operation: 'action', action: actionId};
        const outcome = {success: true, consequence: consequenceTerm};

        learningEngine.recordExperience(context, outcome);

        const mappingId = id('ActionConsequence', [actionId, consequenceTerm]);
        const mappingHyperedge = nar.state.hypergraph.get(mappingId);

        expect(mappingHyperedge).toBeDefined();
        expect(mappingHyperedge.type).toBe('ActionConsequence');
        expect(mappingHyperedge.getTruth().frequency).toBeGreaterThan(0.7);
    });
});