import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {AdvancedLearningEngine} from './AdvancedLearningEngine.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {id} from '../support/utils.js';

// Mock NAR system
const mockNar = {
    state: {
        hypergraph: new Map(),
        currentStep: 0,
    },
    api: {
        addHyperedge: jest.fn(),
        implication: jest.fn(),
        inheritance: jest.fn(),
    },
    derivationEngine: {
        rules: new Map(),
        evaluateRules: jest.fn(),
    },
    metaReasoner: {
        updateStrategyEffectiveness: jest.fn(),
    },
    config: {
        advancedLearningEngine: {
            experienceBufferMaxSize: 10,
            significantExperienceAccuracyThreshold: 0.2,
            failureAnalysisAccuracyThreshold: 0.3,
            reinforcementAccuracyThreshold: 0.8,
            learningRate: 0.1,
            ruleProductivityMinAttempts: 5,
            ruleDisableEffectivenessThreshold: 0.1,
            ruleEnableEffectivenessThreshold: 0.4,
            patternMinInstances: 3,
            patternSuccessRateThreshold: 0.8,
            conceptFormationMinInstances: 3,
        },
    },
    emit: jest.fn(),
};

// Helper to create a mock hyperedge
const createMockHyperedge = (edgeId, type, args, truth = new TruthValue(0.9, 0.9), budget = new Budget({}), premises = [], derivedBy = null) => {
    const edge = new Hyperedge(type, args, {truth, budget, premises, derivedBy});
    edge.id = edgeId;
    // Mock getStrongestBelief to return the main belief
    edge.getStrongestBelief = jest.fn().mockReturnValue({truth, budget, premises, derivedBy});
    mockNar.state.hypergraph.set(edgeId, edge);
    return edge;
};

