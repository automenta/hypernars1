import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { id } from '../support/utils.js';

import { Budget } from '../support/Budget.js';
import { TruthValue } from '../support/TruthValue.js';

describe('LearningEngine', () => {
    it('should create a shortcut rule from a frequently successful reasoning path', () => {
        const nar = new NARHyper();
        const learningEngine = nar.learningEngine;

        // 1. Setup a reasoning chain: A -> B, B -> C
        const premise1Id = nar.api.addHyperedge('Implication', ['A', 'B']);
        const premise2Id = nar.api.addHyperedge('Implication', ['B', 'C']);
        const conclusionId = nar.api.addHyperedge('Term', ['C'], {
            premises: [premise1Id, premise2Id] // Manually set premises for the test
        });

        // 2. Simulate the path being successful multiple times
        const experience = {
            target: conclusionId,
            derivationPath: [premise1Id, premise2Id],
            premises: [premise1Id, premise2Id],
            conclusion: conclusionId,
            budget: new Budget(0.9, 0.9, 0.9),
        };

        for (let i = 0; i < 10; i++) {
            learningEngine.recordExperience(experience, { success: true, accuracy: 0.95 });
        }

        // 3. Trigger the learning process
        learningEngine.applyLearning();

        // 4. Assert that the shortcut rule was created
        const conjunctionId = nar.api.conjunction(premise1Id, premise2Id);
        const shortcutRuleId = id('Implication', [conjunctionId, conclusionId]);

        const shortcutRule = nar.state.hypergraph.get(shortcutRuleId);

        expect(shortcutRule).toBeDefined();
        expect(shortcutRule.type).toBe('Implication');
        expect(shortcutRule.getTruth().confidence).toBeGreaterThan(0.8);
    });
});
