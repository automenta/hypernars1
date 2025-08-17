import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {AdvancedDerivationEngine} from './AdvancedDerivationEngine.js';
import {TruthValue} from '../support/TruthValue.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {Budget} from "../support/Budget.js";
import {id as generateId} from "../support/utils.js";
import {DerivationRuleBase} from "./derivation-rules/DerivationRuleBase.js";

// Mock NAR system and its components
const mockNar = {
    state: {
        hypergraph: new Map(),
        index: {
            byArg: new Map(),
            derivationCache: new Map(),
        },
        memoization: new Map(),
    },
    api: {
        TruthValue: TruthValue,
        inheritance: jest.fn((...args) => {
            mockNar.api.addHyperedge('Inheritance', args.slice(0, 2), args[2]);
        }),
        similarity: jest.fn(),
        implication: jest.fn(),
        addHyperedge: jest.fn((type, args, options) => {
            const id = generateId(type, args);
            createMockHyperedge(id, type, args, options?.truth);
        }),
    },
    propagation: {
        propagate: jest.fn(),
    },
    cognitiveExecutive: {
        getRulePriority: jest.fn().mockReturnValue(1.0),
        monitorDerivation: jest.fn(),
    },
    learningEngine: {
        getRuleProductivityStats: jest.fn().mockReturnValue(new Map()),
    },
    questionHandler: {
        checkQuestionAnswers: jest.fn(),
    },
    expressionEvaluator: {
        parse: jest.fn(str => {
            if (str.includes('->')) {
                return {type: 'Inheritance', args: str.split('->')};
            }
            return {type: 'Term', args: [str]};
        }),
    },
    config: {
        inferenceThreshold: 0.1,
        maxDerivationDepth: 10,
    },
};

// Helper to create a mock hyperedge
const createMockHyperedge = (id, type, args, truth = new TruthValue(0.9, 0.9)) => {
    const edge = new Hyperedge(mockNar, id, type, args);
    edge.revise({truth: truth, budget: new Budget({})});
    mockNar.state.hypergraph.set(id, edge);
    const officialId = generateId(type, args);
    if (id !== officialId) {
        mockNar.state.hypergraph.set(officialId, edge);
    }
    args.forEach(arg => {
        const argId = arg.id || arg;
        if (!mockNar.state.index.byArg.has(argId)) {
            mockNar.state.index.byArg.set(argId, new Set());
        }
        mockNar.state.index.byArg.get(argId).add(id);
        mockNar.state.index.byArg.get(argId).add(officialId);
    });
    return edge;
};

// Mock Rule class for testing registration
class MockRule extends DerivationRuleBase {
    constructor(nar, config, name, options = {}) {
        super(nar, config, name, () => true);
        this.priority = options.priority || 0.5;
        this.applicability = options.applicability || 0.5;
        this.successRate = options.successRate || 0.5;
    }

    execute(hyperedge, event, ruleName) { /* no-op */
    }
}


