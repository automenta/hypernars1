import {describe, expect, it, test, beforeEach} from '@jest/globals';
import {NARHyper} from '../NARHyper.js';
import {id} from '../support/utils.js';
import {Budget} from '../support/Budget.js';
import {TruthValue} from '../support/TruthValue.js';

describe('AdvancedLearningEngine', () => {
    let nar;
    let learningEngine;

    beforeEach(() => {
        nar = new NARHyper();
        learningEngine = nar.learningEngine;
    });

    test('should reinforce premises of a successful outcome', () => {
        const premiseId = nar.api.inheritance('A', 'B', { truth: new TruthValue(0.8, 0.8) });
        const actionId = nar.api.inheritance('A', 'C', { premises: [premiseId] });

        const initialConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;

        learningEngine.recordExperience(actionId, { success: true });

        const finalConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;
        expect(finalConfidence).toBeGreaterThan(initialConfidence);
    });

    test('should weaken premises of a failed outcome', () => {
        const premiseId = nar.api.inheritance('X', 'Y', { truth: new TruthValue(0.8, 0.8) });
        const actionId = nar.api.inheritance('X', 'Z', { premises: [premiseId] });

        const initialConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;

        learningEngine.recordExperience(actionId, { success: false });

        const finalConfidence = nar.state.hypergraph.get(premiseId).getTruth().confidence;
        expect(finalConfidence).toBeLessThan(initialConfidence);
    });

    test('should update rule productivity stats', () => {
        // Setup a derivation
        const premiseId = nar.api.inheritance('bird', 'animal', { derivedBy: 'direct_assertion' });
        const actionId = nar.api.inheritance('tweety', 'animal', { premises: [premiseId], derivedBy: 'transitivity' });

        // Record a successful outcome
        learningEngine.recordExperience(actionId, { success: true });

        const transitivityStats = learningEngine.getRuleProductivityStats().get('transitivity');
        expect(transitivityStats).toBeDefined();
        expect(transitivityStats.successes).toBe(1);
        expect(transitivityStats.attempts).toBe(1);

        // Record a failed outcome
        const action2Id = nar.api.inheritance('penguin', 'flyer', { premises: [premiseId], derivedBy: 'transitivity' });
        learningEngine.recordExperience(action2Id, { success: false });

        const updatedTransitivityStats = learningEngine.getRuleProductivityStats().get('transitivity');
        expect(updatedTransitivityStats.successes).toBe(1);
        expect(updatedTransitivityStats.attempts).toBe(2);
    });

    test('should create a shortcut rule from a frequently successful reasoning path', () => {
        // This test is adapted from the original to use the new API
        const premise1Id = nar.api.implication('A', 'B');
        const premise2Id = nar.api.implication('B', 'C');
        // Manually create a "conclusion" that depends on these premises for the test
        const conclusionId = nar.api.term('C', { premises: [premise1Id, premise2Id] });

        // Simulate the path being successful multiple times via experiences
        for (let i = 0; i < 10; i++) {
            learningEngine.experienceBuffer.push({
                premises: [premise1Id, premise2Id],
                conclusion: conclusionId,
                success: true,
                accuracy: 0.95
            });
        }

        // Trigger the learning process that discovers patterns
        learningEngine.applyLearning();

        // Assert that the shortcut rule was created
        const conjunctionId = id('Conjunction', [premise1Id, premise2Id]);
        const shortcutRuleId = id('Implication', [conjunctionId, conclusionId]);
        const shortcutRule = nar.state.hypergraph.get(shortcutRuleId);

        expect(shortcutRule).toBeDefined();
        expect(shortcutRule.type).toBe('Implication');
        expect(shortcutRule.getTruth().confidence).toBeGreaterThan(0.8);
    });

    test('should create an ActionConsequence mapping from an outcome', () => {
        const actionId = nar.api.term('press_button');
        const consequenceId = nar.api.term('light_turns_on');

        learningEngine.recordExperience(actionId, { success: true, consequence: consequenceId });

        const mappingId = id('ActionConsequence', [actionId, consequenceId]);
        const mappingHyperedge = nar.state.hypergraph.get(mappingId);

        expect(mappingHyperedge).toBeDefined();
        expect(mappingHyperedge.type).toBe('ActionConsequence');
        expect(mappingHyperedge.getTruth().frequency).toBeGreaterThan(0.7);
    });
});