describe('AdvancedLearningEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new AdvancedLearningEngine(mockNar, mockNar.config.advancedLearningEngine);

        jest.clearAllMocks();
        mockNar.state.hypergraph.clear();
        mockNar.derivationEngine.rules.clear();
        engine.experienceBuffer = [];
        engine.patternMemory.clear();
        engine.ruleAdaptor.ruleProductivity.clear();
    });

    describe('Experience Handling', () => {
        it('should record an experience and add it to the buffer', () => {
            engine.recordExperience({context: 'test'}, {success: true});
            expect(engine.experienceBuffer.length).toBe(1);
            // The first argument is stored as the 'context' property. The test passes {context: 'test'}.
            // So the assertion needs to check experience.context.context.
            expect(engine.experienceBuffer[0].context.context).toBe('test');
        });

        it('should prune the experience buffer when it exceeds max size', () => {
            // The config is copied at instantiation, so we need to modify it on the engine directly.
            engine.config.experienceBufferMaxSize = 5;
            for (let i = 0; i < 10; i++) {
                engine.recordExperience({context: `test${i}`}, {success: true});
            }
            expect(engine.experienceBuffer.length).toBe(5);
            expect(engine.experienceBuffer[0].context.context).toBe('test5');
        });

        it('should process significant experiences based on accuracy', () => {
            const spyAnalyze = jest.spyOn(engine, '_analyzeFailure');
            const spyReinforce = jest.spyOn(engine, '_reinforcePattern');

            // Failure
            engine.recordExperience({}, {accuracy: 0.1});
            expect(spyAnalyze).toHaveBeenCalled();

            // Reinforcement
            engine.recordExperience({}, {accuracy: 0.9});
            expect(spyReinforce).toHaveBeenCalled();

            spyAnalyze.mockRestore();
            spyReinforce.mockRestore();
        });
    });

    describe('Learning Mechanisms', () => {
        it('should analyze failure and penalize the responsible rule and premise', () => {
            const premiseEdge = createMockHyperedge('premise1', 'Term', ['A'], new TruthValue(0.8, 0.8), new Budget({}), [], 'Initial');
            const derivationPath = [
                {id: 'conclusion', derivedBy: 'TestRule'},
                {id: 'premise1', derivedBy: 'Initial'}
            ];
            const experience = {derivationPath, outcome: {accuracy: 0.1}};

            engine._analyzeFailure(experience);

            expect(engine.ruleAdaptor.ruleProductivity.get('TestRule').successes).toBe(0);
            expect(engine.ruleAdaptor.ruleProductivity.get('TestRule').attempts).toBe(1);
            expect(premiseEdge.getStrongestBelief().truth.confidence).toBeLessThan(0.8);
        });

        it('should reinforce patterns and boost confidence for success', () => {
            const premiseEdge = createMockHyperedge('premise1', 'Term', ['A'], new TruthValue(0.8, 0.8));
            const derivationPath = [{id: 'premise1'}];
            const experience = {derivationPath, outcome: {accuracy: 0.9}};

            engine._reinforcePattern(experience);
            expect(premiseEdge.getStrongestBelief().truth.confidence).toBeGreaterThan(0.8);
        });

        it('should learn action-consequence mappings', () => {
            engine._learnActionConsequence('action1', 'consequence1', true);
            const expectedId = id('ActionConsequence', ['action1', 'consequence1']);
            expect(mockNar.api.addHyperedge).toHaveBeenCalledWith(
                'ActionConsequence',
                ['action1', 'consequence1'],
                expect.any(Object)
            );
        });
    });

    describe('Rule Adaptation', () => {
        it('should disable a rule if its effectiveness is below the threshold', () => {
            mockNar.derivationEngine.rules.set('BadRule', {enabled: true});
            engine.ruleAdaptor.ruleProductivity.set('BadRule', {successes: 0, attempts: 10});

            engine.ruleAdaptor.adaptDerivationRules();

            expect(mockNar.derivationEngine.rules.get('BadRule').enabled).toBe(false);
            expect(mockNar.emit).toHaveBeenCalledWith('rule-disabled', expect.any(Object));
        });

        it('should re-enable a rule if its effectiveness improves', () => {
            mockNar.derivationEngine.rules.set('GoodRule', {enabled: false});
            engine.ruleAdaptor.ruleProductivity.set('GoodRule', {successes: 8, attempts: 10});

            engine.ruleAdaptor.adaptDerivationRules();

            expect(mockNar.derivationEngine.rules.get('GoodRule').enabled).toBe(true);
            expect(mockNar.emit).toHaveBeenCalledWith('rule-enabled', expect.any(Object));
        });
    });

    describe('Pattern Discovery and Concept Formation', () => {
        beforeEach(() => {
            createMockHyperedge('p1', 'Inheritance', ['A', 'B']);
            createMockHyperedge('p2', 'Inheritance', ['B', 'C']);
            createMockHyperedge('c1', 'Inheritance', ['A', 'C']);
        });

        it('should discover patterns from successful experiences', () => {
            const experienceData = {success: true, premises: ['p1', 'p2'], conclusion: 'c1'};
            // Pass experience-specific data via the `options` parameter so it becomes
            // top-level properties on the experience object, which _discoverPatterns expects.
            engine.recordExperience({/* no context */}, {success: true}, experienceData);

            engine.patternMiner.discoverPatterns();

            const signature = 'Inheritance,Inheritance=>Inheritance';
            expect(engine.patternMemory.has(signature)).toBe(true);
            expect(engine.patternMemory.get(signature).totalCount).toBe(1);
        });

        it('should create a shortcut rule from a successful pattern', () => {
            const signature = 'Inheritance,Inheritance=>Inheritance';
            engine.patternMemory.set(signature, {
                instances: [{premises: ['p1', 'p2'], conclusion: 'c1'}],
                successCount: 4,
                totalCount: 4
            });

            engine.patternMiner.createRulesFromPatterns();

            const expectedPremiseId = id('Conjunction', ['p1', 'p2']);
            expect(mockNar.api.implication).toHaveBeenCalledWith(expectedPremiseId, 'c1', expect.any(Object));
            expect(mockNar.emit).toHaveBeenCalledWith('shortcut-created', expect.any(Object));
        });

        it('should form a new concept from a frequent pattern', () => {
            const signature = 'TypeA,TypeB=>TypeC';
            engine.patternMemory.set(signature, {
                totalCount: 5,
                successCount: 4,
            });
            jest.spyOn(engine.conceptFormer, '_getTermsFromSignature').mockReturnValue(['TypeA', 'TypeB']);

            engine.conceptFormer.formNewConcepts();

            const conceptId = id('Concept', ['TypeA', 'TypeB']);
            expect(mockNar.api.addHyperedge).toHaveBeenCalledWith('Concept', ['TypeA', 'TypeB'], expect.any(Object));
            expect(mockNar.api.inheritance).toHaveBeenCalledWith(conceptId, 'TypeA', expect.any(Object));
            expect(mockNar.api.inheritance).toHaveBeenCalledWith(conceptId, 'TypeB', expect.any(Object));
            expect(mockNar.emit).toHaveBeenCalledWith('concept-formed', expect.any(Object));
        });
    });
});
