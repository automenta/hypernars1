import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {AdvancedDerivationEngine} from './AdvancedDerivationEngine.js';
import {TruthValue} from '../support/TruthValue.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {Budget} from "../support/Budget.js";
import {id as generateId} from "../support/utils.js";

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
        inheritance: jest.fn((...args) => {
            // Forward to addHyperedge to simulate creation
            mockNar.api.addHyperedge('Inheritance', args.slice(0, 2), args[2]);
        }),
        similarity: jest.fn(),
        implication: jest.fn(),
        addHyperedge: jest.fn((type, args, options) => {
            // Use the real ID generator to ensure consistency
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
        parse: jest.fn(str => ({type: 'Inheritance', args: str.split('->')})),
    },
    config: {
        inferenceThreshold: 0.1,
        maxDerivationDepth: 10,
    },
};

// Helper to create a mock hyperedge
const createMockHyperedge = (id, type, args, truth = new TruthValue(0.9, 0.9)) => {
    const edge = new Hyperedge(mockNar, id, type, args);
    edge.revise({truth: truth, budget: new Budget({})}); // Add a belief
    mockNar.state.hypergraph.set(id, edge); // Set by custom test ID

    // ALSO set by the official generated ID so lookups will work
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

describe('AdvancedDerivationEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new AdvancedDerivationEngine(mockNar);

        // Clear all mocks and state before each test
        jest.clearAllMocks();
        mockNar.state.hypergraph.clear();
        mockNar.state.index.byArg.clear();
        mockNar.state.index.derivationCache.clear();
        mockNar.state.memoization.clear();
        mockNar.learningEngine.getRuleProductivityStats.mockReturnValue(new Map());
    });

    describe('Rule Management', () => {
        it('should register a new rule with default values', () => {
            engine.registerRule('TestRule', () => true, () => {
            });
            const rule = engine.rules.get('TestRule');
            expect(rule).toBeDefined();
            expect(rule.priority).toBe(0.5);
            expect(rule.applicability).toBe(0.5);
            expect(rule.successRate).toBe(0.5);
        });

        it('should register a new rule with custom options', () => {
            engine.registerRule('TestRuleWithOptions', () => true, () => {
            }, {
                priority: 0.8,
                applicability: 0.7,
                successRate: 0.9
            });
            const rule = engine.rules.get('TestRuleWithOptions');
            expect(rule.priority).toBe(0.8);
            expect(rule.applicability).toBe(0.7);
            expect(rule.successRate).toBe(0.9);
        });

        it('should sort rules by priority after registration', () => {
            engine.registerRule('LowPriorityRule', () => true, () => {
            }, {priority: 0.2});
            engine.registerRule('HighPriorityRule', () => true, () => {
            }, {priority: 0.8});
            const ruleNames = [...engine.rules.keys()];
            // High priority rule (0.8) should be first
            expect(ruleNames[0]).toBe('HighPriorityRule');
            // Low priority rule (0.2) should be last, after all default 0.5 rules
            expect(ruleNames[ruleNames.length - 1]).toBe('LowPriorityRule');
        });

        it('should evaluate and update rule priorities based on productivity stats', () => {
            engine.registerRule('ProductiveRule', () => true, () => {
            }, {priority: 0.5, applicability: 0.5});
            engine.registerRule('UnproductiveRule', () => true, () => {
            }, {priority: 0.5, applicability: 0.5});

            const stats = new Map([
                ['ProductiveRule', {successes: 8, attempts: 10}],
                ['UnproductiveRule', {successes: 1, attempts: 10}],
            ]);
            mockNar.learningEngine.getRuleProductivityStats.mockReturnValue(stats);

            engine.evaluateRules();

            const productiveRule = engine.rules.get('ProductiveRule');
            const unproductiveRule = engine.rules.get('UnproductiveRule');

            // successRate = 0.5 * 0.9 + (8/10) * 0.1 = 0.45 + 0.08 = 0.53
            // priority = 0.53 * 0.7 + 0.5 * 0.3 = 0.371 + 0.15 = 0.521
            expect(productiveRule.successRate).toBeCloseTo(0.53);
            expect(productiveRule.priority).toBeCloseTo(0.521);

            // successRate = 0.5 * 0.9 + (1/10) * 0.1 = 0.45 + 0.01 = 0.46
            // priority = 0.46 * 0.7 + 0.5 * 0.3 = 0.322 + 0.15 = 0.472
            expect(unproductiveRule.successRate).toBeCloseTo(0.46);
            expect(unproductiveRule.priority).toBeCloseTo(0.472);
        });

        it('should boost a rule success rate', () => {
            engine.registerRule('BoostTest', () => true, () => {
            }, {successRate: 0.5});
            engine.boostRuleSuccessRate('BoostTest', 0.2);
            expect(engine.rules.get('BoostTest').successRate).toBe(0.5 * 0.8 + 1 * 0.2); // 0.4 + 0.2 = 0.6
        });

        it('should penalize a rule success rate', () => {
            engine.registerRule('PenalizeTest', () => true, () => {
            }, {successRate: 0.5});
            engine.penalizeRuleSuccessRate('PenalizeTest', 0.2);
            expect(engine.rules.get('PenalizeTest').successRate).toBe(0.5 * 0.8 + 0 * 0.2); // 0.4
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
            engine._deriveInheritance(h1, event, 'Inheritance');

            expect(mockNar.api.addHyperedge).toHaveBeenCalledWith('Inheritance', ['A', 'C'], expect.any(Object));
        });

        it('should derive analogy (X~Y, X->P => Y->P)', () => {
            const h_sim = createMockHyperedge('h_sim', 'Similarity', ['X', 'Y']);
            const h_inh = createMockHyperedge('h_inh', 'Inheritance', ['X', 'P']);

            const event = {target: 'h_sim', budget: {scale: jest.fn().mockReturnThis()}, pathLength: 1};
            engine._deriveSimilarity(h_sim, event, 'Similarity');

            expect(mockNar.api.inheritance).toHaveBeenCalledWith('Y', 'P', expect.any(Object));
        });

        it('should derive implication (A=>B, A => B)', () => {
            const h_imp = createMockHyperedge('h_imp', 'Implication', ['A', 'B']);
            createMockHyperedge('A', 'Term', ['A']); // Premise exists

            const event = {
                target: 'h_imp',
                activation: 0.9,
                budget: {scale: jest.fn().mockReturnThis()},
                pathHash: 123,
                pathLength: 1,
                derivationPath: []
            };
            engine._deriveImplication(h_imp, event, 'Implication');

            expect(mockNar.propagation.propagate).toHaveBeenCalledWith(expect.objectContaining({
                target: 'B'
            }));
        });

        it('should derive equivalence (A<=>B => A=>B and B=>A)', () => {
            const h_equiv = createMockHyperedge('h_equiv', 'Equivalence', ['A', 'B']);

            const event = {hyperedge: h_equiv, budget: {scale: jest.fn().mockReturnThis()}};
            engine._deriveEquivalence(h_equiv, event, 'Equivalence');

            expect(mockNar.api.implication).toHaveBeenCalledWith('A', 'B', expect.any(Object));
            expect(mockNar.api.implication).toHaveBeenCalledWith('B', 'A', expect.any(Object));
        });
    });

});