describe('AdvancedDerivationEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new AdvancedDerivationEngine(mockNar);
        mockNar.derivationEngine = engine;
        jest.clearAllMocks();
        mockNar.state.hypergraph.clear();
        mockNar.state.index.byArg.clear();
        mockNar.state.index.derivationCache.clear();
        mockNar.state.memoization.clear();
        mockNar.learningEngine.getRuleProductivityStats.mockReturnValue(new Map());
    });

    describe('Rule Management', () => {
        it('should register a new rule with default values', () => {
            const rule = new MockRule(mockNar, engine.config, 'TestRule');
            engine.registerRule(rule);
            const registeredRule = engine.rules.get('TestRule');
            expect(registeredRule).toBeDefined();
            expect(registeredRule.priority).toBe(0.5);
            expect(registeredRule.applicability).toBe(0.5);
            expect(registeredRule.successRate).toBe(0.5);
        });

        it('should register a new rule with custom options', () => {
            const rule = new MockRule(mockNar, engine.config, 'TestRuleWithOptions', {
                priority: 0.8,
                applicability: 0.7,
                successRate: 0.9
            });
            engine.registerRule(rule);
            const registeredRule = engine.rules.get('TestRuleWithOptions');
            expect(registeredRule.priority).toBe(0.8);
            expect(registeredRule.applicability).toBe(0.7);
            expect(registeredRule.successRate).toBe(0.9);
        });

        it('should sort rules by priority after registration', () => {
            engine.registerRule(new MockRule(mockNar, engine.config, 'LowPriorityRule', {priority: 0.2}));
            engine.registerRule(new MockRule(mockNar, engine.config, 'HighPriorityRule', {priority: 0.8}));
            const ruleNames = [...engine.rules.keys()];
            const highPriorityRuleIndex = ruleNames.findIndex(name => name === 'HighPriorityRule');
            expect(highPriorityRuleIndex).toBeLessThan(ruleNames.length - 1);
        });

        it('should evaluate and update rule priorities based on productivity stats', () => {
            engine.rules.set('ProductiveRule', new MockRule(mockNar, engine.config, 'ProductiveRule'));
            engine.rules.set('UnproductiveRule', new MockRule(mockNar, engine.config, 'UnproductiveRule'));

            const stats = new Map([
                ['ProductiveRule', {successes: 8, attempts: 10}],
                ['UnproductiveRule', {successes: 1, attempts: 10}],
            ]);
            mockNar.learningEngine.getRuleProductivityStats.mockReturnValue(stats);
            engine.evaluateRules();

            const productiveRule = engine.rules.get('ProductiveRule');
            const unproductiveRule = engine.rules.get('UnproductiveRule');

            expect(productiveRule.priority).toBeGreaterThan(unproductiveRule.priority);
        });

        it('should boost a rule success rate', () => {
            const rule = new MockRule(mockNar, engine.config, 'BoostTest', {successRate: 0.5});
            engine.registerRule(rule);
            engine.boostRuleSuccessRate('BoostTest', 0.2);
            expect(engine.rules.get('BoostTest').successRate).toBe(0.5 * 0.8 + 1 * 0.2);
        });

        it('should penalize a rule success rate', () => {
            const rule = new MockRule(mockNar, engine.config, 'PenalizeTest', {successRate: 0.5});
            engine.registerRule(rule);
            engine.penalizeRuleSuccessRate('PenalizeTest', 0.2);
            expect(engine.rules.get('PenalizeTest').successRate).toBe(0.5 * 0.8 + 0 * 0.2);
        });
    });

    describe('Derivation Logic', () => {
        it('should derive transitive inheritance (A->B, B->C => A->C)', () => {
            const h1 = createMockHyperedge('h1', 'Inheritance', ['A', 'B']);
            createMockHyperedge('h2', 'Inheritance', ['B', 'C']);
            const event = {
                target: generateId('Inheritance', ['A', 'B']),
                budget: {scale: jest.fn().mockReturnThis()},
                pathLength: 1
            };
            const rule = engine.rules.get('Inheritance');
            rule.execute(h1, event, 'Inheritance');
            expect(mockNar.api.addHyperedge).toHaveBeenCalledWith('Inheritance', ['A', 'C'], expect.any(Object));
        });

        it('should derive analogy (X~Y, X->P => Y->P)', () => {
            const h_sim = createMockHyperedge('h_sim', 'Similarity', ['X', 'Y']);
            createMockHyperedge('h_inh', 'Inheritance', ['X', 'P']);
            const event = {target: 'h_sim', budget: {scale: jest.fn().mockReturnThis()}, pathLength: 1};
            const rule = engine.rules.get('Similarity');
            rule.execute(h_sim, event, 'Similarity');
            expect(mockNar.api.inheritance).toHaveBeenCalledWith('Y', 'P', expect.any(Object));
        });

        it('should derive implication (A=>B, A => B)', () => {
            const h_imp = createMockHyperedge('h_imp', 'Implication', ['A', 'B']);
            createMockHyperedge('A', 'Term', ['A']);
            const event = {
                target: 'h_imp',
                activation: 0.9,
                budget: {scale: jest.fn().mockReturnThis()},
                pathHash: 123,
                pathLength: 1,
                derivationPath: []
            };
            const rule = engine.rules.get('Implication');
            rule.execute(h_imp, event, 'Implication');
            expect(mockNar.propagation.propagate).toHaveBeenCalledWith(expect.objectContaining({target: 'Term(B)'}));
        });

        it('should derive equivalence (A<=>B => A=>B and B=>A)', () => {
            const h_equiv = createMockHyperedge('h_equiv', 'Equivalence', ['A', 'B']);
            const event = {hyperedge: h_equiv, budget: {scale: jest.fn().mockReturnThis()}};
            const rule = engine.rules.get('Equivalence');
            rule.execute(h_equiv, event, 'Equivalence');
            expect(mockNar.api.implication).toHaveBeenCalledWith('A', 'B', expect.any(Object));
            expect(mockNar.api.implication).toHaveBeenCalledWith('B', 'A', expect.any(Object));
        });
    });
});
